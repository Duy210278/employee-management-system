CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"link" text,
	"dedupe_key" text,
	"business_date" date NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "notifications_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
CREATE TABLE "run_pauses" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" integer NOT NULL,
	"requested_at" timestamp with time zone NOT NULL,
	"decided_by" integer,
	"decided_at" timestamp with time zone,
	"decision_note" text
);
--> statement-breakpoint
CREATE TABLE "stage_signoffs" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"stage_key" text NOT NULL,
	"step" integer NOT NULL,
	"role" text NOT NULL,
	"user_id" integer NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_date_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"old_open" date NOT NULL,
	"old_due" date NOT NULL,
	"new_open" date NOT NULL,
	"new_due" date NOT NULL,
	"reason" text NOT NULL,
	"ref_id" integer,
	"at" timestamp with time zone NOT NULL,
	"by" integer
);
--> statement-breakpoint
CREATE TABLE "user_changes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"changed_by" integer,
	"field" text NOT NULL,
	"old_value" text,
	"new_value" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "stop_reason" text;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "stopped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "stopped_by" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requested_role" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requested_store_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "requested_area_id" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reviewed_by" integer;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "row_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_pauses" ADD CONSTRAINT "run_pauses_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_pauses" ADD CONSTRAINT "run_pauses_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_pauses" ADD CONSTRAINT "run_pauses_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_signoffs" ADD CONSTRAINT "stage_signoffs_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stage_signoffs" ADD CONSTRAINT "stage_signoffs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_date_changes" ADD CONSTRAINT "task_date_changes_task_id_run_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."run_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_date_changes" ADD CONSTRAINT "task_date_changes_by_users_id_fk" FOREIGN KEY ("by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_changes" ADD CONSTRAINT "user_changes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_changes" ADD CONSTRAINT "user_changes_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "run_pauses_run_idx" ON "run_pauses" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stage_signoffs_step_uq" ON "stage_signoffs" USING btree ("run_id","stage_key","step");--> statement-breakpoint
CREATE INDEX "task_date_changes_task_idx" ON "task_date_changes" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "user_changes_user_idx" ON "user_changes" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_stopped_by_users_id_fk" FOREIGN KEY ("stopped_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_requested_store_id_stores_id_fk" FOREIGN KEY ("requested_store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_requested_area_id_areas_id_fk" FOREIGN KEY ("requested_area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;