# External Staff Management System — REST API Specification

This document specifies the REST API that your external staff management system needs to implement so that Gardeo can automatically sync employees, sites, clients, suppliers, and shifts/timesheets.

---

## Quick Start

1. Implement the endpoints listed below
2. Secure them with an API key (see Authentication)
3. Share the base URL and API key with your Gardeo administrator
4. Gardeo will call these endpoints to pull data on-demand or on a schedule

---

## Base URL

All endpoints are relative to your base URL. For example:

```
https://your-system.example.com/api
```

---

## Authentication

Every request from Gardeo will include an API key in the header:

```
X-API-Key: your-secret-api-key-here
```

Your API should:
- Validate this key on every request
- Return `401 Unauthorized` if the key is missing or invalid

---

## Common Patterns

### Pagination

All list endpoints must support pagination:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number (1-based) |
| `per_page` | integer | 200 | Records per page (max 500) |

**Response format:**

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "per_page": 200,
    "total_records": 1523,
    "total_pages": 8
  }
}
```

### Incremental Sync

All list endpoints should support a `modified_since` query parameter to enable incremental syncing (only pulling records that changed since the last sync):

| Parameter | Type | Description |
|-----------|------|-------------|
| `modified_since` | ISO 8601 datetime | Only return records created or modified after this timestamp |

Example: `GET /api/employees?modified_since=2024-06-15T10:30:00Z`

### Error Responses

Return errors in this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description of what went wrong"
  }
}
```

Standard HTTP status codes:
- `200` — Success
- `400` — Bad request (invalid parameters)
- `401` — Unauthorized (invalid or missing API key)
- `404` — Resource not found
- `500` — Internal server error

---

## Endpoints

### 1. Health Check

**`GET /api/health`**

Used by Gardeo to test the connection. Should return quickly.

**Response (200):**

```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2024-06-15T10:30:00Z"
}
```

---

### 2. Employees

**`GET /api/employees`**

Returns all employees/staff members.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Records per page |
| `modified_since` | ISO 8601 | Only modified records |

**Response (200):**

```json
{
  "data": [
    {
      "id": "EMP-001",
      "firstName": "John",
      "lastName": "Smith",
      "email": "john.smith@example.com",
      "phone": "07700900123",
      "dateOfBirth": "1990-05-15",
      "nationalInsurance": "AB123456C",
      "addressLine1": "123 High Street",
      "addressLine2": "Flat 4",
      "city": "London",
      "postcode": "SW1A 1AA",
      "jobTitle": "Security Officer",
      "employeeNumber": "E001",
      "siaLicenseNumber": "1234567890123456",
      "siaExpiryDate": "2025-12-31",
      "dbsCertificateNumber": "DBS123456",
      "supplierId": "SUP-001",
      "status": "active",
      "startDate": "2023-01-15",
      "modifiedAt": "2024-06-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "per_page": 200,
    "total_records": 450,
    "total_pages": 3
  }
}
```

**Field Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID in your system (used as `externalId` in Gardeo) |
| `firstName` | string | Yes | First name |
| `lastName` | string | Yes | Last name |
| `email` | string | Yes | Email address (used for matching) |
| `phone` | string | No | Phone number |
| `dateOfBirth` | date (YYYY-MM-DD) | No | Date of birth |
| `nationalInsurance` | string | No | NI number |
| `addressLine1` | string | No | Address line 1 |
| `addressLine2` | string | No | Address line 2 |
| `city` | string | No | City |
| `postcode` | string | No | UK postcode |
| `jobTitle` | string | No | Job title / role |
| `employeeNumber` | string | No | Your internal employee number |
| `siaLicenseNumber` | string | No | SIA licence number |
| `siaExpiryDate` | date (YYYY-MM-DD) | No | SIA licence expiry |
| `dbsCertificateNumber` | string | No | DBS certificate number |
| `supplierId` | string | No | The supplier this employee belongs to (must match a supplier `id`) |
| `status` | string | No | "active" or "inactive" |
| `startDate` | date (YYYY-MM-DD) | No | Employment start date |
| `modifiedAt` | ISO 8601 | Yes | When this record was last modified |

