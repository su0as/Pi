CREATE TABLE "ingestion_checkpoints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"last_run_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "ingestion_checkpoints_job_name_idx" ON "ingestion_checkpoints" USING btree ("job_name");