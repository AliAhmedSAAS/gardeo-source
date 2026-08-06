import { storage } from "./storage";
import crypto from "crypto";
import { pool } from "./db";

const activePollers = new Map<number, ReturnType<typeof setInterval>>();
const syncLocks = new Set<number>();

const ENCRYPTION_KEY = process.env.XERO_ENCRYPTION_KEY || process.env.JWT_SECRET;
if (!ENCRYPTION_KEY) {
  throw new Error("[Xero] Missing required encryption key. Set XERO_ENCRYPTION_KEY (or JWT_SECRET as fallback) before starting the server.");
}

function getEncryptionKey(): Buffer {
  return crypto.createHash("sha256").update(ENCRYPTION_KEY!).digest();
}

export function encryptXeroSecret(plainText: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptXeroSecret(encryptedText: string): string {
  if (!encryptedText) return "";
  const parts = encryptedText.split(":");
  if (parts.length < 2) return encryptedText;
  try {
    const iv = Buffer.from(parts[0], "hex");
    const encrypted = parts.slice(1).join(":");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (decryptErr: any) {
    console.error("[Xero] Failed to decrypt secret — returning raw value (token may be invalid):", decryptErr.message);
    return encryptedText;
  }
}

export function generateXeroAuthUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email accounting.transactions accounting.contacts accounting.settings offline_access",
    state,
  });
  return `https://login.xero.com/identity/connect/authorize?${params.toString()}`;
}

async function exchangeCodeForTokens(
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xero token exchange failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in || 1800,
  };
}

async function refreshXeroTokens(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://identity.xero.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Xero token refresh failed: ${res.status} ${err}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 1800,
  };
}

