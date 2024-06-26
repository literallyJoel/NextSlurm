import { z } from "zod";
import {
  createTRPCRouter,
  globalAdminProcedure,
  protectedProcedure,
  publicProcedure,
} from "../trpc";
import argon2 from "argon2";
import {
  organisationMembers,
  organisations,
  sessions,
  users,
} from "@/server/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
const generatePassword = z
  .function()
  .args(z.number().optional().default(8))
  .returns(z.string())
  .implement((length) => {
    /*
    Passwords have a requirement of at least one upper case letter,
    at least one lower case letter, at least one number, and at least
    one special character. The autogenerated passwords have to follow
    this also, as the login form will reject any passwords that don't.
    */

    //Define the charsets so we can ensure we have at least one from each
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = lowercase.toUpperCase();
    const numbers = "0123456789";
    const specials = "!@#$%^&*()_+[]{}|;:,.<>?";
    const all = lowercase + uppercase + numbers + specials;

    //Grabs a random character out of the provided charset
    const getFromCharSet = (charSet: string) => {
      charSet[Math.floor(Math.random() * charSet.length)];
    };

    let password = "";
    //Ensure one of each type is incluided
    password += getFromCharSet(lowercase);
    password += getFromCharSet(uppercase);
    password += getFromCharSet(numbers);
    password += getFromCharSet(specials);

    //Fill the password to the specified length with random characters
    for (let i = password.length; i < length; i++) {
      password += getFromCharSet(all);
    }

    //Shuffle the password so the required chars aren't always in the same order
    return password
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
  });

