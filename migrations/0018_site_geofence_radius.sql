-- Per-site geofence radius override (nullable; falls back to tenant default when null)
ALTER TABLE "sites" ADD COLUMN IF NOT EXISTS "geofence_radius_metres" integer;
