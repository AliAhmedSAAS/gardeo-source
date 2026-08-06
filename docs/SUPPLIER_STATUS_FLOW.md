# Supplier status flow – how it works in the codebase

## Statuses (schema)

Defined in `shared/schema.ts` as `supplierStatusEnum`:

| Status          | Meaning |
|-----------------|--------|
| **draft**       | Created by admin, not yet submitted by supplier. Default when admin creates a supplier. |
| **pending**     | Legacy/alternate initial state (e.g. created before draft existed). |
| **submitted**   | Supplier completed onboarding and clicked Submit. Waiting for admin review. |
| **approved**    | Admin approved the supplier. Can use portal, complete review, suspend, terminate. |
| **info_required** | Admin requested more information. Supplier can edit and resubmit. |
| **active**      | In use (e.g. after first engagement). Same actions as approved. |
| **suspended**   | Temporarily blocked. Supplier cannot submit onboarding; can be unsuspended. |
| **terminated**  | Permanently ended. No further actions; record kept for audit. |

---

## How status changes (who sets what)

- **Admin only (API / UI)**  
  - **Draft / Pending / Submitted → Approved:** Approve button (list or supplier detail Overview tab).  
  - **Submitted → Info required:** Request info (with notes) on supplier detail.  
  - **Approved / Active → Suspended:** Suspend button → dialog (optional reason) → `PATCH /api/suppliers/:id/suspend`.  
  - **Suspended → Approved:** Unsuspend button → `PATCH /api/suppliers/:id/unsuspend`.  
  - **Approved / Active / Suspended → Terminated:** Terminate button → dialog (optional reason) → `PATCH /api/suppliers/:id/terminate`.

- **Supplier only (portal)**  
  - **Draft / Info required → Submitted:** Submit onboarding (or Resubmit) in supplier portal.

- **System**  
  - New supplier: `status = "draft"` (POST /api/suppliers).  
  - Complete review: updates `lastReviewAt` / `nextReviewDueAt` only; status stays approved/active.

---

## Where in the UI

| Action        | Where |
|---------------|--------|
| **Approve**   | Suppliers list (row button) or Supplier detail → **Overview** tab. Shown for Draft, Pending, Submitted. |
| **Request info** | Supplier detail → **Overview** tab. Shown when status is Submitted. |
| **Suspend**   | Supplier detail → **Overview** tab. Shown when status is Approved or Active. |
| **Unsuspend** | Supplier detail → **Overview** tab. Shown when status is Suspended. |
| **Terminate** | Supplier detail → **Overview** tab. Shown when status is Approved, Active, or Suspended. |
| **Complete review** | Supplier detail → **Overview** tab. Shown when Approved or Active. |

---

## API endpoints (status-related)

| Method | Endpoint | Effect |
|--------|----------|--------|
| POST   | /api/suppliers | Create supplier; `status = "draft"` if not provided. |
| PATCH  | /api/suppliers/:id | Update any fields (e.g. status) and audit `supplier_updated`. |
| PATCH  | /api/suppliers/:id/approve | Set status = approved, set approvedBy/approvedAt, audit `supplier_approved`. |
| PATCH  | /api/suppliers/:id/request-info | Set status = info_required, set notes, audit `supplier_info_required`. |
| PATCH  | /api/suppliers/:id/suspend | Set status = suspended, optional reason, audit `supplier_suspended`. |
| PATCH  | /api/suppliers/:id/unsuspend | Set status = approved, clear suspension fields, audit `supplier_unsuspended`. |
| PATCH  | /api/suppliers/:id/terminate | Set status = terminated, audit `supplier_terminated` (reason in details). |

---

## Portal behaviour by status

- **draft / info_required:** Supplier can edit profile and documents and submit/resubmit onboarding.  
- **submitted:** Read-only; message that submission is under review.  
- **approved / active:** Can request VAT/bank changes (and upload evidence); cannot edit main profile directly.  
- **suspended:** Banner “Account suspended”; cannot submit onboarding or request changes.  
- **terminated:** No portal actions (record remains for history).

---

## Flow summary

```
Admin creates supplier → draft
Supplier fills and submits → submitted
Admin approves → approved  (or requests info → info_required → supplier resubmits → submitted → approve)
Admin can: Complete review (approved/active), Suspend (approved/active), Unsuspend (suspended), Terminate (approved/active/suspended)
Terminated is final; no further status changes in codebase.
```
