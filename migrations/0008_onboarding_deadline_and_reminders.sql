-- Migration: Onboarding Automation & Reminders (Task #55)
-- Adds deadline and last_reminder_sent_at to onboarding_records
-- Adds onboarding_deadline_days (configurable) to tenants

ALTER TABLE "onboarding_records" ADD COLUMN IF NOT EXISTS "deadline" timestamp;
ALTER TABLE "onboarding_records" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" timestamp;

ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "onboarding_deadline_days" integer DEFAULT 7;
