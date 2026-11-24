-- Email & SMS Broadcast: cached officer geocodes + send log.

ALTER TABLE employees ADD COLUMN IF NOT EXISTS latitude numeric(9,6);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS longitude numeric(9,6);
ALTER TABLE employees ADD COLUMN IF NOT EXISTS geocoded_postcode text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS geocoded_at timestamp;

CREATE INDEX IF NOT EXISTS idx_employees_tenant_geo
  ON employees (tenant_id, latitude, longitude)
  WHERE latitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS broadcast_messages (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  shift_id integer REFERENCES shifts(id) ON DELETE SET NULL,
  site_id integer REFERENCES sites(id) ON DELETE SET NULL,
  channel text NOT NULL,
  subject text,
  body text NOT NULL,
  status text NOT NULL DEFAULT 'sending',
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  sent_by varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_messages_tenant_created
  ON broadcast_messages (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id serial PRIMARY KEY,
  broadcast_id integer NOT NULL REFERENCES broadcast_messages(id) ON DELETE CASCADE,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id integer REFERENCES employees(id) ON DELETE SET NULL,
  channel text NOT NULL,
  destination text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error text,
  sent_at timestamp,
  created_at timestamp NOT NULL DEFAULT NOW(),
  updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_broadcast ON broadcast_recipients (broadcast_id);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_employee ON broadcast_recipients (tenant_id, employee_id);
