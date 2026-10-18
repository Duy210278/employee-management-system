CREATE TABLE "level_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"round" integer DEFAULT 0 NOT NULL,
	"criteria_results" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" text,
	"ext_goals" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"saved_by" integer,
	"saved_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"row_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "observations" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"obs_date" date NOT NULL,
	"scores" jsonb NOT NULL,
	"note" text,
	"observer_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_signatures" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer NOT NULL,
	"step" integer NOT NULL,
	"role" text NOT NULL,
	"user_id" integer NOT NULL,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_monthly" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"month_index" integer NOT NULL,
	"total" double precision,
	"coef1" double precision,
	"source" text DEFAULT 'manual' NOT NULL,
	"entered_by" integer,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "level_reviews" ADD CONSTRAINT "level_reviews_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_reviews" ADD CONSTRAINT "level_reviews_saved_by_users_id_fk" FOREIGN KEY ("saved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "observations" ADD CONSTRAINT "observations_observer_id_users_id_fk" FOREIGN KEY ("observer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_signatures" ADD CONSTRAINT "review_signatures_review_id_level_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."level_reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_signatures" ADD CONSTRAINT "review_signatures_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_monthly" ADD CONSTRAINT "sales_monthly_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_monthly" ADD CONSTRAINT "sales_monthly_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "level_reviews_run_round_uq" ON "level_reviews" USING btree ("run_id","round");--> statement-breakpoint
CREATE INDEX "observations_run_idx" ON "observations" USING btree ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_signatures_step_uq" ON "review_signatures" USING btree ("review_id","step");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_monthly_run_month_uq" ON "sales_monthly" USING btree ("run_id","month_index");