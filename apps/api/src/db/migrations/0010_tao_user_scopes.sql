CREATE TABLE "user_scopes" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"store_id" integer,
	"area_id" integer,
	CONSTRAINT "user_scopes_one_of" CHECK (("user_scopes"."store_id" is not null and "user_scopes"."area_id" is null) or ("user_scopes"."store_id" is null and "user_scopes"."area_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_scopes" ADD CONSTRAINT "user_scopes_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_scopes_store_uq" ON "user_scopes" USING btree ("user_id","store_id") WHERE "user_scopes"."store_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "user_scopes_area_uq" ON "user_scopes" USING btree ("user_id","area_id") WHERE "user_scopes"."area_id" is not null;