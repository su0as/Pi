CREATE TYPE "public"."affiliation_position" AS ENUM('undergrad', 'masters', 'phd', 'postdoc', 'faculty', 'staff', 'industry', 'other');--> statement-breakpoint
CREATE TYPE "public"."affiliation_verification_method" AS ENUM('institutional_email', 'orcid', 'manual', 'declared');--> statement-breakpoint
CREATE TYPE "public"."author_claim_method" AS ENUM('orcid', 'manual');--> statement-breakpoint
CREATE TYPE "public"."author_claim_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."identifier_scheme" AS ENUM('arxiv', 'doi', 'pmid', 'pmcid', 'biorxiv', 'medrxiv', 'openalex', 's2', 'openreview', 'ssrn', 'other');--> statement-breakpoint
CREATE TYPE "public"."interaction_event_type" AS ENUM('impression', 'open', 'dwell', 'save', 'unsave', 'skip', 'not_interested', 'share', 'read_progress');--> statement-breakpoint
CREATE TYPE "public"."library_item_status" AS ENUM('to_read', 'reading', 'read', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."moderation_action" AS ENUM('hide', 'remove', 'restore', 'warn', 'suspend', 'ban');--> statement-breakpoint
CREATE TYPE "public"."note_origin" AS ENUM('direct', 'promoted_from_take', 'promoted_from_circle');--> statement-breakpoint
CREATE TYPE "public"."note_rating_value" AS ENUM('helpful', 'somewhat', 'not_helpful');--> statement-breakpoint
CREATE TYPE "public"."note_status" AS ENUM('draft', 'needs_more_ratings', 'currently_rated_helpful', 'currently_rated_not_helpful', 'withdrawn', 'removed');--> statement-breakpoint
CREATE TYPE "public"."note_type" AS ENUM('reproduced', 'failed_to_reproduce', 'correction', 'missing_context', 'code_data_issue', 'helpful_resource');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('email', 'push', 'in_app');--> statement-breakpoint
CREATE TYPE "public"."push_platform" AS ENUM('ios', 'android');--> statement-breakpoint
CREATE TYPE "public"."reader_document_format" AS ENUM('arxiv_html', 'jats', 'pdf_only');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'actioned', 'dismissed');--> statement-breakpoint
CREATE TYPE "public"."source_id" AS ENUM('arxiv', 'openalex', 'crossref', 'unpaywall', 'biorxiv', 'medrxiv', 'pubmed', 'pmc', 'europepmc', 'semanticscholar', 'openreview', 'chemrxiv', 'osf', 'other');--> statement-breakpoint
CREATE TYPE "public"."surface" AS ENUM('web', 'ios', 'extension', 'email');--> statement-breakpoint
CREATE TYPE "public"."topic_scheme" AS ENUM('arxiv', 'openalex', 'mesh', 'custom');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted');--> statement-breakpoint
CREATE TYPE "public"."work_type" AS ENUM('preprint', 'article', 'conference_paper', 'review', 'book_chapter', 'dataset', 'other');--> statement-breakpoint
CREATE TABLE "author_replies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"addressed_in_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_replies_note_user_key" UNIQUE("note_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "note_evidence" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"url" text,
	"work_id" uuid,
	"storage_key" text,
	"label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_ratings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"rater_user_id" uuid NOT NULL,
	"value" "note_rating_value" NOT NULL,
	"reasons" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_ratings_note_rater_key" UNIQUE("note_id","rater_user_id")
);
--> statement-breakpoint
CREATE TABLE "note_status_history" (
	"id" uuid PRIMARY KEY NOT NULL,
	"note_id" uuid NOT NULL,
	"status" "note_status" NOT NULL,
	"scorer_version" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"inputs" jsonb
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"work_version_id" uuid,
	"author_user_id" uuid NOT NULL,
	"type" "note_type" NOT NULL,
	"body" text NOT NULL,
	"anchor" jsonb,
	"status" "note_status" DEFAULT 'draft' NOT NULL,
	"status_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"scorer_version" integer,
	"origin" "note_origin" DEFAULT 'direct' NOT NULL,
	"language" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_params" (
	"id" uuid PRIMARY KEY NOT NULL,
	"version" integer NOT NULL,
	"params" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scoring_params_version_key" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "collection_items" (
	"collection_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_id_work_id_pk" PRIMARY KEY("collection_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "highlights" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"work_version_id" uuid NOT NULL,
	"anchor" jsonb NOT NULL,
	"color" text,
	"comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"work_id" uuid NOT NULL,
	"status" "library_item_status" DEFAULT 'to_read' NOT NULL,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	"progress" jsonb,
	"source_surface" "surface",
	CONSTRAINT "library_items_user_work_key" UNIQUE("user_id","work_id")
);
--> statement-breakpoint
CREATE TABLE "institutions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"ror_id" text NOT NULL,
	"name" text NOT NULL,
	"country" text,
	"email_domains" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"orcid" text,
	"openalex_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"scheme" "topic_scheme" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_scheme_code_key" UNIQUE("scheme","code")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "interaction_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"anon_device_id" text,
	"event_type" "interaction_event_type" NOT NULL,
	"work_id" uuid NOT NULL,
	"surface" "surface" NOT NULL,
	"context" jsonb,
	"dwell_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_actions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"moderator_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"action" "moderation_action" NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"channel_status" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY NOT NULL,
	"reporter_id" uuid NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "affiliations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"institution_id" uuid NOT NULL,
	"department" text,
	"position" "affiliation_position" NOT NULL,
	"verification_method" "affiliation_verification_method" NOT NULL,
	"verified_email_domain" text,
	"verified_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "affiliations_user_institution_key" UNIQUE("user_id","institution_id")
);
--> statement-breakpoint
CREATE TABLE "author_claims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"method" "author_claim_method" NOT NULL,
	"status" "author_claim_status" DEFAULT 'pending' NOT NULL,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "author_claims_user_person_key" UNIQUE("user_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "blocks" (
	"blocker_id" uuid NOT NULL,
	"blocked_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_blocker_id_blocked_id_pk" PRIMARY KEY("blocker_id","blocked_id")
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"type" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_preferences_user_channel_type_key" UNIQUE("user_id","channel","type")
);
--> statement-breakpoint
CREATE TABLE "push_tokens" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"platform" "push_platform" NOT NULL,
	"token" text NOT NULL,
	"device_id" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_tokens_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_key" text,
	"bio" text,
	"locale" text DEFAULT 'en' NOT NULL,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_handle_key" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "authorships" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"raw_name" text,
	"raw_affiliation" text,
	"institution_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "references" (
	"id" uuid PRIMARY KEY NOT NULL,
	"citing_work_id" uuid NOT NULL,
	"cited_work_id" uuid,
	"raw_citation" text,
	"position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_topics" (
	"work_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"score" real NOT NULL,
	CONSTRAINT "work_topics_work_id_topic_id_pk" PRIMARY KEY("work_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "reader_documents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_version_id" uuid NOT NULL,
	"format" "reader_document_format" NOT NULL,
	"storage_key" text NOT NULL,
	"outline" jsonb,
	"figures" jsonb,
	"references" jsonb,
	"pipeline_version" integer NOT NULL,
	"license" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_identifiers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"scheme" "identifier_scheme" NOT NULL,
	"value_normalized" text NOT NULL,
	"value_raw" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_redirects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"old_work_id" uuid NOT NULL,
	"canonical_work_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_redirects_old_work_id_key" UNIQUE("old_work_id")
);
--> statement-breakpoint
CREATE TABLE "work_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"work_id" uuid NOT NULL,
	"source" "source_id" NOT NULL,
	"version_label" text NOT NULL,
	"published_at" timestamp with time zone,
	"license" text,
	"license_url" text,
	"can_display_full_text" boolean DEFAULT false NOT NULL,
	"pdf_url" text,
	"html_url" text,
	"source_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"abstract" text,
	"language" text,
	"work_type" "work_type" NOT NULL,
	"published_at" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"primary_topic_id" uuid,
	"open_access_status" text,
	"citation_count" integer DEFAULT 0 NOT NULL,
	"canonical_url" text,
	"merged_into_id" uuid,
	"author_names_cached" text,
	"search_vector" "tsvector",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "author_replies" ADD CONSTRAINT "author_replies_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_replies" ADD CONSTRAINT "author_replies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_evidence" ADD CONSTRAINT "note_evidence_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_evidence" ADD CONSTRAINT "note_evidence_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_ratings" ADD CONSTRAINT "note_ratings_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_ratings" ADD CONSTRAINT "note_ratings_rater_user_id_users_id_fk" FOREIGN KEY ("rater_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_status_history" ADD CONSTRAINT "note_status_history_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_work_version_id_work_versions_id_fk" FOREIGN KEY ("work_version_id") REFERENCES "public"."work_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_work_version_id_work_versions_id_fk" FOREIGN KEY ("work_version_id") REFERENCES "public"."work_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_parent_id_topics_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interaction_events" ADD CONSTRAINT "interaction_events_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliations" ADD CONSTRAINT "affiliations_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_claims" ADD CONSTRAINT "author_claims_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_claims" ADD CONSTRAINT "author_claims_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "author_claims" ADD CONSTRAINT "author_claims_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocker_id_users_id_fk" FOREIGN KEY ("blocker_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocks" ADD CONSTRAINT "blocks_blocked_id_users_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorships" ADD CONSTRAINT "authorships_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorships" ADD CONSTRAINT "authorships_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "authorships" ADD CONSTRAINT "authorships_institution_id_institutions_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institutions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_citing_work_id_works_id_fk" FOREIGN KEY ("citing_work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "references" ADD CONSTRAINT "references_cited_work_id_works_id_fk" FOREIGN KEY ("cited_work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_topics" ADD CONSTRAINT "work_topics_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_topics" ADD CONSTRAINT "work_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reader_documents" ADD CONSTRAINT "reader_documents_work_version_id_work_versions_id_fk" FOREIGN KEY ("work_version_id") REFERENCES "public"."work_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_identifiers" ADD CONSTRAINT "work_identifiers_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_redirects" ADD CONSTRAINT "work_redirects_old_work_id_works_id_fk" FOREIGN KEY ("old_work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_redirects" ADD CONSTRAINT "work_redirects_canonical_work_id_works_id_fk" FOREIGN KEY ("canonical_work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_versions" ADD CONSTRAINT "work_versions_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_primary_topic_id_topics_id_fk" FOREIGN KEY ("primary_topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_merged_into_id_works_id_fk" FOREIGN KEY ("merged_into_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_evidence_note_id_idx" ON "note_evidence" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "note_status_history_note_id_idx" ON "note_status_history" USING btree ("note_id");--> statement-breakpoint
CREATE INDEX "notes_work_id_idx" ON "notes" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "notes_author_user_id_idx" ON "notes" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "notes_status_idx" ON "notes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "collections_user_id_idx" ON "collections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "highlights_user_id_idx" ON "highlights" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "library_items_user_id_idx" ON "library_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institutions_ror_id_idx" ON "institutions" USING btree ("ror_id");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_orcid_idx" ON "persons" USING btree ("orcid");--> statement-breakpoint
CREATE UNIQUE INDEX "persons_openalex_id_idx" ON "persons" USING btree ("openalex_id");--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_idx" ON "audit_log" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "interaction_events_user_id_idx" ON "interaction_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interaction_events_work_id_idx" ON "interaction_events" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "interaction_events_created_at_idx" ON "interaction_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "moderation_actions_target_idx" ON "moderation_actions" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "notifications_user_id_idx" ON "notifications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_target_idx" ON "reports" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "authorships_work_id_idx" ON "authorships" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "authorships_person_id_idx" ON "authorships" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "references_citing_work_id_idx" ON "references" USING btree ("citing_work_id");--> statement-breakpoint
CREATE INDEX "references_cited_work_id_idx" ON "references" USING btree ("cited_work_id");--> statement-breakpoint
CREATE INDEX "work_topics_topic_id_idx" ON "work_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reader_documents_work_version_id_idx" ON "reader_documents" USING btree ("work_version_id");--> statement-breakpoint
CREATE UNIQUE INDEX "work_identifiers_scheme_value_idx" ON "work_identifiers" USING btree ("scheme","value_normalized");--> statement-breakpoint
CREATE INDEX "work_identifiers_work_id_idx" ON "work_identifiers" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "work_versions_work_id_idx" ON "work_versions" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "works_primary_topic_id_idx" ON "works" USING btree ("primary_topic_id");