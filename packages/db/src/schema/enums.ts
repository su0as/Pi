import { pgEnum } from "drizzle-orm/pg-core";

// Every enum here is copied verbatim from an explicit list in docs/CONTEXT.md, except where a
// comment says otherwise (CONTEXT.md left that particular set open — we chose a reasonable
// starting point rather than a DB-level constraint, per "never guess a figure" — these are
// deliberately app-level/open, not invented ground truth).

// section 6.1 works.work_type
export const workTypeEnum = pgEnum("work_type", [
  "preprint",
  "article",
  "conference_paper",
  "review",
  "book_chapter",
  "dataset",
  "other",
]);

// section 6.1 work_identifiers.scheme
export const identifierSchemeEnum = pgEnum("identifier_scheme", [
  "arxiv",
  "doi",
  "pmid",
  "pmcid",
  "biorxiv",
  "medrxiv",
  "openalex",
  "s2",
  "openreview",
  "ssrn",
  "other",
]);

// section 9.1's source table + section 9.3's SourceConnector.id : SourceId
export const sourceIdEnum = pgEnum("source_id", [
  "arxiv",
  "openalex",
  "crossref",
  "unpaywall",
  "biorxiv",
  "medrxiv",
  "pubmed",
  "pmc",
  "europepmc",
  "semanticscholar",
  "openreview",
  "chemrxiv",
  "osf",
  "other",
]);

// section 6.1 reader_documents.format
export const readerDocumentFormatEnum = pgEnum("reader_document_format", [
  "arxiv_html",
  "jats",
  "pdf_only",
]);

// section 6.1 topics.scheme
export const topicSchemeEnum = pgEnum("topic_scheme", ["arxiv", "openalex", "mesh", "custom"]);

// section 6.2 users.role
export const userRoleEnum = pgEnum("user_role", ["user", "moderator", "admin"]);

// section 6.2 users.status
export const userStatusEnum = pgEnum("user_status", ["active", "suspended", "deleted"]);

// section 6.2 affiliations.position
export const affiliationPositionEnum = pgEnum("affiliation_position", [
  "undergrad",
  "masters",
  "phd",
  "postdoc",
  "faculty",
  "staff",
  "industry",
  "other",
]);

// section 6.2 affiliations.verification_method
export const affiliationVerificationMethodEnum = pgEnum("affiliation_verification_method", [
  "institutional_email",
  "orcid",
  "manual",
  "declared",
]);

// section 6.2 author_claims.method / status
export const authorClaimMethodEnum = pgEnum("author_claim_method", ["orcid", "manual"]);
export const authorClaimStatusEnum = pgEnum("author_claim_status", [
  "pending",
  "approved",
  "rejected",
]);

// section 6.3 library_items.status
export const libraryItemStatusEnum = pgEnum("library_item_status", [
  "to_read",
  "reading",
  "read",
  "abandoned",
]);

// section 7.1 notes.type
export const noteTypeEnum = pgEnum("note_type", [
  "reproduced",
  "failed_to_reproduce",
  "correction",
  "missing_context",
  "code_data_issue",
  "helpful_resource",
]);

// section 7.3 lifecycle diagram
export const noteStatusEnum = pgEnum("note_status", [
  "draft",
  "needs_more_ratings",
  "currently_rated_helpful",
  "currently_rated_not_helpful",
  "withdrawn",
  "removed",
]);

// section 7.8 contribution ladder / notes.origin
export const noteOriginEnum = pgEnum("note_origin", [
  "direct",
  "promoted_from_take",
  "promoted_from_circle",
]);

// section 7.5 note_ratings.value
export const noteRatingValueEnum = pgEnum("note_rating_value", [
  "helpful",
  "somewhat",
  "not_helpful",
]);

// section 5.1/5.2/5.3/5.4 client surfaces — interaction_events.surface and reused for
// library_items.source_surface
export const surfaceEnum = pgEnum("surface", ["web", "ios", "extension", "email"]);

// section 6.6 interaction_events.event_type (explicit list)
export const interactionEventTypeEnum = pgEnum("interaction_event_type", [
  "impression",
  "open",
  "dwell",
  "save",
  "unsave",
  "skip",
  "not_interested",
  "share",
  "read_progress",
]);

// section 6.6 moderation_actions.action (explicit list)
export const moderationActionEnum = pgEnum("moderation_action", [
  "hide",
  "remove",
  "restore",
  "warn",
  "suspend",
  "ban",
]);

// CONTEXT.md doesn't enumerate reports.status — a reasonable starting set, not a fixed spec.
export const reportStatusEnum = pgEnum("report_status", ["pending", "actioned", "dismissed"]);

// section 8's notification_preferences "per channel and per type" — channel is a closed set
// inferable from the client surfaces in section 5; type is left open (see notifications.type
// below) since CONTEXT.md never enumerates notification types.
export const notificationChannelEnum = pgEnum("notification_channel", ["email", "push", "in_app"]);

// section 6.3 push_tokens.platform — only iOS is in scope through P2, but Android is explicitly
// a stated later goal (section 17), so the enum covers what the column will ever hold.
export const pushPlatformEnum = pgEnum("push_platform", ["ios", "android"]);
