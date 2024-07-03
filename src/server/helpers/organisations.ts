import logger from "@/logging/logger";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { organisationMembers } from "../db/schema";
import { db } from "../db";

export const isMember = z
  .function()
  .args(
    z.object({
      organisationId: z.string().uuid(),
      userId: z.string().uuid(),
      db: z.any(),
      role: z.number().min(0).max(2).optional(),
    }),
  )
  .returns(z.promise(z.boolean()))
  .implement(async (input) => {
    const { organisationId, userId, role } = input;
    logger.info(
      `Checking membership for user ${userId} in organisation ${organisationId}${role ? ` with role ${role}` : ""}`,
    );

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

    const orgMembers = db.query.organisationMembers.findFirst({
      where: whereClause,
    });

    const isMember = !!orgMembers;
    logger.info(
      `Membership check result for user ${userId} in organisation ${organisationId}: ${isMember}`,
    );
    return isMember;
  });

  export const isGlobalOrOrgAdmin = z
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
      if (input.role === 1) {
        logger.info(`User ${input.userId} authorized as global admin`);
        return true;
      }

      const isOrgAdmin = await isMember({
        organisationId: input.organisationId,
        userId: input.userId,
        db: input.db,
        role: 2,
      });

      if (!isOrgAdmin) {
        logger.warn(
          `User ${input.userId} attempted unauthorized action for organisation ${input.organisationId}`,
        );
      } else {
        logger.info(
          `User ${input.userId} authorized as admin for organisation ${input.organisationId}`,
        );
      }

      return isOrgAdmin;
    });