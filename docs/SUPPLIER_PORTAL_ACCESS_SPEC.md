# Supplier Portal Access – Understanding & Specification

This document captures the product understanding and technical approach for **supplier portal access**, **invitation flow**, **audit logging**, and **admin controls** based on the current Guardosmart codebase.

---

## 1. Current State (Codebase Summary)

| Area | Current state |
|------|----------------|
| **Suppliers** | Table `suppliers` in `shared/schema.ts`: company/contact/bank/status (`pending` \| `approved` \| `active` \| `suspended` \| `terminated`). No link to a `users` row (no portal account). |
| **Auth** | Session-based (express-session + Passport Local). Users table has `role` including `"supplier"`. No invite or password-reset flow. |
| **Supplier UI** | List at `/suppliers`, detail at `/suppliers/:id`. Approve action for `pending` only. No “portal access” toggle or invitation. |
| **Audit** | `audit_logs` table: `userId`, `action`, `entityType`, `entityId`, `details` (jsonb), `ipAddress`, `createdAt`. Used for supplier_created/updated/approved. IP is not currently passed when creating logs. |
| **Notifications** | No in-app or email notification system yet. |

---

## 2. What You Want (Product Understanding)

### 2.1 When I open a supplier (that is approved)

- A **toggle** to **give the supplier access to the portal** (enable/disable login).
- When enabling access:
  - **Set or edit the supplier’s login email** (e.g. pre-filled from supplier contact email).
  - Ability to **reset the supplier’s password** (admin-initiated).
- **Visibility of invitation status**: see whether the supplier **accepted the invitation** (signed in and set/confirmed password) or not.
- **Option to send a reminder** if the supplier has not yet accepted the invitation.

### 2.2 Supplier portal (once access is given)

- Supplier can **log in** (e.g. with email/username + password).
- Supplier sees **only their own details** (one supplier record).
- Supplier can **update** their allowed information (e.g. contact, company, bank as configured).
- When the supplier submits changes:
  - Changes are **pending** until admin approves.
  - **Admin gets a notification** (in-app and/or email) that there are changes to review.
  - Admin can **approve or reject** the proposed changes; only then do they apply to the main supplier record.

### 2.3 Logs and audit

- **Who changed what, when**: every change (by supplier or admin) logged with **user** (which user/supplier), **what** changed, **when**.
- **Login and activity**:
  - **How many times** the supplier has logged in.
  - **Last login** (timestamp).
  - **Login metadata**: IP, location (if available), browser, and any other useful request metadata.
- **Full audit trail** for the supplier: logins, profile views, updates, and admin actions (approve/reject) so you have a complete history.
- **Invitation and reminder**:
  - Log when invitation was sent and when reminder was sent.
  - Log when the supplier **accepted the invitation** (first login / set password).

---

## 3. End-to-end flow (as understood)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 1. ADMIN OPENS SUPPLIER PROFILE (approved supplier)                         │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 2. PORTAL ACCESS TOGGLE + EMAIL                                              │
│    • Toggle: "Give this supplier portal access" (on/off)                     │
│    • When ON: set/edit email address for login (e.g. supplier contact email) │
│    • Actions: "Send invitation" / "Reset password" / "Send reminder"         │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 3. INVITATION SENT                                                           │
│    • System creates/links a user (role=supplier) and sends invite (e.g.     │
│      email with link to set password + login URL)                            │
│    • Log: invitation_sent, reminder_sent (with timestamp, admin user)        │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 4. SUPPLIER ACCEPTS (or not)                                                 │
│    • Supplier opens link → sets password → first login                        │
│    • Log: invitation_accepted (with timestamp, IP, etc.)                     │
│    • If supplier does nothing → admin can "Send reminder"                    │
│    • Admin can see: "Invitation accepted: Yes/No" and last reminder date      │
└─────────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ 5. SUPPLIER USES PORTAL                                                      │
│    • Login (each login logged: IP, location, browser, timestamp)             │
│    • View own details only                                                   │
│    • Submit updates → stored as "pending changes"                             │
│    • Admin notified → reviews and approves/rejects                           │
│    • All actions (view, update, approve, reject) in audit log with user      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Admin view on supplier profile (summary)

