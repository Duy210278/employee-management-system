ALTER TABLE [lotrinh].[users] DROP CONSTRAINT [users_email_uq];--> statement-breakpoint
ALTER TABLE [lotrinh].[users] ADD [external_id] nvarchar(100);--> statement-breakpoint
ALTER TABLE [lotrinh].[users] ALTER COLUMN [email] nvarchar(255);--> statement-breakpoint
CREATE UNIQUE INDEX [users_external_id_uq] ON [lotrinh].[users] ([external_id]) WHERE [external_id] is not null;--> statement-breakpoint
CREATE UNIQUE INDEX [users_email_uq] ON [lotrinh].[users] ([email]) WHERE [email] is not null;