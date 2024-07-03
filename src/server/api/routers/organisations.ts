import { db } from "@/server/db";
import { organisationMembers, organisations, users } from "@/server/db/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  globalAdminProcedure,
  protectedProcedure,
} from "../trpc";
import { TRPCError } from "@trpc/server";
import logger from "@/logging/logger";
import { isGlobalOrOrgAdmin, isMember } from "@/server/helpers/organisations";

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
      logger.info(
        `Attempting to create organisation '${input.organisationName}' with admin ${input.adminId}`,
      );
      return await ctx.db.transaction(async (tx) => {
        const admin = await tx.query.users.findFirst({
          where: (users, { eq }) => eq(users.id, input.adminId),
        });

        if (!admin) {
          logger.error(
            `Failed to create organisation for user with id ${ctx.session.user.id}. The selected admin ${input.adminId} does not exist`,
          );
          throw new TRPCError({ code: "BAD_REQUEST" });
        }

        const newOrg = await tx
          .insert(organisations)
          .values({ name: input.organisationName })
          .returning({ id: organisations.id });

        if (!newOrg[0]) {
          logger.error(
            `Failed to create organisation with name ${input.organisationName} for user ${ctx.session.user.id}. Failed to create database entry`,
          );
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        const orgAdmin = await tx
          .insert(organisationMembers)
          .values({ organisationId: newOrg[0].id, userId: input.adminId })
          .returning();

        if (!orgAdmin) {
          logger.error(
            `Failed to create organisation with name ${input.organisationName} for user ${ctx.session.user.id}. Failed to add admin to organisation`,
          );
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        logger.info(
          `Successfully created organisation '${input.organisationName}' with ID ${newOrg[0].id} and admin ${input.adminId}`,
        );
        return { organisationId: newOrg[0].id };
      });
    }),

  delete: globalAdminProcedure
    .input(z.object({ organisationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      logger.info(
        `Attempting to delete organisation with ID ${input.organisationId}`,
      );
      await ctx.db.transaction(async (tx) => {
        await tx
          .delete(organisationMembers)
          .where(eq(organisationMembers.organisationId, input.organisationId));

        await tx
          .delete(organisations)
          .where(eq(organisations.id, input.organisationId));
      });
      logger.info(
        `Successfully deleted organisation with ID ${input.organisationId}`,
      );
    }),

  rename: globalAdminProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        organisationName: z.string().min(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      logger.info(
        `Attempting to rename organisation ${input.organisationId} to '${input.organisationName}'`,
      );
      await ctx.db
        .update(organisations)
        .set({ name: input.organisationName })
        .where(eq(organisations.id, input.organisationId));
      logger.info(
        `Successfully renamed organisation ${input.organisationId} to '${input.organisationName}'`,
      );
    }),

  get: protectedProcedure
    .input(
      z
        .union([
          z.object({ organisationId: z.string().uuid(), user: z.undefined() }),
          z.object({
            organisationId: z.undefined(),
            user: z.object({
              userId: z.string().uuid(),
              role: z.number().min(0).max(2).optional(),
            }),
          }),
        ])
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      if (!input) {
        logger.info(
          `Global admin ${ctx.session.user.id} requesting all organisations`,
        );
        if (ctx.session.user.role !== 1) {
          logger.warn(
            `Unauthorized attempt to get all organisations by user ${ctx.session.user.id}`,
          );
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
        const orgs = await ctx.db.select().from(organisations).all();
        logger.info(`Returned ${orgs.length} organisations`);
        return orgs ?? [];
      }

      const { organisationId, user } = input;

      if (organisationId) {
        logger.info(
          `User ${ctx.session.user.id} requesting information for organisation ${organisationId}`,
        );
        if (ctx.session.user.role !== 1) {
          const isOrgMember = await isMember({
            organisationId: organisationId,
            userId: ctx.session.user.id,
            db: ctx.db,
          });

          if (!isOrgMember) {
            logger.warn(
              `Unauthorized attempt to get organisation ${organisationId} by user ${ctx.session.user.id}`,
            );
            throw new TRPCError({ code: "UNAUTHORIZED" });
          }
        }

        const org = await ctx.db
          .select()
          .from(organisations)
          .where(eq(organisations.id, organisationId));
        logger.info(`Returned information for organisation ${organisationId}`);
        return org ?? [];
      }

      if (user) {
        logger.info(`Requesting organisations for user ${user.userId}`);
        if (
          ctx.session.user.role !== 1 &&
          ctx.session.user.id !== user.userId
        ) {
          logger.warn(
            `Unauthorized attempt to get organisations for user ${user.userId} by user ${ctx.session.user.id}`,
          );
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        const orgs = await ctx.db
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
            user.role
              ? and(
                  eq(organisationMembers.userId, user.userId),
                  eq(organisationMembers.role, user.role),
                )
              : eq(organisationMembers.userId, user.userId),
          );
        logger.info(
          `Returned ${orgs.length} organisations for user ${user.userId}`,
        );
        return orgs ?? [];
      }
    }),

  addMember: protectedProcedure
    .input(
      z.union([
        z.object({
          organisationId: z.string().uuid(),
          userId: z.string().uuid(),
          userEmail: z.undefined(),
          role: z.number().min(0).max(2),
        }),
        z.object({
          organisationId: z.string().uuid(),
          userId: z.undefined(),
          userEmail: z.string().email(),
          role: z.number().min(0).max(2),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      logger.info(
        `Attempting to add ${input.userId || input.userEmail} to organisation ${input.organisationId} with role ${input.role}`,
      );
      if (
        !(await isGlobalOrOrgAdmin({
          organisationId: input.organisationId,
          userId: ctx.session.user.id,
          role: ctx.session.user.role,
          db: ctx.db,
        }))
      ) {
        logger.warn(
          `Unauthorized attempt to add member to organisation ${input.organisationId} by user ${ctx.session.user.id}`,
        );
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      if (input.userId) {
        const result = (
          await ctx.db.insert(organisationMembers).values(input).returning()
        )[0];
        logger.info(
          `Successfully added ${input.userId} to organisation ${input.organisationId} with role ${input.role}`,
        );
        return result;
      } else {
        const user = await ctx.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, input.userEmail!));
        if (user[0]) {
          const result = await ctx.db
            .insert(organisationMembers)
            .values({
              organisationId: input.organisationId,
              userId: user[0].id,
              role: input.role,
            })
            .returning();
          logger.info(
            `Successfully added ${input.userEmail} to organisation ${input.organisationId} with role ${input.role}`,
          );
          return result;
        } else {
          logger.warn(
            `Attempted to add non-existent user with email ${input.userEmail} to organisation ${input.organisationId}`,
          );
        }
      }
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      logger.info(
        `Attempting to remove user ${input.userId} from organisation ${input.organisationId}`,
      );
      if (
        !(await isGlobalOrOrgAdmin({
          organisationId: input.organisationId,
          userId: ctx.session.user.id,
          role: ctx.session.user.role,
          db: ctx.db,
        }))
      ) {
        logger.warn(
          `Unauthorized attempt to remove member from organisation ${input.organisationId} by user ${ctx.session.user.id}`,
        );
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      const result = await ctx.db
        .delete(organisationMembers)
        .where(
          and(
            eq(organisationMembers.organisationId, input.organisationId),
            eq(organisationMembers.userId, input.userId),
          ),
        )
        .returning();
      logger.info(
        `Successfully removed user ${input.userId} from organisation ${input.organisationId}`,
      );
      return result;
    }),

  getMember: protectedProcedure
    .input(
      z.object({
        organisationId: z.string().uuid(),
        userId: z.string().uuid().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      logger.info(
        `Retrieving member information for organisation ${input.organisationId}${input.userId ? ` and user ${input.userId}` : ""}`,
      );
      if (ctx.session.user.role !== 1) {
        const isOrgMember = await isMember({
          organisationId: input.organisationId,
          userId: ctx.session.user.id,
          db: ctx.db,
        });

        if (!isOrgMember) {
          logger.warn(
            `Unauthorized attempt to get member information for organisation ${input.organisationId} by user ${ctx.session.user.id}`,
          );
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      const members = await ctx.db
        .select({
          id: organisationMembers.userId,
          name: users.name,
          email: users.email,
          role: organisationMembers.role,
        })
        .from(organisationMembers)
        .leftJoin(users, eq(organisationMembers.userId, users.id))
        .where(
          input.userId
            ? and(
                eq(organisationMembers.userId, input.userId),
                eq(organisationMembers.organisationId, input.organisationId),
              )
            : eq(organisationMembers.organisationId, input.organisationId),
        );
      logger.info(
        `Retrieved ${members.length} member(s) for organisation ${input.organisationId}`,
      );
      return members;
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
      logger.info(
        `Attempting to update role of user ${input.userId} in organisation ${input.organisationId} to ${input.role}`,
      );
      if (
        !isGlobalOrOrgAdmin({
          userId: ctx.session.user.id,
          organisationId: input.organisationId,
          role: ctx.session.user.role,
          db: ctx.db,
        })
      ) {
        logger.warn(
          `Unauthorized attempt to update role for user ${input.userId} in organisation ${input.organisationId} by user ${ctx.session.user.id}`,
        );
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
      logger.info(
        `Successfully updated role of user ${input.userId} in organisation ${input.organisationId} to ${input.role}`,
      );
    }),
});
