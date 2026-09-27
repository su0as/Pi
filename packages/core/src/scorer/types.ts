import type { z } from "zod";
import type { noteRatingValueSchema, noteStatusSchema } from "../schemas/enums.js";

export type NoteRatingValue = z.infer<typeof noteRatingValueSchema>;
export type NoteStatus = z.infer<typeof noteStatusSchema>;

/** docs/CONTEXT.md section 7.5 — versioned in `scoring_params`, never mutated once written. */
export interface ScoringParams {
  version: number;
  requiredRatings: number;
  helpfulMeanThreshold: number;
  notHelpfulMeanThreshold: number;
  minDiversity: number;
}

/**
 * One rating counted toward a scorer computation. Callers resolve this from `note_ratings` +
 * `affiliations` + `author_claims`/`authorships` (all DB access, so it doesn't belong in this
 * pure package) before calling `score()`:
 * - Conflict-of-interest ratings (docs/CONTEXT.md section 7.4: "their ratings are stored but
 *   weight 0") are excluded from this array entirely, not passed with a zero weight — they're
 *   still real `note_ratings` rows, just never counted.
 * - `diversityKey` is section 7.5's v0 diversity key, `(institution_id, normalized department)`,
 *   or `null` when the rater has no institution/department on file (counts toward N/H but never
 *   toward diversity).
 */
export interface CountedRating {
  value: NoteRatingValue;
  diversityKey: string | null;
}

export interface ScorerInputs {
  n: number;
  h: number;
  diversity: number;
}

export interface ScorerResult {
  status: NoteStatus;
  inputs: ScorerInputs;
}

/** docs/CONTEXT.md section 7.6 — v1's bridging-based reputation scorer "must be swappable behind
 * the same Scorer interface." */
export interface Scorer {
  score(ratings: CountedRating[], params: ScoringParams): ScorerResult;
}
