# Gardeo Database Schema Reference

Generated for API data synchronisation. This document describes every table,
column, data type, constraint, and relationship in the Gardeo PostgreSQL database.

---

## Table of Contents

1. [ai_decisions](#ai_decisions)
2. [ai_insights](#ai_insights)
3. [applicants](#applicants)
4. [audit_logs](#audit_logs)
5. [auto_classification_suggestions](#auto_classification_suggestions)
6. [auto_escalation_rules](#auto_escalation_rules)
7. [bank_details](#bank_details)
8. [bank_transaction_allocations](#bank_transaction_allocations)
9. [bank_transactions](#bank_transactions)
10. [broadcast_reads](#broadcast_reads)
11. [broadcasts](#broadcasts)
12. [channel_members](#channel_members)
13. [channels](#channels)
14. [classification_rules](#classification_rules)
15. [client_invoice_line_items](#client_invoice_line_items)
16. [client_invoices](#client_invoices)
17. [client_rate_cards](#client_rate_cards)
18. [clients](#clients)
19. [compliance_alert_log](#compliance_alert_log)
20. [contact_logs](#contact_logs)
21. [controller_activity_log](#controller_activity_log)
22. [controller_handover_notes](#controller_handover_notes)
23. [credit_note_line_items](#credit_note_line_items)
24. [credit_notes](#credit_notes)
25. [data_consents](#data_consents)
26. [data_erasure_requests](#data_erasure_requests)
27. [debit_note_line_items](#debit_note_line_items)
28. [debit_notes](#debit_notes)
29. [dispute_messages](#dispute_messages)
30. [disputes](#disputes)
31. [document_templates](#document_templates)
32. [documents](#documents)
33. [emergency_contacts](#emergency_contacts)
34. [employee_audit_trail](#employee_audit_trail)
35. [employee_invitations](#employee_invitations)
36. [employee_pay_rates](#employee_pay_rates)
37. [employee_policies](#employee_policies)
38. [employees](#employees)
39. [employment_history](#employment_history)
40. [financial_documents](#financial_documents)
41. [incidents](#incidents)
42. [invoice_line_items](#invoice_line_items)
43. [invoice_number_audit_log](#invoice_number_audit_log)
44. [invoices](#invoices)
45. [job_postings](#job_postings)
46. [messages](#messages)
47. [notifications](#notifications)
48. [onboarding_records](#onboarding_records)
49. [password_reset_tokens](#password_reset_tokens)
50. [payroll_run_items](#payroll_run_items)
51. [payroll_runs](#payroll_runs)
52. [purchase_vendors](#purchase_vendors)
53. [rate_card_history](#rate_card_history)
54. [rate_cards](#rate_cards)
55. [references](#references)
56. [reverse_engineer_log](#reverse_engineer_log)
57. [role_permissions](#role_permissions)
58. [sessions](#sessions)
59. [shifts](#shifts)
60. [sites](#sites)
61. [subscription_plans](#subscription_plans)
62. [supplier_agreement_archives](#supplier_agreement_archives)
63. [supplier_audit_events](#supplier_audit_events)
64. [supplier_document_audit](#supplier_document_audit)
65. [supplier_documents](#supplier_documents)
66. [supplier_field_requests](#supplier_field_requests)
67. [supplier_invitations](#supplier_invitations)
68. [supplier_login_activity](#supplier_login_activity)
69. [supplier_pending_changes](#supplier_pending_changes)
70. [supplier_policies](#supplier_policies)
71. [supplier_profile_change_log](#supplier_profile_change_log)
72. [suppliers](#suppliers)
73. [sync_configurations](#sync_configurations)
74. [sync_logs](#sync_logs)
75. [tenant_addons](#tenant_addons)
76. [tenant_invitations](#tenant_invitations)
77. [tenants](#tenants)
78. [users](#users)
79. [vat_verifications](#vat_verifications)
80. [vendor_classifications](#vendor_classifications)
81. [vetting_records](#vetting_records)

---

## Enum Types

### `ai_decision_status`
Values: `suggested` | `accepted` | `rejected` | `modified`

### `application_status`
Values: `applied` | `screening` | `interview` | `offer` | `hired` | `rejected` | `withdrawn`

### `channel_type`
Values: `team` | `site` | `direct` | `broadcast`

### `credit_note_status`
Values: `draft` | `issued` | `applied` | `cancelled`

### `data_consent_status`
Values: `granted` | `withdrawn`

### `dispute_status`
Values: `open` | `under_review` | `resolved` | `escalated` | `closed`

### `erasure_request_status`
Values: `pending` | `approved` | `rejected` | `completed`

### `finance_approval_status`
Values: `pending` | `approved` | `rejected`

### `financial_document_type`
Values: `receipt` | `invoice` | `statement` | `contract` | `credit_note` | `other`

### `incident_severity`
Values: `low` | `medium` | `high` | `critical`

### `incident_status`
Values: `reported` | `investigating` | `resolved` | `closed`

### `invoice_status`
Values: `draft` | `pending` | `approved` | `paid` | `overdue` | `cancelled`

### `invoice_type`
Values: `manual` | `self_billed`

### `onboarding_status`
Values: `invited` | `in_progress` | `submitted` | `under_review` | `approved` | `rejected` | `completed`

### `payroll_run_status`
Values: `draft` | `finalised` | `paid`

### `payroll_status`
Values: `pending` | `approved` | `rejected` | `paid`

### `reverse_engineer_status`
Values: `completed` | `rolled_back`

### `shift_status`
Values: `scheduled` | `in_progress` | `completed` | `cancelled` | `no_show` | `booked_on` | `booked_off` | `verified` | `missed`

### `subscription_plan`
Values: `starter` | `professional` | `enterprise`

### `supplier_approval_status`
Values: `pending` | `approved` | `disputed` | `resolved`

### `supplier_document_audit_action`
Values: `uploaded` | `approved` | `rejected`

### `supplier_document_status`
Values: `pending` | `approved` | `rejected`

### `supplier_document_type`
Values: `companies_house_proof` | `bank_proof` | `supplier_declaration` | `vat_evidence` | `sample_vat_invoice` | `non_vat_declaration` | `el_insurance` | `pl_insurance` | `rtw_payroll_statement` | `labour_supply_chain_statement` | `self_billing_agreement` | `other`

### `supplier_hmrc_event_type`
Values: `agreement_created` | `agreement_renewed` | `agreement_terminated` | `agreement_expired` | `invoice_generated` | `invoice_issued` | `invoice_viewed` | `invoice_accepted` | `invoice_disputed` | `invoice_paid` | `credit_note_issued` | `debit_note_issued` | `vat_number_changed` | `vat_verification_checked` | `vat_status_changed` | `rate_card_created` | `rate_card_updated` | `rate_card_expired` | `timesheet_approved` | `timesheet_rejected` | `timesheet_resubmitted` | `timesheet_linked` | `supplier_approved` | `supplier_terminated` | `supplier_status_changed` | `dispute_opened` | `dispute_resolved` | `audit_accessed`

### `supplier_pending_change_status`
Values: `pending` | `approved` | `rejected`

### `supplier_policy_status`
Values: `pending` | `approved` | `rejected`

### `supplier_status`
Values: `draft` | `pending` | `submitted` | `approved` | `info_required` | `active` | `suspended` | `terminated`

### `supplier_type`
Values: `labour` | `non_labour`

### `user_role`
Values: `super_admin` | `tenant_admin` | `ceo` | `operations_manager` | `regional_manager` | `admin` | `controller` | `scheduler` | `hr_manager` | `compliance_manager` | `accountant` | `payroll_manager` | `training_manager` | `supplier` | `employee`

### `vetting_status`
Values: `not_started` | `pending` | `in_progress` | `passed` | `failed` | `expired`

---

## Tables

### ai_decisions

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('ai_decisions_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `user_id` | character varying(255) | NO |  |  |  |  |
| `site_id` | integer | YES |  |  |  |  |
| `site_name` | character varying(255) | YES |  |  |  |  |
| `shift_date` | character varying(50) | YES |  |  |  |  |
| `employee_id` | integer | YES |  |  |  |  |
| `employee_name` | character varying(255) | YES |  |  |  |  |
| `suggested_shift_time` | character varying(100) | YES |  |  |  |  |
| `reason` | text | YES |  |  |  |  |
| `priority` | character varying(20) | YES |  |  |  |  |
| `status` | USER-DEFINED | NO | 'suggested'::ai_decision_status |  |  |  |
| `feedback` | text | YES |  |  |  |  |
| `requirements` | text | YES |  |  |  |  |
| `batch_id` | character varying(100) | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |
| `decided_at` | timestamp without time zone | YES |  |  |  |  |

### ai_insights

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('ai_insights_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `insight_type` | character varying(50) | NO |  |  |  |  |
| `title` | character varying(255) | NO |  |  |  |  |
| `description` | text | NO |  |  |  |  |
| `severity` | character varying(20) | NO | 'info'::character varying |  |  |  |
| `data` | jsonb | YES |  |  |  |  |
| `is_active` | boolean | NO | true |  |  |  |
| `expires_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### applicants

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('applicants_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `job_posting_id` | integer | YES |  |  |  | job_postings.id |
| `first_name` | text | NO |  |  |  |  |
| `last_name` | text | NO |  |  |  |  |
| `email` | text | NO |  |  |  |  |
| `phone` | text | YES |  |  |  |  |
| `cv_url` | text | YES |  |  |  |  |
| `cover_letter` | text | YES |  |  |  |  |
| `status` | USER-DEFINED | YES | 'applied'::application_status |  |  |  |
| `interview_date` | timestamp without time zone | YES |  |  |  |  |
| `interview_notes` | text | YES |  |  |  |  |
| `rating` | integer | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |

### audit_logs

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('audit_logs_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `user_id` | character varying | YES |  |  |  | users.id |
| `action` | text | NO |  |  |  |  |
| `entity_type` | text | NO |  |  |  |  |
| `entity_id` | text | YES |  |  |  |  |
| `details` | jsonb | YES |  |  |  |  |
| `ip_address` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### auto_classification_suggestions

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('auto_classification_suggesti... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `bank_transaction_id` | integer | NO |  |  |  | bank_transactions.id |
| `entity_type` | text | NO |  |  |  |  |
| `entity_id` | integer | YES |  |  |  |  |
| `expense_category` | text | YES |  |  |  |  |
| `includes_vat` | boolean | NO | false |  |  |  |
| `confidence` | numeric(5,2) | NO |  |  |  |  |
| `match_reasons` | jsonb | YES |  |  |  |  |
| `status` | text | NO | 'pending'::text |  |  |  |
| `invoice_id` | integer | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |
| `vendor_id` | integer | YES |  |  |  |  |

### auto_escalation_rules

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('auto_escalation_rules_id_seq... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `name` | text | NO |  |  |  |  |
| `trigger_type` | text | NO |  |  |  |  |
| `delay_minutes` | integer | NO |  |  |  |  |
| `action_type` | text | NO |  |  |  |  |
| `enabled` | boolean | YES | true |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### bank_details

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('bank_details_id_seq'::regclass) | PK |  |  |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `account_name` | text | NO |  |  |  |  |
| `bank_name` | text | NO |  |  |  |  |
| `sort_code` | text | NO |  |  |  |  |
| `account_number` | text | NO |  |  |  |  |
| `building_society_ref` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |

### bank_transaction_allocations

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('bank_transaction_allocations... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `bank_transaction_id` | integer | NO |  |  |  | bank_transactions.id |
| `invoice_id` | integer | YES |  |  |  | invoices.id |
| `client_invoice_id` | integer | YES |  |  |  |  |
| `supplier_id` | integer | YES |  |  |  | suppliers.id |
| `amount` | numeric(12,2) | NO |  |  |  |  |
| `allocated_by` | character varying | YES |  |  |  | users.id |
| `allocated_at` | timestamp without time zone | NO | now() |  |  |  |
| `notes` | text | YES |  |  |  |  |

### bank_transactions

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('bank_transactions_id_seq'::r... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `transaction_date` | date | NO |  |  |  |  |
| `description` | text | YES |  |  |  |  |
| `amount` | numeric(12,2) | NO |  |  |  |  |
| `type` | text | NO | 'debit'::text |  |  |  |
| `account_number` | text | YES |  |  |  |  |
| `reference` | text | YES |  |  |  |  |
| `memo` | text | YES |  |  |  |  |
| `is_allocated` | boolean | NO | false |  |  |  |
| `allocated_amount` | numeric(12,2) | YES | 0 |  |  |  |
| `supplier_id` | integer | YES |  |  |  | suppliers.id |
| `import_batch_id` | text | YES |  |  |  |  |
| `raw_data` | text | YES |  |  |  |  |
| `net_amount` | numeric(12,2) | YES |  |  |  |  |
| `vat_amount` | numeric(12,2) | YES |  |  |  |  |
| `is_general_purchase` | boolean | NO | false |  |  |  |
| `expense_category` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |
| `vendor_id` | integer | YES |  |  |  |  |

### broadcast_reads

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('broadcast_reads_id_seq'::reg... | PK |  |  |
| `broadcast_id` | integer | NO |  |  |  |  |
| `user_id` | character varying(255) | NO |  |  |  |  |
| `read_at` | timestamp without time zone | NO | now() |  |  |  |

### broadcasts

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('broadcasts_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `sender_id` | character varying(255) | NO |  |  |  |  |
| `sender_name` | character varying(255) | NO |  |  |  |  |
| `title` | character varying(255) | NO |  |  |  |  |
| `content` | text | NO |  |  |  |  |
| `target_roles` | ARRAY | YES |  |  |  |  |
| `priority` | character varying(20) | NO | 'normal'::character varying |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### channel_members

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('channel_members_id_seq'::reg... | PK |  |  |
| `channel_id` | integer | NO |  |  |  |  |
| `user_id` | character varying(255) | NO |  |  |  |  |
| `joined_at` | timestamp without time zone | NO | now() |  |  |  |
| `last_read_at` | timestamp without time zone | YES |  |  |  |  |

### channels

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('channels_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `name` | character varying(255) | NO |  |  |  |  |
| `type` | USER-DEFINED | NO |  |  |  |  |
| `description` | text | YES |  |  |  |  |
| `site_id` | integer | YES |  |  |  |  |
| `created_by` | character varying(255) | NO |  |  |  |  |
| `is_archived` | boolean | NO | false |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### classification_rules

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('classification_rules_id_seq'... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `match_pattern` | text | NO |  |  |  |  |
| `entity_type` | text | NO |  |  |  |  |
| `entity_id` | integer | YES |  |  |  |  |
| `expense_category` | text | YES |  |  |  |  |
| `includes_vat` | boolean | NO | false |  |  |  |
| `match_count` | integer | NO | 1 |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |
| `updated_at` | timestamp without time zone | NO | now() |  |  |  |

### client_invoice_line_items

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('client_invoice_line_items_id... | PK |  |  |
| `client_invoice_id` | integer | NO |  |  |  | client_invoices.id |
| `shift_id` | integer | YES |  |  |  | shifts.id |
| `description` | text | YES |  |  |  |  |
| `hours` | numeric(8,2) | YES |  |  |  |  |
| `charge_rate` | numeric(8,2) | YES |  |  |  |  |
| `subtotal` | numeric(10,2) | YES |  |  |  |  |
| `vat_amount` | numeric(10,2) | YES |  |  |  |  |
| `line_total` | numeric(10,2) | YES |  |  |  |  |

### client_invoices

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('client_invoices_id_seq'::reg... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `client_id` | integer | NO |  |  |  | clients.id |
| `invoice_number` | text | NO |  |  |  |  |
| `period_start` | date | NO |  |  |  |  |
| `period_end` | date | NO |  |  |  |  |
| `subtotal` | numeric(12,2) | NO |  |  |  |  |
| `vat_rate` | numeric(5,2) | YES | 20 |  |  |  |
| `vat_amount` | numeric(12,2) | NO |  |  |  |  |
| `total_amount` | numeric(12,2) | NO |  |  |  |  |
| `status` | text | NO | 'draft'::text |  |  |  |
| `due_date` | date | YES |  |  |  |  |
| `paid_at` | timestamp without time zone | YES |  |  |  |  |
| `issued_at` | timestamp without time zone | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### client_rate_cards

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('client_rate_cards_id_seq'::r... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `client_id` | integer | NO |  |  |  | clients.id |
| `site_id` | integer | YES |  |  |  | sites.id |
| `role_type` | text | YES |  |  |  |  |
| `hourly_charge_rate` | numeric(10,2) | NO |  |  |  |  |
| `effective_from` | date | NO |  |  |  |  |
| `effective_to` | date | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### clients

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('clients_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `company_name` | text | NO |  |  |  |  |
| `contact_name` | text | YES |  |  |  |  |
| `contact_email` | text | YES |  |  |  |  |
| `contact_phone` | text | YES |  |  |  |  |
| `address` | text | YES |  |  |  |  |
| `city` | text | YES |  |  |  |  |
| `postcode` | text | YES |  |  |  |  |
| `contract_ref` | text | YES |  |  |  |  |
| `contract_start_date` | date | YES |  |  |  |  |
| `contract_end_date` | date | YES |  |  |  |  |
| `billing_email` | text | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `is_active` | boolean | YES | true |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `client_code` | text | YES |  |  |  |  |
| `company_reg_number` | text | YES |  |  |  |  |
| `external_id` | text | YES |  |  |  |  |

### compliance_alert_log

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('compliance_alert_log_id_seq'... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `entity_type` | text | NO |  |  |  |  |
| `entity_id` | integer | NO |  |  |  |  |
| `entity_name` | text | NO |  |  |  |  |
| `alert_type` | text | NO |  |  |  |  |
| `days_before` | integer | NO |  |  |  |  |
| `recipient_email` | text | NO |  |  |  |  |
| `sent_at` | timestamp without time zone | YES | now() |  |  |  |

### contact_logs

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('contact_logs_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `shift_id` | integer | YES |  |  |  |  |
| `employee_id` | integer | YES |  |  |  |  |
| `employee_name` | text | YES |  |  |  |  |
| `employee_phone` | text | YES |  |  |  |  |
| `employee_email` | text | YES |  |  |  |  |
| `channel` | text | NO |  |  |  |  |
| `direction` | text | NO | 'outbound'::text |  |  |  |
| `trigger_type` | text | NO |  |  |  |  |
| `subject` | text | YES |  |  |  |  |
| `message_body` | text | YES |  |  |  |  |
| `status` | text | NO | 'pending'::text |  |  |  |
| `error_message` | text | YES |  |  |  |  |
| `twilio_sid` | text | YES |  |  |  |  |
| `call_duration_seconds` | integer | YES |  |  |  |  |
| `ai_transcript` | text | YES |  |  |  |  |
| `employee_response` | text | YES |  |  |  |  |
| `escalation_level` | integer | YES | 1 |  |  |  |
| `triggered_by` | text | YES |  |  |  |  |
| `site_name` | text | YES |  |  |  |  |
| `shift_date` | text | YES |  |  |  |  |
| `shift_time` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### controller_activity_log

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('controller_activity_log_id_s... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `user_id` | character varying | NO |  |  |  | users.id |
| `action_type` | text | NO |  |  |  |  |
| `shift_id` | integer | YES |  |  |  | shifts.id |
| `incident_id` | integer | YES |  |  |  | incidents.id |
| `details` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### controller_handover_notes

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('controller_handover_notes_id... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `created_by` | character varying | NO |  |  |  | users.id |
| `note` | text | NO |  |  |  |  |
| `open_issues` | text | YES |  |  |  |  |
| `pending_actions` | text | YES |  |  |  |  |
| `watch_items` | text | YES |  |  |  |  |
| `shift_date` | date | NO |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### credit_note_line_items

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('credit_note_line_items_id_se... | PK |  |  |
| `credit_note_id` | integer | NO |  |  |  | credit_notes.id |
| `description` | text | YES |  |  |  |  |
| `amount` | numeric(12,2) | NO |  |  |  |  |
| `vat_rate` | numeric(5,2) | YES | '20'::numeric |  |  |  |
| `vat_amount` | numeric(12,2) | YES |  |  |  |  |
| `line_total` | numeric(12,2) | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### credit_notes

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('credit_notes_id_seq'::regclass) | PK |  |  |
| `id` | integer | NO | nextval('credit_notes_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `invoice_id` | integer | NO |  |  |  | invoices.id |
| `credit_note_number` | text | NO |  |  |  |  |
| `reason` | text | NO |  |  |  |  |
| `subtotal` | numeric(12,2) | NO |  |  |  |  |
| `vat_rate` | numeric(5,2) | YES | '20'::numeric |  |  |  |
| `vat_amount` | numeric(12,2) | NO |  |  |  |  |
| `total_amount` | numeric(12,2) | NO |  |  |  |  |
| `status` | USER-DEFINED | NO | 'draft'::credit_note_status |  |  |  |
| `issued_by` | character varying | YES |  |  |  | users.id |
| `issued_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### data_consents

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('data_consents_id_seq'::regcl... | PK |  |  |
| `user_id` | character varying | NO |  |  |  | users.id |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `consent_type` | text | NO |  |  |  |  |
| `status` | USER-DEFINED | NO | 'granted'::data_consent_status |  |  |  |
| `granted_at` | timestamp without time zone | YES | now() |  |  |  |
| `withdrawn_at` | timestamp without time zone | YES |  |  |  |  |
| `ip_address` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### data_erasure_requests

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('data_erasure_requests_id_seq... | PK |  |  |
| `user_id` | character varying | NO |  |  |  | users.id |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `reason` | text | YES |  |  |  |  |
| `status` | USER-DEFINED | NO | 'pending'::erasure_request_status |  |  |  |
| `reviewed_by` | character varying | YES |  |  |  | users.id |
| `reviewed_at` | timestamp without time zone | YES |  |  |  |  |
| `review_notes` | text | YES |  |  |  |  |
| `completed_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### debit_note_line_items

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('debit_note_line_items_id_seq... | PK |  |  |
| `debit_note_id` | integer | NO |  |  |  | debit_notes.id |
| `description` | text | YES |  |  |  |  |
| `amount` | numeric(12,2) | NO |  |  |  |  |
| `vat_rate` | numeric(5,2) | YES | '20'::numeric |  |  |  |
| `vat_amount` | numeric(12,2) | YES |  |  |  |  |
| `line_total` | numeric(12,2) | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### debit_notes

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('debit_notes_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `invoice_id` | integer | NO |  |  |  | invoices.id |
| `debit_note_number` | text | NO |  |  |  |  |
| `reason` | text | NO |  |  |  |  |
| `subtotal` | numeric(12,2) | NO |  |  |  |  |
| `vat_rate` | numeric(5,2) | YES | '20'::numeric |  |  |  |
| `vat_amount` | numeric(12,2) | NO |  |  |  |  |
| `total_amount` | numeric(12,2) | NO |  |  |  |  |
| `status` | USER-DEFINED | NO | 'draft'::credit_note_status |  |  |  |
| `issued_by` | character varying | YES |  |  |  | users.id |
| `issued_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### dispute_messages

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('dispute_messages_id_seq'::re... | PK |  |  |
| `dispute_id` | integer | NO |  |  |  | disputes.id |
| `user_id` | character varying | NO |  |  |  | users.id |
| `user_name` | text | YES |  |  |  |  |
| `message` | text | NO |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### disputes

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('disputes_id_seq'::regclass) | PK |  |  |
| `id` | integer | NO | nextval('disputes_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `shift_id` | integer | NO |  |  |  | shifts.id |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `status` | USER-DEFINED | NO | 'open'::dispute_status |  |  |  |
| `reason` | text | NO |  |  |  |  |
| `resolution` | text | YES |  |  |  |  |
| `resolved_by` | character varying | YES |  |  |  | users.id |
| `resolved_at` | timestamp without time zone | YES |  |  |  |  |
| `escalated_at` | timestamp without time zone | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### document_templates

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('document_templates_id_seq'::... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `name` | text | NO |  |  |  |  |
| `document_type` | text | NO |  |  |  |  |
| `is_default` | boolean | NO | false |  |  |  |
| `header_title` | text | YES |  |  |  |  |
| `header_subtitle` | text | YES |  |  |  |  |
| `sections` | jsonb | YES |  |  |  |  |
| `footer_text` | text | YES |  |  |  |  |
| `compliance_text` | text | YES |  |  |  |  |
| `payment_terms_text` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `invoice_format` | text | YES |  |  |  |  |

### documents

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('documents_id_seq'::regclass) | PK |  |  |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `document_type` | text | NO |  |  |  |  |
| `file_name` | text | NO |  |  |  |  |
| `file_url` | text | NO |  |  |  |  |
| `file_size` | integer | YES |  |  |  |  |
| `mime_type` | text | YES |  |  |  |  |
| `expiry_date` | date | YES |  |  |  |  |
| `is_verified` | boolean | YES | false |  |  |  |
| `verified_by` | character varying | YES |  |  |  | users.id |
| `verified_at` | timestamp without time zone | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### emergency_contacts

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('emergency_contacts_id_seq'::... | PK |  |  |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `name` | text | NO |  |  |  |  |
| `relationship` | text | NO |  |  |  |  |
| `phone` | text | NO |  |  |  |  |
| `alternate_phone` | text | YES |  |  |  |  |
| `email` | text | YES |  |  |  |  |
| `address` | text | YES |  |  |  |  |
| `is_primary` | boolean | YES | false |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### employee_audit_trail

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('employee_audit_trail_id_seq'... | PK |  |  |
| `employee_id` | integer | NO |  |  |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `event_type` | text | NO |  |  |  |  |
| `event_category` | text | NO | 'general'::text |  |  |  |
| `title` | text | NO |  |  |  |  |
| `description` | text | YES |  |  |  |  |
| `performed_by` | text | YES |  |  |  |  |
| `performed_by_name` | text | YES |  |  |  |  |
| `metadata` | text | YES |  |  |  |  |
| `event_at` | timestamp without time zone | NO | now() |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### employee_invitations

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('employee_invitations_id_seq'... | PK |  |  |
| `employee_id` | integer | NO |  |  |  | employees.id |
| `email` | text | NO |  |  |  |  |
| `token` | text | NO |  |  | UNIQUE |  |
| `expires_at` | timestamp without time zone | NO |  |  |  |  |
| `accepted_at` | timestamp without time zone | YES |  |  |  |  |
| `reminder_sent_at` | timestamp without time zone | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### employee_pay_rates

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('employee_pay_rates_id_seq'::... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `employee_id` | integer | NO |  |  |  | employees.id |
| `hourly_rate` | numeric(10,2) | NO |  |  |  |  |
| `effective_from` | date | NO |  |  |  |  |
| `effective_to` | date | YES |  |  |  |  |
| `reason` | text | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### employee_policies

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('employee_policies_id_seq'::r... | PK |  |  |
| `employee_id` | integer | NO |  |  |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `policy_name` | text | NO |  |  |  |  |
| `policy_type` | text | NO | 'policy'::text |  |  |  |
| `version` | text | YES |  |  |  |  |
| `file_url` | text | YES |  |  |  |  |
| `issued_at` | timestamp without time zone | NO | now() |  |  |  |
| `issued_by` | text | YES |  |  |  |  |
| `acknowledged_at` | timestamp without time zone | YES |  |  |  |  |
| `acknowledged_by` | text | YES |  |  |  |  |
| `status` | text | NO | 'issued'::text |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### employees

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('employees_id_seq'::regclass) | PK |  |  |
| `user_id` | character varying | YES |  |  |  | users.id |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `employee_number` | text | YES |  |  |  |  |
| `date_of_birth` | date | YES |  |  |  |  |
| `national_insurance` | text | YES |  |  |  |  |
| `gender` | text | YES |  |  |  |  |
| `nationality` | text | YES |  |  |  |  |
| `address_line_1` | text | YES |  |  |  |  |
| `address_line_2` | text | YES |  |  |  |  |
| `city` | text | YES |  |  |  |  |
| `county` | text | YES |  |  |  |  |
| `postcode` | text | YES |  |  |  |  |
| `country` | text | YES | 'United Kingdom'::text |  |  |  |
| `start_date` | date | YES |  |  |  |  |
| `job_title` | text | YES |  |  |  |  |
| `department` | text | YES |  |  |  |  |
| `employment_type` | text | YES |  |  |  |  |
| `hourly_rate` | text | YES |  |  |  |  |
| `uniform_size` | text | YES |  |  |  |  |
| `boot_size` | text | YES |  |  |  |  |
| `equipment_notes` | text | YES |  |  |  |  |
| `sia_license_number` | text | YES |  |  |  |  |
| `sia_license_type` | text | YES |  |  |  |  |
| `sia_expiry_date` | date | YES |  |  |  |  |
| `dbs_certificate_number` | text | YES |  |  |  |  |
| `dbs_issue_date` | date | YES |  |  |  |  |
| `has_first_aid` | boolean | YES | false |  |  |  |
| `first_aid_expiry` | date | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `supplier_id` | integer | YES |  |  |  | suppliers.id |
| `portal_access_enabled` | boolean | YES | false |  |  |  |
| `portal_email` | text | YES |  |  |  |  |
| `portal_invitation_sent_at` | timestamp without time zone | YES |  |  |  |  |
| `portal_invitation_accepted` | boolean | YES | false |  |  |  |
| `external_id` | text | YES |  |  |  |  |

### employment_history

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('employment_history_id_seq'::... | PK |  |  |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `employer_name` | text | NO |  |  |  |  |
| `job_title` | text | NO |  |  |  |  |
| `date_from` | date | NO |  |  |  |  |
| `date_to` | date | YES |  |  |  |  |
| `is_current` | boolean | YES | false |  |  |  |
| `reason_for_leaving` | text | YES |  |  |  |  |
| `duties` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### financial_documents

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('financial_documents_id_seq':... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `document_type` | USER-DEFINED | NO |  |  |  |  |
| `file_name` | text | NO |  |  |  |  |
| `file_url` | text | NO |  |  |  |  |
| `file_size` | integer | YES |  |  |  |  |
| `mime_type` | text | YES |  |  |  |  |
| `title` | text | NO |  |  |  |  |
| `description` | text | YES |  |  |  |  |
| `supplier_id` | integer | YES |  |  |  | suppliers.id |
| `client_id` | integer | YES |  |  |  | clients.id |
| `invoice_id` | integer | YES |  |  |  | invoices.id |
| `amount` | numeric(12,2) | YES |  |  |  |  |
| `currency` | text | YES | 'GBP'::text |  |  |  |
| `tax_year` | text | YES |  |  |  |  |
| `category` | text | YES |  |  |  |  |
| `tags` | ARRAY | YES |  |  |  |  |
| `uploaded_by` | character varying | NO |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### incidents

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('incidents_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `site_id` | integer | YES |  |  |  | sites.id |
| `reported_by` | character varying | YES |  |  |  | users.id |
| `assigned_to` | character varying | YES |  |  |  | users.id |
| `title` | text | NO |  |  |  |  |
| `description` | text | NO |  |  |  |  |
| `severity` | USER-DEFINED | YES | 'medium'::incident_severity |  |  |  |
| `status` | USER-DEFINED | YES | 'reported'::incident_status |  |  |  |
| `incident_date` | timestamp without time zone | YES | now() |  |  |  |
| `resolved_at` | timestamp without time zone | YES |  |  |  |  |
| `resolution` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `incident_ref` | text | YES |  |  |  |  |

### invoice_line_items

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('invoice_line_items_id_seq'::... | PK |  |  |
| `invoice_id` | integer | NO |  |  |  | invoices.id |
| `shift_id` | integer | YES |  |  |  | shifts.id |
| `description` | text | YES |  |  |  |  |
| `hours` | numeric(10,2) | NO |  |  |  |  |
| `rate` | numeric(10,2) | NO |  |  |  |  |
| `subtotal` | numeric(12,2) | NO |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `vat_rate` | numeric(5,2) | YES | '20'::numeric |  |  |  |
| `vat_amount` | numeric(12,2) | YES |  |  |  |  |
| `line_total` | numeric(12,2) | YES |  |  |  |  |
| `charge_rate` | numeric(10,2) | YES |  |  |  |  |
| `charge_amount` | numeric(12,2) | YES |  |  |  |  |
| `original_hours` | numeric(10,2) | YES |  |  |  |  |
| `original_subtotal` | numeric(12,2) | YES |  |  |  |  |

### invoice_number_audit_log

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('invoice_number_audit_log_id_... | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `invoice_id` | integer | NO |  |  |  | invoices.id |
| `old_number` | text | NO |  |  |  |  |
| `new_number` | text | NO |  |  |  |  |
| `series` | text | NO |  |  |  |  |
| `reason` | text | YES |  |  |  |  |
| `changed_at` | timestamp without time zone | YES | now() |  |  |  |

### invoices

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('invoices_id_seq'::regclass) | PK |  |  |
| `id` | integer | NO | nextval('invoices_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `supplier_id` | integer | YES |  |  |  | suppliers.id |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `invoice_number` | text | NO |  |  |  |  |
| `period_start` | date | NO |  |  |  |  |
| `period_end` | date | NO |  |  |  |  |
| `total_hours` | numeric(10,2) | YES |  |  |  |  |
| `hourly_rate` | numeric(10,2) | YES |  |  |  |  |
| `subtotal` | numeric(12,2) | NO |  |  |  |  |
| `vat_rate` | numeric(5,2) | YES | '20'::numeric |  |  |  |
| `vat_amount` | numeric(12,2) | NO |  |  |  |  |
| `total_amount` | numeric(12,2) | NO |  |  |  |  |
| `status` | USER-DEFINED | YES | 'draft'::invoice_status |  |  |  |
| `due_date` | date | YES |  |  |  |  |
| `paid_at` | timestamp without time zone | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `invoice_type` | USER-DEFINED | YES | 'manual'::invoice_type |  |  |  |
| `approved_timesheet_count` | integer | YES |  |  |  |  |
| `billing_period` | text | YES |  |  |  |  |
| `generated_at` | timestamp without time zone | YES |  |  |  |  |
| `paid_by` | character varying | YES |  |  |  | users.id |
| `payment_date` | date | YES |  |  |  |  |
| `issued_at` | timestamp without time zone | YES |  |  |  |  |
| `issued_by` | character varying | YES |  |  |  | users.id |
| `accepted_at` | timestamp without time zone | YES |  |  |  |  |
| `accepted_by_supplier_user_id` | character varying | YES |  |  |  | users.id |

### job_postings

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('job_postings_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `title` | text | NO |  |  |  |  |
| `department` | text | YES |  |  |  |  |
| `location` | text | YES |  |  |  |  |
| `employment_type` | text | YES |  |  |  |  |
| `description` | text | NO |  |  |  |  |
| `requirements` | text | YES |  |  |  |  |
| `hourly_rate` | text | YES |  |  |  |  |
| `site_id` | integer | YES |  |  |  | sites.id |
| `is_active` | boolean | YES | true |  |  |  |
| `closing_date` | date | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `job_ref` | text | YES |  |  |  |  |

### messages

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('messages_id_seq'::regclass) | PK |  |  |
| `channel_id` | integer | NO |  |  |  |  |
| `sender_id` | character varying(255) | NO |  |  |  |  |
| `sender_name` | character varying(255) | NO |  |  |  |  |
| `content` | text | NO |  |  |  |  |
| `is_edited` | boolean | NO | false |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### notifications

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('notifications_id_seq'::regcl... | PK |  |  |
| `user_id` | character varying | NO |  |  |  | users.id |
| `type` | text | NO |  |  |  |  |
| `title` | text | NO |  |  |  |  |
| `body` | text | YES |  |  |  |  |
| `link` | text | YES |  |  |  |  |
| `related_entity_type` | text | YES |  |  |  |  |
| `related_entity_id` | text | YES |  |  |  |  |
| `metadata` | jsonb | YES |  |  |  |  |
| `read_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### onboarding_records

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('onboarding_records_id_seq'::... | PK |  |  |
| `user_id` | character varying | YES |  |  |  | users.id |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `status` | USER-DEFINED | YES | 'invited'::onboarding_status |  |  |  |
| `current_step` | integer | YES | 1 |  |  |  |
| `total_steps` | integer | YES | 10 |  |  |  |
| `personal_details_complete` | boolean | YES | false |  |  |  |
| `contact_details_complete` | boolean | YES | false |  |  |  |
| `emergency_contact_complete` | boolean | YES | false |  |  |  |
| `bank_details_complete` | boolean | YES | false |  |  |  |
| `documents_complete` | boolean | YES | false |  |  |  |
| `vetting_complete` | boolean | YES | false |  |  |  |
| `uniform_complete` | boolean | YES | false |  |  |  |
| `terms_accepted` | boolean | YES | false |  |  |  |
| `terms_accepted_at` | timestamp without time zone | YES |  |  |  |  |
| `submitted_at` | timestamp without time zone | YES |  |  |  |  |
| `reviewed_by` | character varying | YES |  |  |  | users.id |
| `reviewed_at` | timestamp without time zone | YES |  |  |  |  |
| `review_notes` | text | YES |  |  |  |  |
| `completed_at` | timestamp without time zone | YES |  |  |  |  |
| `invite_token` | text | YES |  |  |  |  |
| `invite_expires_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |

### password_reset_tokens

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('password_reset_tokens_id_seq... | PK |  |  |
| `user_id` | character varying | NO |  |  |  | users.id |
| `token` | text | NO |  |  | UNIQUE |  |
| `expires_at` | timestamp without time zone | NO |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### payroll_run_items

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('payroll_run_items_id_seq'::r... | PK |  |  |
| `payroll_run_id` | integer | NO |  |  |  | payroll_runs.id |
| `shift_id` | integer | NO |  |  |  | shifts.id |
| `employee_id` | integer | NO |  |  |  | employees.id |
| `hours` | numeric(10,2) | NO |  |  |  |  |
| `hourly_rate` | numeric(10,2) | NO |  |  |  |  |
| `gross_amount` | numeric(12,2) | NO |  |  |  |  |
| `deductions` | numeric(12,2) | YES | 0 |  |  |  |
| `net_amount` | numeric(12,2) | NO |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### payroll_runs

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('payroll_runs_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `run_code` | text | YES |  |  |  |  |
| `period_start` | date | NO |  |  |  |  |
| `period_end` | date | NO |  |  |  |  |
| `total_hours` | numeric(10,2) | YES | 0 |  |  |  |
| `total_gross` | numeric(12,2) | YES | 0 |  |  |  |
| `total_deductions` | numeric(12,2) | YES | 0 |  |  |  |
| `total_net` | numeric(12,2) | YES | 0 |  |  |  |
| `shift_count` | integer | YES | 0 |  |  |  |
| `employee_count` | integer | YES | 0 |  |  |  |
| `status` | USER-DEFINED | YES | 'draft'::payroll_run_status |  |  |  |
| `finalised_at` | timestamp without time zone | YES |  |  |  |  |
| `finalised_by` | character varying | YES |  |  |  | users.id |
| `paid_at` | timestamp without time zone | YES |  |  |  |  |
| `paid_by` | character varying | YES |  |  |  | users.id |
| `notes` | text | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### purchase_vendors

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('purchase_vendors_id_seq'::re... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `name` | text | NO |  |  |  |  |
| `vat_registered` | boolean | NO | false |  |  |  |
| `vat_number` | text | YES |  |  |  |  |
| `default_expense_category` | text | YES |  |  |  |  |
| `bank_name` | text | YES |  |  |  |  |
| `account_name` | text | YES |  |  |  |  |
| `sort_code` | text | YES |  |  |  |  |
| `account_number` | text | YES |  |  |  |  |
| `is_active` | boolean | NO | true |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |
| `updated_at` | timestamp without time zone | NO | now() |  |  |  |

### rate_card_history

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('rate_card_history_id_seq'::r... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `rate_card_id` | integer | YES |  |  |  | rate_cards.id |
| `change_type` | text | NO |  |  |  |  |
| `role_type` | text | YES |  |  |  |  |
| `site_id` | integer | YES |  |  |  | sites.id |
| `old_hourly_rate` | numeric(10,2) | YES |  |  |  |  |
| `new_hourly_rate` | numeric(10,2) | YES |  |  |  |  |
| `old_overtime_rate` | numeric(10,2) | YES |  |  |  |  |
| `new_overtime_rate` | numeric(10,2) | YES |  |  |  |  |
| `effective_from` | date | YES |  |  |  |  |
| `effective_to` | date | YES |  |  |  |  |
| `changed_by` | character varying | YES |  |  |  | users.id |
| `changed_by_name` | text | YES |  |  |  |  |
| `reason` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### rate_cards

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('rate_cards_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `site_id` | integer | YES |  |  |  | sites.id |
| `role_type` | text | YES |  |  |  |  |
| `hourly_rate` | numeric(10,2) | NO |  |  |  |  |
| `overtime_rate` | numeric(10,2) | YES |  |  |  |  |
| `effective_from` | date | NO |  |  |  |  |
| `effective_to` | date | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `employee_id` | integer | YES |  |  |  | employees.id |

### references

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('references_id_seq'::regclass) | PK |  |  |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `referee_name` | text | NO |  |  |  |  |
| `referee_email` | text | YES |  |  |  |  |
| `referee_phone` | text | YES |  |  |  |  |
| `company` | text | NO |  |  |  |  |
| `job_title` | text | YES |  |  |  |  |
| `relationship` | text | YES |  |  |  |  |
| `date_from` | date | YES |  |  |  |  |
| `date_to` | date | YES |  |  |  |  |
| `status` | USER-DEFINED | YES | 'not_started'::vetting_status |  |  |  |
| `response_received` | boolean | YES | false |  |  |  |
| `response_date` | timestamp without time zone | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### reverse_engineer_log

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('reverse_engineer_log_id_seq'... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `supplier_name` | text | NO |  |  |  |  |
| `payment_month` | text | NO |  |  |  |  |
| `work_month` | text | NO |  |  |  |  |
| `total_payment_amount` | numeric(12,2) | NO |  |  |  |  |
| `hourly_rate_used` | numeric(10,2) | NO |  |  |  |  |
| `hours_generated` | numeric(12,2) | NO |  |  |  |  |
| `shifts_generated` | integer | NO |  |  |  |  |
| `existing_hours_before` | numeric(12,2) | NO |  |  |  |  |
| `existing_shifts_before` | integer | NO |  |  |  |  |
| `shifts_added` | integer | NO |  |  |  |  |
| `status` | USER-DEFINED | NO | 'completed'::reverse_engineer_status |  |  |  |
| `batch_id` | text | NO |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |
| `rolled_back_at` | timestamp without time zone | YES |  |  |  |  |
| `rolled_back_by` | character varying | YES |  |  |  | users.id |

### role_permissions

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('role_permissions_id_seq'::re... | PK |  |  |
| `role` | text | NO |  |  |  |  |
| `permission_key` | text | NO |  |  |  |  |
| `enabled` | boolean | NO | true |  |  |  |
| `updated_at` | timestamp without time zone | NO | now() |  |  |  |

### sessions

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `sid` | character varying | NO |  | PK |  |  |
| `sess` | jsonb | NO |  |  |  |  |
| `expire` | timestamp without time zone | NO |  |  |  |  |

### shifts

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('shifts_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `site_id` | integer | YES |  |  |  | sites.id |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `title` | text | NO |  |  |  |  |
| `date` | date | NO |  |  |  |  |
| `start_time` | text | NO |  |  |  |  |
| `end_time` | text | NO |  |  |  |  |
| `break_minutes` | integer | YES | 0 |  |  |  |
| `status` | USER-DEFINED | YES | 'scheduled'::shift_status |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `check_in_time` | timestamp without time zone | YES |  |  |  |  |
| `check_out_time` | timestamp without time zone | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `supplier_id` | integer | YES |  |  |  | suppliers.id |
| `controller_notes` | text | YES |  |  |  |  |
| `precheck_data` | jsonb | YES |  |  |  |  |
| `last_check_in_lat` | text | YES |  |  |  |  |
| `last_check_in_lng` | text | YES |  |  |  |  |
| `last_check_in_address` | text | YES |  |  |  |  |
| `supplier_approval_status` | USER-DEFINED | YES | 'pending'::supplier_approval_status |  |  |  |
| `supplier_approval_comment` | text | YES |  |  |  |  |
| `supplier_approved_at` | timestamp without time zone | YES |  |  |  |  |
| `supplier_approved_by` | character varying | YES |  |  |  |  |
| `shift_code` | text | YES |  |  |  |  |
| `payroll_status` | USER-DEFINED | YES | 'pending'::payroll_status |  |  |  |
| `payroll_approved_at` | timestamp without time zone | YES |  |  |  |  |
| `payroll_approved_by` | character varying | YES |  |  |  | users.id |
| `payroll_rejected_reason` | text | YES |  |  |  |  |
| `payroll_paid_at` | timestamp without time zone | YES |  |  |  |  |
| `payroll_run_id` | integer | YES |  |  |  |  |
| `booked_on_at` | timestamp without time zone | YES |  |  |  |  |
| `booked_off_at` | timestamp without time zone | YES |  |  |  |  |
| `booked_on_by` | character varying | YES |  |  |  | users.id |
| `booked_off_by` | character varying | YES |  |  |  | users.id |
| `verified_at` | timestamp without time zone | YES |  |  |  |  |
| `verified_by` | character varying | YES |  |  |  | users.id |
| `finance_status` | USER-DEFINED | YES | 'pending'::finance_approval_status |  |  |  |
| `finance_approved_by` | character varying | YES |  |  |  | users.id |
| `finance_approved_at` | timestamp without time zone | YES |  |  |  |  |
| `finance_note` | text | YES |  |  |  |  |
| `late_minutes` | integer | YES | 0 |  |  |  |
| `external_id` | text | YES |  |  |  |  |
| `pay_rate` | numeric(10,2) | YES |  |  |  |  |
| `last_check_out_lat` | text | YES |  |  |  |  |
| `last_check_out_lng` | text | YES |  |  |  |  |
| `last_check_out_address` | text | YES |  |  |  |  |
| `check_in_distance_metres` | numeric(10,2) | YES |  |  |  |  |
| `check_out_distance_metres` | numeric(10,2) | YES |  |  |  |  |

### sites

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('sites_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `name` | text | NO |  |  |  |  |
| `address` | text | NO |  |  |  |  |
| `city` | text | YES |  |  |  |  |
| `postcode` | text | YES |  |  |  |  |
| `latitude` | text | YES |  |  |  |  |
| `longitude` | text | YES |  |  |  |  |
| `client_name` | text | YES |  |  |  |  |
| `client_contact` | text | YES |  |  |  |  |
| `client_email` | text | YES |  |  |  |  |
| `client_phone` | text | YES |  |  |  |  |
| `contract_ref` | text | YES |  |  |  |  |
| `is_active` | boolean | YES | true |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `client_id` | integer | YES |  |  |  | clients.id |
| `site_code` | text | YES |  |  |  |  |
| `external_id` | text | YES |  |  |  |  |
| `shift_patterns` | jsonb | YES |  |  |  |  |

### subscription_plans

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('subscription_plans_id_seq'::... | PK |  |  |
| `name` | text | NO |  |  |  |  |
| `slug` | USER-DEFINED | NO |  |  | UNIQUE |  |
| `price` | text | NO |  |  |  |  |
| `max_employees` | integer | NO |  |  |  |  |
| `max_sites` | integer | NO |  |  |  |  |
| `max_admin_users` | integer | NO |  |  |  |  |
| `features` | jsonb | YES | '[]'::jsonb |  |  |  |
| `is_active` | boolean | YES | true |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### supplier_agreement_archives

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_agreement_archives_... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `supplier_id` | integer | NO |  |  |  |  |
| `agreement_ref` | text | YES |  |  |  |  |
| `signatory_name` | text | YES |  |  |  |  |
| `signatory_position` | text | YES |  |  |  |  |
| `signed_at` | timestamp without time zone | YES |  |  |  |  |
| `expiry_date` | timestamp without time zone | YES |  |  |  |  |
| `signature_data` | text | YES |  |  |  |  |
| `signed_ip` | text | YES |  |  |  |  |
| `archived_at` | timestamp without time zone | NO | now() |  |  |  |
| `archived_reason` | text | YES |  |  |  |  |
| `template_id` | integer | YES |  |  |  |  |
| `buyer_signatory_name` | text | YES |  |  |  |  |
| `buyer_signatory_position` | text | YES |  |  |  |  |
| `buyer_signature_data` | text | YES |  |  |  |  |

### supplier_audit_events

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_audit_events_id_seq... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `event_type` | USER-DEFINED | NO |  |  |  |  |
| `entity_type` | text | YES |  |  |  |  |
| `entity_id` | text | YES |  |  |  |  |
| `actor_user_id` | character varying | YES |  |  |  | users.id |
| `actor_name` | text | YES |  |  |  |  |
| `actor_role` | text | YES |  |  |  |  |
| `summary` | text | NO |  |  |  |  |
| `old_values` | jsonb | YES |  |  |  |  |
| `new_values` | jsonb | YES |  |  |  |  |
| `metadata` | jsonb | YES |  |  |  |  |
| `ip_address` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### supplier_document_audit

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_document_audit_id_s... | PK |  |  |
| `document_id` | integer | NO |  |  |  | supplier_documents.id |
| `action` | USER-DEFINED | NO |  |  |  |  |
| `user_id` | character varying | YES |  |  |  | users.id |
| `details` | jsonb | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### supplier_documents

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_documents_id_seq'::... | PK |  |  |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `document_type` | USER-DEFINED | NO |  |  |  |  |
| `file_name` | text | NO |  |  |  |  |
| `file_url` | text | NO |  |  |  |  |
| `file_size` | integer | YES |  |  |  |  |
| `mime_type` | text | YES |  |  |  |  |
| `version` | integer | YES | 1 |  |  |  |
| `uploaded_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `status` | USER-DEFINED | YES | 'pending'::supplier_document_status |  |  |  |
| `rejection_reason` | text | YES |  |  |  |  |
| `reviewed_by` | character varying | YES |  |  |  | users.id |
| `reviewed_at` | timestamp without time zone | YES |  |  |  |  |
| `display_name` | text | YES |  |  |  |  |
| `expiry_date` | date | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |

### supplier_field_requests

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_field_requests_id_s... | PK |  |  |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `field_key` | text | NO |  |  |  |  |
| `message` | text | YES |  |  |  |  |
| `requested_by` | character varying | NO |  |  |  | users.id |
| `requested_at` | timestamp without time zone | YES | now() |  |  |  |
| `completed_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### supplier_invitations

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_invitations_id_seq'... | PK |  |  |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `email` | text | NO |  |  |  |  |
| `token` | text | NO |  |  | UNIQUE |  |
| `expires_at` | timestamp without time zone | NO |  |  |  |  |
| `accepted_at` | timestamp without time zone | YES |  |  |  |  |
| `reminder_sent_at` | timestamp without time zone | YES |  |  |  |  |
| `created_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### supplier_login_activity

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_login_activity_id_s... | PK |  |  |
| `user_id` | character varying | NO |  |  |  | users.id |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `ip_address` | text | YES |  |  |  |  |
| `user_agent` | text | YES |  |  |  |  |
| `location` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### supplier_pending_changes

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_pending_changes_id_... | PK |  |  |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `user_id` | character varying | NO |  |  |  | users.id |
| `payload` | jsonb | NO |  |  |  |  |
| `status` | USER-DEFINED | YES | 'pending'::supplier_pending_change_st... |  |  |  |
| `reviewed_by` | character varying | YES |  |  |  | users.id |
| `reviewed_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### supplier_policies

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_policies_id_seq'::r... | PK |  |  |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `policy_type` | text | NO |  |  |  |  |
| `file_name` | text | NO |  |  |  |  |
| `file_url` | text | NO |  |  |  |  |
| `file_size` | integer | YES |  |  |  |  |
| `mime_type` | text | YES |  |  |  |  |
| `issue_date` | date | YES |  |  |  |  |
| `expiry_date` | date | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `version` | integer | YES | 1 |  |  |  |
| `uploaded_by` | character varying | YES |  |  |  | users.id |
| `status` | USER-DEFINED | YES | 'pending'::supplier_policy_status |  |  |  |
| `rejection_reason` | text | YES |  |  |  |  |
| `reviewed_by` | character varying | YES |  |  |  | users.id |
| `reviewed_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### supplier_profile_change_log

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('supplier_profile_change_log_... | PK |  |  |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `user_id` | character varying | NO |  |  |  | users.id |
| `action` | text | NO |  |  |  |  |
| `field_changes` | jsonb | YES |  |  |  |  |
| `pending_change_id` | integer | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |

### suppliers

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('suppliers_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `company_name` | text | NO |  |  |  |  |
| `contact_name` | text | NO |  |  |  |  |
| `email` | text | NO |  |  |  |  |
| `phone` | text | YES |  |  |  |  |
| `address` | text | YES |  |  |  |  |
| `city` | text | YES |  |  |  |  |
| `postcode` | text | YES |  |  |  |  |
| `vat_number` | text | YES |  |  |  |  |
| `company_reg_number` | text | YES |  |  |  |  |
| `bank_name` | text | YES |  |  |  |  |
| `sort_code` | text | YES |  |  |  |  |
| `account_number` | text | YES |  |  |  |  |
| `status` | USER-DEFINED | YES | 'draft'::supplier_status |  |  |  |
| `approved_by` | character varying | YES |  |  |  | users.id |
| `approved_at` | timestamp without time zone | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `supplier_type` | USER-DEFINED | YES |  |  |  |  |
| `registered_office_address` | text | YES |  |  |  |  |
| `registered_office_city` | text | YES |  |  |  |  |
| `registered_office_postcode` | text | YES |  |  |  |  |
| `registered_office_country` | text | YES |  |  |  |  |
| `trading_same_as_registered` | boolean | YES | true |  |  |  |
| `trading_address` | text | YES |  |  |  |  |
| `trading_city` | text | YES |  |  |  |  |
| `trading_postcode` | text | YES |  |  |  |  |
| `finance_contact_name` | text | YES |  |  |  |  |
| `finance_contact_email` | text | YES |  |  |  |  |
| `nature_of_supply` | text | YES |  |  |  |  |
| `vat_status` | text | YES |  |  |  |  |
| `non_vat_reason` | text | YES |  |  |  |  |
| `non_vat_declaration_accepted` | boolean | YES | false |  |  |  |
| `company_category` | text | YES |  |  |  |  |
| `company_status` | text | YES |  |  |  |  |
| `country_of_origin` | text | YES |  |  |  |  |
| `incorporation_date` | text | YES |  |  |  |  |
| `sic_codes` | text | YES |  |  |  |  |
| `accounts_next_due` | text | YES |  |  |  |  |
| `accounts_last_made_up_date` | text | YES |  |  |  |  |
| `account_category` | text | YES |  |  |  |  |
| `accounts_account_ref_day` | text | YES |  |  |  |  |
| `accounts_account_ref_month` | text | YES |  |  |  |  |
| `returns_next_due` | text | YES |  |  |  |  |
| `returns_last_made_up_date` | text | YES |  |  |  |  |
| `previous_names` | jsonb | YES |  |  |  |  |
| `mortgages` | jsonb | YES |  |  |  |  |
| `account_name` | text | YES |  |  |  |  |
| `submitted_at` | timestamp without time zone | YES |  |  |  |  |
| `submitted_by` | character varying | YES |  |  |  | users.id |
| `info_required_notes` | text | YES |  |  |  |  |
| `info_required_at` | timestamp without time zone | YES |  |  |  |  |
| `info_required_by` | character varying | YES |  |  |  | users.id |
| `suspension_reason` | text | YES |  |  |  |  |
| `suspended_at` | timestamp without time zone | YES |  |  |  |  |
| `suspended_by` | character varying | YES |  |  |  | users.id |
| `portal_access_enabled` | boolean | YES | false |  |  |  |
| `portal_email` | text | YES |  |  |  |  |
| `user_id` | character varying | YES |  |  |  | users.id |
| `created_by` | character varying | YES |  |  |  | users.id |
| `who_employs_workers` | text | YES |  |  |  |  |
| `umbrella_name` | text | YES |  |  |  |  |
| `umbrella_crn` | text | YES |  |  |  |  |
| `subcontractor_name` | text | YES |  |  |  |  |
| `subcontractor_crn` | text | YES |  |  |  |  |
| `subcontracting_yes` | boolean | YES | false |  |  |  |
| `paye_compliance` | boolean | YES | false |  |  |  |
| `rtw_compliance` | boolean | YES | false |  |  |  |
| `nmw_compliance` | boolean | YES | false |  |  |  |
| `last_review_at` | timestamp without time zone | YES |  |  |  |  |
| `last_review_by` | character varying | YES |  |  |  | users.id |
| `next_review_due_at` | timestamp without time zone | YES |  |  |  |  |
| `self_billing_agreement_status` | text | YES | 'none'::text |  |  |  |
| `self_billing_signatory_name` | text | YES |  |  |  |  |
| `self_billing_signatory_position` | text | YES |  |  |  |  |
| `self_billing_accepted_at` | timestamp without time zone | YES |  |  |  |  |
| `self_billing_expiry_date` | timestamp without time zone | YES |  |  |  |  |
| `self_billing_agreement_ref` | text | YES |  |  |  |  |
| `billing_frequency` | text | YES | 'monthly'::text |  |  |  |
| `default_vat_rate` | numeric(5,2) | YES | '20'::numeric |  |  |  |
| `supplier_code` | text | YES |  |  |  |  |
| `self_billing_signature_data` | text | YES |  |  |  |  |
| `self_billing_signed_ip` | text | YES |  |  |  |  |
| `external_id` | text | YES |  |  |  |  |
| `ip_pool` | ARRAY | YES |  |  |  |  |
| `agreement_registered_address` | text | YES |  |  |  |  |
| `agreement_registered_city` | text | YES |  |  |  |  |
| `agreement_registered_postcode` | text | YES |  |  |  |  |
| `agreement_registered_country` | text | YES |  |  |  |  |
| `rate_type` | text | YES | 'rate_card'::text |  |  |  |
| `vat_registered_from` | text | YES |  |  |  |  |

### sync_configurations

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('sync_configurations_id_seq':... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `name` | text | NO |  |  |  |  |
| `api_base_url` | text | NO |  |  |  |  |
| `api_key_encrypted` | text | NO |  |  |  |  |
| `sync_entities` | ARRAY | YES | ARRAY['employees'::text, 'sites'::tex... |  |  |  |
| `last_sync_at` | timestamp without time zone | YES |  |  |  |  |
| `is_active` | boolean | NO | true |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |
| `updated_at` | timestamp without time zone | NO | now() |  |  |  |
| `connection_type` | text | NO | 'rest'::text |  |  |  |

### sync_logs

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('sync_logs_id_seq'::regclass) | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `config_id` | integer | NO |  |  |  | sync_configurations.id |
| `sync_type` | text | NO |  |  |  |  |
| `status` | text | NO | 'running'::text |  |  |  |
| `records_created` | integer | YES | 0 |  |  |  |
| `records_updated` | integer | YES | 0 |  |  |  |
| `records_skipped` | integer | YES | 0 |  |  |  |
| `records_failed` | integer | YES | 0 |  |  |  |
| `errors` | jsonb | YES |  |  |  |  |
| `started_at` | timestamp without time zone | NO | now() |  |  |  |
| `completed_at` | timestamp without time zone | YES |  |  |  |  |

### tenant_addons

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('tenant_addons_id_seq'::regcl... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  |  |
| `addon_key` | text | NO |  |  |  |  |
| `addon_name` | text | NO |  |  |  |  |
| `status` | text | NO | 'inactive'::text |  |  |  |
| `stripe_product_id` | text | YES |  |  |  |  |
| `stripe_price_id` | text | YES |  |  |  |  |
| `stripe_subscription_id` | text | YES |  |  |  |  |
| `stripe_customer_id` | text | YES |  |  |  |  |
| `purchased_at` | timestamp without time zone | YES |  |  |  |  |
| `expires_at` | timestamp without time zone | YES |  |  |  |  |
| `purchased_by_user_id` | character varying | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |

### tenant_invitations

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('tenant_invitations_id_seq'::... | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `email` | text | NO |  |  |  |  |
| `first_name` | text | YES |  |  |  |  |
| `last_name` | text | YES |  |  |  |  |
| `role` | USER-DEFINED | NO | 'employee'::user_role |  |  |  |
| `token` | text | NO |  |  | UNIQUE |  |
| `invited_by` | character varying | YES |  |  |  | users.id |
| `accepted_at` | timestamp without time zone | YES |  |  |  |  |
| `expires_at` | timestamp without time zone | NO |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `status` | text | NO | 'pending'::text |  |  |  |

### tenants

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('tenants_id_seq'::regclass) | PK |  |  |
| `name` | text | NO |  |  |  |  |
| `slug` | text | NO |  |  | UNIQUE |  |
| `industry` | text | YES | 'security'::text |  |  |  |
| `address` | text | YES |  |  |  |  |
| `phone` | text | YES |  |  |  |  |
| `email` | text | YES |  |  |  |  |
| `vat_number` | text | YES |  |  |  |  |
| `company_reg_number` | text | YES |  |  |  |  |
| `logo_url` | text | YES |  |  |  |  |
| `is_active` | boolean | YES | true |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `trading_name` | text | YES |  |  |  |  |
| `address_line_1` | text | YES |  |  |  |  |
| `address_line_2` | text | YES |  |  |  |  |
| `city` | text | YES |  |  |  |  |
| `county` | text | YES |  |  |  |  |
| `postcode` | text | YES |  |  |  |  |
| `website` | text | YES |  |  |  |  |
| `company_status` | text | YES |  |  |  |  |
| `sia_acs_number` | text | YES |  |  |  |  |
| `subdomain` | text | YES |  |  | UNIQUE |  |
| `plan_id` | integer | YES |  |  |  |  |
| `trial_ends_at` | timestamp without time zone | YES |  |  |  |  |
| `onboarding_completed` | boolean | YES | false |  |  |  |
| `self_billing_signatory_name` | text | YES |  |  |  |  |
| `self_billing_signatory_position` | text | YES |  |  |  |  |
| `self_billing_signature_data` | text | YES |  |  |  |  |
| `self_billing_signature_date` | timestamp without time zone | YES |  |  |  |  |
| `vat_calculation_type` | text | YES | 'accrual'::text |  |  |  |
| `checkin_time_window_minutes` | integer | YES | 10 |  |  |  |
| `geofence_radius_metres` | integer | YES | 200 |  |  |  |

### users

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | character varying | NO | gen_random_uuid() | PK |  |  |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `username` | text | NO |  |  | UNIQUE |  |
| `email` | text | NO |  |  | UNIQUE |  |
| `password` | text | NO |  |  |  |  |
| `first_name` | text | NO |  |  |  |  |
| `last_name` | text | NO |  |  |  |  |
| `role` | USER-DEFINED | NO | 'employee'::user_role |  |  |  |
| `phone` | text | YES |  |  |  |  |
| `profile_image_url` | text | YES |  |  |  |  |
| `is_active` | boolean | YES | true |  |  |  |
| `last_login_at` | timestamp without time zone | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |
| `failed_login_attempts` | integer | YES | 0 |  |  |  |
| `locked_until` | timestamp without time zone | YES |  |  |  |  |
| `password_changed_at` | timestamp without time zone | YES |  |  |  |  |

### vat_verifications

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('vat_verifications_id_seq'::r... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `supplier_id` | integer | NO |  |  |  | suppliers.id |
| `vat_number` | text | NO |  |  |  |  |
| `verification_result` | text | NO |  |  |  |  |
| `verification_method` | text | YES | 'manual'::text |  |  |  |
| `verified_by` | character varying | YES |  |  |  | users.id |
| `verified_by_name` | text | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | NO | now() |  |  |  |

### vendor_classifications

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('vendor_classifications_id_se... | PK |  |  |
| `tenant_id` | integer | NO |  |  |  | tenants.id |
| `vendor_name` | text | NO |  |  |  |  |
| `vat_qualifying` | boolean | YES |  |  |  |  |
| `expense_category` | text | YES |  |  |  |  |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |

### vetting_records

| Column | Type | Nullable | Default | PK | Unique | References |
|--------|------|----------|---------|-----|--------|------------|
| `id` | integer | NO | nextval('vetting_records_id_seq'::reg... | PK |  |  |
| `employee_id` | integer | YES |  |  |  | employees.id |
| `tenant_id` | integer | YES |  |  |  | tenants.id |
| `check_type` | text | NO |  |  |  |  |
| `status` | USER-DEFINED | YES | 'not_started'::vetting_status |  |  |  |
| `reference_number` | text | YES |  |  |  |  |
| `requested_date` | date | YES |  |  |  |  |
| `completed_date` | date | YES |  |  |  |  |
| `expiry_date` | date | YES |  |  |  |  |
| `result` | text | YES |  |  |  |  |
| `notes` | text | YES |  |  |  |  |
| `conducted_by` | character varying | YES |  |  |  | users.id |
| `created_at` | timestamp without time zone | YES | now() |  |  |  |
| `updated_at` | timestamp without time zone | YES | now() |  |  |  |

---

## Key Relationships

### Multi-Tenancy
Most tables include a `tenant_id` column referencing `tenants.id`.
All queries must filter by `tenant_id` to ensure data isolation between tenants.

### Core Entity Hierarchy
```
tenants
  ├── users (tenant_id → tenants.id)
  ├── suppliers (tenant_id → tenants.id)
  │     ├── employees (supplier_id → suppliers.id)
  │     ├── invoices (supplier_id → suppliers.id)
  │     │     └── invoice_line_items (invoice_id → invoices.id)
  │     ├── rate_cards (supplier_id → suppliers.id)
  │     ├── shifts (supplier_id → suppliers.id)
  │     ├── credit_notes (supplier_id → suppliers.id)
  │     ├── debit_notes (supplier_id → suppliers.id)
  │     └── supplier_documents (supplier_id → suppliers.id)
  ├── clients (tenant_id → tenants.id)
  │     ├── sites (client_id → clients.id)
  │     ├── client_rate_cards (client_id → clients.id)
  │     └── client_invoices (client_id → clients.id)
  ├── employees (tenant_id → tenants.id)
  │     ├── bank_details (employee_id → employees.id)
  │     ├── emergency_contacts (employee_id → employees.id)
  │     └── vetting_records (employee_id → employees.id)
  ├── shifts (tenant_id → tenants.id)
  │     └── linked to sites, employees, suppliers
  ├── bank_transactions (tenant_id → tenants.id)
  │     └── bank_transaction_allocations (bank_transaction_id)
  └── payroll_runs (tenant_id → tenants.id)
        └── payroll_run_items (payroll_run_id)
```

### Data Sync Notes

- Many tables include an `external_id` column for mapping to external system IDs.
  Use this field when syncing data to avoid creating duplicates.
- Tables with `external_id`: `employees`, `sites`, `clients`, `shifts`, `suppliers`
- Always include `tenant_id` when creating or querying records.
- Invoice numbers follow the pattern: `SBI-{SUPPLIER_CODE}-{YYYYMM}-{SUPPLIER_ID}`
- Shift codes follow the pattern: `SHF-{NNNNN}` (tenant-scoped sequential)
- Employee numbers follow: `EMP-{NNNNN}` (tenant-scoped sequential)

## API Endpoints for Data Sync

All endpoints require authentication. Include `tenant_id` context via the authenticated session.

### Core CRUD Endpoints

| Entity | List | Get | Create | Update | Delete |
|--------|------|-----|--------|--------|--------|
| Suppliers | `GET /api/suppliers` | `GET /api/suppliers/:id` | `POST /api/suppliers` | `PATCH /api/suppliers/:id` | `DELETE /api/suppliers/:id` |
| Employees | `GET /api/admin/employees` | `GET /api/admin/employees/:id` | `POST /api/admin/employees` | `PATCH /api/admin/employees/:id` | - |
| Clients | `GET /api/clients` | `GET /api/clients/:id` | `POST /api/clients` | `PATCH /api/clients/:id` | `DELETE /api/clients/:id` |
| Sites | `GET /api/sites` | `GET /api/sites/:id` | `POST /api/sites` | `PATCH /api/sites/:id` | `DELETE /api/sites/:id` |
| Shifts | `GET /api/shifts` | `GET /api/shifts/:id` | `POST /api/shifts` | `PATCH /api/shifts/:id` | `DELETE /api/shifts/:id` |
| Invoices | `GET /api/invoices` | `GET /api/invoices/:id` | `POST /api/invoices/generate` | `PATCH /api/invoices/:id` | `DELETE /api/invoices/:id` |
| Rate Cards | `GET /api/rate-cards/supplier/:id` | - | `POST /api/rate-cards` | `PATCH /api/rate-cards/:id` | `DELETE /api/rate-cards/:id` |

### Bulk Operations

| Endpoint | Description |
|----------|-------------|
| `POST /api/shifts/bulk-create` | Create up to 100 shifts at once |
| `POST /api/shifts/bulk-delete` | Delete up to 100 shifts at once |
| `POST /api/shifts/bulk-complete` | Mark multiple shifts as completed |
| `POST /api/sites/bulk-delete` | Delete up to 100 sites at once |
| `POST /api/invoices/bulk-delete` | Delete multiple invoices |

### Data Import

| Endpoint | Description |
|----------|-------------|
| `POST /api/data-import/suppliers` | Import suppliers from CSV/JSON |
| `POST /api/data-import/employees` | Import employees from CSV/JSON |
| `POST /api/data-import/shifts` | Import shifts from CSV/JSON |
| `POST /api/data-import/sites` | Import sites from CSV/JSON |
