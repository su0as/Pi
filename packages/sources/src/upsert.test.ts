import { createDb } from "@repo/db/client";
import { generateId } from "@repo/db/id";
import {
  authorships,
  institutions,
  topics,
  workIdentifiers,
  works,
  workTopics,
  workVersions,
} from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { OpenAlexEnrichment } from "./openalex";
import type { NormalizedWork } from "./types";
import { applyOpenAlexEnrichment, linkTopic, upsertNormalizedWork } from "./upsert";

// Real Postgres, not mocked — this repo's testing philosophy (CLAUDE.md) is integration tests
// against a real database. Requires `docker compose up -d` (the `postgres` service).
const db = createDb(
  process.env.DATABASE_URL ?? "postgres://pi:pi_dev_password@localhost:5432/pi_dev",
);

function arxivWork(overrides: Partial<NormalizedWork> = {}): NormalizedWork {
  return {
    title: "A Scalable Multi-Robot Framework",
    abstract: "We develop a decentralized system.",
    language: null,
    workType: "preprint",
    publishedAt: new Date("2023-09-18"),
    identifiers: [
      { scheme: "arxiv", valueNormalized: "2309.10164-test", valueRaw: "2309.10164-test" },
    ],
    authors: [
      { name: "Saurav Agarwal", position: 1 },
      { name: "Frederic Vatnsdal", position: 2 },
    ],
    categories: ["cs.RO"],
    version: {
      source: "arxiv",
      versionLabel: "v1",
      publishedAt: new Date("2023-09-18"),
      license: "http://creativecommons.org/licenses/by/4.0/",
      licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
      pdfUrl: "https://arxiv.org/pdf/2309.10164-test",
      htmlUrl: "https://arxiv.org/abs/2309.10164-test",
      sourceUrl: "https://arxiv.org/abs/2309.10164-test",
    },
    ...overrides,
  };
}

async function cleanupWork(arxivId: string): Promise<void> {
  const [identifier] = await db
    .select({ workId: workIdentifiers.workId })
    .from(workIdentifiers)
    .where(eq(workIdentifiers.valueNormalized, arxivId))
    .limit(1);
  if (!identifier) return;

  await db.delete(workTopics).where(eq(workTopics.workId, identifier.workId));
  await db.delete(authorships).where(eq(authorships.workId, identifier.workId));
  await db.delete(workVersions).where(eq(workVersions.workId, identifier.workId));
  await db.delete(workIdentifiers).where(eq(workIdentifiers.workId, identifier.workId));
  await db.delete(works).where(eq(works.id, identifier.workId));
}

afterAll(async () => {
  await cleanupWork("2309.10164-test");
  await db.$client.end();
});

beforeEach(async () => {
  await cleanupWork("2309.10164-test");
});

describe("upsertNormalizedWork", () => {
  it("creates a new work with its identifier, version, and authors", async () => {
    const result = await upsertNormalizedWork(db, arxivWork());
    expect(result.created).toBe(true);

    const [work] = await db.select().from(works).where(eq(works.id, result.workId)).limit(1);
    expect(work?.title).toBe("A Scalable Multi-Robot Framework");

    const identifiers = await db
      .select()
      .from(workIdentifiers)
      .where(eq(workIdentifiers.workId, result.workId));
    expect(identifiers).toHaveLength(1);
    expect(identifiers[0]?.scheme).toBe("arxiv");

    const versions = await db
      .select()
      .from(workVersions)
      .where(eq(workVersions.workId, result.workId));
    expect(versions).toHaveLength(1);
    expect(versions[0]?.canDisplayFullText).toBe(true); // CC-BY license, derived not guessed

    const authors = await db
      .select()
      .from(authorships)
      .where(eq(authorships.workId, result.workId));
    expect(authors).toHaveLength(2);
    expect(authors.map((a) => a.rawName).sort()).toEqual(["Frederic Vatnsdal", "Saurav Agarwal"]);
  });

  it("is idempotent: re-ingesting the same identifier updates the existing work instead of duplicating it", async () => {
    const first = await upsertNormalizedWork(db, arxivWork());
    const second = await upsertNormalizedWork(
      db,
      arxivWork({ version: { ...arxivWork().version, license: null, licenseUrl: null } }),
    );

    expect(second.created).toBe(false);
    expect(second.workId).toBe(first.workId);

    const identifiers = await db
      .select()
      .from(workIdentifiers)
      .where(eq(workIdentifiers.workId, first.workId));
    expect(identifiers).toHaveLength(1); // no duplicate identifier row

    const versions = await db
      .select()
      .from(workVersions)
      .where(eq(workVersions.workId, first.workId));
    expect(versions).toHaveLength(1); // updated in place, not a second version row
    expect(versions[0]?.license).toBeNull();
    expect(versions[0]?.canDisplayFullText).toBe(false); // license removed -> re-derived to false

    const authors = await db.select().from(authorships).where(eq(authorships.workId, first.workId));
    expect(authors).toHaveLength(2); // authors not re-inserted on the update path
  });

  it("resolves an existing work by a second identifier scheme (arXiv work later enriched with a DOI)", async () => {
    const created = await upsertNormalizedWork(db, arxivWork());
    const enriched = await upsertNormalizedWork(
      db,
      arxivWork({
        identifiers: [
          ...arxivWork().identifiers,
          { scheme: "doi", valueNormalized: "10.1234/test-doi", valueRaw: "10.1234/test-doi" },
        ],
      }),
    );

    expect(enriched.workId).toBe(created.workId);
    const identifiers = await db
      .select()
      .from(workIdentifiers)
      .where(eq(workIdentifiers.workId, created.workId));
    expect(identifiers.map((i) => i.scheme).sort()).toEqual(["arxiv", "doi"]);
  });
});

