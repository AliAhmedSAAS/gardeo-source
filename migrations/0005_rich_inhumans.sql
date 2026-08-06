CREATE TABLE "mobile_push_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"token" text NOT NULL,
	"platform" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL
);
