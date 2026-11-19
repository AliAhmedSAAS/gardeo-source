import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateBody, changedFieldsOnly, shiftSchemas, siteSchemas, supplierSchemas, employeePayRateSchemas,
} from "../validation";

const validShift = { title: "Night patrol", date: "2026-11-20", startTime: "20:00", endTime: "06:00", siteId: 4 };

test("shift create requires core fields and allows overnight shifts", () => {
  assert.equal(validateBody(shiftSchemas.create, validShift).ok, true);
  const missing = validateBody(shiftSchemas.create, { ...validShift, siteId: undefined, title: "" });
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.ok(missing.errors.siteId);
    assert.ok(missing.errors.title);
  }
});

test("shift times must differ and break must fit inside the shift", () => {
  assert.equal(validateBody(shiftSchemas.create, { ...validShift, endTime: "20:00" }).ok, false);
  assert.equal(validateBody(shiftSchemas.create, { ...validShift, startTime: "09:00", endTime: "10:00", breakMinutes: 60 }).ok, false);
  assert.equal(validateBody(shiftSchemas.create, { ...validShift, startTime: "25:00" }).ok, false);
});

test("update schemas only check supplied fields but still reject blank required ones", () => {
  assert.equal(validateBody(shiftSchemas.update, { payRate: "13.50" }).ok, true);
  assert.equal(validateBody(siteSchemas.update, { name: "" }).ok, false);
  assert.equal(validateBody(supplierSchemas.update, { email: "not-an-email" }).ok, false);
});

test("site postcode and coordinates are checked", () => {
  assert.equal(validateBody(siteSchemas.create, { name: "HQ", address: "1 High St", postcode: "SW1A 2AA" }).ok, true);
  assert.equal(validateBody(siteSchemas.create, { name: "HQ", address: "1 High St", postcode: "12345" }).ok, false);
  assert.equal(validateBody(siteSchemas.create, { name: "HQ", address: "1 High St", latitude: 120 }).ok, false);
});

test("pay rate end date cannot precede the start date", () => {
  const base = { dutyTypeId: 2, hourlyRate: "12.50", effectiveFrom: "2026-04-01" };
  assert.equal(validateBody(employeePayRateSchemas.create, { ...base, effectiveTo: "2026-03-31" }).ok, false);
  assert.equal(validateBody(employeePayRateSchemas.create, { ...base, effectiveTo: "2026-04-30" }).ok, true);
  assert.equal(validateBody(employeePayRateSchemas.create, { ...base, hourlyRate: "-1" }).ok, false);
});

test("changedFieldsOnly ignores resubmitted values, including dates and numbers", () => {
  const existing = { name: "HQ", postcode: "bad legacy", startDate: new Date("2026-01-05T00:00:00Z"), breakMinutes: 30 };
  const changed = changedFieldsOnly(
    { name: "HQ ", postcode: "bad legacy", startDate: "2026-01-05", breakMinutes: "30", notes: "new" },
    existing,
  );
  assert.deepEqual(changed, { notes: "new" });
});
