import { desc, relations, sql } from "drizzle-orm";
import {
  index,
  int,
  primaryKey,
  sqliteTableCreator,
  text,
} from "drizzle-orm/sqlite-core";

import { type AdapterAccount } from "next-auth/adapters";
import { v4 } from "uuid";

//Every table will be prefixed with nextslurm_
export const createTable = sqliteTableCreator((name) => `nextslurm_${name}`);

//Users table - each user has an entry here
export const users = createTable("user", {
  id: text("id", { length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => v4()),
  name: text("name", { length: 255 }).notNull().default(""),
  email: text("email", { length: 255 }).notNull(),
  emailVerified: int("emailVerified", {
    mode: "timestamp",
  }).default(sql`CURRENT_TIMESTAMP`),
  image: text("image", { length: 255 }),
  password: text("password", { length: 255 }),
  role: int("role", { mode: "number" }).notNull().default(0),
  requiresReset: int("requiresReset", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: int("createdAt", { mode: "timestamp" }).default(
    sql`CURRENT_TIMESTAMP`,
  ),
});

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
}));

/*
This is for providers - so a user in the users table could log in with both
Google and Microsoft, and those two providers would be stored in the accounts table.
*/
export const accounts = createTable(
  "account",
  {
    userId: text("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    type: text("type", { length: 255 })
      .$type<AdapterAccount["type"] | "credential">()
      .notNull(),
    provider: text("provider", { length: 255 }).notNull(),
    providerAccountId: text("providerAccountId", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: int("expires_at"),
    token_type: text("token_type", { length: 255 }),
    scope: text("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: text("session_state", { length: 255 }),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
    userIdIdx: index("account_userId_idx").on(account.userId),
  }),
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

//Stores the session data for logged-in users.
export const sessions = createTable(
  "session",
  {
    sessionToken: text("sessionToken", { length: 255 }).notNull().primaryKey(),
    userId: text("userId", { length: 255 })
      .notNull()
      .references(() => users.id),
    expires: int("expires", { mode: "timestamp" }).notNull(),
  },
  (session) => ({
    userIdIdx: index("session_userId_idx").on(session.userId),
  }),
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verificationToken",
  {
    identifier: text("identifier", { length: 255 }).notNull(),
    token: text("token", { length: 255 }).notNull(),
    expires: int("expires", { mode: "timestamp" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

export const organisations = createTable("organisation", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => v4()),
  name: text("name", { length: 255 }).notNull(),
});

export const organisationMembers = createTable(
  "organisationMember",
  {
    organisationId: text("organisationId")
      .notNull()
      .references(() => organisations.id),
    userId: text("userId")
      .notNull()
      .references(() => users.id),
    role: int("role", { mode: "number" }).notNull().default(0),
  },
  (tbl) => ({
    pk: primaryKey({ columns: [tbl.organisationId, tbl.userId] }),
  }),
);

export const organisationMembersRelations = relations(
  organisationMembers,
  ({ one }) => ({
    organisation: one(organisations, {
      fields: [organisationMembers.organisationId],
      references: [organisations.id],
    }),
    user: one(users, {
      fields: [organisationMembers.userId],
      references: [users.id],
    }),
  }),
);

//Allows for dynamic enabling of different providers by the user. Client Secret is encrypted at rest.
export const providerConfiguration = createTable("providerConfiguration", {
  name: text("name", { length: 255 }).notNull().primaryKey(),
  clientId: text("clientId", { length: 255 }).notNull(),
  clientSecret: text("clientSecret", { length: 255 }).notNull(),
});

//Literally just exists so we know when to allow the setup process
//This was originally done by checking if a user and organisation had been created
//But the optionality of external providers means it needs it's own value somewhere
export const config = createTable("configuration", {
  name: text("name", { length: 255 }).notNull().primaryKey(),
  value: text("value").notNull(),
});

export const jobTypes = createTable("jobType", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => v4()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  script: text("script").notNull(),
  createdBy: text("createdBy")
    .references(() => users.id)
    .notNull(),
  hasFileUpload: int("hasFileUpload", { mode: "boolean" }).notNull(),
  arrayJob: int("arrayJob", { mode: "boolean" }).notNull(),
});

export const jobTypeParameters = createTable("jobTypeParameter", {
  id: text("id")
    .notNull()
    .primaryKey()
    .$defaultFn(() => v4()),
  jobTypeId: text("jobTypeId")
    .notNull()
    .references(() => jobTypes.id),
  name: text("name").notNull(),
  defaultValue: text("defaultValue"),
  type: text("type").notNull(),
});
export const jobTypesRelations = relations(jobTypes, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [jobTypes.createdBy],
    references: [users.id],
  }),
  parameters: many(jobTypeParameters),
  sharedJobTypes: many(sharedJobTypes),
}));

export const sharedJobTypes = createTable("sharedJobType", {
  id: text("id").notNull().primaryKey().$defaultFn(() => v4()),
  jobTypeId: text("jobTypeId").references(() => jobTypes.id).notNull(),
  organisationId: text("organisationId").references(() => organisations.id),
  userId: text("userId").references(() => users.id),
});