async function getXeroTenants(accessToken: string): Promise<Array<{ tenantId: string; tenantName: string }>> {
  const res = await fetch("https://api.xero.com/connections", {
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Failed to get Xero tenants: ${res.status}`);
  const data = await res.json();
  return (data as any[]).map((t: any) => ({ tenantId: t.tenantId, tenantName: t.tenantName }));
}

export async function completeXeroOAuth(
  gardeoTenantId: number,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
  userId: string
): Promise<{ xeroTenantId: string; xeroTenantName: string }> {
  const conn = await storage.getTenantXeroConnection(gardeoTenantId);
  const decryptedClientId = decryptXeroSecret(conn?.clientId || clientId);
  const decryptedClientSecret = decryptXeroSecret(conn?.clientSecret || clientSecret);

  const tokens = await exchangeCodeForTokens(decryptedClientId, decryptedClientSecret, code, redirectUri);
  const tenants = await getXeroTenants(tokens.accessToken);
  if (tenants.length === 0) throw new Error("No Xero organisations found for this account");

  const xeroTenant = tenants[0];
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

  await storage.upsertTenantXeroConnection(gardeoTenantId, {
    accessToken: encryptXeroSecret(tokens.accessToken),
    refreshToken: encryptXeroSecret(tokens.refreshToken),
    tokenExpiresAt: expiresAt,
    xeroTenantId: xeroTenant.tenantId,
    xeroTenantName: xeroTenant.tenantName,
    connectionStatus: "connected",
    connectedBy: userId,
    lastError: null,
    oauthState: null,
  });

  return xeroTenant;
}

async function getValidAccessToken(gardeoTenantId: number): Promise<{ accessToken: string; xeroTenantId: string }> {
  const conn = await storage.getTenantXeroConnection(gardeoTenantId);
  if (!conn || conn.connectionStatus !== "connected") throw new Error("Xero not connected");
  if (!conn.xeroTenantId) throw new Error("No Xero tenant ID");

  const clientId = decryptXeroSecret(conn.clientId);
  const clientSecret = decryptXeroSecret(conn.clientSecret);
  let accessToken = decryptXeroSecret(conn.accessToken || "");

  const bufferMs = 5 * 60 * 1000;
  const needsRefresh = !conn.tokenExpiresAt || new Date(conn.tokenExpiresAt).getTime() - Date.now() < bufferMs;
  if (needsRefresh) {
    const refreshToken = decryptXeroSecret(conn.refreshToken || "");
    if (!refreshToken) throw new Error("No refresh token available");
    const tokens = await refreshXeroTokens(clientId, clientSecret, refreshToken);
    accessToken = tokens.accessToken;
    const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
    await storage.upsertTenantXeroConnection(gardeoTenantId, {
      accessToken: encryptXeroSecret(tokens.accessToken),
      refreshToken: encryptXeroSecret(tokens.refreshToken),
      tokenExpiresAt: expiresAt,
    });
  }

  return { accessToken, xeroTenantId: conn.xeroTenantId };
}

async function xeroGet(accessToken: string, xeroTenantId: string, path: string): Promise<any> {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": xeroTenantId,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Xero GET ${path} failed: ${res.status}`);
  return res.json();
}

async function xeroPost(accessToken: string, xeroTenantId: string, path: string, body: any): Promise<any> {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": xeroTenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xero POST ${path} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function xeroPut(accessToken: string, xeroTenantId: string, path: string, body: any): Promise<any> {
  const res = await fetch(`https://api.xero.com/api.xro/2.0/${path}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "xero-tenant-id": xeroTenantId,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Xero PUT ${path} failed: ${res.status} ${text}`);
  return JSON.parse(text);
}

async function syncContact(
  accessToken: string,
  xeroTenantId: string,
  gardeoTenantId: number,
  entityType: "client" | "supplier",
  entityId: number,
  name: string,
  email?: string | null,
  phone?: string | null,
  vatNumber?: string | null
): Promise<string> {
  const existing = await storage.getXeroSyncRecord(gardeoTenantId, entityType, entityId);

  const contactPayload: any = {
    Name: name,
    IsCustomer: entityType === "client",
    IsSupplier: entityType === "supplier",
  };
  if (email) contactPayload.EmailAddress = email;
  if (phone) contactPayload.Phones = [{ PhoneType: "DEFAULT", PhoneNumber: phone }];
  if (vatNumber) contactPayload.TaxNumber = vatNumber;

  let xeroContactId: string;
  if (existing?.xeroId) {
    contactPayload.ContactID = existing.xeroId;
    const result = await xeroPost(accessToken, xeroTenantId, "Contacts", { Contacts: [contactPayload] });
    xeroContactId = result.Contacts?.[0]?.ContactID || existing.xeroId;
  } else {
    const result = await xeroPost(accessToken, xeroTenantId, "Contacts", { Contacts: [contactPayload] });
    xeroContactId = result.Contacts?.[0]?.ContactID;
    if (!xeroContactId) throw new Error("No ContactID returned from Xero");
  }

  await storage.upsertXeroSyncRecord(gardeoTenantId, {
    tenantId: gardeoTenantId,
    entityType,
    entityId,
    xeroId: xeroContactId,
    syncStatus: "synced",
    lastSyncedAt: new Date(),
    lastError: null,
  });

  return xeroContactId;
}

async function syncInvoice(
  accessToken: string,
  xeroTenantId: string,
  gardeoTenantId: number,
  entityType: "client_invoice" | "supplier_invoice",
  entityId: number,
  invoiceNumber: string,
  contactXeroId: string,
  lineItems: Array<{ description: string; quantity: number; unitAmount: number; taxType: string; accountCode: string }>,
  invoiceDate: string,
  dueDate: string | null,
  status: "DRAFT" | "SUBMITTED" | "AUTHORISED"
): Promise<string> {
  const existing = await storage.getXeroSyncRecord(gardeoTenantId, entityType, entityId);
  const xeroType = entityType === "client_invoice" ? "ACCREC" : "ACCPAY";

  const invoicePayload: any = {
    Type: xeroType,
    Contact: { ContactID: contactXeroId },
    InvoiceNumber: invoiceNumber,
    Date: invoiceDate,
    LineItems: lineItems.map(li => ({
      Description: li.description,
      Quantity: li.quantity,
      UnitAmount: li.unitAmount,
      TaxType: li.taxType,
      AccountCode: li.accountCode,
    })),
    Status: status,
    LineAmountTypes: "Exclusive",
  };
  if (dueDate) invoicePayload.DueDate = dueDate;

  let xeroInvoiceId: string;
  if (existing?.xeroId) {
    invoicePayload.InvoiceID = existing.xeroId;
    const result = await xeroPost(accessToken, xeroTenantId, "Invoices", { Invoices: [invoicePayload] });
    xeroInvoiceId = result.Invoices?.[0]?.InvoiceID || existing.xeroId;
  } else {
    const result = await xeroPost(accessToken, xeroTenantId, "Invoices", { Invoices: [invoicePayload] });
    xeroInvoiceId = result.Invoices?.[0]?.InvoiceID;
    if (!xeroInvoiceId) throw new Error("No InvoiceID returned from Xero");
  }

  await storage.upsertXeroSyncRecord(gardeoTenantId, {
    tenantId: gardeoTenantId,
    entityType,
    entityId,
    xeroId: xeroInvoiceId,
    syncStatus: "synced",
    lastSyncedAt: new Date(),
    lastError: null,
  });

  return xeroInvoiceId;
}

async function syncCreditNote(
  accessToken: string,
  xeroTenantId: string,
  gardeoTenantId: number,
  entityType: "credit_note" | "debit_note",
  entityId: number,
  noteNumber: string,
  contactXeroId: string,
  linkedInvoiceXeroId: string | null,
  subtotal: number,
  vatRate: number,
  vatAmount: number,
  date: string
): Promise<string> {
  const existing = await storage.getXeroSyncRecord(gardeoTenantId, entityType, entityId);

  const notePayload: any = {
    Type: "ACCCREDITS",
    Contact: { ContactID: contactXeroId },
    CreditNoteNumber: noteNumber,
    Date: date,
    LineItems: [{
      Description: `${entityType === "credit_note" ? "Credit Note" : "Debit Note"} - ${noteNumber}`,
      Quantity: 1,
      UnitAmount: subtotal,
      TaxType: vatRate > 0 ? "OUTPUT" : "NONE",
      AccountCode: "200",
    }],
    Status: "AUTHORISED",
    LineAmountTypes: "Exclusive",
  };

  let xeroNoteId: string;
  if (existing?.xeroId) {
    notePayload.CreditNoteID = existing.xeroId;
    const result = await xeroPost(accessToken, xeroTenantId, "CreditNotes", { CreditNotes: [notePayload] });
    xeroNoteId = result.CreditNotes?.[0]?.CreditNoteID || existing.xeroId;
  } else {
    const result = await xeroPost(accessToken, xeroTenantId, "CreditNotes", { CreditNotes: [notePayload] });
    xeroNoteId = result.CreditNotes?.[0]?.CreditNoteID;
    if (!xeroNoteId) throw new Error("No CreditNoteID returned from Xero");
  }

  if (linkedInvoiceXeroId && !existing?.xeroId) {
    try {
      await xeroPost(accessToken, xeroTenantId, "CreditNotes", {
        CreditNotes: [{
          CreditNoteID: xeroNoteId,
          Allocations: [{ Invoice: { InvoiceID: linkedInvoiceXeroId }, Amount: subtotal + vatAmount }],
        }],
      });
    } catch (allocErr: any) {
      console.warn(`[Xero] Credit note allocation failed for ${entityType}#${entityId} (xeroId: ${xeroNoteId}): ${allocErr.message}`);
      await storage.upsertXeroSyncRecord(gardeoTenantId, {
        tenantId: gardeoTenantId, entityType, entityId,
        xeroId: xeroNoteId, syncStatus: "error",
        lastError: `Allocation failed: ${allocErr.message}`, lastSyncedAt: new Date(),
      });
      return xeroNoteId;
    }
  }

  await storage.upsertXeroSyncRecord(gardeoTenantId, {
    tenantId: gardeoTenantId,
    entityType,
    entityId,
    xeroId: xeroNoteId,
    syncStatus: "synced",
    lastSyncedAt: new Date(),
    lastError: null,
  });

  return xeroNoteId;
}

async function syncPayment(
  accessToken: string,
  xeroTenantId: string,
  gardeoTenantId: number,
  entityType: "payment",
  entityId: number,
  xeroInvoiceId: string,
  amount: number,
  date: string
): Promise<void> {
  const existing = await storage.getXeroSyncRecord(gardeoTenantId, entityType, entityId);
  if (existing?.xeroId) return;

  const paymentPayload = {
    Invoice: { InvoiceID: xeroInvoiceId },
    Account: { Code: "090" },
    Date: date,
    Amount: amount,
    Reference: `Gardeo allocation ${entityId}`,
  };

  const result = await xeroPost(accessToken, xeroTenantId, "Payments", { Payments: [paymentPayload] });
  const xeroPaymentId = result.Payments?.[0]?.PaymentID;

  await storage.upsertXeroSyncRecord(gardeoTenantId, {
    tenantId: gardeoTenantId,
    entityType,
    entityId,
    xeroId: xeroPaymentId || null,
    syncStatus: "synced",
    lastSyncedAt: new Date(),
    lastError: null,
  });
}

export async function runXeroSync(gardeoTenantId: number, triggeredBy: string): Promise<{
  contacts: number; invoices: number; notes: number; payments: number; errors: number;
}> {
  if (syncLocks.has(gardeoTenantId)) {
    console.log(`[Xero] Sync already running for tenant ${gardeoTenantId}, skipping`);
    return { contacts: 0, invoices: 0, notes: 0, payments: 0, errors: 0 };
  }
  syncLocks.add(gardeoTenantId);

  const stats = { contacts: 0, invoices: 0, notes: 0, payments: 0, errors: 0 };

  try {
    const { accessToken, xeroTenantId } = await getValidAccessToken(gardeoTenantId);

    const { rows: clients } = await pool.query(
      "SELECT id, company_name, contact_email, contact_phone, billing_email FROM clients WHERE tenant_id = $1 AND is_active = true LIMIT 200",
      [gardeoTenantId]
    );
    for (const c of clients) {
      try {
        await syncContact(accessToken, xeroTenantId, gardeoTenantId, "client", c.id,
          c.company_name, c.billing_email || c.contact_email, c.contact_phone, null);
        stats.contacts++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "client", entityId: c.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    const { rows: suppliers } = await pool.query(
      "SELECT id, company_name, email, phone, vat_number FROM suppliers WHERE tenant_id = $1 AND status = 'active' LIMIT 200",
      [gardeoTenantId]
    );
    for (const s of suppliers) {
      try {
        await syncContact(accessToken, xeroTenantId, gardeoTenantId, "supplier", s.id,
          s.company_name, s.email, s.phone, s.vat_number);
        stats.contacts++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "supplier", entityId: s.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    const { rows: clientInvoices } = await pool.query(
      `SELECT ci.*, c.company_name as client_name, c.billing_email, c.contact_email
       FROM client_invoices ci JOIN clients c ON ci.client_id = c.id
       WHERE ci.tenant_id = $1 AND ci.status NOT IN ('draft', 'cancelled') LIMIT 500`,
      [gardeoTenantId]
    );
    for (const inv of clientInvoices) {
      try {
        const clientSync = await storage.getXeroSyncRecord(gardeoTenantId, "client", inv.client_id);
        if (!clientSync?.xeroId) continue;

        const { rows: lineItems } = await pool.query(
          "SELECT * FROM client_invoice_line_items WHERE client_invoice_id = $1",
          [inv.id]
        );
        const xeroLineItems = lineItems.length > 0 ? lineItems.map((li: any) => ({
          description: li.description || "Security Services",
          quantity: parseFloat(li.hours || "1"),
          unitAmount: parseFloat(li.charge_rate || li.subtotal || "0"),
          taxType: parseFloat(inv.vat_rate || "0") > 0 ? "OUTPUT" : "NONE",
          accountCode: "200",
        })) : [{
          description: `Client Invoice ${inv.invoice_number}`,
          quantity: 1,
          unitAmount: parseFloat(inv.subtotal || "0"),
          taxType: parseFloat(inv.vat_rate || "0") > 0 ? "OUTPUT" : "NONE",
          accountCode: "200",
        }];

        await syncInvoice(accessToken, xeroTenantId, gardeoTenantId,
          "client_invoice", inv.id, inv.invoice_number, clientSync.xeroId,
          xeroLineItems, inv.period_start || inv.created_at?.toISOString()?.slice(0, 10),
          inv.due_date, inv.status === "paid" ? "AUTHORISED" : "SUBMITTED"
        );
        stats.invoices++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "client_invoice", entityId: inv.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    const { rows: supplierInvoices } = await pool.query(
      `SELECT i.*, s.company_name as supplier_name FROM invoices i
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       WHERE i.tenant_id = $1 AND i.status NOT IN ('draft', 'cancelled') AND i.supplier_id IS NOT NULL LIMIT 500`,
      [gardeoTenantId]
    );
    for (const inv of supplierInvoices) {
      try {
        const supplierSync = await storage.getXeroSyncRecord(gardeoTenantId, "supplier", inv.supplier_id);
        if (!supplierSync?.xeroId) continue;

        const { rows: lineItems } = await pool.query(
          "SELECT * FROM invoice_line_items WHERE invoice_id = $1",
          [inv.id]
        );
        const xeroLineItems = lineItems.length > 0 ? lineItems.map((li: any) => ({
          description: li.description || "Labour Supply",
          quantity: parseFloat(li.hours || "1"),
          unitAmount: parseFloat(li.rate || li.subtotal || "0"),
          taxType: parseFloat(inv.vat_rate || "0") > 0 ? "INPUT" : "NONE",
          accountCode: "300",
        })) : [{
          description: `Supplier Invoice ${inv.invoice_number}`,
          quantity: 1,
          unitAmount: parseFloat(inv.subtotal || "0"),
          taxType: parseFloat(inv.vat_rate || "0") > 0 ? "INPUT" : "NONE",
          accountCode: "300",
        }];

        await syncInvoice(accessToken, xeroTenantId, gardeoTenantId,
          "supplier_invoice", inv.id, inv.invoice_number, supplierSync.xeroId,
          xeroLineItems, inv.period_start || inv.created_at?.toISOString()?.slice(0, 10),
          inv.due_date, inv.status === "paid" ? "AUTHORISED" : "SUBMITTED"
        );
        stats.invoices++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "supplier_invoice", entityId: inv.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    const { rows: creditNotes } = await pool.query(
      `SELECT cn.*, i.supplier_id, s.company_name as supplier_name
       FROM credit_notes cn
       JOIN invoices i ON cn.invoice_id = i.id
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       WHERE cn.tenant_id = $1 AND cn.status = 'issued' LIMIT 200`,
      [gardeoTenantId]
    );
    for (const cn of creditNotes) {
      try {
        const supplierSync = cn.supplier_id ? await storage.getXeroSyncRecord(gardeoTenantId, "supplier", cn.supplier_id) : null;
        if (!supplierSync?.xeroId) continue;
        const invoiceSync = await storage.getXeroSyncRecord(gardeoTenantId, "supplier_invoice", cn.invoice_id);

        await syncCreditNote(accessToken, xeroTenantId, gardeoTenantId,
          "credit_note", cn.id, cn.credit_note_number, supplierSync.xeroId,
          invoiceSync?.xeroId || null,
          parseFloat(cn.subtotal || "0"), parseFloat(cn.vat_rate || "0"),
          parseFloat(cn.vat_amount || "0"), cn.issued_at?.toISOString()?.slice(0, 10) || new Date().toISOString().slice(0, 10)
        );
        stats.notes++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "credit_note", entityId: cn.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    const { rows: debitNotes } = await pool.query(
      `SELECT dn.*, i.supplier_id, s.company_name as supplier_name
       FROM debit_notes dn
       JOIN invoices i ON dn.invoice_id = i.id
       LEFT JOIN suppliers s ON i.supplier_id = s.id
       WHERE dn.tenant_id = $1 AND dn.status = 'issued' LIMIT 200`,
      [gardeoTenantId]
    );
    for (const dn of debitNotes) {
      try {
        const supplierSync = dn.supplier_id ? await storage.getXeroSyncRecord(gardeoTenantId, "supplier", dn.supplier_id) : null;
        if (!supplierSync?.xeroId) continue;
        const invoiceSync = await storage.getXeroSyncRecord(gardeoTenantId, "supplier_invoice", dn.invoice_id);

        await syncCreditNote(accessToken, xeroTenantId, gardeoTenantId,
          "debit_note", dn.id, dn.debit_note_number, supplierSync.xeroId,
          invoiceSync?.xeroId || null,
          parseFloat(dn.subtotal || "0"), parseFloat(dn.vat_rate || "0"),
          parseFloat(dn.vat_amount || "0"), dn.issued_at?.toISOString()?.slice(0, 10) || new Date().toISOString().slice(0, 10)
        );
        stats.notes++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "debit_note", entityId: dn.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    const { rows: bankAllocations } = await pool.query(
      `SELECT bta.*, bt.transaction_date FROM bank_transaction_allocations bta
       JOIN bank_transactions bt ON bta.bank_transaction_id = bt.id
       WHERE bta.tenant_id = $1 AND bta.invoice_id IS NOT NULL LIMIT 500`,
      [gardeoTenantId]
    );
    for (const alloc of bankAllocations) {
      try {
        const invoiceSync = await storage.getXeroSyncRecord(gardeoTenantId, "supplier_invoice", alloc.invoice_id);
        if (!invoiceSync?.xeroId) continue;

        await syncPayment(accessToken, xeroTenantId, gardeoTenantId,
          "payment", alloc.id, invoiceSync.xeroId,
          parseFloat(alloc.amount || "0"),
          alloc.transaction_date?.toISOString()?.slice(0, 10) || new Date().toISOString().slice(0, 10)
        );
        stats.payments++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "payment", entityId: alloc.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    const { rows: clientAllocations } = await pool.query(
      `SELECT bta.*, bt.transaction_date FROM bank_transaction_allocations bta
       JOIN bank_transactions bt ON bta.bank_transaction_id = bt.id
       WHERE bta.tenant_id = $1 AND bta.client_invoice_id IS NOT NULL LIMIT 500`,
      [gardeoTenantId]
    );
    for (const alloc of clientAllocations) {
      try {
        const invoiceSync = await storage.getXeroSyncRecord(gardeoTenantId, "client_invoice", alloc.client_invoice_id);
        if (!invoiceSync?.xeroId) continue;

        await syncPayment(accessToken, xeroTenantId, gardeoTenantId,
          "payment", alloc.id, invoiceSync.xeroId,
          parseFloat(alloc.amount || "0"),
          alloc.transaction_date?.toISOString()?.slice(0, 10) || new Date().toISOString().slice(0, 10)
        );
        stats.payments++;
      } catch (e: any) {
        stats.errors++;
        await storage.upsertXeroSyncRecord(gardeoTenantId, {
          tenantId: gardeoTenantId, entityType: "payment", entityId: alloc.id,
          syncStatus: "error", lastError: e.message, lastSyncedAt: new Date(),
        });
      }
    }

    await pullXeroPaymentStatus(gardeoTenantId, accessToken, xeroTenantId);

    await storage.upsertTenantXeroConnection(gardeoTenantId, {
      lastSyncedAt: new Date(),
      connectionStatus: "connected",
      lastError: null,
    });

    await pool.query(
      `INSERT INTO audit_logs (tenant_id, user_id, action, entity_type, entity_id, details, created_at)
       VALUES ($1, $2, 'xero_sync_complete', 'xero_connection', $3, $4, NOW())`,
      [gardeoTenantId, triggeredBy, String(gardeoTenantId),
        JSON.stringify({ contacts: stats.contacts, invoices: stats.invoices, notes: stats.notes, payments: stats.payments, errors: stats.errors })]
    );

  } catch (err: any) {
    stats.errors++;
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Xero] Sync failed for tenant ${gardeoTenantId}:`, msg);
    await storage.upsertTenantXeroConnection(gardeoTenantId, { lastError: msg });
  } finally {
    syncLocks.delete(gardeoTenantId);
  }

  return stats;
}

async function pullXeroPaymentStatus(gardeoTenantId: number, accessToken: string, xeroTenantId: string): Promise<void> {
  const syncedClientInvoices = await storage.getXeroSyncRecordsByType(gardeoTenantId, "client_invoice");
  for (const record of syncedClientInvoices) {
    if (!record.xeroId) continue;
    try {
      const data = await xeroGet(accessToken, xeroTenantId, `Invoices/${record.xeroId}`);
      const xeroInv = data.Invoices?.[0];
      if (!xeroInv) continue;
      if (xeroInv.Status === "PAID" || xeroInv.AmountDue === 0) {
        await pool.query(
          "UPDATE client_invoices SET status = 'paid', paid_at = COALESCE(paid_at, NOW()) WHERE id = $1 AND tenant_id = $2 AND status != 'paid'",
          [record.entityId, gardeoTenantId]
        );
      }
    } catch (pullErr: any) {
      console.warn(`[Xero] Failed to pull payment status for client_invoice#${record.entityId}: ${pullErr.message}`);
      await storage.upsertXeroSyncRecord(gardeoTenantId, {
        tenantId: gardeoTenantId, entityType: "client_invoice", entityId: record.entityId,
        xeroId: record.xeroId, syncStatus: "error",
        lastError: `Payment pull failed: ${pullErr.message}`, lastSyncedAt: new Date(),
      });
    }
  }

  const syncedSupplierInvoices = await storage.getXeroSyncRecordsByType(gardeoTenantId, "supplier_invoice");
  for (const record of syncedSupplierInvoices) {
    if (!record.xeroId) continue;
    try {
      const data = await xeroGet(accessToken, xeroTenantId, `Invoices/${record.xeroId}`);
      const xeroInv = data.Invoices?.[0];
      if (!xeroInv) continue;
      if (xeroInv.Status === "PAID" || xeroInv.AmountDue === 0) {
        await pool.query(
          "UPDATE invoices SET status = 'paid', paid_at = COALESCE(paid_at, NOW()) WHERE id = $1 AND tenant_id = $2 AND status != 'paid'",
          [record.entityId, gardeoTenantId]
        );
      }
    } catch (pullErr: any) {
      console.warn(`[Xero] Failed to pull payment status for supplier_invoice#${record.entityId}: ${pullErr.message}`);
      await storage.upsertXeroSyncRecord(gardeoTenantId, {
        tenantId: gardeoTenantId, entityType: "supplier_invoice", entityId: record.entityId,
        xeroId: record.xeroId, syncStatus: "error",
        lastError: `Payment pull failed: ${pullErr.message}`, lastSyncedAt: new Date(),
      });
    }
  }
}

export function startXeroSync(gardeoTenantId: number, userId: string, intervalMs = 3600000): void {
  stopXeroSync(gardeoTenantId);
  console.log(`[Xero] Starting sync for tenant ${gardeoTenantId} (interval: ${intervalMs / 1000}s)`);

  runXeroSync(gardeoTenantId, userId).catch(err => {
    console.error("[Xero] Initial sync failed:", err instanceof Error ? err.message : String(err));
  });

  const interval = setInterval(() => {
    runXeroSync(gardeoTenantId, "system").catch(err => {
      console.error("[Xero] Scheduled sync failed:", err instanceof Error ? err.message : String(err));
    });
  }, intervalMs);

  activePollers.set(gardeoTenantId, interval);
}

export function stopXeroSync(gardeoTenantId?: number): void {
  if (gardeoTenantId !== undefined) {
    const interval = activePollers.get(gardeoTenantId);
    if (interval) {
      clearInterval(interval);
      activePollers.delete(gardeoTenantId);
      console.log(`[Xero] Sync stopped for tenant ${gardeoTenantId}`);
    }
  } else {
    for (const [tid, interval] of activePollers) {
      clearInterval(interval);
      console.log(`[Xero] Sync stopped for tenant ${tid}`);
    }
    activePollers.clear();
  }
}

export function isXeroSyncActive(gardeoTenantId?: number): boolean {
  if (gardeoTenantId !== undefined) return activePollers.has(gardeoTenantId);
  return activePollers.size > 0;
}

export async function initializeXeroSync(): Promise<void> {
  try {
    const connections = await storage.getAllActiveXeroConnections();
    console.log(`[Xero] Found ${connections.length} active Xero connections to start syncing`);
    for (const conn of connections) {
      try {
        const intervalMs = (conn.syncIntervalMinutes || 60) * 60 * 1000;
        startXeroSync(conn.tenantId, conn.connectedBy || "system", intervalMs);
        console.log(`[Xero] Auto-started sync for tenant ${conn.tenantId}`);
      } catch (err: any) {
        console.error(`[Xero] Failed to auto-start sync for tenant ${conn.tenantId}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error("[Xero] Failed to initialize sync:", err.message);
  }
}
