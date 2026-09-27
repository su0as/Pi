import {
  affiliations,
  authorClaims,
  authorships,
  noteRatings,
  scoringParams,
} from "@repo/db/schema";
import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "../db.js";

const scoringParamsConfigSchema = z.object({
  requiredRatings: z.number().int().positive(),
  helpfulMeanThreshold: z.number().min(0).max(1),
  notHelpfulMeanThreshold: z.number().min(0).max(1),
  minDiversity: z.number().int().nonnegative(),
  writeRequiredRatings: z.number().int().nonnegative(),
  bootstrapMode: z.boolean(),
});

export interface ScoringConfig {
  version: number;
  requiredRatings: number;
  helpfulMeanThreshold: number;
  notHelpfulMeanThreshold: number;
  minDiversity: number;
  writeRequiredRatings: number;
  bootstrapMode: boolean;
}

/** docs/CONTEXT.md section 7.5 — "All thresholds live in scoring_params" — the highest-versioned
 * row is always current; rows are append-only (packages/db/src/schema/notes.ts's own comment). */
export async function loadScoringConfig(db: Db): Promise<ScoringConfig> {
  const [row] = await db.select().from(scoringParams).orderBy(desc(scoringParams.version)).limit(1);
  if (!row) {
    throw new Error("no scoring_params row exists — run the seed script");
  }
  const parsed = scoringParamsConfigSchema.parse(row.params);
  return { version: row.version, ...parsed };
}

/** docs/CONTEXT.md section 7.4 — "any active account with a verified affiliation or linked
 * ORCID." An approved author_claims row with method "orcid" is this repo's only notion of a
 * linked-and-verified ORCID (packages/db/src/schema/users.ts has no separate orcid-link table). */
export async function hasVerifiedIdentity(db: Db, userId: string): Promise<boolean> {
  const [affiliation] = await db
    .select({ id: affiliations.id })
    .from(affiliations)
    .where(
      and(
        eq(affiliations.userId, userId),
        isNotNull(affiliations.verifiedAt),
        or(isNull(affiliations.expiresAt), gt(affiliations.expiresAt, new Date())),
      ),
    )
    .limit(1);
  if (affiliation) return true;

  const [orcidClaim] = await db
    .select({ id: authorClaims.id })
    .from(authorClaims)
    .where(
      and(
        eq(authorClaims.userId, userId),
        eq(authorClaims.method, "orcid"),
        eq(authorClaims.status, "approved"),
      ),
    )
    .limit(1);
  return !!orcidClaim;
}

export async function countCompletedRatings(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ id: noteRatings.id })
    .from(noteRatings)
    .where(eq(noteRatings.raterUserId, userId));
  return rows.length;
}

/** docs/CONTEXT.md section 7.4 — "co-authors of the work (via an approved author claim) cannot
 * rate notes on it." Resolved per-call (not cached) so a claim approved *after* a rating was
 * submitted still excludes it from later scorer recomputes — see packages/core's `CountedRating`
 * doc comment on why this can't just be checked once at submission time. */
export async function isCoAuthorOfWork(db: Db, userId: string, workId: string): Promise<boolean> {
  const rows = await db
    .select({ id: authorClaims.id })
    .from(authorClaims)
    .innerJoin(authorships, eq(authorships.personId, authorClaims.personId))
    .where(
      and(
        eq(authorClaims.userId, userId),
        eq(authorClaims.status, "approved"),
        eq(authorships.workId, workId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function hasApprovedClaimOnWorkAuthor(
  db: Db,
  userId: string,
  workId: string,
): Promise<boolean> {
  return isCoAuthorOfWork(db, userId, workId);
}

/** docs/CONTEXT.md section 7.5 — "diversity key v0 = (institution_id, normalized department)."
 * Uses the rater's most recently verified affiliation; `null` (no affiliation on file at all)
 * means this rating counts toward N/H but never toward diversity — see packages/core's
 * `CountedRating` doc comment. */
export async function resolveDiversityKey(db: Db, userId: string): Promise<string | null> {
  const [affiliation] = await db
    .select({ institutionId: affiliations.institutionId, department: affiliations.department })
    .from(affiliations)
    .where(and(eq(affiliations.userId, userId), isNotNull(affiliations.verifiedAt)))
    .orderBy(desc(affiliations.verifiedAt))
    .limit(1);
  if (!affiliation) return null;

  const normalizedDepartment = affiliation.department?.trim().toLowerCase() ?? "";
  return `${affiliation.institutionId}:${normalizedDepartment}`;
}
