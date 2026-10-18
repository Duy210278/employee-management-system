ALTER TABLE "versions" ALTER COLUMN "code" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "versions" ALTER COLUMN "criteria_line" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "row_version" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "submitted_by" integer;--> statement-breakpoint
ALTER TABLE "versions" ADD COLUMN "submitted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "versions" ADD CONSTRAINT "versions_submitted_by_users_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;