When you open a supplier that is approved, you get:

| Element | Purpose |
|--------|---------|
| **Portal access toggle** | Enable/disable supplier’s ability to log in. |
| **Login email** | Email used for this supplier’s portal account (editable when access is on). |
| **Send invitation** | Send (or resend) invite email to set password and access portal. |
| **Reset password** | Admin triggers a password reset for this supplier (e.g. new reset link). |
| **Send reminder** | Resend invitation/reminder if supplier has not accepted yet. |
| **Invitation status** | "Accepted" / "Pending" (and optionally last reminder sent). |
| **Last login** | Timestamp of last login. |
| **Login count** | Total number of logins. |
| **Audit / activity log** | List of: logins (with IP, location, browser), profile updates, admin approvals/rejections, invitation/reminder events. |

---

## 5. Technical Implementation Outline (aligned with codebase)

### 5.1 Schema changes (`shared/schema.ts`)

- **Suppliers**
  - Add `userId` (optional FK to `users`) to link one portal user to the supplier.
  - Add `portalAccessEnabled` (boolean).
  - Add `portalEmail` (text, nullable) if you want an email that can differ from main contact email.
- **Invitation / token**
  - New table e.g. `supplier_invitations`: `supplierId`, `email`, `token`, `expiresAt`, `acceptedAt`, `reminderSentAt`, `createdBy`, `createdAt`. (Or reuse a generic invite-token table if you prefer.)
- **Pending supplier changes**
  - New table e.g. `supplier_pending_changes`: `id`, `supplierId`, `userId` (supplier who requested), `payload` (jsonb with proposed fields), `status` (`pending` \| `approved` \| `rejected`), `reviewedBy`, `reviewedAt`, `createdAt`.
- **Login / activity metadata**
  - New table e.g. `supplier_login_activity` (or `user_login_activity` for all roles): `userId`, `ipAddress`, `userAgent`, `location` (or separate city/country), `loggedAt`, etc. Optional: same table for any “activity” (e.g. view_profile, submit_changes) with `activityType` and `details` (jsonb) for full audit.

Alternatively, **reuse `audit_logs`** for all of this:
  - Use `entityType: "supplier"`, `entityId: supplierId`, and `action` values such as: `supplier_invitation_sent`, `supplier_invitation_reminder_sent`, `supplier_invitation_accepted`, `supplier_login`, `supplier_profile_view`, `supplier_change_requested`, `supplier_change_approved`, `supplier_change_rejected`.
  - Store IP, userAgent, location, login count, etc. in `details` (jsonb). Optionally add a small `supplier_login_activity` table for quick “last login” and “login count” per supplier user.

### 5.2 Auth and invitation (server)

- **Invitation**
  - When admin enables portal and sends invite: create or link `users` row (role `supplier`), set `suppliers.userId`, create invitation token (and record in `supplier_invitations` or audit), send email (when email is implemented) with link to e.g. `/accept-invite?token=...`.
  - Accept-invite page: validate token, let supplier set password, then redirect to login. Log `supplier_invitation_accepted` with IP/userAgent (and optional location).
- **Login**
  - After successful login, persist login metadata (IP, userAgent, optional location) to `supplier_login_activity` and/or `audit_logs` (action `supplier_login` or `user_login`), and update `users.lastLoginAt` and a login count (e.g. on `users` or in a summary table).
  - IP: from `req.ip` or `req.headers["x-forwarded-for"]`; userAgent: `req.headers["user-agent"]`; location: optional (e.g. third-party geo service or leave blank initially).
- **Password reset**
  - Admin “Reset password”: generate reset token, store with expiry, send email (or show link in UI for testing). Supplier uses link to set new password. Log reset request and reset completion in audit.

### 5.3 Supplier-scoped API (server)

- **GET /api/supplier-portal/me**  
  - Resolve supplier by `req.user.id` (e.g. `getSupplierByUserId`). Return that supplier’s allowed fields only. Require role `supplier`.
