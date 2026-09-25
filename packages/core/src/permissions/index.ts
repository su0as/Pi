import type { z } from "zod";
import type { userRoleSchema } from "../schemas/enums";

type UserRole = z.infer<typeof userRoleSchema>;

export function isModerator(role: UserRole): boolean {
  return role === "moderator" || role === "admin";
}

export function isAdmin(role: UserRole): boolean {
  return role === "admin";
}

/**
 * docs/CONTEXT.md section 7.4 — write eligibility: an eligible rater (verified affiliation or
 * linked ORCID — checked by the caller, not here) plus N completed ratings, or bootstrap_mode.
 * Pure function: the caller looks up `ratingsCompleted` and `bootstrapMode` from the DB
 * (packages/db) and `scoring_params`; this just applies the rule.
 */
export interface WriteEligibilityInput {
  ratingsCompleted: number;
  requiredRatings: number;
  bootstrapMode: boolean;
}

export function canWriteNote(input: WriteEligibilityInput): boolean {
  if (input.bootstrapMode) return true;
  return input.ratingsCompleted >= input.requiredRatings;
}

/**
 * docs/CONTEXT.md section 7.4 — conflict of interest: co-authors of the work (via an approved
 * author claim) cannot rate notes on it, and note authors can't rate their own note. The caller
 * resolves `raterIsCoAuthor` from author_claims + authorships (that's DB access, so it doesn't
 * belong in this package) before calling this.
 */
export interface RatingEligibilityInput {
  raterUserId: string;
  noteAuthorUserId: string;
  raterIsCoAuthor: boolean;
}

export function canRateNote(input: RatingEligibilityInput): boolean {
  if (input.raterUserId === input.noteAuthorUserId) return false;
  if (input.raterIsCoAuthor) return false;
  return true;
}

/** docs/CONTEXT.md section 7.7 — author replies require an approved claim on a person who
 * authored the work; `hasApprovedClaimOnAuthor` is resolved by the caller from author_claims +
 * authorships, same reasoning as above. */
export function canReplyAsAuthor(hasApprovedClaimOnAuthor: boolean): boolean {
  return hasApprovedClaimOnAuthor;
}
