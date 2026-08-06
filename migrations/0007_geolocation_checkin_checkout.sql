-- Geolocation check-in/check-out columns
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "last_check_out_lat" text;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "last_check_out_lng" text;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "last_check_out_address" text;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "check_in_distance_metres" text;
ALTER TABLE "shifts" ADD COLUMN IF NOT EXISTS "check_out_distance_metres" text;

-- Tenant geofence settings
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "checkin_time_window_minutes" integer DEFAULT 10;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "geofence_radius_metres" integer DEFAULT 200;
