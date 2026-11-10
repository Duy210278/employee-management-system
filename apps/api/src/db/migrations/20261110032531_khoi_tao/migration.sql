CREATE SCHEMA [lotrinh];
--> statement-breakpoint
CREATE TABLE [lotrinh].[areas] (
	[id] int IDENTITY(1, 1),
	[code] nvarchar(50) NOT NULL,
	[name] nvarchar(200) NOT NULL,
	[active] bit NOT NULL CONSTRAINT [areas_active_default] DEFAULT ((1)),
	CONSTRAINT [areas_pkey] PRIMARY KEY([id]),
	CONSTRAINT [areas_code_uq] UNIQUE([code])
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[audit_logs] (
	[id] bigint IDENTITY(1, 1),
	[user_id] int,
	[action] nvarchar(100) NOT NULL,
	[entity] nvarchar(50),
	[entity_id] nvarchar(100),
	[payload] nvarchar(max),
	[at] datetimeoffset(3) NOT NULL CONSTRAINT [audit_logs_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	[ip] nvarchar(64),
	CONSTRAINT [audit_logs_pkey] PRIMARY KEY([id]),
	CONSTRAINT [audit_logs_payload_json_ck] CHECK ([audit_logs].[payload] is null or isjson([audit_logs].[payload]) = 1)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[credentials] (
	[user_id] int,
	[password_hash] nvarchar(200) NOT NULL,
	[password_changed_at] datetimeoffset(3) NOT NULL CONSTRAINT [credentials_password_changed_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [credentials_pkey] PRIMARY KEY([user_id])
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[level_reviews] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[round] int NOT NULL CONSTRAINT [level_reviews_round_default] DEFAULT ((0)),
	[criteria_results] nvarchar(max) NOT NULL CONSTRAINT [level_reviews_criteria_results_default] DEFAULT ('[]'),
	[notes] nvarchar(max) NOT NULL CONSTRAINT [level_reviews_notes_default] DEFAULT ('{}'),
	[result] nvarchar(10),
	[ext_goals] nvarchar(max) NOT NULL CONSTRAINT [level_reviews_ext_goals_default] DEFAULT (''),
	[status] nvarchar(10) NOT NULL CONSTRAINT [level_reviews_status_default] DEFAULT ('draft'),
	[saved_by] int,
	[saved_at] datetimeoffset(3),
	[applied_at] datetimeoffset(3),
	[row_version] int NOT NULL CONSTRAINT [level_reviews_row_version_default] DEFAULT ((0)),
	[created_at] datetimeoffset(3) NOT NULL CONSTRAINT [level_reviews_created_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [level_reviews_pkey] PRIMARY KEY([id]),
	CONSTRAINT [level_reviews_result_ck] CHECK ([level_reviews].[result] in (N'pass', N'extend', N'fail')),
	CONSTRAINT [level_reviews_status_ck] CHECK ([level_reviews].[status] in (N'draft', N'signing', N'done')),
	CONSTRAINT [level_reviews_criteria_json_ck] CHECK (isjson([level_reviews].[criteria_results]) = 1),
	CONSTRAINT [level_reviews_notes_json_ck] CHECK (isjson([level_reviews].[notes]) = 1)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[level_runs] (
	[id] int IDENTITY(1, 1),
	[staff_id] int NOT NULL,
	[level_key] int NOT NULL,
	[track] nvarchar(20) NOT NULL CONSTRAINT [level_runs_track_default] DEFAULT ('nvbh'),
	[meta] nvarchar(max) NOT NULL CONSTRAINT [level_runs_meta_default] DEFAULT ('{}'),
	[version_id] int NOT NULL,
	[start_date] date NOT NULL,
	[planned_end] date NOT NULL,
	[status] nvarchar(10) NOT NULL CONSTRAINT [level_runs_status_default] DEFAULT ('active'),
	[ext_count] int NOT NULL CONSTRAINT [level_runs_ext_count_default] DEFAULT ((0)),
	[ack_by] int,
	[ack_at] datetimeoffset(3),
	[created_by] int,
	[created_at] datetimeoffset(3) NOT NULL CONSTRAINT [level_runs_created_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [level_runs_pkey] PRIMARY KEY([id]),
	CONSTRAINT [level_runs_level_ck] CHECK ([level_runs].[level_key] between 1 and 4),
	CONSTRAINT [level_runs_track_ck] CHECK ([level_runs].[track] in (N'nvbh', N'cht_moi_tuyen', N'cht_thang_tien')),
	CONSTRAINT [level_runs_status_ck] CHECK ([level_runs].[status] in (N'active', N'paused', N'review', N'passed', N'extended', N'failed', N'stopped', N'promoted')),
	CONSTRAINT [level_runs_dates_ck] CHECK ([level_runs].[planned_end] >= [level_runs].[start_date]),
	CONSTRAINT [level_runs_meta_json_ck] CHECK (isjson([level_runs].[meta]) = 1)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[notifications] (
	[id] int IDENTITY(1, 1),
	[user_id] int NOT NULL,
	[type] nvarchar(50) NOT NULL,
	[title] nvarchar(300) NOT NULL,
	[body] nvarchar(max),
	[link] nvarchar(500),
	[dedupe_key] nvarchar(200),
	[business_date] date NOT NULL,
	[created_at] datetimeoffset(3) NOT NULL,
	[read_at] datetimeoffset(3),
	CONSTRAINT [notifications_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[observations] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[obs_date] date NOT NULL,
	[scores] nvarchar(max) NOT NULL,
	[note] nvarchar(max),
	[observer_id] int NOT NULL,
	[created_at] datetimeoffset(3) NOT NULL CONSTRAINT [observations_created_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [observations_pkey] PRIMARY KEY([id]),
	CONSTRAINT [observations_scores_json_ck] CHECK (isjson([observations].[scores]) = 1)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[run_assignments] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[role] nvarchar(10) NOT NULL,
	[user_id] int NOT NULL,
	[from_date] date NOT NULL,
	[to_date] date,
	CONSTRAINT [run_assignments_pkey] PRIMARY KEY([id]),
	CONSTRAINT [run_assignments_role_ck] CHECK ([run_assignments].[role] in (N'buddy', N'cht', N'qlkv', N'trainer')),
	CONSTRAINT [run_assignments_dates_ck] CHECK ([run_assignments].[to_date] is null or [run_assignments].[to_date] >= [run_assignments].[from_date])
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[run_evaluations] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[ratings] nvarchar(max) NOT NULL CONSTRAINT [run_evaluations_ratings_default] DEFAULT ('{}'),
	[risk] nvarchar(10),
	[suggestion] nvarchar(max) NOT NULL CONSTRAINT [run_evaluations_suggestion_default] DEFAULT (''),
	[saved_by] int,
	[saved_at] datetimeoffset(3),
	[confirmed_by] int,
	[confirmed_at] datetimeoffset(3),
	[confirm_note] nvarchar(max),
	CONSTRAINT [run_evaluations_pkey] PRIMARY KEY([id]),
	CONSTRAINT [run_evaluations_run_uq] UNIQUE([run_id]),
	CONSTRAINT [run_evaluations_risk_ck] CHECK ([run_evaluations].[risk] in (N'low', N'medium', N'high')),
	CONSTRAINT [run_evaluations_ratings_json_ck] CHECK (isjson([run_evaluations].[ratings]) = 1)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[run_journal] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[day] int NOT NULL,
	[mood] nvarchar(100),
	[difficulties] nvarchar(max) NOT NULL CONSTRAINT [run_journal_difficulties_default] DEFAULT (''),
	[actions] nvarchar(max) NOT NULL CONSTRAINT [run_journal_actions_default] DEFAULT (''),
	[manager_note] nvarchar(max) NOT NULL CONSTRAINT [run_journal_manager_note_default] DEFAULT (''),
	[updated_by] int,
	[updated_at] datetimeoffset(3),
	[manager_by] int,
	[manager_at] datetimeoffset(3),
	CONSTRAINT [run_journal_pkey] PRIMARY KEY([id])
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[run_pauses] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[from_date] date NOT NULL,
	[to_date] date NOT NULL,
	[reason] nvarchar(max) NOT NULL,
	[status] nvarchar(10) NOT NULL CONSTRAINT [run_pauses_status_default] DEFAULT ('pending'),
	[requested_by] int NOT NULL,
	[requested_at] datetimeoffset(3) NOT NULL,
	[decided_by] int,
	[decided_at] datetimeoffset(3),
	[decision_note] nvarchar(max),
	CONSTRAINT [run_pauses_pkey] PRIMARY KEY([id]),
	CONSTRAINT [run_pauses_status_ck] CHECK ([run_pauses].[status] in (N'pending', N'approved', N'rejected')),
	CONSTRAINT [run_pauses_dates_ck] CHECK ([run_pauses].[to_date] >= [run_pauses].[from_date])
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[run_tasks] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[item_key] nvarchar(100) NOT NULL,
	[open_date] date NOT NULL,
	[due_date] date NOT NULL,
	[status] nvarchar(10) NOT NULL CONSTRAINT [run_tasks_status_default] DEFAULT ('todo'),
	[done_date] date,
	[na_reason] nvarchar(max),
	[rework_note] nvarchar(max),
	[rework_by] int,
	[rework_at] datetimeoffset(3),
	[row_version] int NOT NULL CONSTRAINT [run_tasks_row_version_default] DEFAULT ((0)),
	[updated_at] datetimeoffset(3) NOT NULL CONSTRAINT [run_tasks_updated_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [run_tasks_pkey] PRIMARY KEY([id]),
	CONSTRAINT [run_tasks_status_ck] CHECK ([run_tasks].[status] in (N'todo', N'doing', N'help', N'na', N'done', N'void')),
	CONSTRAINT [run_tasks_dates_ck] CHECK ([run_tasks].[due_date] >= [run_tasks].[open_date]),
	CONSTRAINT [run_tasks_done_ck] CHECK ([run_tasks].[status] <> N'done' or [run_tasks].[done_date] is not null),
	CONSTRAINT [run_tasks_na_ck] CHECK ([run_tasks].[status] <> N'na' or [run_tasks].[na_reason] is not null)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[sales_monthly] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[month_index] int NOT NULL,
	[total] float,
	[coef1] float,
	[source] nvarchar(10) NOT NULL CONSTRAINT [sales_monthly_source_default] DEFAULT ('manual'),
	[entered_by] int,
	[at] datetimeoffset(3) NOT NULL CONSTRAINT [sales_monthly_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [sales_monthly_pkey] PRIMARY KEY([id]),
	CONSTRAINT [sales_monthly_source_ck] CHECK ([sales_monthly].[source] in (N'manual', N'pos'))
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[signoffs] (
	[id] int IDENTITY(1, 1),
	[run_id] int NOT NULL,
	[stage_key] nvarchar(100),
	[review_id] int,
	[step] int NOT NULL,
	[role] nvarchar(10) NOT NULL,
	[user_id] int NOT NULL,
	[at] datetimeoffset(3) NOT NULL,
	CONSTRAINT [signoffs_pkey] PRIMARY KEY([id]),
	CONSTRAINT [signoffs_one_of] CHECK (([signoffs].[stage_key] is not null and [signoffs].[review_id] is null) or ([signoffs].[stage_key] is null and [signoffs].[review_id] is not null)),
	CONSTRAINT [signoffs_role_ck] CHECK ([signoffs].[role] in (N'nv', N'buddy', N'cht', N'qlkv', N'bp'))
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[staff] (
	[id] int IDENTITY(1, 1),
	[user_id] int,
	[employee_code] nvarchar(30),
	[full_name] nvarchar(200) NOT NULL,
	[store_id] int NOT NULL,
	[hire_date] date NOT NULL,
	[current_level] int NOT NULL CONSTRAINT [staff_current_level_default] DEFAULT ((1)),
	[active] bit NOT NULL CONSTRAINT [staff_active_default] DEFAULT ((1)),
	[stop_reason] nvarchar(max),
	[stopped_at] datetimeoffset(3),
	[stopped_by] int,
	[created_at] datetimeoffset(3) NOT NULL CONSTRAINT [staff_created_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [staff_pkey] PRIMARY KEY([id]),
	CONSTRAINT [staff_level_ck] CHECK ([staff].[current_level] between 1 and 4)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[stores] (
	[id] int IDENTITY(1, 1),
	[code] nvarchar(50) NOT NULL,
	[name] nvarchar(200) NOT NULL,
	[address] nvarchar(500),
	[area_id] int NOT NULL,
	[active] bit NOT NULL CONSTRAINT [stores_active_default] DEFAULT ((1)),
	CONSTRAINT [stores_pkey] PRIMARY KEY([id]),
	CONSTRAINT [stores_code_uq] UNIQUE([code])
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[task_confirmations] (
	[id] int IDENTITY(1, 1),
	[task_id] int NOT NULL,
	[role] nvarchar(10) NOT NULL,
	[user_id] int NOT NULL,
	[proxy_role] nvarchar(10),
	[at] datetimeoffset(3) NOT NULL,
	[note] nvarchar(max),
	[revoked_at] datetimeoffset(3),
	[revoked_by] int,
	CONSTRAINT [task_confirmations_pkey] PRIMARY KEY([id]),
	CONSTRAINT [task_confirmations_role_ck] CHECK ([task_confirmations].[role] in (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
	CONSTRAINT [task_confirmations_proxy_ck] CHECK ([task_confirmations].[proxy_role] in (N'nv', N'buddy', N'cht', N'qlkv', N'bp'))
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[task_events] (
	[id] int IDENTITY(1, 1),
	[task_id] int NOT NULL,
	[user_id] int NOT NULL,
	[role] nvarchar(10),
	[proxy_role] nvarchar(10),
	[action] nvarchar(50) NOT NULL,
	[note] nvarchar(max),
	[data] nvarchar(max),
	[at] datetimeoffset(3) NOT NULL,
	CONSTRAINT [task_events_pkey] PRIMARY KEY([id]),
	CONSTRAINT [task_events_role_ck] CHECK ([task_events].[role] in (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
	CONSTRAINT [task_events_proxy_ck] CHECK ([task_events].[proxy_role] in (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
	CONSTRAINT [task_events_data_json_ck] CHECK ([task_events].[data] is null or isjson([task_events].[data]) = 1)
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[user_scopes] (
	[id] int IDENTITY(1, 1),
	[user_id] int NOT NULL,
	[store_id] int,
	[area_id] int,
	CONSTRAINT [user_scopes_pkey] PRIMARY KEY([id]),
	CONSTRAINT [user_scopes_one_of] CHECK (([user_scopes].[store_id] is not null and [user_scopes].[area_id] is null) or ([user_scopes].[store_id] is null and [user_scopes].[area_id] is not null))
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[users] (
	[id] int IDENTITY(1, 1),
	[employee_code] nvarchar(30),
	[full_name] nvarchar(200) NOT NULL,
	[email] nvarchar(255) NOT NULL,
	[phone] nvarchar(30),
	[role] nvarchar(10) NOT NULL,
	[status] nvarchar(10) NOT NULL CONSTRAINT [users_status_default] DEFAULT ('pending'),
	[can_buddy] bit NOT NULL CONSTRAINT [users_can_buddy_default] DEFAULT ((0)),
	[requested_role] nvarchar(10),
	[requested_store_id] int,
	[requested_area_id] int,
	[review_note] nvarchar(max),
	[reviewed_by] int,
	[reviewed_at] datetimeoffset(3),
	[row_version] int NOT NULL CONSTRAINT [users_row_version_default] DEFAULT ((0)),
	[last_seen_at] datetimeoffset(3),
	[created_at] datetimeoffset(3) NOT NULL CONSTRAINT [users_created_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [users_pkey] PRIMARY KEY([id]),
	CONSTRAINT [users_email_uq] UNIQUE([email]),
	CONSTRAINT [users_role_ck] CHECK ([users].[role] in (N'nv', N'cht', N'qlkv', N'bp')),
	CONSTRAINT [users_status_ck] CHECK ([users].[status] in (N'pending', N'active', N'locked', N'left', N'rejected')),
	CONSTRAINT [users_requested_role_ck] CHECK ([users].[requested_role] in (N'nv', N'cht', N'qlkv', N'bp'))
);
--> statement-breakpoint
CREATE TABLE [lotrinh].[versions] (
	[id] int IDENTITY(1, 1),
	[code] nvarchar(30),
	[criteria_line] nvarchar(10),
	[status] nvarchar(10) NOT NULL,
	[effective_from] date,
	[effective_to] date,
	[parent_id] int,
	[change_note] nvarchar(max),
	[change_kind] nvarchar(10),
	[review_note] nvarchar(max),
	[content] nvarchar(max) NOT NULL,
	[row_version] int NOT NULL CONSTRAINT [versions_row_version_default] DEFAULT ((0)),
	[created_by] int,
	[updated_by] int,
	[updated_at] datetimeoffset(3) NOT NULL CONSTRAINT [versions_updated_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	[submitted_by] int,
	[submitted_at] datetimeoffset(3),
	[approved_by] int,
	[approved_at] datetimeoffset(3),
	[created_at] datetimeoffset(3) NOT NULL CONSTRAINT [versions_created_at_default] DEFAULT (SYSDATETIMEOFFSET()),
	CONSTRAINT [versions_pkey] PRIMARY KEY([id]),
	CONSTRAINT [versions_status_ck] CHECK ([versions].[status] in (N'draft', N'pending', N'active', N'expired')),
	CONSTRAINT [versions_change_kind_ck] CHECK ([versions].[change_kind] in (N'text', N'criteria')),
	CONSTRAINT [versions_effective_ck] CHECK ([versions].[effective_to] is null or [versions].[effective_from] is null or [versions].[effective_to] >= [versions].[effective_from]),
	CONSTRAINT [versions_content_json_ck] CHECK (isjson([versions].[content]) = 1)
);
--> statement-breakpoint
ALTER TABLE [lotrinh].[audit_logs] ADD CONSTRAINT [audit_logs_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[credentials] ADD CONSTRAINT [credentials_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[level_reviews] ADD CONSTRAINT [level_reviews_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[level_reviews] ADD CONSTRAINT [level_reviews_saved_by_users_id_fk] FOREIGN KEY ([saved_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[level_runs] ADD CONSTRAINT [level_runs_staff_id_staff_id_fk] FOREIGN KEY ([staff_id]) REFERENCES [lotrinh].[staff]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[level_runs] ADD CONSTRAINT [level_runs_version_id_versions_id_fk] FOREIGN KEY ([version_id]) REFERENCES [lotrinh].[versions]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[level_runs] ADD CONSTRAINT [level_runs_ack_by_users_id_fk] FOREIGN KEY ([ack_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[level_runs] ADD CONSTRAINT [level_runs_created_by_users_id_fk] FOREIGN KEY ([created_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[notifications] ADD CONSTRAINT [notifications_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[observations] ADD CONSTRAINT [observations_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[observations] ADD CONSTRAINT [observations_observer_id_users_id_fk] FOREIGN KEY ([observer_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_assignments] ADD CONSTRAINT [run_assignments_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_assignments] ADD CONSTRAINT [run_assignments_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_evaluations] ADD CONSTRAINT [run_evaluations_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_evaluations] ADD CONSTRAINT [run_evaluations_saved_by_users_id_fk] FOREIGN KEY ([saved_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_evaluations] ADD CONSTRAINT [run_evaluations_confirmed_by_users_id_fk] FOREIGN KEY ([confirmed_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_journal] ADD CONSTRAINT [run_journal_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_journal] ADD CONSTRAINT [run_journal_updated_by_users_id_fk] FOREIGN KEY ([updated_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_journal] ADD CONSTRAINT [run_journal_manager_by_users_id_fk] FOREIGN KEY ([manager_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_pauses] ADD CONSTRAINT [run_pauses_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_pauses] ADD CONSTRAINT [run_pauses_requested_by_users_id_fk] FOREIGN KEY ([requested_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_pauses] ADD CONSTRAINT [run_pauses_decided_by_users_id_fk] FOREIGN KEY ([decided_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_tasks] ADD CONSTRAINT [run_tasks_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[run_tasks] ADD CONSTRAINT [run_tasks_rework_by_users_id_fk] FOREIGN KEY ([rework_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[sales_monthly] ADD CONSTRAINT [sales_monthly_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[sales_monthly] ADD CONSTRAINT [sales_monthly_entered_by_users_id_fk] FOREIGN KEY ([entered_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[signoffs] ADD CONSTRAINT [signoffs_run_id_level_runs_id_fk] FOREIGN KEY ([run_id]) REFERENCES [lotrinh].[level_runs]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[signoffs] ADD CONSTRAINT [signoffs_review_id_level_reviews_id_fk] FOREIGN KEY ([review_id]) REFERENCES [lotrinh].[level_reviews]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[signoffs] ADD CONSTRAINT [signoffs_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[staff] ADD CONSTRAINT [staff_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[staff] ADD CONSTRAINT [staff_store_id_stores_id_fk] FOREIGN KEY ([store_id]) REFERENCES [lotrinh].[stores]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[staff] ADD CONSTRAINT [staff_stopped_by_users_id_fk] FOREIGN KEY ([stopped_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[stores] ADD CONSTRAINT [stores_area_id_areas_id_fk] FOREIGN KEY ([area_id]) REFERENCES [lotrinh].[areas]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[task_confirmations] ADD CONSTRAINT [task_confirmations_task_id_run_tasks_id_fk] FOREIGN KEY ([task_id]) REFERENCES [lotrinh].[run_tasks]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[task_confirmations] ADD CONSTRAINT [task_confirmations_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[task_confirmations] ADD CONSTRAINT [task_confirmations_revoked_by_users_id_fk] FOREIGN KEY ([revoked_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[task_events] ADD CONSTRAINT [task_events_task_id_run_tasks_id_fk] FOREIGN KEY ([task_id]) REFERENCES [lotrinh].[run_tasks]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[task_events] ADD CONSTRAINT [task_events_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[user_scopes] ADD CONSTRAINT [user_scopes_user_id_users_id_fk] FOREIGN KEY ([user_id]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[user_scopes] ADD CONSTRAINT [user_scopes_store_id_stores_id_fk] FOREIGN KEY ([store_id]) REFERENCES [lotrinh].[stores]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[user_scopes] ADD CONSTRAINT [user_scopes_area_id_areas_id_fk] FOREIGN KEY ([area_id]) REFERENCES [lotrinh].[areas]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[users] ADD CONSTRAINT [users_requested_store_id_stores_id_fk] FOREIGN KEY ([requested_store_id]) REFERENCES [lotrinh].[stores]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[users] ADD CONSTRAINT [users_requested_area_id_areas_id_fk] FOREIGN KEY ([requested_area_id]) REFERENCES [lotrinh].[areas]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[versions] ADD CONSTRAINT [versions_created_by_users_id_fk] FOREIGN KEY ([created_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[versions] ADD CONSTRAINT [versions_updated_by_users_id_fk] FOREIGN KEY ([updated_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[versions] ADD CONSTRAINT [versions_submitted_by_users_id_fk] FOREIGN KEY ([submitted_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
ALTER TABLE [lotrinh].[versions] ADD CONSTRAINT [versions_approved_by_users_id_fk] FOREIGN KEY ([approved_by]) REFERENCES [lotrinh].[users]([id]);--> statement-breakpoint
CREATE INDEX [audit_logs_entity_idx] ON [lotrinh].[audit_logs] ([entity],[entity_id]);--> statement-breakpoint
CREATE INDEX [audit_logs_at_idx] ON [lotrinh].[audit_logs] ([at]);--> statement-breakpoint
CREATE UNIQUE INDEX [level_reviews_run_round_uq] ON [lotrinh].[level_reviews] ([run_id],[round]);--> statement-breakpoint
CREATE INDEX [level_runs_staff_idx] ON [lotrinh].[level_runs] ([staff_id]);--> statement-breakpoint
CREATE UNIQUE INDEX [level_runs_one_open_uq] ON [lotrinh].[level_runs] ([staff_id]) WHERE [status] in (N'active', N'paused', N'review');--> statement-breakpoint
CREATE INDEX [notifications_user_idx] ON [lotrinh].[notifications] ([user_id],[read_at]);--> statement-breakpoint
CREATE UNIQUE INDEX [notifications_dedupe_uq] ON [lotrinh].[notifications] ([dedupe_key]) WHERE [dedupe_key] is not null;--> statement-breakpoint
CREATE INDEX [observations_run_idx] ON [lotrinh].[observations] ([run_id]);--> statement-breakpoint
CREATE INDEX [run_assignments_run_idx] ON [lotrinh].[run_assignments] ([run_id]);--> statement-breakpoint
CREATE INDEX [run_assignments_user_idx] ON [lotrinh].[run_assignments] ([user_id]);--> statement-breakpoint
CREATE UNIQUE INDEX [run_assignments_active_uq] ON [lotrinh].[run_assignments] ([run_id],[role]) WHERE [to_date] is null;--> statement-breakpoint
CREATE UNIQUE INDEX [run_journal_run_day_uq] ON [lotrinh].[run_journal] ([run_id],[day]);--> statement-breakpoint
CREATE INDEX [run_pauses_run_idx] ON [lotrinh].[run_pauses] ([run_id]);--> statement-breakpoint
CREATE UNIQUE INDEX [run_tasks_run_item_uq] ON [lotrinh].[run_tasks] ([run_id],[item_key]);--> statement-breakpoint
CREATE UNIQUE INDEX [sales_monthly_run_month_uq] ON [lotrinh].[sales_monthly] ([run_id],[month_index]);--> statement-breakpoint
CREATE UNIQUE INDEX [signoffs_stage_step_uq] ON [lotrinh].[signoffs] ([run_id],[stage_key],[step]) WHERE [stage_key] is not null;--> statement-breakpoint
CREATE UNIQUE INDEX [signoffs_review_step_uq] ON [lotrinh].[signoffs] ([review_id],[step]) WHERE [review_id] is not null;--> statement-breakpoint
CREATE INDEX [signoffs_run_idx] ON [lotrinh].[signoffs] ([run_id]);--> statement-breakpoint
CREATE UNIQUE INDEX [staff_user_uq] ON [lotrinh].[staff] ([user_id]) WHERE [user_id] is not null;--> statement-breakpoint
CREATE UNIQUE INDEX [staff_employee_code_uq] ON [lotrinh].[staff] ([employee_code]) WHERE [employee_code] is not null;--> statement-breakpoint
CREATE INDEX [staff_store_idx] ON [lotrinh].[staff] ([store_id]);--> statement-breakpoint
CREATE UNIQUE INDEX [task_confirmations_active_uq] ON [lotrinh].[task_confirmations] ([task_id],[role]) WHERE [revoked_at] is null;--> statement-breakpoint
CREATE INDEX [task_confirmations_task_idx] ON [lotrinh].[task_confirmations] ([task_id]);--> statement-breakpoint
CREATE INDEX [task_events_task_idx] ON [lotrinh].[task_events] ([task_id]);--> statement-breakpoint
CREATE UNIQUE INDEX [user_scopes_store_uq] ON [lotrinh].[user_scopes] ([user_id],[store_id]) WHERE [store_id] is not null;--> statement-breakpoint
CREATE UNIQUE INDEX [user_scopes_area_uq] ON [lotrinh].[user_scopes] ([user_id],[area_id]) WHERE [area_id] is not null;--> statement-breakpoint
CREATE UNIQUE INDEX [users_employee_code_uq] ON [lotrinh].[users] ([employee_code]) WHERE [employee_code] is not null;--> statement-breakpoint
CREATE UNIQUE INDEX [versions_code_uq] ON [lotrinh].[versions] ([code]) WHERE [code] is not null;