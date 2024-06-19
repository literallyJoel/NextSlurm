import {
  accounts,
  organisationMembers,
  organisations,
  users,
} from "@/server/db/schema";
import { createTRPCRouter, publicProcedure } from "../trpc";
import { ne } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import argon2 from "argon2";
export const setupRouter = createTRPCRouter({
  //Used to determine whether to redirect to the first time setup screen
  getRequiresSetup: publicProcedure.query(async ({ ctx }) => {
    return (
      (
        await ctx.db
          .select({ name: users.name })
          .from(users)
          /*
          A default user exists so we can retain job types etc when a users account is deleted,
          so we need to discount it when determining whether to run setup.
          */
          .where(ne(users.id, "default"))
          .limit(1)
      ).length === 0
    );
  }),
  /*
  Use for creating the initial user and organisation. 
  A separate function is used for this, as we need it to be public.
  Once the setup is complete, it'll just return a 404
  */
  createInitial: publicProcedure
    .input(
      z.object({
        name: z.string(),
        email: z.string().email(),
        password: z
          .string()
          .min(8)
          //Contains an uppercase character
          .regex(/[A-Z]/)
          //Contains a lowercase character
          .regex(/[a-z]/)
          //contains a number
          .regex(/\d/)
          //contains a special character
          .regex(/\W/),
        organisationName: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      /*
        We ensure there are no users or organisatons created already.
        If there are, we return a 404 error.
    */

      //Grab the current users
      const _users = await ctx.db
        .select()
        .from(users)
        .where(ne(users.id, "default"));

      const orgs = await ctx.db.select().from(organisations).all();

      if (_users.length > 0 || orgs.length > 0) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      //Start a trasnscation
      await ctx.db.transaction(async (tx) => {
        //Hash the password
        const pwHash = await argon2.hash(input.password);

        //Insert the user
        const user = await tx
          .insert(users)
          .values({
            name: input.name,
            email: input.email,
            password: pwHash,
            //Admin
            role: 1,
          })
          .returning({ userId: users.id });

        //Rollback if we don't get a user ID returned
        if (!user[0]) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        //Create the organisation
        const org = await tx
          .insert(organisations)
          .values({
            name: input.organisationName,
          })
          .returning({ id: organisations.id });

        //rollback if no org ID returned
        if (!org[0]) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        //Make the user an admin of the new organisation
        const orgMember = await tx
          .insert(organisationMembers)
          .values({
            organisationId: org[0].id,
            userId: user[0].userId,
            //Organisation Admin
            role: 2,
          })
          .returning();

        //If no org member is returned we rollback
        if (!orgMember[0]) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
        /*
        Create a record in the accounts table for the credentials provider.
        This is done so that we have interoperability with other providers.
        */
        const account = await tx
          .insert(accounts)
          .values({
            userId: user[0].userId,
            type: "credential",
            provider: "credential",
            providerAccountId: user[0].userId,
          })
          .returning();

        //If no account record is returned, we rollback.
        if (!account[0]) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }
      });
    }),
});
