import { authRouter } from "./routers/auth";
import { createCallerFactory, createTRPCRouter } from "@/server/api/trpc";
import { organisationsRouter } from "./routers/organisations";
import { providersRouter } from "./routers/providers";
import { setupRouter } from "./routers/setup";
import { usersRouter } from "./routers/users";
import { jobTypesRouter } from "./routers/jobtypes";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  auth: authRouter,
  organisations: organisationsRouter,
  providers: providersRouter,
  setup: setupRouter,
  users: usersRouter,
  jobTypes: jobTypesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
