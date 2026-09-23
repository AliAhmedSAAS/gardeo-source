ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "custom_payroll_control_enabled" boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS payroll_control_months (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  employee_id integer NOT NULL REFERENCES employees(id),
  period_month date NOT NULL,
  rules_of_payment text NOT NULL DEFAULT 'full_paye',
  payroll_source text NOT NULL DEFAULT 'first4_paye',
  ni_used integer NOT NULL DEFAULT 0,
  hr_status text NOT NULL DEFAULT 'approved',
  remarks text,
  accounts_remarks text,
  first4_hours numeric(10,2) DEFAULT 0,
  first4_wages numeric(12,2) DEFAULT 0,
  first4_paid boolean DEFAULT false,
  gfm_hours numeric(10,2) DEFAULT 0,
  gfm_wages numeric(12,2) DEFAULT 0,
  gfm_paid boolean DEFAULT false,
  self_hours numeric(10,2) DEFAULT 0,
  self_wages numeric(12,2) DEFAULT 0,
  self_paid boolean DEFAULT false,
  updated_at timestamp DEFAULT NOW(),
  created_at timestamp DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_payroll_control_month ON payroll_control_months (tenant_id, employee_id, period_month);
CREATE INDEX IF NOT EXISTS idx_pcm_tenant_month ON payroll_control_months (tenant_id, period_month);

CREATE TABLE IF NOT EXISTS payroll_rule_change_requests (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  month_row_id integer NOT NULL REFERENCES payroll_control_months(id) ON DELETE CASCADE,
  from_rule text NOT NULL,
  from_source text NOT NULL,
  to_rule text NOT NULL,
  to_source text NOT NULL,
  control_status text NOT NULL DEFAULT 'pending',
  hr_status text NOT NULL DEFAULT 'pending',
  accounts_status text NOT NULL DEFAULT 'pending',
  control_by varchar REFERENCES users(id),
  hr_by varchar REFERENCES users(id),
  accounts_by varchar REFERENCES users(id),
  resolved_at timestamp,
  created_by varchar REFERENCES users(id),
  created_at timestamp DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prcr_month ON payroll_rule_change_requests (month_row_id);
CREATE INDEX IF NOT EXISTS idx_prcr_tenant ON payroll_rule_change_requests (tenant_id);

CREATE TABLE IF NOT EXISTS payroll_applied_lines (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  month_row_id integer NOT NULL REFERENCES payroll_control_months(id) ON DELETE CASCADE,
  employee_id integer NOT NULL REFERENCES employees(id),
  shift_id integer NOT NULL REFERENCES shifts(id),
  hours numeric(10,2) NOT NULL,
  holiday_hours numeric(10,2) DEFAULT 0,
  rate numeric(10,2) NOT NULL,
  expense numeric(12,2) DEFAULT 0,
  wages numeric(12,2) NOT NULL,
  bucket text NOT NULL,
  payee_to_claim boolean NOT NULL DEFAULT true,
  claimable boolean NOT NULL DEFAULT true,
  billed boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pal_tenant_emp ON payroll_applied_lines (tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_pal_shift ON payroll_applied_lines (shift_id);
CREATE INDEX IF NOT EXISTS idx_pal_month ON payroll_applied_lines (month_row_id);

CREATE TABLE IF NOT EXISTS payroll_bills (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  bill_number text NOT NULL,
  employee_id integer NOT NULL REFERENCES employees(id),
  bill_date date NOT NULL,
  due_date date NOT NULL,
  claim_from date NOT NULL,
  claim_to date NOT NULL,
  payee_type text NOT NULL,
  branch_type text NOT NULL,
  payroll_provider text,
  emp_level integer DEFAULT 0,
  particulars text,
  account_title text,
  account_number text,
  sort_code text,
  bank_name text,
  ni_number text,
  bill_amount numeric(12,2) NOT NULL,
  paid_amount numeric(12,2) DEFAULT 0,
  balance numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'UNPAID',
  remarks text,
  terms text,
  remittance boolean DEFAULT false,
  post_date date,
  created_by varchar REFERENCES users(id),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pb_tenant_status ON payroll_bills (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_pb_tenant_emp ON payroll_bills (tenant_id, employee_id);

CREATE TABLE IF NOT EXISTS payroll_bill_lines (
  id serial PRIMARY KEY,
  bill_id integer NOT NULL REFERENCES payroll_bills(id) ON DELETE CASCADE,
  applied_line_id integer NOT NULL REFERENCES payroll_applied_lines(id),
  shift_id integer NOT NULL REFERENCES shifts(id),
  hours numeric(10,2) NOT NULL,
  holiday_hours numeric(10,2) DEFAULT 0,
  rate numeric(10,2) NOT NULL,
  wages numeric(12,2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pbl_bill ON payroll_bill_lines (bill_id);

CREATE TABLE IF NOT EXISTS payroll_payments (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  bill_id integer NOT NULL REFERENCES payroll_bills(id) ON DELETE CASCADE,
  payment_type text NOT NULL DEFAULT 'PMT',
  amount numeric(12,2) NOT NULL,
  post_date date NOT NULL,
  bank_name text,
  created_by varchar REFERENCES users(id),
  created_at timestamp DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pp_bill ON payroll_payments (bill_id);

CREATE TABLE IF NOT EXISTS payroll_payslips (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  bill_id integer NOT NULL REFERENCES payroll_bills(id) ON DELETE CASCADE,
  employee_id integer NOT NULL REFERENCES employees(id),
  file_url text,
  generated_at timestamp DEFAULT NOW(),
  generated_by varchar REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_pps_bill ON payroll_payslips (bill_id);

CREATE TABLE IF NOT EXISTS payroll_control_comms (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  bill_id integer NOT NULL REFERENCES payroll_bills(id) ON DELETE CASCADE,
  channel text NOT NULL,
  status text NOT NULL,
  subject text,
  body text,
  error_message text,
  created_by varchar REFERENCES users(id),
  created_at timestamp DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pcc_bill ON payroll_control_comms (bill_id);
