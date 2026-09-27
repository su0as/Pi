import type {
  CountedRating,
  NoteRatingValue,
  Scorer,
  ScorerResult,
  ScoringParams,
} from "./types.js";

const VALUE_SCORE: Record<NoteRatingValue, number> = {
  helpful: 1,
  somewhat: 0.5,
  not_helpful: 0,
};

/**
 * docs/CONTEXT.md section 7.5 — "Scorer v0 (simple, launch scale)":
 * ```
 * value: helpful=1.0, somewhat=0.5, not_helpful=0.0
 * N = eligible ratings, H = mean value
 * diversity = count of distinct diversity keys among raters with value >= 0.5
 * HELPFUL      if N >= 3 and H >= 0.67 and diversity >= 2
 * NOT_HELPFUL  if N >= 3 and H <= 0.33
 * else NEEDS_MORE_RATINGS
 * ```
 * `ratings` is already the *eligible* set — COI ratings are excluded by the caller before this
 * runs (see CountedRating's doc comment) — this function has no DB access and no notion of who a
 * rater is beyond the pre-resolved `diversityKey`.
 */
function score(ratings: CountedRating[], params: ScoringParams): ScorerResult {
  const n = ratings.length;
  const h = n === 0 ? 0 : ratings.reduce((sum, r) => sum + VALUE_SCORE[r.value], 0) / n;

  const diversityKeys = new Set(
    ratings
      .filter((r) => VALUE_SCORE[r.value] >= 0.5 && r.diversityKey !== null)
      .map((r) => r.diversityKey as string),
  );
  const diversity = diversityKeys.size;

  const status =
    n >= params.requiredRatings &&
    h >= params.helpfulMeanThreshold &&
    diversity >= params.minDiversity
      ? "currently_rated_helpful"
      : n >= params.requiredRatings && h <= params.notHelpfulMeanThreshold
        ? "currently_rated_not_helpful"
        : "needs_more_ratings";

  return { status, inputs: { n, h, diversity } };
}

export const scorerV0: Scorer = { score };
