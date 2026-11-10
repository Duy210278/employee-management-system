CREATE TABLE "signoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"stage_key" text,
	"review_id" integer,
	"step" integer NOT NULL,
	"role" text NOT NULL,
	"user_id" integer NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "signoffs_one_of" CHECK (("signoffs"."stage_key" is not null and "signoffs"."review_id" is null) or ("signoffs"."stage_key" is null and "signoffs"."review_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_review_id_level_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."level_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "signoffs_stage_step_uq" ON "signoffs" USING btree ("run_id","stage_key","step") WHERE "signoffs"."stage_key" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "signoffs_review_step_uq" ON "signoffs" USING btree ("review_id","step") WHERE "signoffs"."review_id" is not null;--> statement-breakpoint
CREATE INDEX "signoffs_run_idx" ON "signoffs" USING btree ("run_id");