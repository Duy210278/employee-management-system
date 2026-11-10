/* ============================================================================
   Lộ trình Upharma: script tạo bảng cho SQL Server (bản đã gom nhóm)
   Yêu cầu: SQL Server 2016 trở lên (dùng ISJSON, DATETIMEOFFSET, filtered index).
   Chạy bằng sqlcmd (có lệnh GO tách khối), BẮT BUỘC có cờ -I để bật QUOTED_IDENTIFIER
   (filtered index cần tùy chọn này; thư viện Node mssql bật sẵn):
     sqlcmd -I -S localhost -U lotrinh_app -d lotrinh_test -C -b -i docs/thiet-ke/sqlserver/01_tao_bang.sql
   Đã chạy thử ngày 10/11/2026 trên SQL Server 2022 (16.0.4305.5, collation Vietnamese_100_CI_AS):
   21 bảng, 38 CHECK, 10 filtered index, 2 trigger; các ràng buộc và trigger chặn đúng khi ghi sai.

   Quy ước chuyển đổi từ PostgreSQL:
     serial/bigserial        -> INT / BIGINT IDENTITY
     text                    -> NVARCHAR(n) (bắt buộc dùng NVARCHAR để lưu tiếng Việt); nội dung dài -> NVARCHAR(MAX)
     boolean                 -> BIT
     timestamptz             -> DATETIMEOFFSET(3)
     date                    -> DATE
     double precision        -> FLOAT
     jsonb                   -> NVARCHAR(MAX) kèm CHECK (ISJSON(...) = 1)
     unique cho phép NULL    -> filtered unique index WHERE cột IS NOT NULL
                                (SQL Server chỉ cho đúng một NULL trong unique thường)
     partial unique index    -> filtered unique index (cú pháp tương đương)
     trigger plpgsql         -> trigger T-SQL (THROW mã 50001)
   Khóa ngoại dùng NO ACTION (như bản PostgreSQL, tránh lỗi nhiều đường xóa dây chuyền).
   Dữ liệu nghiệp vụ không xóa vật lý (R21).

   Đã gom so với bản PostgreSQL (26 bảng -> 21 bảng):
     user_changes                          -> audit_logs (entity = 'user')
     task_date_changes                     -> task_events (action = 'date_change', cột data)
     user_store_scopes + user_area_scopes  -> user_scopes
     stage_signoffs + review_signatures    -> signoffs (kind = 'stage' | 'review')
     system_settings                       -> bỏ (chỉ lưu ngày giả lập của đồng hồ demo, đã bỏ)
   credentials giữ lại cho tới khi đăng nhập bằng SSO của dự án lớn; khi có SSO thì bỏ bảng này,
   các cột requested_* và đổi khóa nhận diện sang employee_code.

   Khác bản PostgreSQL ở các cột:
     level_runs: bỏ criteria_line (lấy qua versions.criteria_line theo version_id).
     task_events: thêm cột data (JSON) để chứa ngày cũ, ngày mới, lý do khi đổi hạn.

   Giá trị của signoffs.ref:
     kind = 'stage'  -> mã giai đoạn (stage_key cũ)
     kind = 'review' -> số vòng của phiếu đánh giá (level_reviews.round) của cùng run_id
   ============================================================================ */

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF SCHEMA_ID(N'lotrinh') IS NULL EXEC(N'CREATE SCHEMA lotrinh');
GO

/* ---------- 1. Tổ chức và người dùng ---------- */

CREATE TABLE lotrinh.areas (
  id     INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_areas PRIMARY KEY,
  code   NVARCHAR(50)  NOT NULL CONSTRAINT uq_areas_code UNIQUE,
  name   NVARCHAR(200) NOT NULL,
  active BIT NOT NULL CONSTRAINT df_areas_active DEFAULT 1
);

CREATE TABLE lotrinh.stores (
  id      INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_stores PRIMARY KEY,
  code    NVARCHAR(50)  NOT NULL CONSTRAINT uq_stores_code UNIQUE,
  name    NVARCHAR(200) NOT NULL,
  address NVARCHAR(500) NULL,
  area_id INT NOT NULL CONSTRAINT fk_stores_area REFERENCES lotrinh.areas(id),
  active  BIT NOT NULL CONSTRAINT df_stores_active DEFAULT 1
);

