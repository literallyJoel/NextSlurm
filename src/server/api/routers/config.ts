import { z } from "zod";
import crypto from "crypto-js";
import { env } from "@/env";
import {
  createTRPCRouter,
  globalAdminProcedure,
  publicProcedure,
} from "../trpc";
import { providerConfiguration } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const encrypt = z
  .function()
  .args(z.object({ plaintext: z.string() }))
  .returns(z.string())
  .implement((input) => {
    return crypto.AES.encrypt(input.plaintext, env.NEXTAUTH_SECRET).toString();
  });

export const configRouter = createTRPCRouter({
  createProvider: globalAdminProcedure
    .input(
      //Allows either a single provider, or an array of providers to be passed in
      z
        .object({
          name: z.string().min(1),
          clientId: z.string().min(1),
          clientSecret: z.string().min(1),
        })
        .or(
          z.array(
            z.object({
              name: z.string().min(1),
              clientId: z.string().min(1),
              clientSecret: z.string().min(1),
            }),
          ),
        ),
    )
    .mutation(async ({ ctx, input }) => {
      //Check if a single provider, or an array has been provided
      if (Array.isArray(input)) {
        //If it's an array we loop through the arrasy and add the providers

        //Encrypt the client secret for each provider
        const toAdd = input.map((provider) => ({
          ...provider,
          clientSecret: encrypt({ plaintext: provider.clientSecret }),
        }));

        //Insert into the DB
        await ctx.db.insert(providerConfiguration).values(toAdd);
      } else {
        //If a single provider is given, we add it

        //Encrypt the client secret
        const encryptedSecret = encrypt({ plaintext: input.clientSecret });
        //Add the provider to the database
        await ctx.db
          .insert(providerConfiguration)
          .values({ ...input, clientSecret: encryptedSecret });
      }
    }),

  removeProvider: globalAdminProcedure
    .input(z.object({ name: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(providerConfiguration)
        .where(eq(providerConfiguration.name, input.name));
    }),
  //This is public because the login screen needs to be able to grab the providers
  getProvider: publicProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.providerConfiguration.findMany({
      columns: {
        name: true,
      },
    });
  }),
});
