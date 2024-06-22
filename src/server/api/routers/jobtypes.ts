import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { jobTypes } from "@/server/db/schema";
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
    .query(async ({ ctx, input }) => {
      //If they request all job types we ensure they're global admin
      if (!input) {
        if (ctx.session.user.role !== 1) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        return await ctx.db.query.jobTypes.findMany({
          with: {
            parameters: {
              where: (jobTypesParameters, { eq }) =>
                eq(jobTypesParameters.jobTypeId, jobTypes.id),
            },
          },
        });
      }

      const where = input.id
        ? eq(jobTypes.id, input.id)
        : //We can non-null assert here because if there's no id, there must be a createdBy
          eq(jobTypes.createdBy, input.createdBy!);

      const jobType = await ctx.db.query.jobTypes.findFirst({
        with: {
          parameters: {
            where: (jobTypesParameters, { eq }) =>
              eq(jobTypesParameters.jobTypeId, jobTypes.id),
          },
        },
        where: where,
      });

      //If the job type was not created by the user, we check it's shared with them or an org they're a member of.
      if (!!jobType && jobType.createdBy !== ctx.session.user.id) {
        //Grab a list of the organisations the user is a member of
        const requestorOrgs = await ctx.db.query.organisationMembers.findMany({
          where: (organisationMembers, { eq }) =>
            eq(organisationMembers.userId, ctx.session.user.id),
          columns: { organisationId: true },
        });

        //Find the first instance of the job being shared with either the user directly, or any of the organisations they're a member of
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

        //If there are no instances, we return undefined
        if (!_jt) {
          return undefined;
        }
      }

      //If the job type was created by the user, or shared with them, we return it.
      return jobType;
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
      //Grab teh job type from the db
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

      return await ctx.db
        .insert(jobTypes)
        .values({ ...input, createdBy: ctx.session.user.id });
    }),
});
