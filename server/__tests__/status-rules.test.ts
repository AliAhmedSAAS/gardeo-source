import { test } from "node:test";
import assert from "node:assert/strict";
import { getEditStatusError } from "../shift-status-rules";
import { getSupplierActionError, getMissingRequiredDocuments } from "../supplier-status-rules";

test("shift edit cannot jump to lifecycle statuses", () => {
  assert.match(getEditStatusError("scheduled", "verified", { reassigning: false })!, /Use Verify/);
  assert.match(getEditStatusError("booked_on", "booked_off", { reassigning: false })!, /Use Book Off/);
  assert.match(getEditStatusError("scheduled", "booked_on", { reassigning: false })!, /Use Book On/);
});

test("shift edit allows the control-room actions", () => {
  assert.equal(getEditStatusError("scheduled", "no_show", { reassigning: false }), null);
  assert.equal(getEditStatusError("scheduled", "cancelled", { reassigning: false }), null);
  assert.equal(getEditStatusError("in_progress", "completed", { reassigning: false }), null);
  assert.equal(getEditStatusError("verified", "verified", { reassigning: false }), null);
});

test("shift reset to scheduled from booked-on only when reassigning", () => {
  assert.equal(getEditStatusError("in_progress", "scheduled", { reassigning: true }), null);
  assert.ok(getEditStatusError("in_progress", "scheduled", { reassigning: false }));
  assert.ok(getEditStatusError("verified", "scheduled", { reassigning: true }));
});

test("supplier terminated is final", () => {
  assert.match(getSupplierActionError("approve", "terminated")!, /final/);
  assert.match(getSupplierActionError("unsuspend", "terminated")!, /final/);
});

test("supplier actions follow the status diagram", () => {
  assert.equal(getSupplierActionError("approve", "submitted"), null);
  assert.equal(getSupplierActionError("suspend", "approved"), null);
  assert.equal(getSupplierActionError("unsuspend", "suspended"), null);
  assert.ok(getSupplierActionError("unsuspend", "approved"));
  assert.ok(getSupplierActionError("suspend", "draft"));
});

test("supplier approval needs every required document, ignoring rejected ones", () => {
  const supplier = { vatStatus: "not_vat_registered", supplierType: "non_labour" };
  assert.equal(getMissingRequiredDocuments(supplier, []).length, 4);
  const docs = [
    { documentType: "companies_house_proof", status: "approved" },
    { documentType: "bank_proof", status: "pending" },
    { documentType: "supplier_declaration", status: "approved" },
    { documentType: "non_vat_declaration", status: "rejected" },
  ];
  assert.deepEqual(getMissingRequiredDocuments(supplier, docs), ["Signed Non-VAT Declaration"]);
});
