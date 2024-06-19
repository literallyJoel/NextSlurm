import { DrizzleAdapter } from "@auth/drizzle-adapter";
import {
  getServerSession,
  type DefaultSession,
  type NextAuthOptions,
} from "next-auth";
import { type Adapter } from "next-auth/adapters";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import SlackProvider from "next-auth/providers/slack";
import AzureProvider from "next-auth/providers/azure-ad";
import { env } from "@/env";
import { db } from "@/server/db";
import {
  accounts,
  providerConfiguration,
  sessions,
  users,
  verificationTokens,
} from "@/server/db/schema";
import { createCaller } from "./api/root";
import { v4 } from "uuid";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { decode, encode } from "next-auth/jwt";
import { AES } from "crypto-js";
import type { Provider } from "next-auth/providers/index";
import CryptoJS from "crypto-js";

/**
 * Module augmentation for `next-auth` types. Allows us to add custom properties to the `session`
 * object and keep type safety.
 *
 * @see https://next-auth.js.org/getting-started/typescript#module-augmentation
 */
declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: number;
      isOrgAdmin: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: number;
  }
}

/*
Used to convert between the headers provided by the "authorize" callback, and the
headers expected by TRPC.
*/
function convertHeaders(headers: Record<string, any> | undefined): Headers {
  const newHeaders: Headers = new Headers();
  if (headers !== undefined) {
    for (const key in headers) {
      newHeaders.append(key, headers[key] as string);
    }
  }
  return newHeaders;
}

function decryptSecret(secret: string) {
  return AES.decrypt(secret, env.NEXTAUTH_SECRET);
}

//Checks the database for the enabled providers and their configuration and creates an array of providers.
async function getProviderConfig(_db: typeof db) {
  //Define the initial config, setting up the credential login
  const providerConfig: Provider[] = [
    CredentialsProvider({
      /*
      This bit doesn't matter too much. It's used to define how the next-auth login
      page is generated. We use a custom login page though, so we've left email and password blank.
      */
      name: "Email",
      credentials: {
        email: {},
        password: {},
      },
      //This is the login process for local accounts
      authorize: async (credentials, req) => {
        //Create a TRPC caller so we can access the backend
        const caller = createCaller({
          headers: convertHeaders(req.headers),
          db: db,
          session: null,
        });

        //Parse the credentials to ensure they meet the requirements
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(8),
          })
          .safeParse(credentials);

        //If they don't we return null - rejecting the login request.
        if (!parsedCredentials.success) {
          return null;
        }

        //Otherwise we call the backend to authenticate the user using the provided credentials
        const user = await caller.auth.login(parsedCredentials.data);
        //We return the user if there is one, and null if there isn't.
        return user ?? null;
      },
    }),
  ];

  //Grab the list of enabled providers from the database
  const providers = await _db.select().from(providerConfiguration).all();
  //Loop through em
  providers.forEach((provider) => {
    //Decrypt the client secret
    let decrypted = decryptSecret(provider.clientSecret).toString(
      CryptoJS.enc.Utf8,
    );

    /*
    Originally I used a loop to do this to make it easier to extend to other providers
    but TypeScript complained.
    */
    switch (provider.name) {
      /*
      Microsoft requires a Tenant ID. Most providers don't so rather than
      add a tenantId to the table, we just aqppend it to the client secret with 
      || as a separator
      */
      case "Microsoft": {
        providerConfig.push(
          AzureProvider({
            clientId: provider.clientId,
            clientSecret: decrypted.split("||")[1]!,
            tenantId: decrypted.split("||")[0],
            /*
            This means that if a user has logged in with one provider,
            and then tries to log in with another, it'll automatically link them.
            There can be some security concerns with this, but with the chosen providers,
            it should be fine.
            */
            allowDangerousEmailAccountLinking: true,
          }),
        );
      }
      case "Slack": {
        providerConfig.push(
          SlackProvider({
            clientId: provider.clientId,
            clientSecret: decrypted,
            allowDangerousEmailAccountLinking: true,
          }),
        );
      }
      case "Google": {
        providerConfig.push(
          GoogleProvider({
            clientId: provider.clientId,
            clientSecret: decrypted,
            allowDangerousEmailAccountLinking: true,
          }),
        );
      }
    }

    //This isn't particularly neccessary, but it ensures the plaintext client secret isn't still saved.
    decrypted = "";
  });

  return providerConfig;
}

