ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "manager_name" text;
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "manager_email" text;
--> statement-breakpoint
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "book_on_email" text;
