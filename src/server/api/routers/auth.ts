import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { eq } from "drizzle-orm";
import { sessions, users } from "@/server/db/schema";
import argon2 from "argon2";

export const authRouter = createTRPCRouter({
  //Handles logins for local accounts
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z
          .string()
          .min(8)
          //Contains an uppercase
          .regex(/[A-Z]/)
          //Contains a lowercase character
          .regex(/\d/)
          //Contains a special character
          .regex(/\W/),
      }),
      /*
    We explicitly define the output shape for this, as this function deals 
    with sensitive information, such as the (hashed) user password. So we take 
    every precaution to ensure only the intended data is returned.
    */
    )
    .output(
      z
        .object({
          id: z.string().uuid(),
          name: z.string(),
          //We store role as an number rather than a bool so we can extend more easily later
          role: z.number().min(0).max(1),
          email: z.string().email(),
          requresReset: z.boolean(),
        })
        .or(z.undefined()),
    )
    .mutation(async ({ ctx, input }) => {
      //Grab the user from the db using their email.
      const user = (
        await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            requiresReset: users.requiresReset,
            password: users.password,
          })
          .from(users)
          .where(eq(users.email, input.email))
          .limit(1)
      )[0];

      //If there's no password, it means it's not a local account.
      if (!user?.password) {
        return undefined;
      }

      //Argon2 Comparison
      const passwordMatches = await argon2.verify(
        user.password,
        input.password,
      );

      if (!passwordMatches) {
        return undefined;
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
