-- Notifications (in-app for admin and supplier)
CREATE TABLE IF NOT EXISTS "notifications" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "link" text,
  "related_entity_type" text,
  "related_entity_id" text,
  "metadata" jsonb,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- Supplier field requests (admin requests a specific field from supplier)
CREATE TABLE IF NOT EXISTS "supplier_field_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL,
  "field_key" text NOT NULL,
  "message" text,
  "requested_by" varchar NOT NULL,
  "requested_at" timestamp DEFAULT now(),
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

-- Supplier profile change log (audit of every profile change)
CREATE TABLE IF NOT EXISTS "supplier_profile_change_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "supplier_id" integer NOT NULL,
  "user_id" varchar NOT NULL,
  "action" text NOT NULL,
  "field_changes" jsonb,
  "pending_change_id" integer,
  "created_at" timestamp DEFAULT now()
);

-- Foreign keys (idempotent: only add if constraint does not exist)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'notifications_user_id_users_id_fk') THEN
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_field_requests_supplier_id_suppliers_id_fk') THEN
    ALTER TABLE "supplier_field_requests" ADD CONSTRAINT "supplier_field_requests_supplier_id_suppliers_id_fk"
      FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_field_requests_requested_by_users_id_fk') THEN
    ALTER TABLE "supplier_field_requests" ADD CONSTRAINT "supplier_field_requests_requested_by_users_id_fk"
      FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_profile_change_log_supplier_id_suppliers_id_fk') THEN
    ALTER TABLE "supplier_profile_change_log" ADD CONSTRAINT "supplier_profile_change_log_supplier_id_suppliers_id_fk"
      FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'supplier_profile_change_log_user_id_users_id_fk') THEN
    ALTER TABLE "supplier_profile_change_log" ADD CONSTRAINT "supplier_profile_change_log_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