CREATE TABLE lotrinh.users (
  id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_users PRIMARY KEY,
  employee_code      NVARCHAR(30)  NULL,
  full_name          NVARCHAR(200) NOT NULL,
  email              NVARCHAR(255) NOT NULL CONSTRAINT uq_users_email UNIQUE,   -- tên đăng nhập
  phone              NVARCHAR(30)  NULL,
  [role]             NVARCHAR(10)  NOT NULL CONSTRAINT ck_users_role CHECK ([role] IN (N'nv', N'cht', N'qlkv', N'bp')),
  [status]           NVARCHAR(10)  NOT NULL CONSTRAINT df_users_status DEFAULT N'pending'
                     CONSTRAINT ck_users_status CHECK ([status] IN (N'pending', N'active', N'locked', N'left', N'rejected')),
  can_buddy          BIT NOT NULL CONSTRAINT df_users_can_buddy DEFAULT 0,
  -- Người đăng ký đề nghị vai trò, phạm vi; BP Đào tạo chốt khi duyệt
  requested_role     NVARCHAR(10) NULL CONSTRAINT ck_users_requested_role CHECK (requested_role IN (N'nv', N'cht', N'qlkv', N'bp')),
  requested_store_id INT NULL CONSTRAINT fk_users_requested_store REFERENCES lotrinh.stores(id),
  requested_area_id  INT NULL CONSTRAINT fk_users_requested_area REFERENCES lotrinh.areas(id),
  review_note        NVARCHAR(MAX) NULL,       -- lý do từ chối đăng ký
  reviewed_by        INT NULL CONSTRAINT fk_users_reviewed_by REFERENCES lotrinh.users(id),
  reviewed_at        DATETIMEOFFSET(3) NULL,
  row_version        INT NOT NULL CONSTRAINT df_users_row_version DEFAULT 0,
  last_seen_at       DATETIMEOFFSET(3) NULL,
  created_at         DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSDATETIMEOFFSET()
);
CREATE UNIQUE INDEX uq_users_employee_code ON lotrinh.users(employee_code) WHERE employee_code IS NOT NULL;

/* Mật khẩu đăng nhập nội bộ; bỏ khi chuyển sang SSO */
CREATE TABLE lotrinh.credentials (
  user_id             INT NOT NULL CONSTRAINT pk_credentials PRIMARY KEY
                      CONSTRAINT fk_credentials_user REFERENCES lotrinh.users(id),
  password_hash       NVARCHAR(200) NOT NULL,
  password_changed_at DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_credentials_changed_at DEFAULT SYSDATETIMEOFFSET()
);

/* Phạm vi dữ liệu của tài khoản: CHT theo cửa hàng, QLKV theo khu vực. Mỗi dòng đúng một trong hai cột. */
CREATE TABLE lotrinh.user_scopes (
  id       INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_user_scopes PRIMARY KEY,
  user_id  INT NOT NULL CONSTRAINT fk_user_scopes_user REFERENCES lotrinh.users(id),
  store_id INT NULL CONSTRAINT fk_user_scopes_store REFERENCES lotrinh.stores(id),
  area_id  INT NULL CONSTRAINT fk_user_scopes_area REFERENCES lotrinh.areas(id),
  CONSTRAINT ck_user_scopes_one_of CHECK (
    (store_id IS NOT NULL AND area_id IS NULL) OR (store_id IS NULL AND area_id IS NOT NULL))
);
CREATE UNIQUE INDEX uq_user_scopes_store ON lotrinh.user_scopes(user_id, store_id) WHERE store_id IS NOT NULL;
CREATE UNIQUE INDEX uq_user_scopes_area  ON lotrinh.user_scopes(user_id, area_id)  WHERE area_id  IS NOT NULL;

