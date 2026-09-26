import type { Database } from "@repo/db/client";
import { generateId } from "@repo/db/id";
import {
  authorships,
  institutions,
  persons,
  topics,
  workIdentifiers,
  works,
  workTopics,
  workVersions,
} from "@repo/db/schema";
import { and, eq } from "drizzle-orm";
import { canDisplayFullText } from "./license.js";
import type { OpenAlexEnrichment } from "./openalex.js";
import type { NormalizedWork } from "./types.js";

type Db = Database;

/** `noUncheckedIndexedAccess` makes `rows[0]` possibly-undefined even right after an
 * insert/select guaranteed to return exactly one row — this documents that guarantee instead of
 * silently asserting it away at each call site (same helper as packages/db/src/seed/index.ts). */
function firstOrThrow<T>(rows: T[], what: string): T {
  const row = rows[0];
  if (!row) throw new Error(`Expected a row from ${what}, got none`);
  return row;
}

export interface UpsertResult {
  workId: string;
  created: boolean;
}

/**
 * Idempotent upsert keyed on `work_identifiers` (docs/CONTEXT.md section 9.3's "idempotent
 * upsert" requirement). Looks up an existing work by ANY of the normalized work's identifiers
 * first — a work already ingested via arXiv and later re-seen via a DOI-based OpenAlex/Crossref
 * enrichment call must resolve to the same row, not create a duplicate.
 *
 * Author/topic linking follows the M1 seed script's pattern (exact-displayName person matching,
 * topics linked only when a matching row already exists) with one deliberate difference: M4's
 * OpenAlex enrichment may introduce new openalex-scheme topics that aren't in the M1 seed
 * taxonomy, so unlike the seed script this does NOT silently skip an unseeded topic code — see
 * `linkTopics` below.
 */
export async function upsertNormalizedWork(db: Db, work: NormalizedWork): Promise<UpsertResult> {
  const existingWorkId = await findExistingWorkId(db, work);

  if (existingWorkId) {
    // Re-ingesting a known work can surface identifiers it didn't have on file yet — e.g. an
    // arXiv work later resolved by DOI through OpenAlex/Crossref enrichment (CONTEXT.md section
    // 9.3). `onConflictDoNothing` in `upsertIdentifier` makes this safe to call for identifiers
    // that already exist too.
    for (const identifier of work.identifiers) {
      await upsertIdentifier(db, existingWorkId, identifier);
    }
    await upsertVersion(db, existingWorkId, work);
    return { workId: existingWorkId, created: false };
  }

  const workRows = await db
    .insert(works)
    .values({
      id: generateId(),
      title: work.title,
      abstract: work.abstract,
      language: work.language,
      workType: work.workType,
      publishedAt: work.publishedAt,
      citationCount: 0,
    })
    .returning({ id: works.id });
  const workId = firstOrThrow(workRows, "work insert").id;

  for (const identifier of work.identifiers) {
    await upsertIdentifier(db, workId, identifier);
  }

  await upsertVersion(db, workId, work);

  for (const [index, author] of work.authors.entries()) {
    const personId = await findOrCreatePerson(db, author.name, author.orcid);
    await db.insert(authorships).values({
      id: generateId(),
      workId,
      personId,
      position: author.position ?? index + 1,
      rawName: author.name,
    });
  }

  return { workId, created: true };
}

async function findExistingWorkId(db: Db, work: NormalizedWork): Promise<string | null> {
  for (const identifier of work.identifiers) {
    const [row] = await db
      .select({ workId: workIdentifiers.workId })
      .from(workIdentifiers)
      .where(
        and(
          eq(workIdentifiers.scheme, identifier.scheme),
          eq(workIdentifiers.valueNormalized, identifier.valueNormalized),
        ),
      )
      .limit(1);
    if (row) return row.workId;
  }
  return null;
}

async function upsertIdentifier(
  db: Db,
  workId: string,
  identifier: NormalizedWork["identifiers"][number],
): Promise<void> {
  await db
    .insert(workIdentifiers)
    .values({
      id: generateId(),
      workId,
      scheme: identifier.scheme,
      valueNormalized: identifier.valueNormalized,
      valueRaw: identifier.valueRaw,
    })
    .onConflictDoNothing({
      target: [workIdentifiers.scheme, workIdentifiers.valueNormalized],
    });
}

async function upsertVersion(db: Db, workId: string, work: NormalizedWork): Promise<void> {
  const { version } = work;
  const [existing] = await db
    .select({ id: workVersions.id })
    .from(workVersions)
    .where(
      and(
        eq(workVersions.workId, workId),
        eq(workVersions.source, version.source),
        eq(workVersions.versionLabel, version.versionLabel),
      ),
    )
    .limit(1);

  const values = {
    publishedAt: version.publishedAt,
    license: version.license,
    licenseUrl: version.licenseUrl,
    canDisplayFullText: canDisplayFullText(version.licenseUrl ?? version.license),
    pdfUrl: version.pdfUrl,
    htmlUrl: version.htmlUrl,
    sourceUrl: version.sourceUrl,
  };

  if (existing) {
    await db.update(workVersions).set(values).where(eq(workVersions.id, existing.id));
    return;
  }

  await db.insert(workVersions).values({
    id: generateId(),
    workId,
    source: version.source,
    versionLabel: version.versionLabel,
    ...values,
  });
}

