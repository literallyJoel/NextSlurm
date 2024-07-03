import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import argon2 from "argon2";
import logger from "@/logging/logger";
import { obscureEmail } from "@/server/helpers/authHelper";


export const authRouter = createTRPCRouter({
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).regex(/[A-Z]/).regex(/\d/).regex(/\W/),
      }),
    )
    .output(
      z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          role: z.number().min(0).max(1),
          email: z.string().email(),
          requresReset: z.boolean(),
        })
        .or(z.undefined()),
    )
    .mutation(async ({ ctx, input }) => {
      logger.info(`Login attempt for email: ${input.email}`);

      const user = await ctx.db.query.users.findFirst({
        where: (users, { eq }) => eq(users.email, input.email),
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
          requiresReset: true,
          password: true,
        },
      });

      if (!user) {
        logger.warn(
          `Login attempt failed: User not found for email ${obscureEmail(input.email)}`,
        );
        return undefined;
      }

      if (!user.password) {
        logger.warn(
          `Login attempt failed: Account for email ${obscureEmail(input.email)} is not a local account`,
        );
        return undefined;
      }

      const passwordMatches = await argon2.verify(
        user.password,
        input.password,
      );

      if (!passwordMatches) {
        logger.warn(
          `Login attempt failed: Incorrect password for email ${obscureEmail(input.email)}`,
        );
        return undefined;
      }

      logger.info(
        `Successful login for user: ${user.id} (${obscureEmail(user.email)})`,
      );

      if (user.requiresReset) {
        logger.info(
          `User ${user.id} (${obscureEmail(user.email)}) requires password reset`,
        );
      }

      return {
        id: user.id,
        name: user.name,
        role: user.role,
        email: user.email,
        requresReset: user.requiresReset,
      };
    }),
});
