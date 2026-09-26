import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadApiEnv } from "@repo/config/env/api";
import { authorships, workIdentifiers, works, workTopics, workVersions } from "@repo/db/schema";
import { eq } from "drizzle-orm";
import pino from "pino";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../app.js";
import { createApiDb } from "../db.js";
import { createMailer } from "../mailer.js";
import { json } from "../test-utils.js";

function fixture(name: string): string {
  return readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8");
}

/** Routes a fake `fetch` by a substring of the request URL to a real, captured fixture — the
 * same approach packages/sources' own connector tests use, so no live network is touched here
 * either. */
function fixtureRouter(routes: Record<string, { status: number; body: string }>): typeof fetch {
  return (async (input: string | URL) => {
    const url = String(input);
    for (const [match, { status, body }] of Object.entries(routes)) {
      if (url.includes(match)) return new Response(body, { status });
    }
    throw new Error(`fixtureRouter: no fixture registered for ${url}`);
  }) as typeof fetch;
}

describe("GET /v1/works/resolve", () => {
  const env = loadApiEnv();
  const db = createApiDb(env);
  const logger = pino({ enabled: false });
  const mailer = createMailer(env);

  const cleanupWorkIds: string[] = [];

  afterAll(async () => {
    for (const workId of cleanupWorkIds) {
      await db.delete(authorships).where(eq(authorships.workId, workId));
      await db.delete(workTopics).where(eq(workTopics.workId, workId));
      await db.delete(workVersions).where(eq(workVersions.workId, workId));
      await db.delete(workIdentifiers).where(eq(workIdentifiers.workId, workId));
      await db.delete(works).where(eq(works.id, workId));
    }
    await db.$client.end();
  });

  it("returns 400 for an id that isn't a recognizable arXiv ID/URL, DOI, or PMID", async () => {
    const app = buildApp({ env, db, logger, mailer, sourceFetchImpl: fixtureRouter({}) });
    const res = await app.request("/v1/works/resolve?id=not-an-identifier");
    expect(res.status).toBe(400);
  });

  it("ingests an unseen arXiv id synchronously, then finds it on a second call", async () => {
    // 1706.03762 is in the M1 seed fixtures, so it wouldn't exercise the ingestion path — this id
    // is a real paper (verified via a live fetch) that isn't in the seed set.
    const app = buildApp({
      env,
      db,
      logger,
      mailer,
      sourceFetchImpl: fixtureRouter({
        "id_list=2309.10164": { status: 200, body: fixture("arxiv-atom-2309.10164.xml") },
      }),
    });

    const firstRes = await app.request("/v1/works/resolve?id=2309.10164");
    expect(firstRes.status).toBe(200);
    const first = await json<{ status: string; workId: string }>(firstRes);
    expect(first.status).toBe("ingested");
    expect(first.workId).toBeTruthy();
    cleanupWorkIds.push(first.workId);

    const secondRes = await app.request("/v1/works/resolve?id=2309.10164");
    expect(secondRes.status).toBe(200);
    const second = await json<{ status: string; workId: string }>(secondRes);
    expect(second.status).toBe("found");
    expect(second.workId).toBe(first.workId);
  });

  it("ingests an unseen DOI via OpenAlex", async () => {
    const app = buildApp({
      env,
      db,
      logger,
      mailer,
      sourceFetchImpl: fixtureRouter({
        "api.openalex.org": { status: 200, body: fixture("openalex-work-W2998766662.json") },
      }),
    });

    const res = await app.request("/v1/works/resolve?id=10.7554/elife.52157");
    expect(res.status).toBe(200);
    const body = await json<{ status: string; workId: string }>(res);
    expect(body.status).toBe("ingested");
    cleanupWorkIds.push(body.workId);
  });

  it("falls back to Crossref when OpenAlex has no record of the DOI", async () => {
    const app = buildApp({
      env,
      db,
      logger,
      mailer,
      sourceFetchImpl: fixtureRouter({
        "api.openalex.org": { status: 404, body: "" },
        "api.crossref.org": {
          status: 200,
          body: fixture("crossref-work-10.7554-elife.52157.json"),
        },
      }),
    });

    const res = await app.request(
      "/v1/works/resolve?id=10.7554/elife.52157-crossref-fallback-test",
    );
    // Note: the fixture body's own DOI (10.7554/elife.52157) differs from the id queried above —
    // Crossref's fetchById normalizes off the fixture body's DOI field, not the request id, which
    // is realistic (a redirected/aliased DOI resolving to a canonical one) and still exercises the
    // fallback path end-to-end.
    expect(res.status).toBe(200);
    const body = await json<{ status: string; workId: string }>(res);
    expect(body.status).toBe("ingested");
    cleanupWorkIds.push(body.workId);
  });

  it("returns 404 when no connector has a record of the DOI", async () => {
    const app = buildApp({
      env,
      db,
      logger,
      mailer,
      sourceFetchImpl: fixtureRouter({
        "api.openalex.org": { status: 404, body: "" },
        "api.crossref.org": { status: 404, body: "Resource not found." },
      }),
    });

    const res = await app.request("/v1/works/resolve?id=10.9999/doesnotexist12345");
    expect(res.status).toBe(404);
  });

  it("returns 404 for a PMID (a scheme with no lazy-ingestion connector yet)", async () => {
    const app = buildApp({ env, db, logger, mailer, sourceFetchImpl: fixtureRouter({}) });
    const res = await app.request(
      `/v1/works/resolve?id=${encodeURIComponent("https://pubmed.ncbi.nlm.nih.gov/999999999/")}`,
    );
    expect(res.status).toBe(404);
  });
});
