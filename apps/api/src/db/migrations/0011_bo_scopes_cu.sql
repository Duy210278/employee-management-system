-- Chuyển phạm vi cửa hàng, khu vực sang bảng chung user_scopes rồi bỏ hai bảng cũ
INSERT INTO "user_scopes" ("user_id", "store_id") SELECT "user_id", "store_id" FROM "user_store_scopes";
--> statement-breakpoint
INSERT INTO "user_scopes" ("user_id", "area_id") SELECT "user_id", "area_id" FROM "user_area_scopes";
--> statement-breakpoint
DROP TABLE "user_area_scopes" CASCADE;
--> statement-breakpoint
DROP TABLE "user_store_scopes" CASCADE;
