import { and, eq } from "drizzle-orm";
import { createDb } from "../client.js";
import { generateId } from "../id.js";
import {
  affiliations,
  authorships,
  institutions,
  persons,
  scoringParams,
  topics,
  users,
  workIdentifiers,
  works,
  workTopics,
  workVersions,
} from "../schema/index.js";
import { demoUserFixtures } from "./fixtures/demo-users.js";
import { institutionFixtures } from "./fixtures/institutions.js";
import { scoringParamsFixture } from "./fixtures/scoring-params.js";
import { topicFixtures } from "./fixtures/topics.js";
import { workFixtures } from "./fixtures/works.js";

type Db = ReturnType<typeof createDb>;

/** `noUncheckedIndexedAccess` makes `rows[0]` come back as possibly-undefined even right after an
 * insert/upsert that's guaranteed to return exactly one row — this documents that guarantee
 * instead of silently asserting it away at each call site. */
function firstOrThrow<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`Expected a row from ${what}, got none`);
  return row;
}

async function seedInstitutions(db: Db): Promise<Map<string, string>> {
  console.info(`Seeding ${institutionFixtures.length} institutions...`);
  const idByRorId = new Map<string, string>();

  for (const fixture of institutionFixtures) {
    const rows = await db
      .insert(institutions)
      .values({
        id: generateId(),
        rorId: fixture.rorId,
        name: fixture.name,
        country: fixture.country,
        emailDomains: fixture.emailDomains,
      })
      .onConflictDoUpdate({
        target: institutions.rorId,
        set: { name: fixture.name, country: fixture.country, emailDomains: fixture.emailDomains },
      })
      .returning({ id: institutions.id });
    idByRorId.set(fixture.rorId, firstOrThrow(rows, "institution upsert").id);
  }

  return idByRorId;
}

async function seedTopics(db: Db): Promise<Map<string, string>> {
  console.info(`Seeding ${topicFixtures.length} topics...`);
  const idByCode = new Map<string, string>();

  // Top-level groups first so children can resolve parentId.
  const groups = topicFixtures.filter((t) => t.parentCode === null);
  const leaves = topicFixtures.filter((t) => t.parentCode !== null);

  for (const fixture of groups) {
    const rows = await db
      .insert(topics)
      .values({ id: generateId(), scheme: fixture.scheme, code: fixture.code, name: fixture.name })
      .onConflictDoUpdate({
        target: [topics.scheme, topics.code],
        set: { name: fixture.name },
      })
      .returning({ id: topics.id });
    idByCode.set(fixture.code, firstOrThrow(rows, "topic group upsert").id);
  }

  for (const fixture of leaves) {
    const parentId = fixture.parentCode ? (idByCode.get(fixture.parentCode) ?? null) : null;
    const rows = await db
      .insert(topics)
      .values({
        id: generateId(),
        scheme: fixture.scheme,
        code: fixture.code,
        name: fixture.name,
        parentId,
      })
      .onConflictDoUpdate({
        target: [topics.scheme, topics.code],
        set: { name: fixture.name, parentId },
      })
      .returning({ id: topics.id });
    idByCode.set(fixture.code, firstOrThrow(rows, "topic leaf upsert").id);
  }

  return idByCode;
}

async function seedDemoUsers(db: Db, institutionIdByRorId: Map<string, string>): Promise<void> {
  console.info(`Seeding ${demoUserFixtures.length} demo users...`);

  for (const fixture of demoUserFixtures) {
    const userRows = await db
      .insert(users)
      .values({
        id: generateId(),
        handle: fixture.handle,
        displayName: fixture.displayName,
        email: fixture.email,
        // Seed users are pre-verified — there's no inbox behind these addresses to click a link
        // in, and CONTEXT.md's affiliation flow (a *separate* verification from login) is what
        // these fixtures exist to exercise, not the login email-OTP flow itself.
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: users.handle,
        set: { displayName: fixture.displayName, email: fixture.email },
      })
      .returning({ id: users.id });
    const userRow = firstOrThrow(userRows, "user upsert");

    const institutionId = institutionIdByRorId.get(fixture.affiliation.institutionRorId);
    if (!institutionId) {
      console.warn(`  skipping affiliation for ${fixture.handle}: unknown institution`);
      continue;
    }

    await db
      .insert(affiliations)
      .values({
        id: generateId(),
        userId: userRow.id,
        institutionId,
        department: fixture.affiliation.department,
        position: fixture.affiliation.position,
        verificationMethod: "declared",
      })
      .onConflictDoUpdate({
        target: [affiliations.userId, affiliations.institutionId],
        set: {
          department: fixture.affiliation.department,
          position: fixture.affiliation.position,
        },
      });
  }
}