/* dedupe_key chống trùng khi job nhắc việc chạy lại */
CREATE TABLE lotrinh.notifications (
  id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_notifications PRIMARY KEY,
  user_id       INT NOT NULL CONSTRAINT fk_notifications_user REFERENCES lotrinh.users(id),
  [type]        NVARCHAR(50)  NOT NULL,
  title         NVARCHAR(300) NOT NULL,
  body          NVARCHAR(MAX) NULL,
  link          NVARCHAR(500) NULL,
  dedupe_key    NVARCHAR(200) NULL,
  business_date DATE NOT NULL,
  created_at    DATETIMEOFFSET(3) NOT NULL,
  read_at       DATETIMEOFFSET(3) NULL
);
CREATE INDEX ix_notifications_user ON lotrinh.notifications(user_id, read_at);
CREATE UNIQUE INDEX uq_notifications_dedupe ON lotrinh.notifications(dedupe_key) WHERE dedupe_key IS NOT NULL;

/* ---------- 2. Phiên bản lộ trình (nội dung là một tài liệu JSON bất biến) ---------- */

CREATE TABLE lotrinh.versions (
  id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_versions PRIMARY KEY,
  code          NVARCHAR(30) NULL,          -- cấp khi duyệt; bản nháp chưa có số
  criteria_line NVARCHAR(10) NULL,          -- dòng tiêu chí, hai số đầu (ví dụ 2.1)
  [status]      NVARCHAR(10) NOT NULL
                CONSTRAINT ck_versions_status CHECK ([status] IN (N'draft', N'pending', N'active', N'expired')),
  effective_from DATE NULL,
  effective_to   DATE NULL,
  parent_id     INT NULL CONSTRAINT fk_versions_parent REFERENCES lotrinh.versions(id),
  change_note   NVARCHAR(MAX) NULL,
  change_kind   NVARCHAR(10) NULL CONSTRAINT ck_versions_change_kind CHECK (change_kind IN (N'text', N'criteria')),
  review_note   NVARCHAR(MAX) NULL,
  content       NVARCHAR(MAX) NOT NULL CONSTRAINT ck_versions_content_json CHECK (ISJSON(content) = 1),
  row_version   INT NOT NULL CONSTRAINT df_versions_row_version DEFAULT 0,
  created_by    INT NULL CONSTRAINT fk_versions_created_by REFERENCES lotrinh.users(id),
  updated_by    INT NULL CONSTRAINT fk_versions_updated_by REFERENCES lotrinh.users(id),
  updated_at    DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_versions_updated_at DEFAULT SYSDATETIMEOFFSET(),
  submitted_by  INT NULL CONSTRAINT fk_versions_submitted_by REFERENCES lotrinh.users(id),
  submitted_at  DATETIMEOFFSET(3) NULL,
  approved_by   INT NULL CONSTRAINT fk_versions_approved_by REFERENCES lotrinh.users(id),
  approved_at   DATETIMEOFFSET(3) NULL,
  created_at    DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_versions_created_at DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT ck_versions_effective_range CHECK (effective_from IS NULL OR effective_to IS NULL OR effective_to >= effective_from)
);
CREATE UNIQUE INDEX uq_versions_code ON lotrinh.versions(code) WHERE code IS NOT NULL;
GO

/* R03: bản đã gửi duyệt hoặc ban hành không sửa được nội dung, không xóa được; chỉ bản nháp được sửa, xóa.
   Bản đã ban hành không được đưa về nháp. */
CREATE TRIGGER lotrinh.trg_versions_no_delete ON lotrinh.versions AFTER DELETE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @msg NVARCHAR(400);
  SELECT TOP (1) @msg = CONCAT(N'Phiên bản ', COALESCE(d.code, CAST(d.id AS NVARCHAR(20))),
                               N' đã gửi duyệt hoặc ban hành, không được xóa (R03)')
  FROM deleted d WHERE d.[status] <> N'draft';
  IF @msg IS NOT NULL THROW 50001, @msg, 1;
END;
GO

