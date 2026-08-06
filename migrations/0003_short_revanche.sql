CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_url" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_name" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_type" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "file_size" integer;