-- GitHub Tables Migration

CREATE TABLE IF NOT EXISTS "github_organization" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"login" text NOT NULL,
	"name" text,
	"description" text,
	"avatar_url" text,
	"url" text,
	"user_id" text NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_organization_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_repo" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"owner" text NOT NULL,
	"description" text,
	"url" text,
	"html_url" text,
	"private" boolean DEFAULT false NOT NULL,
	"fork" boolean DEFAULT false NOT NULL,
	"default_branch" text DEFAULT 'main',
	"language" text,
	"stargazers_count" integer DEFAULT 0,
	"forks_count" integer DEFAULT 0,
	"open_issues_count" integer DEFAULT 0,
	"organization_id" text,
	"user_id" text NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_repo_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_pull_request" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"number" integer NOT NULL,
	"repo_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"merged" boolean DEFAULT false NOT NULL,
	"mergeable" boolean,
	"mergeable_state" text,
	"author_login" text,
	"author_avatar_url" text,
	"head_ref" text,
	"head_sha" text,
	"base_ref" text,
	"base_sha" text,
	"html_url" text,
	"diff_url" text,
	"additions" integer DEFAULT 0,
	"deletions" integer DEFAULT 0,
	"changed_files" integer DEFAULT 0,
	"commits" integer DEFAULT 0,
	"comments" integer DEFAULT 0,
	"review_comments" integer DEFAULT 0,
	"labels" text,
	"github_created_at" timestamp,
	"github_updated_at" timestamp,
	"closed_at" timestamp,
	"merged_at" timestamp,
	"user_id" text NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_pr_review" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"pull_request_id" text NOT NULL,
	"state" text NOT NULL,
	"body" text,
	"author_login" text,
	"author_avatar_url" text,
	"html_url" text,
	"submitted_at" timestamp,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_pr_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"pull_request_id" text NOT NULL,
	"review_id" text,
	"comment_type" text NOT NULL,
	"body" text,
	"author_login" text,
	"author_avatar_url" text,
	"html_url" text,
	"path" text,
	"line" integer,
	"side" text,
	"diff_hunk" text,
	"github_created_at" timestamp,
	"github_updated_at" timestamp,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_pr_file" (
	"id" text PRIMARY KEY NOT NULL,
	"pull_request_id" text NOT NULL,
	"sha" text NOT NULL,
	"filename" text NOT NULL,
	"status" text NOT NULL,
	"additions" integer DEFAULT 0,
	"deletions" integer DEFAULT 0,
	"changes" integer DEFAULT 0,
	"patch" text,
	"previous_filename" text,
	"blob_url" text,
	"raw_url" text,
	"contents_url" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "github_sync_state" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"last_synced_at" timestamp,
	"last_etag" text,
	"rate_limit_remaining" integer,
	"rate_limit_reset" timestamp,
	"sync_status" text DEFAULT 'idle',
	"sync_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Foreign Keys
ALTER TABLE "github_organization" ADD CONSTRAINT "github_organization_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_repo" ADD CONSTRAINT "github_repo_organization_id_github_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."github_organization"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_repo" ADD CONSTRAINT "github_repo_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pull_request" ADD CONSTRAINT "github_pull_request_repo_id_github_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."github_repo"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pull_request" ADD CONSTRAINT "github_pull_request_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_review" ADD CONSTRAINT "github_pr_review_pull_request_id_github_pull_request_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."github_pull_request"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_review" ADD CONSTRAINT "github_pr_review_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_comment" ADD CONSTRAINT "github_pr_comment_pull_request_id_github_pull_request_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."github_pull_request"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_comment" ADD CONSTRAINT "github_pr_comment_review_id_github_pr_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."github_pr_review"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_comment" ADD CONSTRAINT "github_pr_comment_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_file" ADD CONSTRAINT "github_pr_file_pull_request_id_github_pull_request_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."github_pull_request"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_file" ADD CONSTRAINT "github_pr_file_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_sync_state" ADD CONSTRAINT "github_sync_state_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Indexes
CREATE INDEX IF NOT EXISTS "github_org_userId_idx" ON "github_organization" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_org_login_idx" ON "github_organization" USING btree ("login");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repo_userId_idx" ON "github_repo" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repo_fullName_idx" ON "github_repo" USING btree ("full_name");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_repo_owner_idx" ON "github_repo" USING btree ("owner");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_pr_repoId_idx" ON "github_pull_request" USING btree ("repo_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_pr_userId_idx" ON "github_pull_request" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_pr_state_idx" ON "github_pull_request" USING btree ("state");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_pr_number_idx" ON "github_pull_request" USING btree ("repo_id","number");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_review_prId_idx" ON "github_pr_review" USING btree ("pull_request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_review_userId_idx" ON "github_pr_review" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_comment_prId_idx" ON "github_pr_comment" USING btree ("pull_request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_comment_reviewId_idx" ON "github_pr_comment" USING btree ("review_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_comment_userId_idx" ON "github_pr_comment" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_file_prId_idx" ON "github_pr_file" USING btree ("pull_request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_file_userId_idx" ON "github_pr_file" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_sync_userId_idx" ON "github_sync_state" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_sync_resource_idx" ON "github_sync_state" USING btree ("user_id","resource_type");