CREATE TRIGGER lotrinh.trg_versions_guard_update ON lotrinh.versions AFTER UPDATE AS
BEGIN
  SET NOCOUNT ON;
  DECLARE @msg NVARCHAR(400);

  IF UPDATE(content)
  BEGIN
    SELECT TOP (1) @msg = CONCAT(N'Phiên bản ', COALESCE(d.code, CAST(d.id AS NVARCHAR(20))),
                                 N' đã gửi duyệt hoặc ban hành, không được sửa nội dung (R03)')
    FROM deleted d JOIN inserted i ON i.id = d.id
    WHERE d.[status] <> N'draft' AND i.content <> d.content;
    IF @msg IS NOT NULL THROW 50001, @msg, 1;
  END;

  IF UPDATE([status])
  BEGIN
    SELECT TOP (1) @msg = CONCAT(N'Phiên bản ', COALESCE(d.code, CAST(d.id AS NVARCHAR(20))),
                                 N' đã ban hành, không được đưa về nháp (R03)')
    FROM deleted d JOIN inserted i ON i.id = d.id
    WHERE d.[status] IN (N'active', N'expired') AND i.[status] NOT IN (N'active', N'expired');
    IF @msg IS NOT NULL THROW 50001, @msg, 1;
  END;
END;
GO

/* ---------- 3. Vận hành ---------- */