async function findOrCreatePerson(db: Db, displayName: string, orcid?: string): Promise<string> {
  if (orcid) {
    const [byOrcid] = await db
      .select({ id: persons.id })
      .from(persons)
      .where(eq(persons.orcid, orcid))
      .limit(1);
    if (byOrcid) return byOrcid.id;
  }

  const [byName] = await db
    .select({ id: persons.id })
    .from(persons)
    .where(eq(persons.displayName, displayName))
    .limit(1);
  if (byName) return byName.id;

  const created = await db
    .insert(persons)
    .values({ id: generateId(), displayName, orcid: orcid ?? null })
    .returning({ id: persons.id });
  return firstOrThrow(created, "person insert").id;
}

/**
 * Links a work to a topic by (scheme, code), creating the topic row if it doesn't exist yet.
 * Unlike the M1 seed script (which only links pre-seeded arXiv taxonomy codes and skips unknown
 * ones — see docs/adr/0005), M4's OpenAlex enrichment is allowed to grow the topic table
 * organically: an OpenAlex topic id/display-name pair not yet in the DB is a legitimate new
 * topic, not a data error.
 */
export async function linkTopic(
  db: Db,
  workId: string,
  topic: {
    scheme: "arxiv" | "openalex" | "mesh" | "custom";
    code: string;
    name: string;
    score: number;
  },
): Promise<void> {
  const [existingTopic] = await db
    .select({ id: topics.id })
    .from(topics)
    .where(and(eq(topics.scheme, topic.scheme), eq(topics.code, topic.code)))
    .limit(1);

  const topicId = existingTopic
    ? existingTopic.id
    : firstOrThrow(
        await db
          .insert(topics)
          .values({ id: generateId(), scheme: topic.scheme, code: topic.code, name: topic.name })
          .onConflictDoUpdate({ target: [topics.scheme, topics.code], set: { name: topic.name } })
          .returning({ id: topics.id }),
        "topic upsert",
      ).id;

  await db
    .insert(workTopics)
    .values({ workId, topicId, score: topic.score })
    .onConflictDoUpdate({
      target: [workTopics.workId, workTopics.topicId],
      set: { score: topic.score },
    });
}

async function upsertInstitution(
  db: Db,
  institution: { rorId: string; name: string; country: string | null },
): Promise<string> {
  const rows = await db
    .insert(institutions)
    .values({
      id: generateId(),
      rorId: institution.rorId,
      name: institution.name,
      country: institution.country,
    })
    .onConflictDoUpdate({
      target: institutions.rorId,
      set: { name: institution.name, country: institution.country },
    })
    .returning({ id: institutions.id });
  return firstOrThrow(rows, "institution upsert").id;
}

/**
 * Applies an OpenAlex enrichment (docs/CONTEXT.md section 9.3's "enrich arXiv works with OpenAlex
 * IDs/ROR institutions/topics when available") to an already-ingested work: upserts ROR-keyed
 * institution rows, sets `authorships.institutionId` per author position, and links every
 * enrichment topic. Run by `apps/worker`'s `work.enrich` job, never inline during initial
 * ingestion (enrichment is a separate, optional, best-effort follow-up call).
 */
export async function applyOpenAlexEnrichment(
  db: Db,
  workId: string,
  enrichment: OpenAlexEnrichment,
): Promise<void> {
  const institutionIdByRorId = new Map<string, string>();
  for (const institution of enrichment.institutions) {
    institutionIdByRorId.set(institution.rorId, await upsertInstitution(db, institution));
  }

  const authorshipRows = await db
    .select({ id: authorships.id, position: authorships.position })
    .from(authorships)
    .where(eq(authorships.workId, workId));
  const authorshipIdByPosition = new Map(authorshipRows.map((a) => [a.position, a.id]));

  for (const { position, rorIds } of enrichment.authorInstitutions) {
    const firstRorId = rorIds[0];
    if (!firstRorId) continue;
    const authorshipId = authorshipIdByPosition.get(position);
    const institutionId = institutionIdByRorId.get(firstRorId);
    if (!authorshipId || !institutionId) continue;
    await db.update(authorships).set({ institutionId }).where(eq(authorships.id, authorshipId));
  }

  for (const topic of enrichment.topics) {
    await linkTopic(db, workId, {
      scheme: "openalex",
      code: topic.code,
      name: topic.name,
      score: topic.score,
    });
  }
}
