import { boolean, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { createdUpdatedAt, id, timestamps } from "./_helpers";
import {
  affiliationPositionEnum,
  affiliationVerificationMethodEnum,
  authorClaimMethodEnum,
  authorClaimStatusEnum,
  notificationChannelEnum,
  pushPlatformEnum,
  userRoleEnum,
  userStatusEnum,
} from "./enums";
import { institutions, persons } from "./scholarly";

// docs/CONTEXT.md section 6.2. Deliberately holds only the app-domain fields CONTEXT.md lists
// here (handle, display_name, ...) — auth-specific fields (email, emailVerified, sessions,
// accounts, verifications) are better-auth's own schema, generated and reconciled against this
// table in M3 (docs/CONTEXT.md: "Auth tables are owned by the auth library").
export const users = pgTable(
  "users",
  {
    id: id(),
    handle: text().notNull(),
    displayName: text().notNull(),
    avatarKey: text(),
    bio: text(),
    locale: text().notNull().default("en"),
    role: userRoleEnum().notNull().default("user"),
    status: userStatusEnum().notNull().default("active"),
    ...timestamps,
  },
  (t) => [unique("users_handle_key").on(t.handle)],
);

// docs/CONTEXT.md section 6.2 — verified or declared links to institutions, separate from login.
export const affiliations = pgTable(
  "affiliations",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    institutionId: uuid()
      .notNull()
      .references(() => institutions.id),
    department: text(),
    position: affiliationPositionEnum().notNull(),
    verificationMethod: affiliationVerificationMethodEnum().notNull(),
    verifiedEmailDomain: text(),
    verifiedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }),
    ...createdUpdatedAt,
  },
  (t) => [
    // A user can hold more than one affiliation over time (e.g. student -> alum at a new
    // institution), but not two active rows for the same institution.
    unique("affiliations_user_institution_key").on(t.userId, t.institutionId),
  ],
);

// docs/CONTEXT.md section 6.2 — links a user to a `person` (a real-world author record).
export const authorClaims = pgTable(
  "author_claims",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    personId: uuid()
      .notNull()
      .references(() => persons.id),
    method: authorClaimMethodEnum().notNull(),
    status: authorClaimStatusEnum().notNull().default("pending"),
    reviewedBy: uuid().references(() => users.id),
    ...createdUpdatedAt,
  },
  (t) => [unique("author_claims_user_person_key").on(t.userId, t.personId)],
);

// docs/CONTEXT.md section 6.2
export const blocks = pgTable(
  "blocks",
  {
    blockerId: uuid()
      .notNull()
      .references(() => users.id),
    blockedId: uuid()
      .notNull()
      .references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })],
);

// docs/CONTEXT.md section 6.2
export const pushTokens = pgTable(
  "push_tokens",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    platform: pushPlatformEnum().notNull(),
    token: text().notNull(),
    deviceId: text(),
    lastSeenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("push_tokens_token_key").on(t.token)],
);

// docs/CONTEXT.md section 6.2 — "per channel and per type."
export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    channel: notificationChannelEnum().notNull(),
    // Open set — see enums.ts's comment on notificationChannelEnum for why `type` isn't a
    // DB enum: CONTEXT.md never enumerates notification types.
    type: text().notNull(),
    enabled: boolean().notNull().default(true),
    ...createdUpdatedAt,
  },
  (t) => [unique("notification_preferences_user_channel_type_key").on(t.userId, t.channel, t.type)],
);
