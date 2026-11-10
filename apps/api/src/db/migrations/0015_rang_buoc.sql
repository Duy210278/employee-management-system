CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_at_idx" ON "audit_logs" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "level_runs_one_open_uq" ON "level_runs" USING btree ("staff_id") WHERE "level_runs"."status" in ('active', 'paused', 'review');--> statement-breakpoint
CREATE UNIQUE INDEX "run_assignments_active_uq" ON "run_assignments" USING btree ("run_id","role") WHERE "run_assignments"."to_date" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "staff_employee_code_uq" ON "staff" USING btree ("employee_code") WHERE "staff"."employee_code" is not null;--> statement-breakpoint
ALTER TABLE "level_reviews" ADD CONSTRAINT "level_reviews_result_ck" CHECK ("level_reviews"."result" in ('pass', 'extend', 'fail'));--> statement-breakpoint
ALTER TABLE "level_reviews" ADD CONSTRAINT "level_reviews_status_ck" CHECK ("level_reviews"."status" in ('draft', 'signing', 'done'));--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_level_ck" CHECK ("level_runs"."level_key" between 1 and 4);--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_track_ck" CHECK ("level_runs"."track" in ('nvbh', 'cht_moi_tuyen', 'cht_thang_tien'));--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_status_ck" CHECK ("level_runs"."status" in ('active', 'paused', 'review', 'passed', 'extended', 'failed', 'stopped', 'promoted'));--> statement-breakpoint
ALTER TABLE "level_runs" ADD CONSTRAINT "level_runs_dates_ck" CHECK ("level_runs"."planned_end" >= "level_runs"."start_date");--> statement-breakpoint
ALTER TABLE "run_assignments" ADD CONSTRAINT "run_assignments_role_ck" CHECK ("run_assignments"."role" in ('buddy', 'cht', 'qlkv', 'trainer'));--> statement-breakpoint
ALTER TABLE "run_assignments" ADD CONSTRAINT "run_assignments_dates_ck" CHECK ("run_assignments"."to_date" is null or "run_assignments"."to_date" >= "run_assignments"."from_date");--> statement-breakpoint
ALTER TABLE "run_evaluations" ADD CONSTRAINT "run_evaluations_risk_ck" CHECK ("run_evaluations"."risk" in ('low', 'medium', 'high'));--> statement-breakpoint
ALTER TABLE "run_pauses" ADD CONSTRAINT "run_pauses_status_ck" CHECK ("run_pauses"."status" in ('pending', 'approved', 'rejected'));--> statement-breakpoint
ALTER TABLE "run_pauses" ADD CONSTRAINT "run_pauses_dates_ck" CHECK ("run_pauses"."to_date" >= "run_pauses"."from_date");--> statement-breakpoint
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_status_ck" CHECK ("run_tasks"."status" in ('todo', 'doing', 'help', 'na', 'done', 'void'));--> statement-breakpoint
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_dates_ck" CHECK ("run_tasks"."due_date" >= "run_tasks"."open_date");--> statement-breakpoint
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_done_ck" CHECK ("run_tasks"."status" <> 'done' or "run_tasks"."done_date" is not null);--> statement-breakpoint
ALTER TABLE "run_tasks" ADD CONSTRAINT "run_tasks_na_ck" CHECK ("run_tasks"."status" <> 'na' or "run_tasks"."na_reason" is not null);--> statement-breakpoint
ALTER TABLE "sales_monthly" ADD CONSTRAINT "sales_monthly_source_ck" CHECK ("sales_monthly"."source" in ('manual', 'pos'));--> statement-breakpoint
ALTER TABLE "signoffs" ADD CONSTRAINT "signoffs_role_ck" CHECK ("signoffs"."role" in ('nv', 'buddy', 'cht', 'qlkv', 'bp'));--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_level_ck" CHECK ("staff"."current_level" between 1 and 4);--> statement-breakpoint
ALTER TABLE "task_confirmations" ADD CONSTRAINT "task_confirmations_role_ck" CHECK ("task_confirmations"."role" in ('nv', 'buddy', 'cht', 'qlkv', 'bp'));--> statement-breakpoint
ALTER TABLE "task_confirmations" ADD CONSTRAINT "task_confirmations_proxy_ck" CHECK ("task_confirmations"."proxy_role" in ('nv', 'buddy', 'cht', 'qlkv', 'bp'));--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_role_ck" CHECK ("task_events"."role" in ('nv', 'buddy', 'cht', 'qlkv', 'bp'));--> statement-breakpoint
ALTER TABLE "task_events" ADD CONSTRAINT "task_events_proxy_ck" CHECK ("task_events"."proxy_role" in ('nv', 'buddy', 'cht', 'qlkv', 'bp'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_ck" CHECK ("users"."role" in ('nv', 'cht', 'qlkv', 'bp'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_status_ck" CHECK ("users"."status" in ('pending', 'active', 'locked', 'left', 'rejected'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_requested_role_ck" CHECK ("users"."requested_role" in ('nv', 'cht', 'qlkv', 'bp'));--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_status_ck" CHECK ("versions"."status" in ('draft', 'pending', 'active', 'expired'));--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_change_kind_ck" CHECK ("versions"."change_kind" in ('text', 'criteria'));--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_effective_ck" CHECK ("versions"."effective_to" is null or "versions"."effective_from" is null or "versions"."effective_to" >= "versions"."effective_from");