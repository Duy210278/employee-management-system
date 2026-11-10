-- Lịch sử thay đổi tài khoản chuyển vào nhật ký hệ thống (action = user.change, entity = users)
INSERT INTO "audit_logs" ("user_id", "action", "entity", "entity_id", "payload", "at")
SELECT "changed_by", 'user.change', 'users', "user_id"::text,
       jsonb_build_object('field', "field", 'oldValue', "old_value", 'newValue', "new_value"), "at"
FROM "user_changes";
--> statement-breakpoint
DROP TABLE "user_changes" CASCADE;
