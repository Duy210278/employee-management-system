ALTER TABLE "users" DROP COLUMN "can_approve_versions";--> statement-breakpoint
-- Bỏ cấu hình V20: BP Đào tạo luôn tự duyệt và ban hành phiên bản
DELETE FROM "system_settings" WHERE "key" = 'bp_self_publish';