---

### 3. Sites / Locations

**`GET /api/sites`**

Returns all work sites and locations.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Records per page |
| `modified_since` | ISO 8601 | Only modified records |

**Response (200):**

```json
{
  "data": [
    {
      "id": "SITE-001",
      "name": "Broadway Shopping Centre",
      "address": "1 Broadway, Hammersmith",
      "city": "London",
      "postcode": "W6 9YE",
      "latitude": 51.4932,
      "longitude": -0.2249,
      "clientId": "CLT-001",
      "contractRef": "CON-2024-001",
      "status": "active",
      "modifiedAt": "2024-06-15T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Field Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID in your system |
| `name` | string | Yes | Site name |
| `address` | string | Yes | Full address |
| `city` | string | No | City |
| `postcode` | string | No | UK postcode |
| `latitude` | number | No | GPS latitude |
| `longitude` | number | No | GPS longitude |
| `clientId` | string | No | The client this site belongs to (must match a client `id`) |
| `contractRef` | string | No | Contract reference number |
| `status` | string | No | "active" or "inactive" |
| `modifiedAt` | ISO 8601 | Yes | When this record was last modified |

---

### 4. Clients

**`GET /api/clients`**

Returns all client companies.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Records per page |
| `modified_since` | ISO 8601 | Only modified records |

**Response (200):**

```json
{
  "data": [
    {
      "id": "CLT-001",
      "companyName": "Westfield Group",
      "contactName": "Sarah Johnson",
      "contactEmail": "sarah@westfield.com",
      "contactPhone": "02071234567",
      "address": "1 Ariel Way, London",
      "postcode": "W12 7GF",
      "companyRegNumber": "12345678",
      "contractRef": "CON-2024-001",
      "status": "active",
      "modifiedAt": "2024-06-15T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Field Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID in your system |
| `companyName` | string | Yes | Company name |
| `contactName` | string | No | Primary contact name |
| `contactEmail` | string | No | Contact email |
| `contactPhone` | string | No | Contact phone |
| `address` | string | Yes | Registered address |
| `postcode` | string | No | UK postcode |
| `companyRegNumber` | string | No | Companies House registration number |
| `contractRef` | string | No | Contract reference |
| `status` | string | No | "active" or "inactive" |
| `modifiedAt` | ISO 8601 | Yes | When this record was last modified |

---

### 5. Suppliers

**`GET /api/suppliers`**

Returns all supplier companies (labour providers, subcontractors).

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Records per page |
| `modified_since` | ISO 8601 | Only modified records |

**Response (200):**

```json
{
  "data": [
    {
      "id": "SUP-001",
      "companyName": "Alliance Security Services Ltd",
      "contactName": "James Wilson",
      "email": "james@alliancesecurity.co.uk",
      "phone": "07700900456",
      "supplierType": "labour",
      "vatNumber": "GB841672620",
      "companyRegNumber": "SC654321",
      "address": "10 Union Street, Glasgow",
      "postcode": "G1 3QA",
      "bankName": "Barclays",
      "accountName": "Alliance Security Services Ltd",
      "accountNumber": "12345678",
      "sortCode": "20-00-00",
      "onboardingDate": "2023-06-01",
      "status": "active",
      "modifiedAt": "2024-06-15T10:30:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Field Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID in your system |
| `companyName` | string | Yes | Company name |
| `contactName` | string | Yes | Primary contact name |
| `email` | string | Yes | Contact email |
| `phone` | string | No | Phone number |
| `supplierType` | string | No | "labour" or "non_labour" |
| `vatNumber` | string | No | VAT registration number (e.g. GB841672620) |
| `companyRegNumber` | string | No | Companies House number |
| `address` | string | No | Registered address |
| `postcode` | string | No | UK postcode |
| `bankName` | string | No | Bank name |
| `accountName` | string | No | Bank account name |
| `accountNumber` | string | No | Bank account number |
| `sortCode` | string | No | Sort code (format: XX-XX-XX) |
| `onboardingDate` | date (YYYY-MM-DD) | No | When supplier was onboarded |
| `status` | string | No | "active" or "inactive" |
| `modifiedAt` | ISO 8601 | Yes | When this record was last modified |

---

### 6. Shifts / Timesheets

**`GET /api/shifts`**

Returns shift/timesheet records. Supports date range filtering in addition to the standard pagination and incremental sync.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `per_page` | integer | Records per page |
| `modified_since` | ISO 8601 | Only modified records |
| `date_from` | date (YYYY-MM-DD) | Only shifts on or after this date |
| `date_to` | date (YYYY-MM-DD) | Only shifts on or before this date |

**Response (200):**

```json
{
  "data": [
    {
      "id": "SHIFT-001",
      "employeeId": "EMP-001",
      "siteId": "SITE-001",
      "supplierId": "SUP-001",
      "clientId": "CLT-001",
      "date": "2024-06-15",
      "startTime": "08:00",
      "endTime": "20:00",
      "hoursWorked": 12.0,
      "hourlyRate": 12.50,
      "status": "completed",
      "notes": "",
      "modifiedAt": "2024-06-15T21:00:00Z"
    }
  ],
  "pagination": { ... }
}
```

**Field Reference:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique ID in your system (used as `shiftExternalId` in Gardeo) |
| `employeeId` | string | No | Employee ID (must match an employee `id`) |
| `siteId` | string | No | Site ID (must match a site `id`) |
| `supplierId` | string | No | Supplier ID (must match a supplier `id`) |
| `clientId` | string | No | Client ID (must match a client `id`) |
| `date` | date (YYYY-MM-DD) | Yes | Shift date |
| `startTime` | time (HH:MM) | Yes | Shift start time (24-hour format) |
| `endTime` | time (HH:MM) | Yes | Shift end time (24-hour format) |
| `hoursWorked` | number | No | Total hours worked (calculated from start/end if not provided) |
| `hourlyRate` | number | No | Pay rate per hour |
| `status` | string | No | "scheduled", "in_progress", "completed", "cancelled" |
| `notes` | string | No | Any notes about the shift |
| `modifiedAt` | ISO 8601 | Yes | When this record was last modified |

---

## Implementation Checklist

- [ ] **Health check** (`GET /api/health`) — returns `{"status": "ok"}`
- [ ] **API key authentication** — validate `X-API-Key` header on all requests
- [ ] **Employees endpoint** (`GET /api/employees`) with pagination + `modified_since`
- [ ] **Sites endpoint** (`GET /api/sites`) with pagination + `modified_since`
- [ ] **Clients endpoint** (`GET /api/clients`) with pagination + `modified_since`
- [ ] **Suppliers endpoint** (`GET /api/suppliers`) with pagination + `modified_since`
- [ ] **Shifts endpoint** (`GET /api/shifts`) with pagination + `modified_since` + `date_from`/`date_to`
- [ ] **Error handling** — consistent error response format
- [ ] **HTTPS** — serve API over HTTPS in production
- [ ] **`modifiedAt` tracking** — update this timestamp whenever a record changes

## Important Notes

1. **IDs must be stable** — The `id` field for each record must never change. Gardeo uses these as `externalId` to match records across syncs.
2. **Include all records** — When `modified_since` is not provided, return all records (paginated). This is used for the initial full sync.
3. **Deleted records** — If you soft-delete records, include them with `status: "inactive"` so Gardeo can update accordingly. If you hard-delete, Gardeo will simply keep the last known version.
4. **Times are local** — `startTime` and `endTime` should be in local UK time. `modifiedAt` should be in UTC (ISO 8601 with Z suffix).
5. **Cross-references** — Fields like `supplierId` on employees and `clientId` on sites should use the same `id` values returned by the respective endpoints.
