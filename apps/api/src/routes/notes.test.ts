import { loadApiEnv } from "@repo/config/env/api";
import { generateId } from "@repo/core";
import {
  authorReplies,
  institutions,
  noteEvidence,
  noteRatings,
  noteStatusHistory,
  notes,
} from "@repo/db/schema";
import { eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createApiDb } from "../db.js";
import { createMailer } from "../mailer.js";
import { waitForEmailTo } from "../test-mailpit.js";
import { json } from "../test-utils.js";

function extractOtp(text: string): string {
  const match = text.match(/\b(\d{6})\b/);
  if (!match?.[1]) throw new Error(`No 6-digit code found in email body: ${text}`);
  return match[1];
}

describe("notes, ratings, replies, and moderation", () => {
  const env = loadApiEnv();
  const db = createApiDb(env);
  const logger = pino({ enabled: false });
  const mailer = createMailer(env);
  const app = buildApp({ env, db, logger, mailer });

  const testDomain = `test-${crypto.randomUUID().slice(0, 8)}.example`;
  const cleanupNoteIds: string[] = [];

  beforeAll(async () => {
    await db.insert(institutions).values({
      id: generateId(),
      rorId: `test-${crypto.randomUUID()}`,
      name: "Test Institution",
      country: "SG",
      emailDomains: [testDomain],
    });
  });

  afterAll(async () => {
    for (const noteId of cleanupNoteIds) {
      await db.delete(noteStatusHistory).where(eq(noteStatusHistory.noteId, noteId));
      await db.delete(authorReplies).where(eq(authorReplies.noteId, noteId));
      await db.delete(noteRatings).where(eq(noteRatings.noteId, noteId));
      await db.delete(noteEvidence).where(eq(noteEvidence.noteId, noteId));
      await db.delete(notes).where(eq(notes.id, noteId));
    }
    // Test users are intentionally left in place, not hard-deleted: they're referenced by
    // affiliations/notifications/sessions/etc. with no cascade, same low-stakes leftover pattern
    // already accepted for e.g. packages/sources' seed-fixture `persons` rows.
    await db.$client.end();
  });

  async function signInAndVerify(department: string): Promise<{ token: string; userId: string }> {
    const email = `user-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const sendRes = await app.request("/v1/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" }),
    });
    expect(sendRes.status).toBe(200);
    const signInOtp = extractOtp((await waitForEmailTo(email)).Text);
    const signInRes = await app.request("/v1/auth/sign-in/email-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp: signInOtp }),
    });
    const token = signInRes.headers.get("set-auth-token");
    if (!token) throw new Error("no set-auth-token header");
    const { user } = await json<{ user: { id: string } }>(signInRes);

    const authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };
    const institutionEmail = `${crypto.randomUUID().slice(0, 8)}@${testDomain}`;
    await app.request("/v1/me/affiliations/verify/start", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ institutionEmail }),
    });
    const affOtp = extractOtp((await waitForEmailTo(institutionEmail)).Text);
    const confirmRes = await app.request("/v1/me/affiliations/verify/confirm", {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ code: affOtp, department, position: "postdoc" }),
    });
    expect(confirmRes.status).toBe(200);

    return { token, userId: user.id };
  }

  function authHeaders(token: string) {
    return { authorization: `Bearer ${token}`, "content-type": "application/json" };
  }

  it("full lifecycle: write, rate to HELPFUL with 2 diversity keys, author reply, and notifications", async () => {
    const author = await signInAndVerify("Department of Testing");

    // 1706.03762 is already ingested (M1 seed) — resolving it needs no live network/fixture.
    const resolveRes = await app.request("/v1/works/resolve?id=1706.03762");
    const { workId } = await json<{ workId: string }>(resolveRes);

    const createRes = await app.request(`/v1/works/${workId}/notes`, {
      method: "POST",
      headers: authHeaders(author.token),
      body: JSON.stringify({
        workId,
        type: "correction",
        body: "The reported BLEU score in Table 2 appears to be transcribed incorrectly.",
        evidence: [{ kind: "citation", url: "https://example.com/errata", label: "Errata" }],
      }),
    });
    expect(createRes.status).toBe(201);
    const note = await json<{ id: string; status: string }>(createRes);
    cleanupNoteIds.push(note.id);
    expect(note.status).toBe("needs_more_ratings");

    // Self-rating is forbidden.
    const selfRateRes = await app.request(`/v1/notes/${note.id}/ratings`, {
      method: "POST",
      headers: authHeaders(author.token),
      body: JSON.stringify({ value: "helpful", reasons: [] }),
    });
    expect(selfRateRes.status).toBe(403);

    // 3 independent raters, 2 distinct departments (diversity = 2).
    const rater1 = await signInAndVerify("Department A");
    const rater2 = await signInAndVerify("Department B");
    const rater3 = await signInAndVerify("Department A");

    for (const rater of [rater1, rater2, rater3]) {
      const res = await app.request(`/v1/notes/${note.id}/ratings`, {
        method: "POST",
        headers: authHeaders(rater.token),
        body: JSON.stringify({ value: "helpful", reasons: [] }),
      });
      expect(res.status).toBe(200);
    }

    const [finalNote] = await db.select().from(notes).where(eq(notes.id, note.id)).limit(1);
    expect(finalNote?.status).toBe("currently_rated_helpful");

    const history = await db
      .select()
      .from(noteStatusHistory)
      .where(eq(noteStatusHistory.noteId, note.id));
    expect(history.length).toBeGreaterThan(0);
    const latest = history.at(-1);
    expect(latest?.inputs).toMatchObject({ n: 3, diversity: 2 });

    // Editable: a rater changes their mind — status recomputes again (still helpful with mean 2/3).
    const editRes = await app.request(`/v1/notes/${note.id}/ratings`, {
      method: "POST",
      headers: authHeaders(rater3.token),
      body: JSON.stringify({ value: "not_helpful", reasons: [] }),
    });
    expect(editRes.status).toBe(200);
    const ratingRows = await db.select().from(noteRatings).where(eq(noteRatings.noteId, note.id));
    expect(ratingRows).toHaveLength(3); // updated in place, not duplicated

    // Author reply requires an approved author claim — this author has none, so it's forbidden.
    const replyRes = await app.request(`/v1/notes/${note.id}/replies`, {
      method: "POST",
      headers: authHeaders(author.token),
      body: JSON.stringify({ body: "Thanks, fixed in v8." }),
    });
    expect(replyRes.status).toBe(403);
  });

  it("returns 403 for a signed-in user with no verified affiliation or ORCID", async () => {
    const email = `unverified-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const sendRes = await app.request("/v1/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" }),
    });
    expect(sendRes.status).toBe(200);
    const otp = extractOtp((await waitForEmailTo(email)).Text);
    const signInRes = await app.request("/v1/auth/sign-in/email-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    const token = signInRes.headers.get("set-auth-token");
    if (!token) throw new Error("no token");

    const resolveRes = await app.request("/v1/works/resolve?id=1706.03762");
    const { workId } = await json<{ workId: string }>(resolveRes);

    const res = await app.request(`/v1/works/${workId}/notes`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        workId,
        type: "helpful_resource",
        body: "See also this talk.",
        evidence: [],
      }),
    });
    expect(res.status).toBe(403);
  });

  it("reports and blocks require sign-in and work end-to-end", async () => {
    const reporter = await signInAndVerify("Department of Reporting");
    const target = await signInAndVerify("Department of Targets");

    const reportRes = await app.request("/v1/reports", {
      method: "POST",
      headers: authHeaders(reporter.token),
      body: JSON.stringify({ targetType: "user", targetId: target.userId, reason: "spam" }),
    });
    expect(reportRes.status).toBe(201);

    const blockRes = await app.request(`/v1/users/${target.userId}/block`, {
      method: "POST",
      headers: authHeaders(reporter.token),
    });
    expect(blockRes.status).toBe(204);

    const selfBlockRes = await app.request(`/v1/users/${reporter.userId}/block`, {
      method: "POST",
      headers: authHeaders(reporter.token),
    });
    expect(selfBlockRes.status).toBe(400);

    const unblockRes = await app.request(`/v1/users/${target.userId}/block`, {
      method: "DELETE",
      headers: authHeaders(reporter.token),
    });
    expect(unblockRes.status).toBe(204);
  });
});