CREATE TABLE lotrinh.staff (
  id            INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_staff PRIMARY KEY,
  user_id       INT NULL CONSTRAINT fk_staff_user REFERENCES lotrinh.users(id),
  employee_code NVARCHAR(30) NULL,
  full_name     NVARCHAR(200) NOT NULL,
  store_id      INT NOT NULL CONSTRAINT fk_staff_store REFERENCES lotrinh.stores(id),
  hire_date     DATE NOT NULL,
  current_level INT NOT NULL CONSTRAINT df_staff_level DEFAULT 1
                CONSTRAINT ck_staff_level CHECK (current_level BETWEEN 1 AND 4),
  active        BIT NOT NULL CONSTRAINT df_staff_active DEFAULT 1,
  stop_reason   NVARCHAR(MAX) NULL,       -- "Ngừng theo dõi" khi nghỉ việc; dữ liệu giữ nguyên
  stopped_at    DATETIMEOFFSET(3) NULL,
  stopped_by    INT NULL CONSTRAINT fk_staff_stopped_by REFERENCES lotrinh.users(id),
  created_at    DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_staff_created_at DEFAULT SYSDATETIMEOFFSET()
);
CREATE UNIQUE INDEX uq_staff_user ON lotrinh.staff(user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX uq_staff_employee_code ON lotrinh.staff(employee_code) WHERE employee_code IS NOT NULL;
CREATE INDEX ix_staff_store ON lotrinh.staff(store_id);

/* track: nvbh = lộ trình 4 Level; cht_moi_tuyen, cht_thang_tien = checklist onboarding Cửa hàng trưởng.
   Mỗi nhân viên chỉ có một lượt đang mở. */
CREATE TABLE lotrinh.level_runs (
  id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_level_runs PRIMARY KEY,
  staff_id     INT NOT NULL CONSTRAINT fk_level_runs_staff REFERENCES lotrinh.staff(id),
  level_key    INT NOT NULL CONSTRAINT ck_level_runs_level CHECK (level_key BETWEEN 1 AND 4),
  track        NVARCHAR(20) NOT NULL CONSTRAINT df_level_runs_track DEFAULT N'nvbh'
               CONSTRAINT ck_level_runs_track CHECK (track IN (N'nvbh', N'cht_moi_tuyen', N'cht_thang_tien')),
  meta         NVARCHAR(MAX) NOT NULL CONSTRAINT df_level_runs_meta DEFAULT N'{}'
               CONSTRAINT ck_level_runs_meta_json CHECK (ISJSON(meta) = 1),
  version_id   INT NOT NULL CONSTRAINT fk_level_runs_version REFERENCES lotrinh.versions(id),
  start_date   DATE NOT NULL,
  planned_end  DATE NOT NULL,
  [status]     NVARCHAR(10) NOT NULL CONSTRAINT df_level_runs_status DEFAULT N'active'
               CONSTRAINT ck_level_runs_status CHECK ([status] IN
                 (N'active', N'paused', N'review', N'passed', N'extended', N'failed', N'stopped', N'promoted')),
  ext_count    INT NOT NULL CONSTRAINT df_level_runs_ext_count DEFAULT 0,
  ack_by       INT NULL CONSTRAINT fk_level_runs_ack_by REFERENCES lotrinh.users(id),
  ack_at       DATETIMEOFFSET(3) NULL,
  created_by   INT NULL CONSTRAINT fk_level_runs_created_by REFERENCES lotrinh.users(id),
  created_at   DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_level_runs_created_at DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT ck_level_runs_dates CHECK (planned_end >= start_date)
);
CREATE INDEX ix_level_runs_staff ON lotrinh.level_runs(staff_id);
CREATE UNIQUE INDEX uq_level_runs_one_open ON lotrinh.level_runs(staff_id)
  WHERE [status] IN (N'active', N'paused', N'review', N'extended');

/* Người phụ trách theo thời gian: to_date NULL = đang hiệu lực. Mỗi vai trò chỉ một người đang hiệu lực. */
CREATE TABLE lotrinh.run_assignments (
  id        INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_run_assignments PRIMARY KEY,
  run_id    INT NOT NULL CONSTRAINT fk_run_assignments_run REFERENCES lotrinh.level_runs(id),
  [role]    NVARCHAR(10) NOT NULL CONSTRAINT ck_run_assignments_role CHECK ([role] IN (N'buddy', N'cht', N'qlkv', N'trainer')),
  user_id   INT NOT NULL CONSTRAINT fk_run_assignments_user REFERENCES lotrinh.users(id),
  from_date DATE NOT NULL,
  to_date   DATE NULL,
  CONSTRAINT ck_run_assignments_dates CHECK (to_date IS NULL OR to_date >= from_date)
);
CREATE INDEX ix_run_assignments_run  ON lotrinh.run_assignments(run_id);
CREATE INDEX ix_run_assignments_user ON lotrinh.run_assignments(user_id);
CREATE UNIQUE INDEX uq_run_assignments_active ON lotrinh.run_assignments(run_id, [role]) WHERE to_date IS NULL;

CREATE TABLE lotrinh.run_tasks (
  id          INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_run_tasks PRIMARY KEY,
  run_id      INT NOT NULL CONSTRAINT fk_run_tasks_run REFERENCES lotrinh.level_runs(id),
  item_key    NVARCHAR(100) NOT NULL,
  open_date   DATE NOT NULL,
  due_date    DATE NOT NULL,
  [status]    NVARCHAR(10) NOT NULL CONSTRAINT df_run_tasks_status DEFAULT N'todo'
              CONSTRAINT ck_run_tasks_status CHECK ([status] IN (N'todo', N'doing', N'help', N'na', N'done', N'void')),
  done_date   DATE NULL,
  na_reason   NVARCHAR(MAX) NULL,
  rework_note NVARCHAR(MAX) NULL,
  rework_by   INT NULL CONSTRAINT fk_run_tasks_rework_by REFERENCES lotrinh.users(id),
  rework_at   DATETIMEOFFSET(3) NULL,
  row_version INT NOT NULL CONSTRAINT df_run_tasks_row_version DEFAULT 0,   -- chống ghi đè khi hai người cùng thao tác
  updated_at  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_run_tasks_updated_at DEFAULT SYSDATETIMEOFFSET(),
  CONSTRAINT ck_run_tasks_dates CHECK (due_date >= open_date),
  CONSTRAINT ck_run_tasks_done  CHECK ([status] <> N'done' OR done_date IS NOT NULL),
  CONSTRAINT ck_run_tasks_na    CHECK ([status] <> N'na' OR na_reason IS NOT NULL)
);
CREATE UNIQUE INDEX uq_run_tasks_run_item ON lotrinh.run_tasks(run_id, item_key);

/* Ô xác nhận của từng vai trò; xác nhận đã thu hồi (revoked_at) không tính */
CREATE TABLE lotrinh.task_confirmations (
  id         INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_task_confirmations PRIMARY KEY,
  task_id    INT NOT NULL CONSTRAINT fk_task_confirmations_task REFERENCES lotrinh.run_tasks(id),
  [role]     NVARCHAR(10) NOT NULL CONSTRAINT ck_task_confirmations_role CHECK ([role] IN (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
  user_id    INT NOT NULL CONSTRAINT fk_task_confirmations_user REFERENCES lotrinh.users(id),
  proxy_role NVARCHAR(10) NULL CONSTRAINT ck_task_confirmations_proxy CHECK (proxy_role IN (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
  [at]       DATETIMEOFFSET(3) NOT NULL,
  note       NVARCHAR(MAX) NULL,
  revoked_at DATETIMEOFFSET(3) NULL,
  revoked_by INT NULL CONSTRAINT fk_task_confirmations_revoked_by REFERENCES lotrinh.users(id)
);
CREATE INDEX ix_task_confirmations_task ON lotrinh.task_confirmations(task_id);
CREATE UNIQUE INDEX uq_task_confirmations_active ON lotrinh.task_confirmations(task_id, [role]) WHERE revoked_at IS NULL;

/* Lịch sử thao tác trên đầu việc, gồm cả đổi hạn (action = 'date_change', data = ngày cũ, ngày mới, lý do) */
CREATE TABLE lotrinh.task_events (
  id         INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_task_events PRIMARY KEY,
  task_id    INT NOT NULL CONSTRAINT fk_task_events_task REFERENCES lotrinh.run_tasks(id),
  user_id    INT NOT NULL CONSTRAINT fk_task_events_user REFERENCES lotrinh.users(id),
  [role]     NVARCHAR(10) NULL CONSTRAINT ck_task_events_role CHECK ([role] IN (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
  proxy_role NVARCHAR(10) NULL CONSTRAINT ck_task_events_proxy CHECK (proxy_role IN (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
  [action]   NVARCHAR(50) NOT NULL,
  note       NVARCHAR(MAX) NULL,
  data       NVARCHAR(MAX) NULL CONSTRAINT ck_task_events_data_json CHECK (data IS NULL OR ISJSON(data) = 1),
  [at]       DATETIMEOFFSET(3) NOT NULL
);
CREATE INDEX ix_task_events_task ON lotrinh.task_events(task_id);

/* Chữ ký theo chuỗi ký: cuối giai đoạn (kind = 'stage', ref = mã giai đoạn)
   hoặc phiếu đánh giá tổng kết (kind = 'review', ref = số vòng của phiếu) */
CREATE TABLE lotrinh.signoffs (
  id      INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_signoffs PRIMARY KEY,
  run_id  INT NOT NULL CONSTRAINT fk_signoffs_run REFERENCES lotrinh.level_runs(id),
  kind    NVARCHAR(10) NOT NULL CONSTRAINT ck_signoffs_kind CHECK (kind IN (N'stage', N'review')),
  ref     NVARCHAR(100) NOT NULL,
  step    INT NOT NULL,
  [role]  NVARCHAR(10) NOT NULL CONSTRAINT ck_signoffs_role CHECK ([role] IN (N'nv', N'buddy', N'cht', N'qlkv', N'bp')),
  user_id INT NOT NULL CONSTRAINT fk_signoffs_user REFERENCES lotrinh.users(id),
  [at]    DATETIMEOFFSET(3) NOT NULL
);
CREATE UNIQUE INDEX uq_signoffs_step ON lotrinh.signoffs(run_id, kind, ref, step);

/* Tạm dừng lượt: CHT đề xuất, QLKV hoặc BP Đào tạo duyệt */
CREATE TABLE lotrinh.run_pauses (
  id             INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_run_pauses PRIMARY KEY,
  run_id         INT NOT NULL CONSTRAINT fk_run_pauses_run REFERENCES lotrinh.level_runs(id),
  from_date      DATE NOT NULL,
  to_date        DATE NOT NULL,
  reason         NVARCHAR(MAX) NOT NULL,
  [status]       NVARCHAR(10) NOT NULL CONSTRAINT df_run_pauses_status DEFAULT N'pending'
                 CONSTRAINT ck_run_pauses_status CHECK ([status] IN (N'pending', N'approved', N'rejected')),
  requested_by   INT NOT NULL CONSTRAINT fk_run_pauses_requested_by REFERENCES lotrinh.users(id),
  requested_at   DATETIMEOFFSET(3) NOT NULL,
  decided_by     INT NULL CONSTRAINT fk_run_pauses_decided_by REFERENCES lotrinh.users(id),
  decided_at     DATETIMEOFFSET(3) NULL,
  decision_note  NVARCHAR(MAX) NULL,
  CONSTRAINT ck_run_pauses_dates CHECK (to_date >= from_date)
);
CREATE INDEX ix_run_pauses_run ON lotrinh.run_pauses(run_id);

/* Onboarding CHT: nhật ký theo dõi hằng ngày ([day] = 0 là Ngày D) */
CREATE TABLE lotrinh.run_journal (
  id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_run_journal PRIMARY KEY,
  run_id       INT NOT NULL CONSTRAINT fk_run_journal_run REFERENCES lotrinh.level_runs(id),
  [day]        INT NOT NULL,
  mood         NVARCHAR(100) NULL,
  difficulties NVARCHAR(MAX) NOT NULL CONSTRAINT df_run_journal_difficulties DEFAULT N'',
  actions      NVARCHAR(MAX) NOT NULL CONSTRAINT df_run_journal_actions DEFAULT N'',
  manager_note NVARCHAR(MAX) NOT NULL CONSTRAINT df_run_journal_manager_note DEFAULT N'',
  updated_by   INT NULL CONSTRAINT fk_run_journal_updated_by REFERENCES lotrinh.users(id),
  updated_at   DATETIMEOFFSET(3) NULL,
  manager_by   INT NULL CONSTRAINT fk_run_journal_manager_by REFERENCES lotrinh.users(id),
  manager_at   DATETIMEOFFSET(3) NULL
);
CREATE UNIQUE INDEX uq_run_journal_run_day ON lotrinh.run_journal(run_id, [day]);

/* Onboarding CHT: đánh giá tổng kết tuần đầu; quản lý xác nhận thì lượt hoàn thành */
CREATE TABLE lotrinh.run_evaluations (
  id           INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_run_evaluations PRIMARY KEY,
  run_id       INT NOT NULL CONSTRAINT uq_run_evaluations_run UNIQUE
               CONSTRAINT fk_run_evaluations_run REFERENCES lotrinh.level_runs(id),
  ratings      NVARCHAR(MAX) NOT NULL CONSTRAINT df_run_evaluations_ratings DEFAULT N'{}'
               CONSTRAINT ck_run_evaluations_ratings_json CHECK (ISJSON(ratings) = 1),
  risk         NVARCHAR(10) NULL CONSTRAINT ck_run_evaluations_risk CHECK (risk IN (N'low', N'medium', N'high')),
  suggestion   NVARCHAR(MAX) NOT NULL CONSTRAINT df_run_evaluations_suggestion DEFAULT N'',
  saved_by     INT NULL CONSTRAINT fk_run_evaluations_saved_by REFERENCES lotrinh.users(id),
  saved_at     DATETIMEOFFSET(3) NULL,
  confirmed_by INT NULL CONSTRAINT fk_run_evaluations_confirmed_by REFERENCES lotrinh.users(id),
  confirmed_at DATETIMEOFFSET(3) NULL,
  confirm_note NVARCHAR(MAX) NULL
);

/* ---------- 4. Đánh giá và chuyển level ---------- */

/* Doanh số theo tháng của Level, đơn vị triệu đồng; POS ghi vào cùng bảng khi tích hợp */
CREATE TABLE lotrinh.sales_monthly (
  id          INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_sales_monthly PRIMARY KEY,
  run_id      INT NOT NULL CONSTRAINT fk_sales_monthly_run REFERENCES lotrinh.level_runs(id),
  month_index INT NOT NULL,
  total       FLOAT NULL,
  coef1       FLOAT NULL,
  [source]    NVARCHAR(10) NOT NULL CONSTRAINT df_sales_monthly_source DEFAULT N'manual'
              CONSTRAINT ck_sales_monthly_source CHECK ([source] IN (N'manual', N'pos')),
  entered_by  INT NULL CONSTRAINT fk_sales_monthly_entered_by REFERENCES lotrinh.users(id),
  [at]        DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_sales_monthly_at DEFAULT SYSDATETIMEOFFSET()
);
CREATE UNIQUE INDEX uq_sales_monthly_run_month ON lotrinh.sales_monthly(run_id, month_index);

/* Ca quan sát Rubric: điểm theo mã tiêu chí của phiên bản */
CREATE TABLE lotrinh.observations (
  id          INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_observations PRIMARY KEY,
  run_id      INT NOT NULL CONSTRAINT fk_observations_run REFERENCES lotrinh.level_runs(id),
  obs_date    DATE NOT NULL,
  scores      NVARCHAR(MAX) NOT NULL CONSTRAINT ck_observations_scores_json CHECK (ISJSON(scores) = 1),
  note        NVARCHAR(MAX) NULL,
  observer_id INT NOT NULL CONSTRAINT fk_observations_observer REFERENCES lotrinh.users(id),
  created_at  DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_observations_created_at DEFAULT SYSDATETIMEOFFSET()
);
CREATE INDEX ix_observations_run ON lotrinh.observations(run_id);

/* Phiếu đánh giá tổng kết; mỗi vòng gia hạn là một phiếu mới ([round]) */
CREATE TABLE lotrinh.level_reviews (
  id               INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_level_reviews PRIMARY KEY,
  run_id           INT NOT NULL CONSTRAINT fk_level_reviews_run REFERENCES lotrinh.level_runs(id),
  [round]          INT NOT NULL CONSTRAINT df_level_reviews_round DEFAULT 0,
  criteria_results NVARCHAR(MAX) NOT NULL CONSTRAINT df_level_reviews_criteria DEFAULT N'[]'
                   CONSTRAINT ck_level_reviews_criteria_json CHECK (ISJSON(criteria_results) = 1),
  notes            NVARCHAR(MAX) NOT NULL CONSTRAINT df_level_reviews_notes DEFAULT N'{}'
                   CONSTRAINT ck_level_reviews_notes_json CHECK (ISJSON(notes) = 1),
  result           NVARCHAR(10) NULL CONSTRAINT ck_level_reviews_result CHECK (result IN (N'pass', N'extend', N'fail')),
  ext_goals        NVARCHAR(MAX) NOT NULL CONSTRAINT df_level_reviews_ext_goals DEFAULT N'',
  [status]         NVARCHAR(10) NOT NULL CONSTRAINT df_level_reviews_status DEFAULT N'draft'
                   CONSTRAINT ck_level_reviews_status CHECK ([status] IN (N'draft', N'signing', N'done')),
  saved_by         INT NULL CONSTRAINT fk_level_reviews_saved_by REFERENCES lotrinh.users(id),
  saved_at         DATETIMEOFFSET(3) NULL,
  applied_at       DATETIMEOFFSET(3) NULL,      -- thời điểm kết quả được áp dụng (chuyển Level, gia hạn, đóng lượt)
  row_version      INT NOT NULL CONSTRAINT df_level_reviews_row_version DEFAULT 0,
  created_at       DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_level_reviews_created_at DEFAULT SYSDATETIMEOFFSET()
);
CREATE UNIQUE INDEX uq_level_reviews_run_round ON lotrinh.level_reviews(run_id, [round]);

/* ---------- 5. Nhật ký hệ thống (gồm lịch sử thay đổi tài khoản: entity = 'user') ---------- */

CREATE TABLE lotrinh.audit_logs (
  id        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_audit_logs PRIMARY KEY,
  user_id   INT NULL CONSTRAINT fk_audit_logs_user REFERENCES lotrinh.users(id),
  [action]  NVARCHAR(100) NOT NULL,
  entity    NVARCHAR(50)  NULL,
  entity_id NVARCHAR(100) NULL,
  payload   NVARCHAR(MAX) NULL CONSTRAINT ck_audit_logs_payload_json CHECK (payload IS NULL OR ISJSON(payload) = 1),
  [at]      DATETIMEOFFSET(3) NOT NULL CONSTRAINT df_audit_logs_at DEFAULT SYSDATETIMEOFFSET(),
  ip        NVARCHAR(64) NULL
);
CREATE INDEX ix_audit_logs_entity ON lotrinh.audit_logs(entity, entity_id);
CREATE INDEX ix_audit_logs_at ON lotrinh.audit_logs([at]);
GO
