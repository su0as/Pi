import {
  affiliationPositionEnum,
  affiliationVerificationMethodEnum,
  authorClaimMethodEnum,
  authorClaimStatusEnum,
  identifierSchemeEnum,
  interactionEventTypeEnum,
  libraryItemStatusEnum,
  moderationActionEnum,
  noteOriginEnum,
  noteRatingValueEnum,
  noteStatusEnum,
  noteTypeEnum,
  notificationChannelEnum,
  pushPlatformEnum,
  readerDocumentFormatEnum,
  reportStatusEnum,
  sourceIdEnum,
  surfaceEnum,
  topicSchemeEnum,
  userRoleEnum,
  userStatusEnum,
  workTypeEnum,
} from "@repo/db/schema";
import { z } from "zod";

/**
 * Zod mirrors of every fixed-list field this app validates — packages/core is the app-level
 * source of truth for these (docs/CONTEXT.md's own package-layout description), so every one of
 * them is defined here, not left to whatever a route handler happens to write inline.
 *
 * Two groups:
 * 1. DB-enum-backed: derived from the same `.enumValues` array packages/db uses for its Postgres
 *    enum, so the two can't drift. Reach for these (not a hand-written `z.enum([...])`) any time
 *    you're validating one of these fields outside a full table schema — e.g. a route param like
 *    `?type=correction`.
 * 2. App-level only (no DB enum): docs/CONTEXT.md leaves these open-ended, and the DB column is
 *    plain `text` on purpose (see packages/db/src/schema's comments on `note_evidence.kind` and
 *    `notifications.type`) — extending the list is a code change here, not a migration. Still a
 *    real, curated list, not `z.string()`.
 */

// --- DB-enum-backed -------------------------------------------------------

export const workTypeSchema = z.enum(workTypeEnum.enumValues);
export const identifierSchemeSchema = z.enum(identifierSchemeEnum.enumValues);
export const sourceIdSchema = z.enum(sourceIdEnum.enumValues);
export const readerDocumentFormatSchema = z.enum(readerDocumentFormatEnum.enumValues);
export const topicSchemeSchema = z.enum(topicSchemeEnum.enumValues);

export const userRoleSchema = z.enum(userRoleEnum.enumValues);
export const userStatusSchema = z.enum(userStatusEnum.enumValues);
export const affiliationPositionSchema = z.enum(affiliationPositionEnum.enumValues);
export const affiliationVerificationMethodSchema = z.enum(
  affiliationVerificationMethodEnum.enumValues,
);
export const authorClaimMethodSchema = z.enum(authorClaimMethodEnum.enumValues);
export const authorClaimStatusSchema = z.enum(authorClaimStatusEnum.enumValues);
export const libraryItemStatusSchema = z.enum(libraryItemStatusEnum.enumValues);

export const noteTypeSchema = z.enum(noteTypeEnum.enumValues);
export const noteStatusSchema = z.enum(noteStatusEnum.enumValues);
export const noteOriginSchema = z.enum(noteOriginEnum.enumValues);
export const noteRatingValueSchema = z.enum(noteRatingValueEnum.enumValues);

export const surfaceSchema = z.enum(surfaceEnum.enumValues);
export const interactionEventTypeSchema = z.enum(interactionEventTypeEnum.enumValues);
export const moderationActionSchema = z.enum(moderationActionEnum.enumValues);
export const reportStatusSchema = z.enum(reportStatusEnum.enumValues);
export const notificationChannelSchema = z.enum(notificationChannelEnum.enumValues);
export const pushPlatformSchema = z.enum(pushPlatformEnum.enumValues);

// --- App-level only (DB column is `text`, kept flexible on purpose) -------

/**
 * docs/CONTEXT.md section 7.1's evidence-required table gives these as examples per note type
 * (repo, logs/numbers, citation, link, upload) — `note_evidence.kind` in packages/db is
 * deliberately `text`, not a DB enum, so adding a kind doesn't need a migration. This is the
 * actual closed list until someone extends it here.
 */
export const noteEvidenceKindSchema = z.enum([
  "repository",
  "log_output",
  "dataset",
  "citation",
  "publication",
  "external_link",
  "upload",
  "other",
]);

/**
 * docs/CONTEXT.md doesn't give a table for notification types, but does name these concrete
 * triggers: M7 ("note on saved paper", "note status changed", "reply received", "note created on
 * an author's claimed work") and M3 ("a note was added to your paper", author-claim approval).
 * `notifications.type` in packages/db is `text`, same reasoning as evidence kind above.
 */
export const notificationTypeSchema = z.enum([
  "note_on_saved_work",
  "note_status_changed",
  "reply_received",
  "note_on_authored_work",
  "author_claim_approved",
]);
