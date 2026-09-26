import { loadApiEnv } from "@repo/config/env/api";
import { generateId } from "@repo/core";
import { institutions, users } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { createApiDb } from "./db.js";
import { createMailer } from "./mailer.js";
import { waitForEmailTo } from "./test-mailpit.js";
import { json } from "./test-utils.js";

function extractOtp(text: string): string {
  const match = text.match(/\b(\d{6})\b/);
  if (!match?.[1]) throw new Error(`No 6-digit code found in email body: ${text}`);
  return match[1];
}

describe("auth (email OTP sign-in, affiliation verification, /v1/me)", () => {
  const env = loadApiEnv();
  const db = createApiDb(env);
  const logger = pino({ enabled: false });
  const mailer = createMailer(env);
  const app = buildApp({ env, db, logger, mailer });

  const testDomain = `test-${crypto.randomUUID().slice(0, 8)}.example`;

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
    await db.$client.end();
  });

  async function signInNewUser(email: string): Promise<{ token: string; userId: string }> {
    const sendRes = await app.request("/v1/auth/email-otp/send-verification-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, type: "sign-in" }),
    });
    expect(sendRes.status).toBe(200);

    const message = await waitForEmailTo(email);
    const otp = extractOtp(message.Text);

    const signInRes = await app.request("/v1/auth/sign-in/email-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, otp }),
    });
    expect(signInRes.status).toBe(200);
    const token = signInRes.headers.get("set-auth-token");
    if (!token) throw new Error("sign-in succeeded but no set-auth-token header was returned");

    const body = await json<{ user: { id: string } }>(signInRes);
    return { token, userId: body.user.id };
  }

  it("signs in a new user via email OTP, verified through Mailpit, and auto-generates a handle", async () => {
    const email = `new-user-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const { userId } = await signInNewUser(email);

    const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    expect(row).toBeDefined();
    expect(row?.handle).toBeTruthy();
    expect(row?.handle).toMatch(/^[a-z0-9_]{3,20}$/);
    expect(row?.email).toBe(email);
  });

  it("rejects a bearer token that doesn't correspond to a real session", async () => {
    const res = await app.request("/v1/auth/get-session", {
      headers: { authorization: "Bearer not-a-real-token" },
    });
    // better-auth returns 200 with a null body for "no session," not a 401, for this endpoint.
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  describe("affiliation verification", () => {
    it("verifies an institutional email, matches its domain, and records the affiliation", async () => {
      const userEmail = `student-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const { token } = await signInNewUser(userEmail);
      const authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };

      const institutionEmail = `alice@${testDomain}`;
      const startRes = await app.request("/v1/me/affiliations/verify/start", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ institutionEmail }),
      });
      expect(startRes.status).toBe(200);

      const message = await waitForEmailTo(institutionEmail);
      const otp = extractOtp(message.Text);

      const confirmRes = await app.request("/v1/me/affiliations/verify/confirm", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: otp, department: "School of Testing", position: "phd" }),
      });
      expect(confirmRes.status).toBe(200);
      const body = await json<{ institutionName: string; expiresAt: string | null }>(confirmRes);
      expect(body.institutionName).toBe("Test Institution");
      // "phd" is a student position — CONTEXT.md section 6.2: yearly re-verification.
      expect(body.expiresAt).toBeTruthy();
    });

    it("rejects a wrong OTP code", async () => {
      const userEmail = `student-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const { token } = await signInNewUser(userEmail);
      const authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };

      const institutionEmail = `bob@${testDomain}`;
      await app.request("/v1/me/affiliations/verify/start", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ institutionEmail }),
      });
      await waitForEmailTo(institutionEmail);

      const confirmRes = await app.request("/v1/me/affiliations/verify/confirm", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: "000000", department: "X", position: "phd" }),
      });
      expect(confirmRes.status).toBe(400);
    });

    it("rejects an email domain that doesn't match any known institution", async () => {
      const userEmail = `student-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const { token } = await signInNewUser(userEmail);
      const authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };

      const institutionEmail = "someone@totally-unrecognized-domain.invalid";
      await app.request("/v1/me/affiliations/verify/start", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ institutionEmail }),
      });
      const message = await waitForEmailTo(institutionEmail);
      const otp = extractOtp(message.Text);

      const confirmRes = await app.request("/v1/me/affiliations/verify/confirm", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ code: otp, department: "X", position: "phd" }),
      });
      expect(confirmRes.status).toBe(422);
    });
  });

  describe("PATCH /v1/me/handle", () => {
    it("updates the handle, then blocks a second change within 30 days", async () => {
      const userEmail = `handle-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const { token } = await signInNewUser(userEmail);
      const authHeaders = { authorization: `Bearer ${token}`, "content-type": "application/json" };
      const newHandle = `handle_${crypto.randomUUID().slice(0, 8)}`;

      const firstRes = await app.request("/v1/me/handle", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ handle: newHandle }),
      });
      expect(firstRes.status).toBe(200);

      const secondRes = await app.request("/v1/me/handle", {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({ handle: `${newHandle}_2` }),
      });
      expect(secondRes.status).toBe(429);
    });

    it("rejects an unauthenticated request", async () => {
      const res = await app.request("/v1/me/handle", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handle: "whoever" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /v1/me/export", () => {
    it("emails a JSON export to the user's own address", async () => {
      const userEmail = `export-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const { token } = await signInNewUser(userEmail);

      const res = await app.request("/v1/me/export", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.status).toBe(200);

      const message = await waitForEmailTo(userEmail, 8000);
      expect(message.Text).toContain(userEmail);
      expect(message.Text).toContain("exportedAt");
    });
  });

  describe("DELETE /v1/me", () => {
    it("soft-deletes and anonymizes the account, and revokes the session", async () => {
      const userEmail = `delete-${crypto.randomUUID().slice(0, 8)}@example.com`;
      const { token, userId } = await signInNewUser(userEmail);

      const deleteRes = await app.request("/v1/me", {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      });
      expect(deleteRes.status).toBe(200);

      const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      expect(row?.status).toBe("deleted");
      expect(row?.displayName).toBe("Deleted user");
      expect(row?.email).not.toBe(userEmail);

      const sessionRes = await app.request("/v1/auth/get-session", {
        headers: { authorization: `Bearer ${token}` },
      });
      expect(await sessionRes.json()).toBeNull();
    });
  });
});
