CREATE TABLE "github_repo_blob" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"sha" text NOT NULL,
	"content" text,
	"encoding" text,
	"size" integer,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_repo_tree" (
	"id" text PRIMARY KEY NOT NULL,
	"repo_id" text NOT NULL,
	"ref" text NOT NULL,
	"path" text NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"sha" text NOT NULL,
	"size" integer,
	"url" text,
	"html_url" text,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "github_repo_blob" ADD CONSTRAINT "github_repo_blob_repo_id_github_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."github_repo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_blob" ADD CONSTRAINT "github_repo_blob_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_tree" ADD CONSTRAINT "github_repo_tree_repo_id_github_repo_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."github_repo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "github_repo_tree" ADD CONSTRAINT "github_repo_tree_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "github_blob_sha_idx" ON "github_repo_blob" USING btree ("sha");--> statement-breakpoint
CREATE INDEX "github_blob_repoId_idx" ON "github_repo_blob" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "github_blob_userId_idx" ON "github_repo_blob" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "github_tree_repoId_idx" ON "github_repo_tree" USING btree ("repo_id");--> statement-breakpoint
CREATE INDEX "github_tree_ref_idx" ON "github_repo_tree" USING btree ("repo_id","ref");--> statement-breakpoint
CREATE INDEX "github_tree_path_idx" ON "github_repo_tree" USING btree ("repo_id","ref","path");--> statement-breakpoint
CREATE INDEX "github_tree_userId_idx" ON "github_repo_tree" USING btree ("user_id");