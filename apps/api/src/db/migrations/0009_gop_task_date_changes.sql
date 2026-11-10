-- Lịch sử đổi hạn chuyển thành sự kiện date_change của đầu việc (dữ liệu kèm trong cột data)
ALTER TABLE "task_events" ADD COLUMN "data" jsonb;
--> statement-breakpoint
-- Sự kiện cần người thực hiện; dòng không rõ người đổi (by trống) không chuyển được và bị bỏ
INSERT INTO "task_events" ("task_id", "user_id", "action", "data", "at")
SELECT "task_id", "by", 'date_change',
       jsonb_build_object('oldOpen', "old_open", 'oldDue', "old_due", 'newOpen', "new_open", 'newDue', "new_due", 'reason', "reason", 'refId', "ref_id"),
       "at"
FROM "task_date_changes" WHERE "by" IS NOT NULL;
--> statement-breakpoint
DROP TABLE "task_date_changes" CASCADE;