async function findOrCreatePerson(db: Db, displayName: string): Promise<string> {
  // Fixture-only simplification, not a general rule: no ORCID/OpenAlex id is available for these
  // authors, so an exact display-name match is treated as "the same person" for seed idempotency.
  const [existing] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(eq(persons.displayName, displayName))
    .limit(1);
  if (existing) return existing.id;

  const created = await db
    .insert(persons)
    .values({ id: generateId(), displayName })
    .returning({ id: persons.id });
  return firstOrThrow(created, "person insert").id;
}

async function seedWorks(db: Db, topicIdByCode: Map<string, string>): Promise<void> {
  console.info(`Seeding ${workFixtures.length} works...`);

  for (const fixture of workFixtures) {
    const [existingIdentifier] = await db
      .select({ workId: workIdentifiers.workId })
      .from(workIdentifiers)
      .where(
        and(
          eq(workIdentifiers.scheme, "arxiv"),
          eq(workIdentifiers.valueNormalized, fixture.arxivId),
        ),
      )
      .limit(1);

    if (existingIdentifier) {
      console.info(`  ${fixture.arxivId} already seeded, skipping`);
      continue;
    }

    const seededTopicCodes = fixture.topics.filter((code) => topicIdByCode.has(code));
    const primaryTopicId = seededTopicCodes[0]
      ? (topicIdByCode.get(seededTopicCodes[0]) ?? null)
      : null;

    const workRows = await db
      .insert(works)
      .values({
        id: generateId(),
        title: fixture.title,
        abstract: fixture.abstract,
        language: "en",
        workType: "preprint",
        publishedAt: new Date(fixture.publishedAt),
        primaryTopicId,
        citationCount: 0,
      })
      .returning({ id: works.id });
    const work = firstOrThrow(workRows, "work insert");

    await db.insert(workIdentifiers).values({
      id: generateId(),
      workId: work.id,
      scheme: "arxiv",
      valueNormalized: fixture.arxivId,
      valueRaw: fixture.arxivId,
    });

    await db.insert(workVersions).values({
      id: generateId(),
      workId: work.id,
      source: "arxiv",
      versionLabel: "v1",
      publishedAt: new Date(fixture.publishedAt),
      // license intentionally null — see docs/adr/0005-seed-fixture-provenance.md
      license: null,
      canDisplayFullText: false,
      pdfUrl: `https://arxiv.org/pdf/${fixture.arxivId}`,
      htmlUrl: `https://arxiv.org/abs/${fixture.arxivId}`,
      sourceUrl: `https://arxiv.org/abs/${fixture.arxivId}`,
    });

    for (const [index, authorName] of fixture.authors.entries()) {
      const personId = await findOrCreatePerson(db, authorName);
      await db.insert(authorships).values({
        id: generateId(),
        workId: work.id,
        personId,
        position: index + 1,
        rawName: authorName,
      });
    }

    for (const code of seededTopicCodes) {
      const topicId = topicIdByCode.get(code);
      if (!topicId) continue; // see docs/adr/0005 — categories outside the seeded taxonomy
      await db.insert(workTopics).values({
        workId: work.id,
        topicId,
        score: code === seededTopicCodes[0] ? 1 : 0.5,
      });
    }
  }
}

async function seedScoringParams(db: Db): Promise<void> {
  console.info("Seeding scoring_params...");
  await db
    .insert(scoringParams)
    .values({ id: generateId(), ...scoringParamsFixture })
    .onConflictDoNothing({ target: scoringParams.version });
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the seed script");
  }

  const db = createDb(databaseUrl);

  const institutionIdByRorId = await seedInstitutions(db);
  const topicIdByCode = await seedTopics(db);
  await seedDemoUsers(db, institutionIdByRorId);
  await seedWorks(db, topicIdByCode);
  await seedScoringParams(db);

  console.info("Seed complete.");
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
