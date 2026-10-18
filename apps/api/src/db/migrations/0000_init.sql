CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "areas_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text,
	"entity_id" text,
	"payload" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text
);
--> statement-breakpoint
CREATE TABLE "credentials" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"password_hash" text NOT NULL,
	"password_changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "level_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"level_key" integer NOT NULL,
	"version_id" integer NOT NULL,
	"criteria_line" text NOT NULL,
	"start_date" date NOT NULL,
	"planned_end" date NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"ext_count" integer DEFAULT 0 NOT NULL,
	"ack_by" integer,
	"ack_at" timestamp with time zone,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "run_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"role" text NOT NULL,
	"user_id" integer NOT NULL,
	"from_date" date NOT NULL,
	"to_date" date
);
--> statement-breakpoint
CREATE TABLE "run_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"item_key" text NOT NULL,
	"open_date" date NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"done_date" date,
	"na_reason" text,
	"rework_note" text,
	"rework_by" integer,
	"rework_at" timestamp with time zone,
	"row_version" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"employee_code" text,
	"full_name" text NOT NULL,
	"store_id" integer NOT NULL,
	"hire_date" date NOT NULL,
	"current_level" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "staff_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"area_id" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_confirmations" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"role" text NOT NULL,
	"user_id" integer NOT NULL,
	"proxy_role" text,
	"at" timestamp with time zone NOT NULL,
	"note" text,
	"revoked_at" timestamp with time zone,
	"revoked_by" integer
);
--> statement-breakpoint
CREATE TABLE "task_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text,
	"proxy_role" text,
	"action" text NOT NULL,
	"note" text,
	"at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_area_scopes" (
	"user_id" integer NOT NULL,
	"area_id" integer NOT NULL,
	CONSTRAINT "user_area_scopes_user_id_area_id_pk" PRIMARY KEY("user_id","area_id")
);
--> statement-breakpoint
CREATE TABLE "user_store_scopes" (
	"user_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	CONSTRAINT "user_store_scopes_user_id_store_id_pk" PRIMARY KEY("user_id","store_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"employee_code" text,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"can_buddy" boolean DEFAULT false NOT NULL,
	"can_approve_versions" boolean DEFAULT false NOT NULL,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_employee_code_unique" UNIQUE("employee_code"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"criteria_line" text NOT NULL,
	"status" text NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"parent_id" integer,
	"change_note" text,
	"change_kind" text,
	"content" jsonb NOT NULL,
	"approved_by" integer,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "versions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_staff_id_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_version_id_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_ack_by_users_id_fk" FOREIGN KEY ("ack_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_assignments" ADD CONSTRAINT "run_assignments_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_assignments" ADD CONSTRAINT "run_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_run_id_level_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."level_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_rework_by_users_id_fk" FOREIGN KEY ("rework_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stores" ADD CONSTRAINT "stores_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_confirmations" ADD CONSTRAINT "task_confirmations_task_id_run_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."run_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_confirmations" ADD CONSTRAINT "task_confirmations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_confirmations" ADD CONSTRAINT "task_confirmations_revoked_by_users_id_fk" FOREIGN KEY ("revoked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_task_id_run_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."run_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_area_scopes" ADD CONSTRAINT "user_area_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_area_scopes" ADD CONSTRAINT "user_area_scopes_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_store_scopes" ADD CONSTRAINT "user_store_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_store_scopes" ADD CONSTRAINT "user_store_scopes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "level_runs_staff_idx" ON "level_runs" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "run_assignments_run_idx" ON "run_assignments" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "run_assignments_user_idx" ON "run_assignments" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "run_tasks_run_item_uq" ON "run_tasks" USING btree ("run_id","item_key");--> statement-breakpoint
CREATE UNIQUE INDEX "task_confirmations_active_uq" ON "task_confirmations" USING btree ("task_id","role") WHERE revoked_at is null;--> statement-breakpoint
CREATE INDEX "task_confirmations_task_idx" ON "task_confirmations" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "task_events_task_idx" ON "task_events" USING btree ("task_id");