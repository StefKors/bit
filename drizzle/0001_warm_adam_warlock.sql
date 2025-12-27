CREATE TABLE "github_pr_event" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" bigint,
	"pull_request_id" text NOT NULL,
	"event_type" text NOT NULL,
	"actor_login" text,
	"actor_avatar_url" text,
	"event_data" text,
	"commit_sha" text,
	"commit_message" text,
	"label_name" text,
	"label_color" text,
	"assignee_login" text,
	"assignee_avatar_url" text,
	"requested_reviewer_login" text,
	"requested_reviewer_avatar_url" text,
	"event_created_at" timestamp,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_pr_event" ADD CONSTRAINT "github_pr_event_pull_request_id_github_pull_request_id_fk" FOREIGN KEY ("pull_request_id") REFERENCES "public"."github_pull_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_pr_event" ADD CONSTRAINT "github_pr_event_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_pr_event_prId_idx" ON "github_pr_event" USING btree ("pull_request_id");--> statement-breakpoint
CREATE INDEX "github_pr_event_userId_idx" ON "github_pr_event" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_pr_event_type_idx" ON "github_pr_event" USING btree ("event_type");