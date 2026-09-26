import { pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { id } from "./_helpers.js";
import { users } from "./users.js";

/**
 * better-auth's own tables — docs/CONTEXT.md: "Auth tables are owned by the auth library."
 * Shape verified directly against the installed better-auth version's `getSchema()` output for
 * our actual config (apps/api/src/auth.ts's plugin set: emailOTP, bearer, Google/Apple
 * socialProviders), not copied from docs that may lag the installed version. `usePlural: true`
 * in the Drizzle adapter config is what makes better-auth look for `sessions`/`accounts`/
 * `verifications` here instead of `session`/`account`/`verification`.
 */

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    ipAddress: text(),
    userAgent: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("sessions_token_key").on(t.token)],
);

export const accounts = pgTable("accounts", {
  id: id(),
  userId: uuid()
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text().notNull(),
  providerId: text().notNull(),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp({ withTimezone: true }),
  refreshTokenExpiresAt: timestamp({ withTimezone: true }),
  scope: text(),
  // Present in better-auth's core schema (used if email+password auth is ever enabled) — this
  // repo never enables it (docs/CONTEXT.md section 12.3: "No passwords"), so it's always null.
  password: text(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const verifications = pgTable("verifications", {
  id: id(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
