import type { ApiEnv } from "@repo/config/env/api";
import { generateId, isValidHandle, slugifyForHandle } from "@repo/core";
import { users } from "@repo/db/schema";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth/minimal";
import { bearer, emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import type { Db } from "./db.js";
import { otpEmail } from "./emails/otp.js";
import type { Mailer } from "./mailer.js";

/**
 * docs/CONTEXT.md section 18 decision 4: self-hosted better-auth, Drizzle adapter, Google/Apple
 * OAuth, email OTP, bearer tokens for mobile/extension (not consumed by any client yet — M2/M3
 * — but on from day one per that decision). No passwords, ever (section 12.3).
 */
export function buildAuth(db: Db, env: ApiEnv, mailer: Mailer) {
  const socialProviders: NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]> = {};

  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    };
  }
  if (env.APPLE_CLIENT_ID && env.APPLE_CLIENT_SECRET) {
    socialProviders.apple = {
      clientId: env.APPLE_CLIENT_ID,
      clientSecret: env.APPLE_CLIENT_SECRET,
      appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER,
    };
  }

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    basePath: "/v1/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: env.CORS_ALLOWED_ORIGINS,

    database: drizzleAdapter(db, { provider: "pg", usePlural: true }),

    // UUIDv7, same generator as everywhere else — docs/CONTEXT.md section 18 decisions 6 and 9.
    advanced: {
      database: {
        generateId: () => generateId(),
      },
    },

    emailAndPassword: { enabled: false },
    socialProviders,

    user: {
      // No redundant second "name" column — writes straight to the same `displayName` column
      // packages/db/src/schema/users.ts already has.
      fields: { name: "displayName" },
      additionalFields: {
        // Declared so better-auth's own schema-consistency check knows this NOT NULL (at the DB
        // level) column exists and is intentional. `required: false` here is about *request
        // input*, not the DB constraint — `required: true` made better-auth's own validation
        // reject sign-in for not supplying a `handle` in the request body, even though
        // `input: false` should have excluded it from that same validation. The actual value is
        // always set by the `databaseHooks.user.create.before` hook below.
        handle: { type: "string", required: false, input: false },
      },
    },

    databaseHooks: {
      user: {
        create: {
          // Handle creation on first sign-in — docs/CONTEXT.md section 5.1. Runs as a `before`
          // hook (not `after` + a follow-up UPDATE) so the row is created with its handle
          // already set.
          async before(user) {
            // better-auth's generic User type doesn't reflect the `user.fields.name ->
            // "displayName"` remap below at the TS level (only at the schema/runtime level,
            // verified directly against getSchema() while building this) — narrowed to what's
            // actually on the object instead of fighting that inference.
            const seed = (user as { displayName?: string; email: string }).displayName;
            const handle = await generateUniqueHandle(db, seed || user.email);
            return { data: { ...user, handle } };
          },
        },
      },
    },

    plugins: [
      emailOTP({
        storeOTP: "hashed",
        async sendVerificationOTP({ email, otp, type }) {
          const { subject, html, text } = otpEmail(otp, "sign-in");
          await mailer.send({ to: email, subject: `${subject} (${type})`, html, text });
        },
      }),
      bearer(),
    ],
  });
}

async function generateUniqueHandle(db: Db, seed: string): Promise<string> {
  const base = slugifyForHandle(seed);
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = attempt === 0 ? base : `${base}_${Math.floor(Math.random() * 10000)}`;
    if (!isValidHandle(candidate)) continue;

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  // Astronomically unlikely to be reached (10 collisions on a slugified base), but a handle is
  // required — fall back to something guaranteed-unique rather than fail sign-in. UUIDv7's
  // hyphens aren't handle-valid, so this strips them rather than reusing generateId() directly.
  return `user_${generateId().replaceAll("-", "").slice(0, 12)}`;
}

export type Auth = ReturnType<typeof buildAuth>;
