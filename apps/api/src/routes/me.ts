import { createHash, randomInt } from "node:crypto";
import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  affiliationPositionSchema,
  canEditHandle,
  confirmAffiliationVerificationInputSchema,
  generateId,
  isValidHandle,
  nextHandleEditAt,
  startAffiliationVerificationInputSchema,
  updateHandleInputSchema,
} from "@repo/core";
import {
  affiliations,
  affiliationVerifications,
  authorReplies,
  collections,
  highlights,
  institutions,
  libraryItems,
  noteRatings,
  notes,
  sessions,
  users,
} from "@repo/db/schema";
import { and, arrayContains, desc, eq, gt, isNull } from "drizzle-orm";
import { otpEmail } from "../emails/otp.js";
import { AppError } from "../lib/problem-details.js";
import type { Mailer } from "../mailer.js";
import { validationHook } from "../middleware/error-handler.js";
import { requireAuth } from "../middleware/require-auth.js";
import type { AppEnv } from "../types.js";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
// Positions that trigger yearly re-verification — docs/CONTEXT.md section 6.2:
// "Re-verification is required yearly for student positions."
const STUDENT_POSITIONS = new Set(["undergrad", "masters", "phd"]);

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function buildMeRoutes(mailer: Mailer) {
  const me = new OpenAPIHono<AppEnv>({ defaultHook: validationHook });

  me.use("*", requireAuth);

  // --- PATCH /handle -------------------------------------------------------

  const updateHandleRoute = createRoute({
    method: "patch",
    path: "/handle",
    request: {
      body: { content: { "application/json": { schema: updateHandleInputSchema } } },
    },
    responses: {
      200: {
        description: "Handle updated",
        content: { "application/json": { schema: z.object({ handle: z.string() }) } },
      },
      409: { description: "Handle taken", content: { "application/json": { schema: z.any() } } },
      429: {
        description: "Still within the 30-day cooldown",
        content: { "application/json": { schema: z.any() } },
      },
    },
  });

  me.openapi(updateHandleRoute, async (c) => {
    const userId = c.get("userId") as string;
    const db = c.get("db");
    const { handle } = c.req.valid("json");

    if (!isValidHandle(handle)) {
      throw new AppError(400, "invalid_handle", "lowercase letters, numbers, underscores only.");
    }

    const [current] = await db
      .select({ handleChangedAt: users.handleChangedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!current) throw new AppError(401, "unauthenticated", "Sign in required.");

    if (!canEditHandle(current.handleChangedAt)) {
      const nextAt = nextHandleEditAt(current.handleChangedAt);
      throw new AppError(
        429,
        "handle_cooldown",
        `Handle was changed too recently. Try again after ${nextAt?.toISOString()}.`,
      );
    }

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.handle, handle))
      .limit(1);
    if (existing && existing.id !== userId) {
      throw new AppError(409, "handle_taken", "That handle is already in use.");
    }

    await db.update(users).set({ handle, handleChangedAt: new Date() }).where(eq(users.id, userId));

    return c.json({ handle }, 200);
  });

  // --- POST /affiliations/verify/start --------------------------------------

  const startVerifyRoute = createRoute({
    method: "post",
    path: "/affiliations/verify/start",
    request: {
      body: {
        content: { "application/json": { schema: startAffiliationVerificationInputSchema } },
      },
    },
    responses: {
      200: {
        description: "OTP sent",
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
      },
    },
  });

  me.openapi(startVerifyRoute, async (c) => {
    const userId = c.get("userId") as string;
    const db = c.get("db");
    const { institutionEmail } = c.req.valid("json");

    const code = generateOtp();
    await db.insert(affiliationVerifications).values({
      id: generateId(),
      userId,
      institutionEmail,
      otpHash: hashOtp(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    });

    const { subject, html, text } = otpEmail(code, "affiliation-verification");
    await mailer.send({ to: institutionEmail, subject, html, text });

    return c.json({ ok: true }, 200);
  });

  // --- POST /affiliations/verify/confirm ------------------------------------

  const confirmVerifyRoute = createRoute({
    method: "post",
    path: "/affiliations/verify/confirm",
    request: {
      body: {
        content: { "application/json": { schema: confirmAffiliationVerificationInputSchema } },
      },
    },
    responses: {
      200: {
        description: "Affiliation recorded",
        content: {
          "application/json": {
            schema: z.object({
              institutionName: z.string(),
              department: z.string(),
              position: affiliationPositionSchema,
              expiresAt: z.string().nullable(),
            }),
          },
        },
      },
    },
  });

  me.openapi(confirmVerifyRoute, async (c) => {
    const userId = c.get("userId") as string;
    const db = c.get("db");
    const { code, department, position } = c.req.valid("json");

    const [pending] = await db
      .select()
      .from(affiliationVerifications)
      .where(
        and(
          eq(affiliationVerifications.userId, userId),
          isNull(affiliationVerifications.consumedAt),
          gt(affiliationVerifications.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(affiliationVerifications.createdAt))
      .limit(1);

    if (!pending) {
      throw new AppError(400, "no_pending_verification", "Start verification again.");
    }
    if (pending.attempts >= OTP_MAX_ATTEMPTS) {
      throw new AppError(429, "too_many_attempts", "Start verification again.");
    }
    if (pending.otpHash !== hashOtp(code)) {
      await db
        .update(affiliationVerifications)
        .set({ attempts: pending.attempts + 1 })
        .where(eq(affiliationVerifications.id, pending.id));
      throw new AppError(400, "invalid_code", "That code is incorrect.");
    }

    const domain = pending.institutionEmail.split("@")[1]?.toLowerCase();
    if (!domain) {
      throw new AppError(400, "invalid_email", "Malformed institutional email.");
    }

    const [institution] = await db
      .select()
      .from(institutions)
      .where(arrayContains(institutions.emailDomains, [domain]))
      .limit(1);
    if (!institution) {
      throw new AppError(
        422,
        "domain_not_recognized",
        `${domain} isn't a recognized institutional domain yet.`,
      );
    }

    const expiresAt = STUDENT_POSITIONS.has(position)
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : null;

    await db.transaction(async (tx) => {
      await tx
        .update(affiliationVerifications)
        .set({ consumedAt: new Date() })
        .where(eq(affiliationVerifications.id, pending.id));

      await tx
        .insert(affiliations)
        .values({
          id: generateId(),
          userId,
          institutionId: institution.id,
          department,
          position,
          verificationMethod: "institutional_email",
          verifiedEmailDomain: domain,
          verifiedAt: new Date(),
          expiresAt,
        })
        .onConflictDoUpdate({
          target: [affiliations.userId, affiliations.institutionId],
          set: {
            department,
            position,
            verificationMethod: "institutional_email",
            verifiedEmailDomain: domain,
            verifiedAt: new Date(),
            expiresAt,
          },
        });
    });

    return c.json(
      {
        institutionName: institution.name,
        department,
        position,
        expiresAt: expiresAt?.toISOString() ?? null,
      },
      200,
    );
  });

  // --- POST /export ----------------------------------------------------------

  const exportRoute = createRoute({
    method: "post",
    path: "/export",
    responses: {
      200: {
        description: "Export emailed",
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
      },
    },
  });

  me.openapi(exportRoute, async (c) => {
    const userId = c.get("userId") as string;
    const db = c.get("db");

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw new AppError(401, "unauthenticated", "Sign in required.");

    // Gathers whatever these tables currently hold for this user — most are still empty at M3
    // (their write paths land in later milestones), which is fine: the export is complete for
    // what exists today, not a promise about what will exist later.
    const [
      userAffiliations,
      userLibraryItems,
      userCollections,
      userHighlights,
      userNotes,
      userNoteRatings,
      userAuthorReplies,
    ] = await Promise.all([
      db.select().from(affiliations).where(eq(affiliations.userId, userId)),
      db.select().from(libraryItems).where(eq(libraryItems.userId, userId)),
      db.select().from(collections).where(eq(collections.userId, userId)),
      db.select().from(highlights).where(eq(highlights.userId, userId)),
      db.select().from(notes).where(eq(notes.authorUserId, userId)),
      db.select().from(noteRatings).where(eq(noteRatings.raterUserId, userId)),
      db.select().from(authorReplies).where(eq(authorReplies.userId, userId)),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        handle: user.handle,
        displayName: user.displayName,
        email: user.email,
        bio: user.bio,
        locale: user.locale,
        createdAt: user.createdAt,
      },
      affiliations: userAffiliations,
      libraryItems: userLibraryItems,
      collections: userCollections,
      highlights: userHighlights,
      notes: userNotes,
      noteRatings: userNoteRatings,
      authorReplies: userAuthorReplies,
    };

    // Emailed inline (not "a link" — CONTEXT.md's ObjectStore interface doesn't exist until M5;
    // see docs/adr/0007 for the full reasoning). Generated synchronously here, not queued —
    // apps/worker's job runner doesn't exist until M4 either.
    const json = JSON.stringify(payload, null, 2);
    await mailer.send({
      to: user.email,
      subject: "Your data export",
      html: `<p>Your data export is attached below.</p><pre style="white-space: pre-wrap; font-size: 12px;">${json}</pre>`,
      text: json,
    });

    return c.json({ ok: true }, 200);
  });

  // --- DELETE / (account deletion) --------------------------------------------

  const deleteRoute = createRoute({
    method: "delete",
    path: "/",
    responses: {
      200: {
        description: "Account soft-deleted",
        content: { "application/json": { schema: z.object({ ok: z.boolean() }) } },
      },
    },
  });

  me.openapi(deleteRoute, async (c) => {
    const userId = c.get("userId") as string;
    const db = c.get("db");

    await db.transaction(async (tx) => {
      // Anonymized immediately (public content attribution) — CONTEXT.md section 6.2's account
      // deletion spec. The actual row purge after a retention window is a scheduled job that
      // needs apps/worker (M4) — known gap, tracked here, not silently dropped.
      await tx
        .update(users)
        .set({
          status: "deleted",
          deletedAt: new Date(),
          displayName: "Deleted user",
          handle: `deleted_${userId.replaceAll("-", "").slice(0, 12)}`,
          email: `${userId}@deleted.invalid`,
          bio: null,
          avatarKey: null,
          image: null,
        })
        .where(eq(users.id, userId));

      // Revokes every session immediately — a deleted account shouldn't stay signed in on
      // devices it's already authenticated on.
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    });

    return c.json({ ok: true }, 200);
  });

  return me;
}
