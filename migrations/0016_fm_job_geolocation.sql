-- FM job geolocation: GPS check-in/check-out for FM job assignments
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_in_lat" text;
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_in_lng" text;
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_in_distance_metres" numeric(10, 2);
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_in_within_range" boolean;
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_out_lat" text;
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_out_lng" text;
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_out_distance_metres" numeric(10, 2);
ALTER TABLE "fm_job_assignments" ADD COLUMN IF NOT EXISTS "check_out_within_range" boolean;