describe("linkTopic", () => {
  it("creates a new topic and links it, then updates the score on re-link without duplicating the row", async () => {
    const { workId } = await upsertNormalizedWork(db, arxivWork());
    const topicCode = `test-topic-${generateId()}`;

    try {
      await linkTopic(db, workId, {
        scheme: "openalex",
        code: topicCode,
        name: "Test Topic",
        score: 0.5,
      });
      await linkTopic(db, workId, {
        scheme: "openalex",
        code: topicCode,
        name: "Test Topic",
        score: 0.9,
      });

      const rows = await db.select().from(workTopics).where(eq(workTopics.workId, workId));
      expect(rows).toHaveLength(1);
      expect(rows[0]?.score).toBe(0.9);
    } finally {
      const [topic] = await db
        .select({ id: topics.id })
        .from(topics)
        .where(and(eq(topics.scheme, "openalex"), eq(topics.code, topicCode)))
        .limit(1);
      if (topic) {
        await db.delete(workTopics).where(eq(workTopics.topicId, topic.id));
        await db.delete(topics).where(eq(topics.id, topic.id));
      }
    }
  });
});

describe("applyOpenAlexEnrichment", () => {
  it("upserts ROR-keyed institutions, links them to authorships by position, and links topics", async () => {
    const { workId } = await upsertNormalizedWork(db, arxivWork());
    const rorId = `https://ror.org/test-${generateId()}`;
    const topicCode = `test-topic-${generateId()}`;
    const enrichment: OpenAlexEnrichment = {
      openalexId: "https://openalex.org/Wtest",
      topics: [{ code: topicCode, name: "Test Enrichment Topic", score: 0.8 }],
      institutions: [{ rorId, name: "Test University", country: "SG" }],
      authorInstitutions: [
        { position: 1, rorIds: [rorId] },
        { position: 2, rorIds: [] },
      ],
    };

    try {
      await applyOpenAlexEnrichment(db, workId, enrichment);

      const [institution] = await db
        .select()
        .from(institutions)
        .where(eq(institutions.rorId, rorId))
        .limit(1);
      expect(institution?.name).toBe("Test University");

      const authorRows = await db
        .select()
        .from(authorships)
        .where(eq(authorships.workId, workId))
        .orderBy(authorships.position);
      expect(authorRows[0]?.institutionId).toBe(institution?.id);
      expect(authorRows[1]?.institutionId).toBeNull();

      const topicRows = await db.select().from(workTopics).where(eq(workTopics.workId, workId));
      expect(topicRows).toHaveLength(1);
      expect(topicRows[0]?.score).toBe(0.8);
    } finally {
      const [topic] = await db
        .select({ id: topics.id })
        .from(topics)
        .where(and(eq(topics.scheme, "openalex"), eq(topics.code, topicCode)))
        .limit(1);
      if (topic) {
        await db.delete(workTopics).where(eq(workTopics.topicId, topic.id));
        await db.delete(topics).where(eq(topics.id, topic.id));
      }
      await db
        .update(authorships)
        .set({ institutionId: null })
        .where(eq(authorships.workId, workId));
      await db.delete(institutions).where(eq(institutions.rorId, rorId));
    }
  });
});
