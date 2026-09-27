import { describe, expect, it } from "vitest";
import { DEFAULT_SCORING_PARAMS, scorerV0 } from "./index.js";
import type { CountedRating } from "./types.js";

const params = DEFAULT_SCORING_PARAMS; // requiredRatings=3, helpful>=0.67, notHelpful<=0.33, diversity>=2

function rating(value: CountedRating["value"], diversityKey: string | null = null): CountedRating {
  return { value, diversityKey };
}

describe("scorerV0", () => {
  it("is NEEDS_MORE_RATINGS with zero ratings", () => {
    const result = scorerV0.score([], params);
    expect(result).toEqual({ status: "needs_more_ratings", inputs: { n: 0, h: 0, diversity: 0 } });
  });

  describe("the N threshold (requiredRatings)", () => {
    it("stays NEEDS_MORE_RATINGS at N=2 even with a perfect, diverse mean", () => {
      const ratings = [rating("helpful", "a"), rating("helpful", "b")];
      expect(scorerV0.score(ratings, params).status).toBe("needs_more_ratings");
    });

    it("becomes HELPFUL at exactly N=3 once mean and diversity thresholds are also met", () => {
      const ratings = [rating("helpful", "a"), rating("helpful", "b"), rating("helpful", "c")];
      expect(scorerV0.score(ratings, params).status).toBe("currently_rated_helpful");
    });
  });

  describe("the helpful mean threshold (H >= 0.67)", () => {
    it("is NEEDS_MORE_RATINGS with a mixed mean below the threshold (1 helpful + 1 somewhat + 1 not_helpful = 0.5)", () => {
      const ratings = [rating("helpful", "a"), rating("somewhat", "b"), rating("not_helpful", "c")];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.h).toBeCloseTo(0.5, 5);
      expect(result.status).toBe("needs_more_ratings");
    });

    it("is HELPFUL exactly at H = 0.67 (67 helpful / 33 not_helpful out of 100, with 2 diversity keys)", () => {
      const ratings: CountedRating[] = [
        ...Array.from({ length: 67 }, (_, i) => rating("helpful", i % 2 === 0 ? "a" : "b")),
        ...Array.from({ length: 33 }, () => rating("not_helpful", "c")),
      ];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.h).toBeCloseTo(0.67, 10);
      expect(result.status).toBe("currently_rated_helpful");
    });

    it("is NEEDS_MORE_RATINGS just under H = 0.67 (66 helpful / 34 not_helpful)", () => {
      const ratings: CountedRating[] = [
        ...Array.from({ length: 66 }, (_, i) => rating("helpful", i % 2 === 0 ? "a" : "b")),
        ...Array.from({ length: 34 }, () => rating("not_helpful", "c")),
      ];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.h).toBeLessThan(0.67);
      expect(result.status).toBe("needs_more_ratings");
    });
  });

  describe("the not-helpful mean threshold (H <= 0.33)", () => {
    it("is NOT_HELPFUL exactly at H = 0.33 (33 helpful / 67 not_helpful)", () => {
      const ratings: CountedRating[] = [
        ...Array.from({ length: 33 }, () => rating("helpful", "a")),
        ...Array.from({ length: 67 }, () => rating("not_helpful", "b")),
      ];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.h).toBeCloseTo(0.33, 10);
      expect(result.status).toBe("currently_rated_not_helpful");
    });

    it("is NEEDS_MORE_RATINGS just above H = 0.33 (34 helpful / 66 not_helpful)", () => {
      const ratings: CountedRating[] = [
        ...Array.from({ length: 34 }, () => rating("helpful", "a")),
        ...Array.from({ length: 66 }, () => rating("not_helpful", "b")),
      ];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.h).toBeGreaterThan(0.33);
      expect(result.status).toBe("needs_more_ratings");
    });

    it("never returns NOT_HELPFUL below the N threshold, even with H = 0", () => {
      const ratings = [rating("not_helpful", "a"), rating("not_helpful", "b")];
      expect(scorerV0.score(ratings, params).status).toBe("needs_more_ratings");
    });
  });

  describe("the diversity threshold (diversity >= 2)", () => {
    it("stays NEEDS_MORE_RATINGS with N/H satisfied but only 1 distinct diversity key", () => {
      const ratings = [rating("helpful", "a"), rating("helpful", "a"), rating("helpful", "a")];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.diversity).toBe(1);
      expect(result.status).toBe("needs_more_ratings");
    });

    it("counts null diversity keys toward N/H but never toward diversity", () => {
      const ratings = [rating("helpful", "a"), rating("helpful", null), rating("helpful", null)];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.n).toBe(3);
      expect(result.inputs.diversity).toBe(1);
      expect(result.status).toBe("needs_more_ratings");
    });

    it("only counts diversity keys from raters whose value >= 0.5 (excludes not_helpful raters' keys)", () => {
      const ratings = [rating("helpful", "a"), rating("somewhat", "b"), rating("not_helpful", "c")];
      const result = scorerV0.score(ratings, params);
      expect(result.inputs.diversity).toBe(2); // "a" and "b" only, not "c"
    });

    it("becomes HELPFUL once a second distinct diversity key appears, all else equal", () => {
      const oneKey = [rating("helpful", "a"), rating("helpful", "a"), rating("helpful", "a")];
      expect(scorerV0.score(oneKey, params).status).toBe("needs_more_ratings");

      const twoKeys = [rating("helpful", "a"), rating("helpful", "a"), rating("helpful", "b")];
      expect(scorerV0.score(twoKeys, params).status).toBe("currently_rated_helpful");
    });
  });

  describe("conflict of interest (docs/CONTEXT.md section 7.4)", () => {
    it("has no notion of COI at all — the caller is expected to have already excluded those ratings", () => {
      // A COI rating is never passed to score() in the first place (see CountedRating's doc
      // comment) — this test documents that the scorer itself applies zero special-casing and
      // simply counts whatever it's given, proving the exclusion must happen upstream.
      const asIfIncludingAnIneligibleRating = [
        rating("helpful", "a"),
        rating("helpful", "b"),
        rating("helpful", "b"), // would be a co-author's rating in the real flow
      ];
      const result = scorerV0.score(asIfIncludingAnIneligibleRating, params);
      expect(result.inputs.n).toBe(3); // counted as if fully eligible — no COI logic exists here
    });
  });

  describe("custom scoring_params versions", () => {
    it("respects a stricter configured threshold set", () => {
      const strictParams = {
        version: 2,
        requiredRatings: 5,
        helpfulMeanThreshold: 0.8,
        notHelpfulMeanThreshold: 0.2,
        minDiversity: 3,
      };
      const ratings = [rating("helpful", "a"), rating("helpful", "b"), rating("helpful", "c")];
      // Would be HELPFUL under DEFAULT_SCORING_PARAMS but N=3 < requiredRatings=5 here.
      expect(scorerV0.score(ratings, strictParams).status).toBe("needs_more_ratings");
    });
  });
});