- **PATCH /api/supplier-portal/me**  
  - Accept proposed changes; create row in `supplier_pending_changes` (status `pending`). Notify admin (when notification exists). Log `supplier_change_requested` with userId, supplierId, and diff in `details`.
- **GET /api/supplier-portal/me/activity** (optional)  
  - Return last N activities for this supplier (for “My activity” in portal).

Admin:
- **GET /api/suppliers/:id/pending-changes**  
  - List pending change requests for this supplier.
- **POST /api/suppliers/:id/pending-changes/:changeId/approve**  
  - Apply change to `suppliers`, set status `approved`, notify supplier (optional). Log `supplier_change_approved`.
- **POST /api/suppliers/:id/pending-changes/:changeId/reject**  
  - Set status `rejected`. Log `supplier_change_rejected`.

### 5.4 Supplier detail page (admin UI)

- In `client/src/pages/supplier-detail.tsx` (when supplier is approved):
  - **Portal access** section:
    - Toggle: “Portal access” (bound to `portalAccessEnabled`).
    - When ON: input for portal email; buttons: “Send invitation”, “Reset password”, “Send reminder”.
    - Display: Invitation status (Accepted / Pending), Last login, Login count.
  - **Activity / audit** section:
    - Table or list of audit entries for this supplier: logins (IP, location, browser, time), invitation/reminder sent, invitation accepted, changes requested/approved/rejected. Use existing audit API filtered by `entityType: "supplier"` and `entityId: supplier.id`, or a dedicated `GET /api/suppliers/:id/activity` that returns supplier-specific logs.

### 5.5 Supplier portal UI

- **Sidebar / routes**  
  - For role `supplier`, show a “Supplier portal” or “My details” entry that points to e.g. `/supplier-portal` (or `/my-details`).
- **Supplier portal page**  
  - Fetch `GET /api/supplier-portal/me` and show read-only view of allowed fields with an “Edit” or “Request changes” that opens a form; submit calls `PATCH /api/supplier-portal/me` with the proposed changes. Show a message that changes are pending approval.
- **Accept-invite page** (public or minimal layout)  
  - Route e.g. `/accept-invite?token=...`: validate token, form to set password, submit to e.g. `POST /api/auth/accept-supplier-invite`, then redirect to login.

### 5.6 Notifications

- When supplier submits pending changes: create in-app notification (if you add a `notifications` table and UI) and/or send email to admins. When you add the notification layer, call it from the handler that creates the `supplier_pending_changes` row.
- Optional: notify supplier when their change is approved or rejected (email or in-app).

### 5.7 Audit and logs (consistent logging)

- **Every relevant action** should call `storage.createAuditLog` with:
  - `tenantId`, `userId` (admin or supplier user), `action`, `entityType: "supplier"`, `entityId: supplierId`, `details` (object with diff, IP, userAgent, etc.), and **`ipAddress`** (from `req.ip` or `req.headers["x-forwarded-for"]`).
- Actions to log: `supplier_invitation_sent`, `supplier_invitation_reminder_sent`, `supplier_invitation_accepted`, `supplier_login`, `supplier_change_requested`, `supplier_change_approved`, `supplier_change_rejected`, `supplier_portal_access_enabled`, `supplier_portal_access_disabled`, `supplier_password_reset_requested`.
- Optionally extend `getAuditLogs` or add `GET /api/suppliers/:id/activity` to filter by `entityId` and action prefix so the supplier detail page can show only that supplier’s activity.

---

## 6. Summary

- **Open supplier (approved)** → Toggle portal access, set email, send invitation, reset password, send reminder; see invitation status, last login, login count, and full audit (logins with IP/location/browser, invitation accepted, changes requested/approved/rejected).
- **Supplier** → Receives invite, accepts (sets password), logs in; sees only own details; submits changes that stay pending until admin approves; every login and action is logged with metadata.
- **Logs** → All changes and who made them; how many times and when the supplier logged in; from which IP, location, browser; whether they accepted the invitation; option to send reminder if not.

This document can be used as the single source of truth for implementing the feature and for any follow-up MD files (e.g. API contract or DB migration plan).