export const usersRouter = createTRPCRouter({
  create: globalAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        //Name and password are optional as they are only required for local accounts
        name: z.string().optional(),
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
          .regex(/\W/)
          .optional(),
        role: z.number().min(0).max(1),
        organisationId: z.string().uuid(),
        organisationRole: z.number().min(0).max(2),
        generatePassword: z.boolean().optional().default(false),
      }),
    )
    .output(z.object({ userId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      //Autogenerate a password if requested
      const plaintext = input.generatePassword
        ? generatePassword(8)
        : input.password;

      //We hash the password if there is one, or null it if there isn't
      const password = plaintext ? await argon2.hash(plaintext) : null;

      //Begin transactrion
      return await ctx.db.transaction(async (tx) => {
        //Create the user
        const user = await tx
          .insert(users)
          .values({
            email: input.email,
            name: input.name,
            password: password,
            role: input.role,
          })
          .returning({ id: users.id });

        //If no userId is returned we rollback and throw an error
        if (!user[0]) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        //Add them to the organisation
        const orgMembership = await tx
          .insert(organisationMembers)
          .values({
            organisationId: input.organisationId,
            userId: user[0].id,
            role: input.organisationRole,
          })
          .returning();

        //If we don't get the org membership back we rollback
        if (!orgMembership[0]) {
          tx.rollback();
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
        }

        return { userId: user[0].id };
      });
    }),
  delete: protectedProcedure
    .input(z.object({ userId: z.string() }).optional())
    .mutation(async ({ ctx, input }) => {
      /*
        If they've provided a user to delete, we ensure they're either
        a global admin, or it's their own ID
        */
      if (input) {
        if (
          input.userId !== ctx.session.user.id &&
          ctx.session.user.role !== 1
        ) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      const _id = input?.userId ?? ctx.session.user.id;

      //Start a transaction
      return await ctx.db.transaction(async (tx) => {
        //Remove the users org memberships
        await tx
          .delete(organisationMembers)
          .where(eq(organisationMembers.userId, _id));

        const user = await tx
          .delete(users)
          .where(eq(users.id, _id))
          .returning({ id: users.id });

        return { userId: user[0]?.id ?? "" };
      });
    }),
  update: protectedProcedure
    .input(
      z.union([
        /*
        If a userId is provided, it means an admin is updating another user.
        We therefore prevent them from changing the users password.
        */
        z.object({
          userId: z.string().uuid(),
          name: z.string().optional(),
          email: z.string().email().optional(),
          image: z.string().max(255).optional(),
          password: z.undefined(),
          role: z.number().min(0).max(1).optional(),
          requiresReset: z.boolean().optional(),
        }),
        /*
        If the user is updating their own account, they can update their password
        but cannot change their own role. 
      */
        z.object({
          userId: z.undefined(),
          name: z.string().optional(),
          email: z.string().email().optional(),
          image: z.string().max(255).optional(),
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
            .regex(/\W/)
            .optional(),
          role: z.undefined(),
          requiresReset: z.boolean().optional(),
        }),
      ]),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.userId) {
        //If a userId is provided, we ensure they are a global admin
        if (ctx.session.user.role !== 1) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      //Set ID to either the provided input, or the requestor
      const id = input.userId ?? ctx.session.user.id;

      //Hash the password if a new oone is provided
      const password = input.password
        ? await argon2.hash(input.password)
        : undefined;

      //Update the user - if it's undefined it'll remain unchanged.
      const updated = await ctx.db
        .update(users)
        .set({
          name: input.name,
          email: input.email,
          image: input.image,
          password: password,
          role: input.role,
          requiresReset: input.requiresReset,
        })
        .where(eq(users.id, id))
        .returning({ id: users.id });

      return updated[0];
    }),
  get: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().uuid(),
          role: z.number().min(0).max(1).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      //If there's no input provided, we ensure they're a global admin and return all users
      if (!input) {
        if (ctx.session.user.role !== 1) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }

        return await ctx.db
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            role: users.role,
            image: users.image,
          })
          .from(users)
          .all();
      }

      /*
      If there'es a specific user being looked for, 
      we ensure they're either a global admin, or that user
      */

      if (ctx.session.user.role !== 1 && ctx.session.user.id !== input.userId) {
        throw new TRPCError({ code: "UNAUTHORIZED" });
      }

      return await ctx.db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: users.role,
          image: users.image,
        })
        .from(users)
        .where(
          input.role
            ? and(eq(users.id, input.userId), eq(users.role, input.role))
            : eq(users.id, input.userId),
        );
    }),
  isWhitelisted: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .output(z.boolean())
    .query(async ({ ctx, input }) => {
      return (
        (
          await ctx.db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, input.email))
        ).length !== 0
      );
    }),
  getOrganisations: protectedProcedure
    .input(
      z
        .object({
          userId: z.string().uuid().optional(),
          role: z
            .number()
            .min(0)
            .max(2)
            .optional()
            .or(z.array(z.number().min(0).max(2))),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      //If user ID is provided, we ensure the user is either a global admin, or their own ID
      if (input) {
        if (
          ctx.session.user.role !== 1 &&
          ctx.session.user.id !== input.userId
        ) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }

      //Set id to either the userID if provided, or the requestors ID otherwise
      const id = input?.userId ?? ctx.session.user.id;

      //Grab the org info from the database
      return await ctx.db
        .select({
          id: organisations.id,
          name: organisations.name,
          role: organisationMembers.role,
        })
        .from(organisationMembers)
        .leftJoin(
          organisations,
          eq(organisations.id, organisationMembers.organisationId),
        )
        .where(
          input?.role
            ? and(
                Array.isArray(input.role)
                  ? inArray(organisationMembers.role, input.role)
                  : eq(organisationMembers.role, input.role),

                eq(organisationMembers.userId, id),
              )
            : eq(organisationMembers.userId, id),
        );
    }),
  //Removes a users sessions from the database, used for the sign out everywhere functionality
  deleteSessions: protectedProcedure
    .input(z.object({ userId: z.string().uuid() }).optional())
    .mutation(async ({ ctx, input }) => {
      if (input) {
        if (
          ctx.session.user.role !== 1 &&
          input.userId !== ctx.session.user.id
        ) {
          throw new TRPCError({ code: "UNAUTHORIZED" });
        }
      }
      const id = input?.userId ?? ctx.session.user.id;

      await ctx.db.delete(sessions).where(eq(sessions.userId, id));
    }),
});
