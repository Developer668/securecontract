CREATE TYPE "public"."application_status" AS ENUM('not_started', 'reviewing', 'preparing', 'ready_for_review', 'submitted_manually', 'archived');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'healthy', 'warning', 'degraded', 'failed');--> statement-breakpoint
CREATE TYPE "public"."source_status" AS ENUM('draft', 'active', 'warning', 'degraded', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'done', 'blocked');--> statement-breakpoint
CREATE TABLE "amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" text NOT NULL,
	"label" text NOT NULL,
	"url" text,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"label" text NOT NULL,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"evidence_id" uuid,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" text NOT NULL,
	"status" "application_status" DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "application_workspaces_opportunity_id_unique" UNIQUE("opportunity_id")
);
--> statement-breakpoint
CREATE TABLE "copilot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"evidence_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copilot_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "field_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"normalized_value" jsonb,
	"raw_label" text,
	"raw_value" text,
	"source_url" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	"confidence" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" uuid NOT NULL,
	"external_id" text,
	"canonical" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"current_version_id" uuid,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" text NOT NULL,
	"version_id" uuid NOT NULL,
	"field_name" text NOT NULL,
	"old_value" jsonb,
	"new_value" jsonb,
	"severity" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunity_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opportunity_id" text NOT NULL,
	"source_run_id" uuid NOT NULL,
	"canonical" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_run_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"record_index" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"raw_hash" text NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"collection_id" text,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"row_count" integer,
	"valid_row_count" integer,
	"metrics" jsonb,
	"problems" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"jurisdiction_type" text NOT NULL,
	"jurisdiction_name" text,
	"locale" text NOT NULL,
	"timezone" text NOT NULL,
	"currency" text,
	"source_language" text NOT NULL,
	"source_url" text NOT NULL,
	"input_url" text NOT NULL,
	"collector_id" text,
	"adapter_key" text NOT NULL,
	"status" "source_status" DEFAULT 'draft' NOT NULL,
	"required_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_access_verified_at" timestamp with time zone,
	"prebuilt_library_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sources_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vendor_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"profile" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amendments" ADD CONSTRAINT "amendments_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_tasks" ADD CONSTRAINT "application_tasks_workspace_id_application_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."application_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_tasks" ADD CONSTRAINT "application_tasks_evidence_id_field_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."field_evidence"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_workspaces" ADD CONSTRAINT "application_workspaces_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_thread_id_copilot_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."copilot_threads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copilot_threads" ADD CONSTRAINT "copilot_threads_workspace_id_application_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."application_workspaces"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_evidence" ADD CONSTRAINT "field_evidence_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_evidence" ADD CONSTRAINT "field_evidence_version_id_opportunity_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."opportunity_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_changes" ADD CONSTRAINT "opportunity_changes_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_changes" ADD CONSTRAINT "opportunity_changes_version_id_opportunity_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."opportunity_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunity_versions" ADD CONSTRAINT "opportunity_versions_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_source_run_id_source_runs_id_fk" FOREIGN KEY ("source_run_id") REFERENCES "public"."source_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raw_records" ADD CONSTRAINT "raw_records_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "raw_record_run_index" ON "raw_records" USING btree ("source_run_id","record_index");