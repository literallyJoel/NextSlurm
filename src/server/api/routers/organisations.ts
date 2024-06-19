import { db as _db } from "@/server/db";
import { organisationMembers, organisations, users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { string, z } from "zod";
import {
  createTRPCRouter,
  globalAdminProcedure,
  protectedProcedure,
} from "../trpc";
import { TRPCError } from "@trpc/server";

/*
Returns if the provided user is a member of the provided organisation
If a role is provided, only returns orgs where they are that role
*/

const isMember = z
  .function()
  .args(
    z.object({
      organisationId: z.string().uuid(),
      userId: z.string().uuid(),
      //We can't directly access the db type here, so we use any and assert later
      db: z.any(),
      role: z.number().min(0).max(2).optional(),
    }),
  )
  .returns(z.promise(z.boolean()))
  .implement(async (input) => {
    //Grab the input
    const { organisationId, userId, db, role } = input;
    //Assert the db type
    const dbWithType = db as typeof _db;

    //If a role is provided, we include the role in the where clause, else we only check the user and org IDs
    const whereClause = role
      ? and(
          eq(organisationMembers.organisationId, organisationId),
          and(
            eq(organisationMembers.userId, userId),
            eq(organisationMembers.role, role),
          ),
        )
      : and(
          eq(organisationMembers.organisationId, organisationId),
          eq(organisationMembers.userId, userId),
        );

    //Return whether there are any results
    return (
      (
        await dbWithType
          .select()
          .from(organisationMembers)
          .where(whereClause)
          .limit(1)
      ).length !== 0
    );
  });

const isGlobalOrOrgAdmin = z
  .function()
  .args(
    z.object({
      organisationId: z.string().uuid(),
      userId: z.string().uuid(),
      role: z.number().min(0).max(1),
      db: z.any(),
    }),
  )
  .returns(z.promise(z.boolean()))
  .implement(async (input) => {
    //Check if they're a global admin
    if (input.role === 1) return true;

    //Check if they're an admin of the organisation
    return isMember({
      organisationId: input.organisationId,
      userId: input.userId,
      db: input.db,
      role: 2,
    });
  });

export const organisationsRouter = createTRPCRouter({
  create: globalAdminProcedure
    .input(
      z.object({
        organisationName: z.string().min(3),
        adminId: z.string().uuid(),
      }),
    )
    .output(z.object({ organisationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      //Start a DB transaction
      return await ctx.db.transaction(async (tx) => {
        //Check the provided userId exists
        const admin = await tx
          .select()
          .from(users)
          .where(eq(users.id, input.adminId));

        //If the user doesn't exist we throw a bad request
        if (!admin) {
          throw new TRPCError({ code: "BAD_REQUEST" });
        }

        //If the user does exist, we attempt to create the new organisation in the DB
        const newOrg = await tx
          .insert(organisations)
          .values({ name: input.organisationName })
          .returning({ id: organisations.id });

        //If it fails we rollback on the transaction and throw a 500
        if (!newOrg[0]) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        //If it succeeds we attempt to add the organisation admin
        const orgAdmin = await tx
          .insert(organisationMembers)
          .values({ organisationId: newOrg[0].id, userId: input.adminId })
          .returning();

        //If it fails for any reason, we rollback so there isn't an org with no members, and we throw a 500
        if (!orgAdmin) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        return { organisationId: newOrg[0].id };
      });
    }),
  delete: globalAdminProcedure
    .input(z.object({ organisationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.transaction(async (tx) => {
        //First we remove the organisation members
        await tx
          .delete(organisationMembers)
          .where(eq(organisationMembers.organisationId, input.organisationId));

        //Finally we remove the organisation
        await tx
          .delete(organisations)
          .where(eq(organisations.id, input.organisationId));
      });
    }),
  rename: globalAdminProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        organisationName: z.string().min(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      //Simple update call to the database to change the org name
      await ctx.db
        .update(organisations)
        .set({ name: input.organisationName })
        .where(eq(organisations.id, input.organisationId));
    }),
  get: protectedProcedure
    .input(
      z
        .union([
          //If an organisationId is provided, a user cannot be provided
          z.object({ organisationId: z.string().uuid(), user: z.undefined() }),
          //If a user is provided, an organistionId cannot be provided
          z.object({
            organisationId: z.undefined(),
            user: z.object({
              userId: z.string().uuid(),
              role: z.number().min(0).max(2).optional(),
            }),
          }),
        ])
        //Nothing has to be provided
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      //If there's no input, we ensure they'rea global admin before returning all orgs
      if (!input) {
        if (ctx.session.user.role !== 1) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        return (await ctx.db.select().from(organisations).all()) ?? [];
      }

      const { organisationId, user } = input;

      //If an organisationId is provided, we ensure they're either a global admin or in that orgainsation, and return the org
      if (organisationId) {
        if (ctx.session.user.role !== 1) {
          const isOrgMember = await isMember({
            organisationId: organisationId,
            userId: ctx.session.user.id,
            db: ctx.db,
          });

          if (!isOrgMember) {
            throw new TRPCError({ code: "UNAUTHORIZED" });
          }
        }

        return (
          (await ctx.db
            .select()
            .from(organisations)
            .where(eq(organisations.id, organisationId))) ?? []
        );
      }

      //If a user is provided, we check they are either a global admin, or that user, before returning that users orgs
      if (user) {
        if (
          ctx.session.user.role !== 1 &&
          ctx.session.user.id !== user.userId
        ) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        return (
          (await ctx.db
            .select({
              id: organisations.id,
              name: organisations.name,
              userRole: organisationMembers.role,
            })
            .from(organisations)
            .leftJoin(
              organisationMembers,
              eq(organisations.id, organisationMembers.organisationId),
            )
            .where(
              //If a role is provided, we filter by role alsd
              user.role
                ? and(
                    eq(organisationMembers.userId, user.userId),
                    eq(organisationMembers.role, user.role),
                  )
                : eq(organisationMembers.userId, user.userId),
            )) ?? []
        );
      }
    }),
  addMember: protectedProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.number().min(0).max(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      //Check the requestor is a global admin or admin in the requested organisation
      if (
        !(await isGlobalOrOrgAdmin({
          organisationId: input.organisationId,
          userId: ctx.session.user.id,
          role: ctx.session.user.role,
          db: ctx.db,
        }))
      ) {
        //Throw a 401 if not
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      //Add the member
      return (
        await ctx.db.insert(organisationMembers).values(input).returning()
      )[0];
    }),
  removeMember: protectedProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      //Check the requestor is global admin or org admin
      if (
        !(await isGlobalOrOrgAdmin({
          organisationId: input.organisationId,
          userId: ctx.session.user.id,
          role: ctx.session.user.role,
          db: ctx.db,
        }))
      ) {
        //Throw 401 if not
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      //Remove the user from the org
      return await ctx.db
        .delete(organisationMembers)
        .where(
          and(
            eq(organisationMembers.organisationId, input.organisationId),
            eq(organisationMembers.userId, input.userId),
          ),
        )
        .returning();
    }),
  getMember: protectedProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      //Check the requestor is either a global admin or in the org
      if (ctx.session.user.role !== 1) {
        const isOrgMember = await isMember({
          organisationId: input.organisationId,
          userId: ctx.session.user.id,
          db: ctx.db,
        });

        if (!isOrgMember) {
          //If not throw 401
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      return await ctx.db
        .select({
          //Grab the info from the users table
          id: organisationMembers.userId,
          name: users.name,
          email: users.email,
          role: organisationMembers.role,
        })
        .from(organisationMembers)
        //Join the orgMembers and users table on the userId
        .leftJoin(users, eq(organisationMembers.userId, users.id))
        .where(
          //If a userID is provided, we only return for that user, else all members of the org
          input.userId
            ? and(
                eq(organisationMembers.userId, input.userId),
                eq(organisationMembers.organisationId, input.organisationId),
              )
            : eq(organisationMembers.organisationId, input.organisationId),
        );
    }),
  updateMember: protectedProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid(),
        role: z.number().min(0).max(2),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      //Ensure the user is either an org or global admin
      if (
        !isGlobalOrOrgAdmin({
          userId: ctx.session.user.id,
          organisationId: input.organisationId,
          role: ctx.session.user.role,
          db: ctx.db,
        })
      ) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      await ctx.db
        .update(organisationMembers)
        .set({ role: input.role })
        .where(
          and(
            eq(organisationMembers.organisationId, input.organisationId),
            eq(organisationMembers.userId, input.userId),
          ),
        );
    }),
});
