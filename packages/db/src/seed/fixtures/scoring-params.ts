/**
 * docs/CONTEXT.md section 7.5's stated launch defaults, mirrored (not imported — packages/db
 * can't depend on @repo/core, which itself depends on @repo/db, per ADR-0001's circular-dependency
 * note) from packages/core/src/scorer/index.ts's `DEFAULT_SCORING_PARAMS`. If one changes, so
 * must the other — there's no way to enforce that at the type level across the dependency
 * boundary, only by comment.
 */
export const scoringParamsFixture = {
  version: 1,
  params: {
    requiredRatings: 3,
    helpfulMeanThreshold: 0.67,
    notHelpfulMeanThreshold: 0.33,
    minDiversity: 2,
    // docs/CONTEXT.md section 7.4 — write eligibility: N ratings completed (default 5); "a
    // bootstrap_mode flag sets N = 0 during seeding." True here since this repo has no real raters
    // yet; flip to false once launched.
    writeRequiredRatings: 5,
    bootstrapMode: true,
  },
};