/**
 * Options for NextAuth.js used to configure adapters, providers, callbacks, etc.
 *
 * @see https://next-auth.js.org/configuration/options
 */

export const authOptions: NextAuthOptions = {
  //We're using custom login and error pages, so we define them here.
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },
  jwt: {
    encode: async ({ token, secret, maxAge }) => {
      /*
      Next-Auth doesn't support using sessions with credential login, so we
      manully implement it here. In the JWT callback defined below, if the user uses credential login,
      we append the provider to the token, and access it here.
      */
      if (token?.provider === "credentials") {
        //Rather than return a JWT, we just return the session token.
        const cookie = cookies().get("next-auth.session-token");
        return cookie?.value ?? "";
      }

      //If it's not a local account, we use the standard encode.
      return encode({ token, secret, maxAge });
    },
    decode: async ({ token, secret }) => {
      //If it's a local account, we don't return any data, as the session table should deal w/ it.
      if (token) {
        const decoded = await decode({ token, secret });
        if (decoded) {
          if (decoded.provider && decoded.provider === "credentials") {
            return null;
          }
        }

        return decoded;
      }
      return null;
    },
  },
  callbacks: {
    jwt: async ({ token, account, user }) => {
      /*
      If the account has a provider, we add it to the token so we can
      check it in the encode override above.
      */
      if (account?.provider) {
        token.provider = account.provider;
      }

      //Adds the other user info into the token for use on the frontend
      token.role = user.role;
      token.image = user.image;
      token.name = user.name;
      return token;
    },
    session: ({ session, user }) => ({
      ...session,
      user: {
        name: user.name,
        ...session.user,
        id: user.id,
        role: user.role,
        image: user.image,
      },
    }),
    async signIn({ user, credentials, profile }) {
      /*
        Because we allow sign in with external providers, a whitelist system
        is used to make sure only authorised users can sign in.
      */

      //We check the users database to see if that email is registered.
      const _user = await db
        .select()
        .from(users)
        .where(eq(users.email, user.email ?? ""));
      const isWhitelisted = _user.length > 0;

      //If there are no users with that email we send an error.
      if (!isWhitelisted) {
        throw new Error(
          "This account is not registered with WebSlurm. Contact a system administrator.",
        );
      }

      /*
      When an admin adds a user to the whitelist, but does not add them as a local account,
      they are not asked for the users name. So this grabs the name from the provider profile.
      */
      if (profile?.name && !user.name) {
        await db
          .update(users)
          .set({ name: profile.name })
          .where(eq(users.id, user.id));
      }

      //If the user doesn't have an image, we copy it from the provider
      if (profile?.image && !user.image) {
        await db
          .update(users)
          .set({ image: profile.image })
          .where(eq(users.id, user.id));
      }

      //If it's a local account, credentials will be true
      if (credentials) {
        //We manually create a session token, and create a session in the database.
        if (user.id) {
          const sessionToken = v4();
          const sessionExpires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);
          await db.insert(sessions).values({
            sessionToken,
            userId: user.id,
            expires: sessionExpires,
          });

          cookies().set("next-auth.session-token", sessionToken, {
            expires: sessionExpires,
          });
        }
      }
      return true;
    },
  },
  events: {
    async signOut({ session }) {
      //Ensures the session is removed on sign out for local accounts
      const { sessionToken = "" } = session as unknown as {
        sessionToken: string;
      };
      await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
      cookies().delete("next-auth.session-token");
    },
  },
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as Adapter,
  providers: await getProviderConfig(db),
};

/**
 * Wrapper for `getServerSession` so that you don't need to import the `authOptions` in every file.
 *
 * @see https://next-auth.js.org/configuration/nextjs
 */
export const getServerAuthSession = () => getServerSession(authOptions);
