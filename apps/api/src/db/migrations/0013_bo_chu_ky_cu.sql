-- Chuyển chữ ký giai đoạn và chữ ký phiếu đánh giá sang bảng chung signoffs rồi bỏ hai bảng cũ
INSERT INTO "signoffs" ("run_id", "stage_key", "step", "role", "user_id", "at")
SELECT "run_id", "stage_key", "step", "role", "user_id", "at" FROM "stage_signoffs";
--> statement-breakpoint
INSERT INTO "signoffs" ("run_id", "review_id", "step", "role", "user_id", "at")
SELECT r."run_id", s."review_id", s."step", s."role", s."user_id", s."at"
FROM "review_signatures" s JOIN "level_reviews" r ON r."id" = s."review_id";
--> statement-breakpoint
DROP TABLE "review_signatures" CASCADE;
--> statement-breakpoint
DROP TABLE "stage_signoffs" CASCADE;
