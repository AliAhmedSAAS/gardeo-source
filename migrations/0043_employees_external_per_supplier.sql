-- Allow the same GS officer (external_id) as separate profiles:
-- one in-house (supplier_id NULL) and one per agency supplier.
DROP INDEX IF EXISTS uq_employees_tenant_external;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_tenant_external_inhouse
  ON employees (tenant_id, external_id)
  WHERE external_id IS NOT NULL AND supplier_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_tenant_external_supplier
  ON employees (tenant_id, external_id, supplier_id)
  WHERE external_id IS NOT NULL AND supplier_id IS NOT NULL;
