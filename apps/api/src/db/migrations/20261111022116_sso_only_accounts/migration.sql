ALTER TABLE [lotrinh].[users] DROP CONSTRAINT [users_status_ck];--> statement-breakpoint
UPDATE [lotrinh].[users] SET [status] = N'active' WHERE [status] IN (N'pending', N'locked', N'rejected');--> statement-breakpoint
ALTER TABLE [lotrinh].[users] ADD CONSTRAINT [users_status_ck] CHECK ([users].[status] in (N'active', N'left'));--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP CONSTRAINT [users_status_default];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] ADD CONSTRAINT [users_status_default] DEFAULT ('active') FOR [status];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP CONSTRAINT [users_requested_store_id_stores_id_fk];
--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP CONSTRAINT [users_requested_area_id_areas_id_fk];
--> statement-breakpoint
DROP TABLE [lotrinh].[credentials];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP CONSTRAINT [users_requested_role_ck];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP COLUMN [requested_role];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP COLUMN [requested_store_id];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP COLUMN [requested_area_id];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP COLUMN [review_note];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP COLUMN [reviewed_by];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] DROP COLUMN [reviewed_at];