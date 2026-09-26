import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { createdUpdatedAt, id, timestamps } from "./_helpers.js";
import {
  affiliationPositionEnum,
  affiliationVerificationMethodEnum,
  authorClaimMethodEnum,
  authorClaimStatusEnum,
  notificationChannelEnum,
  pushPlatformEnum,
  userRoleEnum,
  userStatusEnum,
} from "./enums.js";
import { institutions, persons } from "./scholarly.js";

// docs/CONTEXT.md section 6.2. `email`/`emailVerified`/`image` are better-auth's own core user
// fields (docs/CONTEXT.md: "Auth tables are owned by the auth library") — better-auth's `name`
// field is remapped to `displayName` (apps/api/src/auth.ts's `user.fields.name`) rather than
// carrying a redundant second name column; everything else here is app-domain, per CONTEXT.md's
// field list for this table.
export const users = pgTable(
  "users",
  {
    id: id(),
    handle: text().notNull(),
    // Null until the handle is changed for the first time — see packages/core's
    // `canEditHandle()`, which reads this to enforce the "editable once per 30 days" rule.
    handleChangedAt: timestamp({ withTimezone: true }),
    displayName: text().notNull(),
    email: text().notNull(),
    emailVerified: boolean().notNull().default(false),
    image: text(),
    avatarKey: text(),
    bio: text(),
    locale: text().notNull().default("en"),
    role: userRoleEnum().notNull().default("user"),
    status: userStatusEnum().notNull().default("active"),
    ...timestamps,
  },
  (t) => [unique("users_handle_key").on(t.handle), unique("users_email_key").on(t.email)],
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

// docs/CONTEXT.md section 5.1/M3 — institutional affiliation verification (separate from login):
// institutional email -> OTP -> domain match against institutions.email_domains -> an
// `affiliations` row. Not in CONTEXT.md's table list (that section predates the OTP mechanics
// being designed) but needed to hold a pending verification between the "start" and "confirm"
// API calls — same reasoning as `idempotency_keys`/`rate_limit_buckets` in schema/api.ts.
export const affiliationVerifications = pgTable(
  "affiliation_verifications",
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    institutionEmail: text().notNull(),
    otpHash: text().notNull(),
    attempts: integer().notNull().default(0),
    consumedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("affiliation_verifications_user_id_idx").on(t.userId)],
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
