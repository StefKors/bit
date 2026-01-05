-- GitHub PR Commits Migration

CREATE TABLE IF NOT EXISTS "github_pr_commit" (
	"id" text PRIMARY KEY NOT NULL,
	"pull_request_id" text NOT NULL,
	"sha" text NOT NULL,
	"message" text NOT NULL,
	"author_login" text,
	"author_avatar_url" text,
	"author_name" text,
	"author_email" text,
	"committer_login" text,
	"committer_avatar_url" text,
	"committer_name" text,
	"committer_email" text,
	"html_url" text,
	"committed_at" timestamp,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_pr_commit" ADD CONSTRAINT "github_pr_commit_pull_request_id_github_pull_request_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."github_pull_request"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "github_pr_commit" ADD CONSTRAINT "github_pr_commit_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_commit_prId_idx" ON "github_pr_commit" USING btree ("pull_request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "github_commit_userId_idx" ON "github_pr_commit" USING btree ("user_id");
