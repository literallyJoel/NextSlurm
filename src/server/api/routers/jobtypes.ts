import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  jobTypeParameters,
  jobTypes,
  sharedJobTypes,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";
import logger from "@/logging/logger";

export const jobTypesRouter = createTRPCRouter({
  get: protectedProcedure
    .input(
      z.union([
        z.object({ id: z.string().uuid(), createdBy: z.undefined() }),
        z.object({ id: z.undefined(), createdBy: z.string().uuid() }),
      ]),
    )
    .output(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        description: z.string(),
        script: z.string(),
        hasFileUpload: z.boolean(),
        arrayJob: z.boolean(),
        createdBy: z.object({ id: z.string().uuid(), name: z.string() }),
        parameters: z.array(
          z.object({
            name: z.string(),
            type: z.string(),
            defaultValue: z.string().nullable(),
          }),
        ),
      }),
    )
    .query(async ({ ctx, input }) => {
      let jobType;
      if (input.id) {
        logger.info(`Fetching job type by ID: ${input.id}`);
        jobType = await ctx.db.query.jobTypes.findFirst({
          where: (jobTypes, { eq }) => eq(jobTypes.id, input.id),
          with: {
            parameters: true,
            createdBy: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        });
      } else {
        logger.info(`Fetching job type by createdBy: ${input.createdBy}`);
        jobType = await ctx.db.query.jobTypes.findFirst({
          where: (jobTypes, { eq }) => eq(jobTypes.createdBy, input.createdBy!),
          with: {
            parameters: true,
            createdBy: {
              columns: {
                id: true,
                name: true,
              },
            },
          },
        });
      }

      if (!jobType) {
        logger.warn(`Job type not found for input: ${JSON.stringify(input)}`);
        throw new TRPCError({ code: "BAD_REQUEST" });
      }

      if (
        jobType.createdBy.id !== ctx.session.user.id &&
        ctx.session.user.role !== 1
      ) {
        logger.info(
          `Checking access for user ${ctx.session.user.id} to job type ${jobType.id}`,
        );
        const requestorOrgs = await ctx.db.query.organisationMembers.findMany({
          where: (organisationMembers, { eq }) =>
            eq(organisationMembers.userId, ctx.session.user.id),
        });

        const _jt = await ctx.db.query.sharedJobTypes.findFirst({
          where: (sharedJobTypes, { eq, and, or, inArray }) =>
            and(
              eq(sharedJobTypes.jobTypeId, jobType.id),
              or(
                inArray(
                  sharedJobTypes.organisationId,
                  requestorOrgs.map((org) => org.organisationId),
                ),
                eq(sharedJobTypes.userId, ctx.session.user.id),
              ),
            ),
        });

        if (!_jt) {
          logger.warn(
            `Unauthorized attempt to access job type with id ${jobType.id} by user with id ${ctx.session.user.id}`,
          );
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      logger.info(`Successfully fetched job type ${jobType.id}`);
      return jobType;
    }),

  getAll: protectedProcedure
    .output(
      z.array(
        z.object({
          id: z.string().uuid(),
          name: z.string(),
          description: z.string(),
          script: z.string(),
          hasFileUpload: z.boolean(),
          arrayJob: z.boolean(),
          createdBy: z.object({ id: z.string().uuid(), name: z.string() }),
          parameters: z.array(
            z.object({
              name: z.string(),
              type: z.string(),
              defaultValue: z.string().nullable(),
            }),
          ),
        }),
      ),
    )
    .query(async ({ ctx }) => {
      logger.info(`Fetching all job types for user ${ctx.session.user.id}`);
      const jobTypes = await ctx.db.query.jobTypes.findMany({
        with: {
          parameters: true,
          createdBy: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (ctx.session.user.role !== 1) {
        logger.info(
          `Filtering job types for non-admin user ${ctx.session.user.id}`,
        );
        const requestorOrgs = await ctx.db.query.organisationMembers.findMany({
          where: (organisationMembers, { eq }) =>
            eq(organisationMembers.userId, ctx.session.user.id),
        });

        const _jt = await ctx.db.query.sharedJobTypes.findMany({
          where: (sharedJobTypes, { eq, and, or, inArray }) =>
            and(
              inArray(
                sharedJobTypes.jobTypeId,
                jobTypes.map((jt) => jt.id),
              ),
              or(
                inArray(
                  sharedJobTypes.organisationId,
                  requestorOrgs.map((org) => org.organisationId),
                ),
                eq(sharedJobTypes.userId, ctx.session.user.id),
              ),
            ),
        });

        const filteredTypes = jobTypes.filter((type) => {
          return _jt.some((_jt) => _jt.jobTypeId === type.id);
        });
        logger.info(`Returned ${filteredTypes.length} filtered job types`);
        return filteredTypes;
      }

      logger.info(`Returned ${jobTypes.length} job types for admin user`);
      return jobTypes;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().min(1).optional(),
        script: z.string().min(1).optional(),
        hasFileUpload: z.boolean().optional(),
        arrayJob: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      logger.info(`Attempting to update job type ${input.id}`);
      const jobType = await ctx.db.query.jobTypes.findFirst({
        where: (jobTypes, { eq }) => eq(jobTypes.id, input.id),
      });

      if (!jobType) {
        logger.warn(`Job type not found for update: ${input.id}`);
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Job type not found",
        });
      }

      if (
        jobType.createdBy !== ctx.session.user.id &&
        ctx.session.user.role !== 1
      ) {
        logger.warn(
          `Unauthorized attempt to update job type with id ${input.id} by user with id ${ctx.session.user.id}`,
        );
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      logger.info(`Updating job type ${input.id}`);
      const result = await ctx.db
        .update(jobTypes)
        .set(input)
        .where(eq(jobTypes.id, input.id));
      logger.info(`Job type ${input.id} updated successfully`);
      return result;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        script: z.string().min(1),
        hasFileUpload: z.boolean(),
        arrayJob: z.boolean(),
        organisationId: z.string().uuid().optional(),
        parameters: z
          .array(
            z.object({
              name: z.string(),
              type: z.enum(["string", "number", "boolean"]),
              defaultValue: z.string().optional(),
            }),
          )
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      logger.info(`Attempting to create new job type`);
      if (!input.organisationId && ctx.session.user.role !== 1) {
        logger.warn(
          `Unauthorized attempt to create global job type by user with id ${ctx.session.user.id}`,
        );
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      if (!!input.organisationId && ctx.session.user.role !== 1) {
        logger.info(
          `Checking user role in organisation ${input.organisationId}`,
        );
        const org = await ctx.db.query.organisationMembers.findFirst({
          where: (organisationMembers, { eq, and }) =>
            and(
              eq(organisationMembers.organisationId, input.organisationId!),
              eq(organisationMembers.userId, ctx.session.user.id),
              eq(organisationMembers.role, 2),
            ),
        });

        if (!org) {
          logger.warn(
            `Unauthorized attempt to create job type for organisationId ${input.organisationId} by user with id ${ctx.session.user.id}`,
          );
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      return await ctx.db.transaction(async (tx) => {
        logger.info(`Creating new job type`);
        const jobType = (
          await tx
            .insert(jobTypes)
            .values({
              name: input.name,
              description: input.description,
              script: input.script,
              hasFileUpload: input.hasFileUpload,
              arrayJob: input.arrayJob,
              createdBy: ctx.session.user.id,
            })
            .returning({ id: jobTypes.id })
        )[0];

        if (!jobType) {
          logger.error(`Failed to create job type`);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
          });
        }

        try {
          if (input.parameters) {
            logger.info(
              `Inserting ${input.parameters.length} parameters for job type ${jobType.id}`,
            );
            const toInsert = input.parameters.map((param) => ({
              ...param,
              jobTypeId: jobType.id,
            }));

            await tx.insert(jobTypeParameters).values(toInsert);
          }
        } catch (e) {
          logger.error(
            `Failed to insert parameters for job type ${jobType.id}`,
            { cause: e },
          );
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: e });
        }

        if (!!input.organisationId) {
          logger.info(
            `Sharing job type ${jobType.id} with organisation ${input.organisationId}`,
          );
          const share = await tx
            .insert(sharedJobTypes)
            .values({
              jobTypeId: jobType.id,
              organisationId: input.organisationId,
            })
            .returning({ id: sharedJobTypes.id });

          if (!share) {
            logger.error(
              `Failed to share job type ${jobType.id} with organisation ${input.organisationId}`,
            );
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
            });
          }
        }

        logger.info(`Successfully created job type ${jobType.id}`);
        return jobType;
      });
    }),
});
