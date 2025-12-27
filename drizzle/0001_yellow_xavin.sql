CREATE TABLE "github_issue" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"number" integer NOT NULL,
	"repo_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"state" text NOT NULL,
	"state_reason" text,
	"author_login" text,
	"author_avatar_url" text,
	"html_url" text,
	"comments" integer DEFAULT 0,
	"labels" text,
	"assignees" text,
	"milestone" text,
	"github_created_at" timestamp,
	"github_updated_at" timestamp,
	"closed_at" timestamp,
	"user_id" text NOT NULL,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_issue_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"issue_id" text NOT NULL,
	"body" text,
	"author_login" text,
	"author_avatar_url" text,
	"html_url" text,
	"github_created_at" timestamp,
	"github_updated_at" timestamp,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_issue" ADD CONSTRAINT "github_issue_repo_id_github_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."github_repo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issue" ADD CONSTRAINT "github_issue_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issue_comment" ADD CONSTRAINT "github_issue_comment_issue_id_github_issue_id_fk" FOREIGN KEY ("issue_id") REFERENCES "public"."github_issue"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_issue_comment" ADD CONSTRAINT "github_issue_comment_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_issue_repoId_idx" ON "github_issue" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "github_issue_userId_idx" ON "github_issue" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_issue_state_idx" ON "github_issue" USING btree ("state");--> statement-breakpoint
CREATE INDEX "github_issue_number_idx" ON "github_issue" USING btree ("repo_id","number");--> statement-breakpoint
CREATE INDEX "github_issue_comment_issueId_idx" ON "github_issue_comment" USING btree ("issue_id");--> statement-breakpoint
CREATE INDEX "github_issue_comment_userId_idx" ON "github_issue_comment" USING btree ("user_id");