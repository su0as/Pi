export type { CountedRating, Scorer, ScorerInputs, ScorerResult, ScoringParams } from "./types.js";
export { scorerV0 } from "./v0.js";

/** docs/CONTEXT.md section 7.5's stated launch defaults — the actual source of truth is always
 * the highest-versioned row in `scoring_params` (seeded with these same values); this constant is
 * only for seeding that row and for tests, never read directly by a scoring call. */
export const DEFAULT_SCORING_PARAMS = {
  version: 1,
  requiredRatings: 3,
  helpfulMeanThreshold: 0.67,
  notHelpfulMeanThreshold: 0.33,
  minDiversity: 2,
};
