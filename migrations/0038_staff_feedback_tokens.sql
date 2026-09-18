CREATE TABLE IF NOT EXISTS staff_feedback_tokens (
  id serial PRIMARY KEY,
  token varchar(64) NOT NULL UNIQUE,
  tenant_id integer REFERENCES tenants(id) ON DELETE SET NULL,
  employee_id integer NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  expires_at timestamp NOT NULL,
  used_at timestamp,
  issue_number integer NOT NULL DEFAULT 1,
  q1 text,
  q2 text,
  q3 text,
  q4 text,
  q5 text,
  q6 text,
  q7 text,
  q8 text,
  q9 text,
  comments text,
  print_name text,
  signature text,
  created_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_feedback_tokens_token ON staff_feedback_tokens (token);
CREATE INDEX IF NOT EXISTS idx_staff_feedback_tokens_employee ON staff_feedback_tokens (employee_id);
