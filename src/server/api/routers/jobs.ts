import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { jobs } from "@/server/db/schema";
import logger from "@/logging/logger";
import {
  connectToAmqp,
  handleFiles,
  setupDirectories,
  templateScript,
  validateFileId,
  validateJobType,
} from "@/server/helpers/jobsHelper";

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
});
