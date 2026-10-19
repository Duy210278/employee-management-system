CREATE TABLE "run_evaluations" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"ratings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk" text,
	"suggestion" text DEFAULT '' NOT NULL,
	"saved_by" integer,
	"saved_at" timestamp with time zone,
	"confirmed_by" integer,
	"confirmed_at" timestamp with time zone,
	"confirm_note" text,
	CONSTRAINT "run_evaluations_run_id_unique" UNIQUE("run_id")
);
--> statement-breakpoint
CREATE TABLE "run_journal" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"day" integer NOT NULL,
	"mood" text,
	"difficulties" text DEFAULT '' NOT NULL,
	"actions" text DEFAULT '' NOT NULL,
	"manager_note" text DEFAULT '' NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone,
	"manager_by" integer,
	"manager_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "level_runs" ADD COLUMN "track" text DEFAULT 'nvbh' NOT NULL;--> statement-breakpoint
ALTER TABLE "level_runs" ADD COLUMN "meta" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "run_evaluations" ADD CONSTRAINT "run_evaluations_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_evaluations" ADD CONSTRAINT "run_evaluations_saved_by_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_evaluations" ADD CONSTRAINT "run_evaluations_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_journal" ADD CONSTRAINT "run_journal_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_journal" ADD CONSTRAINT "run_journal_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_journal" ADD CONSTRAINT "run_journal_manager_by_users_id_fk" FOREIGN KEY ("manager_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_journal_run_day_uq" ON "run_journal" USING btree ("run_id","day");