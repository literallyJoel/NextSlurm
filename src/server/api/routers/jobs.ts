import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  jobTypes,
  jobs,
  organisationMembers,
  sharedJobs,
  users,
} from "@/server/db/schema";
import logger from "@/logging/logger";
import {
  connectToAmqp,
  handleFiles,
  setupDirectories,
  templateScript,
  validateFileId,
  validateJobType,
} from "@/server/helpers/jobsHelper";
import { and, desc, eq, exists, or } from "drizzle-orm";

export const jobsRouter = createTRPCRouter({
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        jobTypeId: z.string().uuid(),
        fileId: z.string().uuid().optional(),
        parameters: z
          .array(
            z.object({
              key: z.string(),
              value: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { name, jobTypeId, fileId, parameters } = input;

      if (
        !(await validateFileId({ fileId: fileId, userId: ctx.session.user.id }))
      ) {
        logger.warn(`Invalid FileId provided: ${fileId}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid FileId provided",
        });
      }

      const jobType = await validateJobType({
        jobTypeId: input.jobTypeId,
        userId: ctx.session.user.id,
        role: ctx.session.user.role,
      });

      switch (jobType) {
        case false:
          logger.warn(
            `User ${ctx.session.user.id} unauthorized for job type ${input.jobTypeId}`,
          );
          throw new TRPCError({ code: "UNAUTHORIZED" });
        case undefined:
          logger.warn(`Invalid job type: ${input.jobTypeId}`);
          throw new TRPCError({
            code: "BAD_REQUEST",
          });
        default:
          break;
      }

      return await ctx.db.transaction(async (tx) => {
        const job = (
          await tx
            .insert(jobs)
            .values({
              name,
              jobTypeId,
              fileId,
              createdBy: ctx.session.user.id,
            })
            .returning({
              id: jobs.id,
              name: jobs.createdBy,
              jobTypeId: jobs.jobTypeId,
              fileId: jobs.fileId,
              createdBy: jobs.createdBy,
              authCode: jobs.authCode,
            })
        )[0];

        if (!job) {
          logger.error("Failed to create job record");
          tx.rollback();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to create Job. Try again later.",
          });
        }

        logger.info(`Job created: ${job.id}`);

        const directories = await setupDirectories({
          jobId: job.id,
          userId: ctx.session.user.id,
        });

        const handleFilesResult = await handleFiles({
          hasFileUpload: jobType.hasFileUpload,
          arrayJob: jobType.arrayJob,
          directories: directories,
        });
        if (handleFilesResult instanceof Error) {
          logger.error("Failed to handle files", { cause: handleFilesResult });
          tx.rollback();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to handle files. Try again later.",
            cause: handleFilesResult,
          });
        }

        const scriptPath = await templateScript({
          script: jobType.script,
          parameters: parameters,
          arrayJob: jobType.arrayJob,
          directories: directories,
          job: job,
        });

        try {
          const jobData = {
            jobId: job.id,
            scriptPath: scriptPath,
            directories,
            authCode: job.authCode,
          };

          const { connection, channel } = await connectToAmqp();

          channel.sendToQueue(
            "slurmJob",
            Buffer.from(JSON.stringify(jobData)),
            {
              persistent: true,
            },
          );

          logger.info(`Job queued: ${job.id}`);
          setTimeout(async () => {
            await connection.close();
          }, 500);
        } catch (e) {
          logger.error("Failed to queue job", { cause: e });
          tx.rollback();
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to queue job. Please try again later.",
            cause: e,
          });
        }
      });
    }),
  get: protectedProcedure
    .input(z.object({ jobId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.db.query.jobs.findFirst({
        where: (jobs, { eq }) => eq(jobs.id, input.jobId),
      });

      if (!job) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Job not found",
        });
      }

      if (job.createdBy !== ctx.session.user.id) {
        const organisationMemberships =
          await ctx.db.query.organisationMembers.findMany({
            where: (organisationMembers, { eq }) =>
              eq(organisationMembers.userId, ctx.session.user.id),
          });

        const jobShares = await ctx.db.query.sharedJobs.findFirst({
          where: (sharedJobs, { eq, or, and, inArray }) =>
            and(
              eq(sharedJobs.jobId, job.id),
              or(
                inArray(
                  sharedJobs.organisationId,
                  organisationMemberships.map((m) => m.organisationId),
                ),
                eq(sharedJobs.userId, ctx.session.user.id),
              ),
            ),
        });

        if (!jobShares) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
          });
        }
      }
      return job;
    }),
  getAll: protectedProcedure
    .input(
      z.object({
        all: z.boolean().optional(),
        filter: z
          .union([
            z.literal("running"),
            z.literal("completed"),
            z.literal("failed"),
            z.literal("queued"),
          ])
          .optional(),
        number: z.number().min(1).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { db } = ctx;
      const userId = ctx.session.user.id;

      // For global admins, if the input is true then we return all jobs
      if (ctx.session.user.role === 1 && input.all === true) {
        return (
          await db.query.jobs.findMany({
            with: {
              createdBy: { columns: { name: true, id: true } },
              jobType: { columns: { name: true, id: true } },
            },
          })
        ).map((r) => ({
          ...r,
          authCode: undefined,
        }));
      }

      const query = db
        .select({
          job: jobs,
          createdBy: {
            name: users.name,
            id: users.id,
          },
          jobType: {
            name: jobTypes.name,
            id: jobTypes.id,
          },
        })
        .from(jobs)
        .leftJoin(users, eq(jobs.createdBy, users.id))
        .leftJoin(jobTypes, eq(jobs.jobTypeId, jobTypes.id))
        .where(
          and(
            or(
              // Jobs created by the user
              eq(jobs.createdBy, userId),
              // Jobs shared directly with the user
              exists(
                db
                  .select()
                  .from(sharedJobs)
                  .where(
                    and(
                      eq(sharedJobs.jobId, jobs.id),
                      eq(sharedJobs.userId, userId),
                    ),
                  ),
              ),
              // Jobs shared with organizations the user is a member of
              exists(
                db
                  .select()
                  .from(sharedJobs)
                  .innerJoin(
                    organisationMembers,
                    and(
                      eq(
                        sharedJobs.organisationId,
                        organisationMembers.organisationId,
                      ),
                      eq(organisationMembers.userId, userId),
                    ),
                  )
                  .where(eq(sharedJobs.jobId, jobs.id)),
              ),
            ),
            input.filter ? eq(jobs.status, input.filter) : undefined,
          ),
        );

      // Apply ordering and limit
      query.orderBy(desc(jobs.startTime)).limit(input.number ?? 1000);

      const results = await query;

      return results.map((r) => ({
        ...r.job,
        createdBy: r.createdBy,
        jobType: r.jobType,
        authCode: undefined,
      }));
    }),
});
