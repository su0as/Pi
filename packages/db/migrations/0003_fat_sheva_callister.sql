CREATE TABLE "idempotency_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer NOT NULL,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
