import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  jobTypeParameters,
  jobTypes,
  sharedJobTypes,
} from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const jobTypesRouter = createTRPCRouter({
  get: protectedProcedure
    .input(
      z.union([
        z
          .object({ id: z.string().uuid(), createdBy: z.undefined() })
          .optional(),
        z
          .object({ id: z.undefined(), createdBy: z.string().uuid() })
          .optional(),
      ]),
    )
    .output(
      z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          description: z.string(),
          script: z.string(),
          hasFileUpload: z.boolean(),
          arrayJob: z.boolean(),
          createdBy: z.string().uuid(),
        })
        .or(
          z.array(
            z.object({
              id: z.string().uuid(),
              name: z.string(),
              description: z.string(),
              script: z.string(),
              hasFileUpload: z.boolean(),
              arrayJob: z.boolean(),
              createdBy: z.string().uuid(),
            }),
          ),
        )
        .or(z.undefined()),
    )
    .query(async ({ ctx, input }) => {
      //If there is no input, we ensure global admin and return all
      if (!input) {
        if (ctx.session.user.role !== 1) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        return await ctx.db.query.jobTypes.findMany({
          with: { parameters: true },
        });
      }

      //If they provide an ID,we grab the job type with that ID
      if (input.id) {
        //Grab the job type
        const jobType = await ctx.db.query.jobTypes.findFirst({
          where: (jobTypes, { eq }) => eq(jobTypes.id, input.id),
          with: { parameters: true },
        });

        if (!jobType) {
          throw new TRPCError({ code: "BAD_REQUEST" });
        }

        //Ensure the user either created or has access to the job type
        if (jobType.createdBy !== ctx.session.user.id) {
          //Grab a list of the organisations the user is a member of
          const requestorOrgs = await ctx.db.query.organisationMembers.findMany(
            {
              where: (organisationMembers, { eq }) =>
                eq(organisationMembers.userId, ctx.session.user.id),
            },
          );

          //Find the first instance of the job being shared with either the user or their orgs
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

          //If there are no instances, we return unauthorized
          if (!_jt) throw new TRPCError({ code: "UNAUTHORIZED" });

          return jobType;
        }
      }

      //If they provide a createdBy, we grab the jobTypes created by that user
      if (input.createdBy) {
        //Grab the job types
        const jobTypes = await ctx.db.query.jobTypes.findMany({
          where: (jobTypes, { eq }) => eq(jobTypes.createdBy, input.createdBy),
          with: { parameters: true },
        });

        if (input.createdBy !== ctx.session.user.id) {
          //Filter the list to only include job types the user has access to
          //Grab a list of the organisations the user is a member of
          const requestorOrgs = await ctx.db.query.organisationMembers.findMany(
            {
              where: (organisationMembers, { eq }) =>
                eq(organisationMembers.userId, ctx.session.user.id),
            },
          );
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

          return filteredTypes;
        }
      }
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
      //Grab the job type from the db
      const jobType = await ctx.db.query.jobTypes.findFirst({
        where: (jobTypes, { eq }) => eq(jobTypes.id, input.id),
      });

      //Throw a 400 if none found
      if (!jobType) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Job type not found",
        });
      }

      //Make sure the user either created the job type or is a global admin
      if (
        jobType.createdBy !== ctx.session.user.id &&
        ctx.session.user.role !== 1
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      //Update the job type
      return await ctx.db
        .update(jobTypes)
        .set(input)
        .where(eq(jobTypes.id, input.id));
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
      /*
        If an organisationId is not provided, the job type will be globally accessible.
        Only global admins can do this.
        */
      if (!input.organisationId && ctx.session.user.role !== 1) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      //Ensure the user is at least a moderator in the organisation if provided
      if (!!input.organisationId && ctx.session.user.role !== 1) {
        const org = await ctx.db.query.organisationMembers.findFirst({
          where: (organisationMembers, { eq, and }) =>
            and(
              //The if statement ensures organisationId is not null but TS isn't picking it up for some reason
              eq(organisationMembers.organisationId, input.organisationId!),
              eq(organisationMembers.userId, ctx.session.user.id),
              eq(organisationMembers.role, 2),
            ),
        });

        if (!org) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      return await ctx.db.transaction(async (tx) => {
        //Insert the job type
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
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
          });
        }

        try {
          //Insert the parameters
          if (input.parameters) {
            const toInsert = input.parameters.map((param) => ({
              ...param,
              jobTypeId: jobType.id,
            }));

            await tx.insert(jobTypeParameters).values(toInsert);
          }
        } catch (e) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", cause: e });
        }

        //Share with the organisation
        if (!!input.organisationId) {
          const share = await tx
            .insert(sharedJobTypes)
            .values({
              jobTypeId: jobType.id,
              organisationId: input.organisationId,
            })
            .returning({ id: sharedJobTypes.id });

          if (!share) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
            });
          }
        }

        return jobType;
      });
    }),
});
