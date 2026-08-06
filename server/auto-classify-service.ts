import { pool } from "./db";

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\b(ltd|limited|plc|inc|llp|llc|co|company|services|group|uk)\b/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeText(text).split(" ").filter(t => t.length > 2);
}

function tokenOverlap(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;
  const setB = new Set(tokensB);
  const matches = tokensA.filter(t => setB.has(t)).length;
  return matches / Math.max(tokensA.length, tokensB.length);
}

interface Supplier {
  id: number;
  company_name: string;
  account_number: string | null;
  sort_code: string | null;
  account_name: string | null;
  vat_number: string | null;
}

interface Client {
  id: number;
  company_name: string;
  client_code: string | null;
}

interface UnpaidInvoice {
  id: number;
  invoice_number: string;
  total_amount: number;
  remaining: number;
  supplier_id: number | null;
  client_id: number | null;
  type: "supplier" | "client";
  entity_name: string;
}

interface Rule {
  id: number;
  match_pattern: string;
  entity_type: string;
  entity_id: number | null;
  expense_category: string | null;
  includes_vat: boolean;
  match_count: number;
}

interface Vendor {
  id: number;
  name: string;
  vat_registered: boolean;
  default_expense_category: string | null;
  sort_code: string | null;
  account_number: string | null;
}

interface Suggestion {
  bankTransactionId: number;
  entityType: string;
  entityId: number | null;
  expenseCategory: string | null;
  includesVat: boolean;
  confidence: number;
  matchReasons: string[];
  invoiceId: number | null;
  vendorId: number | null;
}

export async function classifyTransactions(
  tenantId: number,
  transactionIds?: number[]
): Promise<{ classified: number; suggestions: number }> {
  let txnQuery: string;
  let txnParams: any[];

  if (transactionIds && transactionIds.length > 0) {
    txnQuery = `SELECT * FROM bank_transactions WHERE tenant_id = $1 AND is_allocated = false AND is_general_purchase = false AND id = ANY($2)`;
    txnParams = [tenantId, transactionIds];
  } else {
    txnQuery = `SELECT * FROM bank_transactions WHERE tenant_id = $1 AND is_allocated = false AND is_general_purchase = false`;
    txnParams = [tenantId];
  }

  const txnResult = await pool.query(txnQuery, txnParams);
  const transactions = txnResult.rows;

  if (transactions.length === 0) return { classified: 0, suggestions: 0 };

  const suppliersResult = await pool.query(
    `SELECT id, company_name, account_number, sort_code, account_name, vat_number FROM suppliers WHERE tenant_id = $1`,
    [tenantId]
  );
  const suppliers: Supplier[] = suppliersResult.rows;

  const clientsResult = await pool.query(
    `SELECT id, company_name, client_code FROM clients WHERE tenant_id = $1`,
    [tenantId]
  );
  const clients: Client[] = clientsResult.rows;

  const rulesResult = await pool.query(
    `SELECT * FROM classification_rules WHERE tenant_id = $1 ORDER BY match_count DESC`,
    [tenantId]
  );
  const rules: Rule[] = rulesResult.rows;

  const vendorsResult = await pool.query(
    `SELECT id, name, vat_registered, default_expense_category, sort_code, account_number FROM purchase_vendors WHERE tenant_id = $1 AND is_active = true`,
    [tenantId]
  );
  const vendors: Vendor[] = vendorsResult.rows;

  const supplierInvoicesResult = await pool.query(
    `SELECT i.id, i.invoice_number, i.total_amount::numeric as total_amount,
       i.total_amount::numeric - COALESCE((SELECT SUM(bta.amount::numeric) FROM bank_transaction_allocations bta WHERE bta.invoice_id = i.id), 0) as remaining,
       i.supplier_id, s.company_name as entity_name
     FROM invoices i
     JOIN suppliers s ON i.supplier_id = s.id
     WHERE i.tenant_id = $1 AND i.status != 'cancelled' AND i.status != 'paid'
       AND i.total_amount::numeric > COALESCE((SELECT SUM(bta.amount::numeric) FROM bank_transaction_allocations bta WHERE bta.invoice_id = i.id), 0)`,
    [tenantId]
  );

  const clientInvoicesResult = await pool.query(
    `SELECT ci.id, ci.invoice_number, ci.total_amount::numeric as total_amount,
       ci.total_amount::numeric - COALESCE((SELECT SUM(bta.amount::numeric) FROM bank_transaction_allocations bta WHERE bta.client_invoice_id = ci.id), 0) as remaining,
       ci.client_id, c.company_name as entity_name
     FROM client_invoices ci
     JOIN clients c ON ci.client_id = c.id
     WHERE ci.tenant_id = $1 AND ci.status != 'cancelled' AND ci.status != 'paid'
       AND ci.total_amount::numeric > COALESCE((SELECT SUM(bta.amount::numeric) FROM bank_transaction_allocations bta WHERE bta.client_invoice_id = ci.id), 0)`,
    [tenantId]
  );

  const unpaidInvoices: UnpaidInvoice[] = [
    ...supplierInvoicesResult.rows.map((r: any) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      total_amount: parseFloat(r.total_amount),
      remaining: parseFloat(r.remaining),
      supplier_id: r.supplier_id,
      client_id: null,
      type: "supplier" as const,
      entity_name: r.entity_name,
    })),
    ...clientInvoicesResult.rows.map((r: any) => ({
      id: r.id,
      invoice_number: r.invoice_number,
      total_amount: parseFloat(r.total_amount),
      remaining: parseFloat(r.remaining),
      supplier_id: null,
      client_id: r.client_id,
      type: "client" as const,
      entity_name: r.entity_name,
    })),
  ];

  const existingSuggestions = await pool.query(
    `SELECT bank_transaction_id FROM auto_classification_suggestions WHERE tenant_id = $1 AND status IN ('pending', 'accepted')`,
    [tenantId]
  );
  const existingTxnIds = new Set(existingSuggestions.rows.map((r: any) => r.bank_transaction_id));

  let suggestionsCount = 0;

  for (const txn of transactions) {
    if (existingTxnIds.has(txn.id)) continue;

    const suggestion = matchTransaction(txn, suppliers, clients, rules, unpaidInvoices, vendors);

    if (suggestion && suggestion.confidence >= 50) {
      await pool.query(
        `INSERT INTO auto_classification_suggestions
         (tenant_id, bank_transaction_id, entity_type, entity_id, expense_category, includes_vat, confidence, match_reasons, status, invoice_id, vendor_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9, $10)`,
        [
          tenantId,
          txn.id,
          suggestion.entityType,
          suggestion.entityId,
          suggestion.expenseCategory,
          suggestion.includesVat,
          suggestion.confidence.toFixed(2),
          JSON.stringify(suggestion.matchReasons),
          suggestion.invoiceId,
          suggestion.vendorId,
        ]
      );
      suggestionsCount++;
    }
  }

  return { classified: transactions.length, suggestions: suggestionsCount };
}

function matchTransaction(
  txn: any,
  suppliers: Supplier[],
  clients: Client[],
  rules: Rule[],
  invoices: UnpaidInvoice[],
  vendors: Vendor[] = []
): Suggestion | null {
  const desc = (txn.description || "").toLowerCase();
  const ref = (txn.reference || "").toLowerCase();
  const memo = (txn.memo || "").toLowerCase();
  const combined = `${desc} ${ref} ${memo}`;
  const normalizedDesc = normalizeText(txn.description || "");
  const amount = Math.abs(parseFloat(txn.amount));

  let bestSuggestion: Suggestion | null = null;

  for (const rule of rules) {
    const ruleNorm = normalizeText(rule.match_pattern);
    if (normalizedDesc === ruleNorm || normalizedDesc.includes(ruleNorm) || ruleNorm.includes(normalizedDesc)) {
      const exactMatch = normalizedDesc === ruleNorm;
      let confidence = exactMatch ? 95 : 85;

      if (rule.entity_type === "supplier" && rule.entity_id) {
        const matchingInvoice = invoices.find(
          (inv) => inv.type === "supplier" && inv.supplier_id === rule.entity_id && Math.abs(inv.remaining - amount) < 0.02
        );
        if (matchingInvoice) confidence = Math.min(confidence + 4, 99);

        bestSuggestion = {
          bankTransactionId: txn.id,
          entityType: "supplier",
          entityId: rule.entity_id,
          expenseCategory: null,
          includesVat: false,
          confidence,
          matchReasons: ["learned_rule", ...(matchingInvoice ? ["amount_match"] : [])],
          invoiceId: matchingInvoice?.id || null,
          vendorId: null,
        };
      } else if (rule.entity_type === "client" && rule.entity_id) {
        bestSuggestion = {
          bankTransactionId: txn.id,
          entityType: "client",
          entityId: rule.entity_id,
          expenseCategory: null,
          includesVat: false,
          confidence,
          matchReasons: ["learned_rule"],
          invoiceId: null,
          vendorId: null,
        };
      } else if (rule.entity_type === "purchase") {
        bestSuggestion = {
          bankTransactionId: txn.id,
          entityType: "purchase",
          entityId: null,
          expenseCategory: rule.expense_category,
          includesVat: rule.includes_vat,
          confidence,
          matchReasons: ["learned_rule"],
          invoiceId: null,
          vendorId: null,
        };
      } else if (rule.entity_type === "vendor" && rule.entity_id) {
        bestSuggestion = {
          bankTransactionId: txn.id,
          entityType: "vendor",
          entityId: null,
          expenseCategory: rule.expense_category,
          includesVat: rule.includes_vat,
          confidence,
          matchReasons: ["learned_rule"],
          invoiceId: null,
          vendorId: rule.entity_id,
        };
      }
      if (bestSuggestion) return bestSuggestion;
    }
  }

  for (const inv of invoices) {
    const invNum = inv.invoice_number.toLowerCase();
    if (ref.includes(invNum) || desc.includes(invNum)) {
      const confidence = Math.min(90 + (Math.abs(inv.remaining - amount) < 0.02 ? 5 : 0), 99);
      const entityType = inv.type;
      const entityId = inv.type === "supplier" ? inv.supplier_id : inv.client_id;

      const candidate: Suggestion = {
        bankTransactionId: txn.id,
        entityType,
        entityId,
        expenseCategory: null,
        includesVat: false,
        confidence,
        matchReasons: ["invoice_reference", ...(Math.abs(inv.remaining - amount) < 0.02 ? ["amount_match"] : [])],
        invoiceId: inv.id,
        vendorId: null,
      };

      if (!bestSuggestion || candidate.confidence > bestSuggestion.confidence) {
        bestSuggestion = candidate;
      }
    }
  }
  if (bestSuggestion && bestSuggestion.confidence >= 90) return bestSuggestion;

  for (const supplier of suppliers) {
    const reasons: string[] = [];
    let confidence = 0;

    const supplierNorm = normalizeText(supplier.company_name);
    if (supplierNorm.length > 2) {
      if (normalizedDesc.includes(supplierNorm) || supplierNorm.includes(normalizedDesc)) {
        confidence = 80;
        reasons.push("name_match");
      } else {
        const overlap = tokenOverlap(txn.description || "", supplier.company_name);
        if (overlap >= 0.5) {
          confidence = Math.floor(60 + overlap * 20);
          reasons.push("partial_name_match");
        }
      }
    }

    if (supplier.sort_code) {
      const sc = supplier.sort_code.replace(/[-\s]/g, "");
      const scFormatted = sc.length === 6 ? `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}` : sc;
      if (combined.includes(sc) || combined.includes(scFormatted)) {
        confidence += 20;
        reasons.push("sort_code_match");
      }
    }

    if (supplier.account_number && supplier.account_number.length >= 6) {
      if (combined.includes(supplier.account_number)) {
        confidence += 20;
        reasons.push("account_number_match");
      }
    }

    const matchingInvoice = invoices.find(
      (inv) => inv.type === "supplier" && inv.supplier_id === supplier.id && Math.abs(inv.remaining - amount) < 0.02
    );
    if (matchingInvoice && confidence > 0) {
      confidence += 15;
      reasons.push("amount_match");
    }

    confidence = Math.min(confidence, 99);

    if (confidence >= 50 && (!bestSuggestion || confidence > bestSuggestion.confidence)) {
      bestSuggestion = {
        bankTransactionId: txn.id,
        entityType: "supplier",
        entityId: supplier.id,
        expenseCategory: null,
        includesVat: false,
        confidence,
        matchReasons: reasons,
        invoiceId: matchingInvoice?.id || null,
        vendorId: null,
      };
    }
  }

  for (const client of clients) {
    const reasons: string[] = [];
    let confidence = 0;

    const clientNorm = normalizeText(client.company_name);
    if (clientNorm.length > 2) {
      if (normalizedDesc.includes(clientNorm) || clientNorm.includes(normalizedDesc)) {
        confidence = 80;
        reasons.push("name_match");
      } else {
        const overlap = tokenOverlap(txn.description || "", client.company_name);
        if (overlap >= 0.5) {
          confidence = Math.floor(60 + overlap * 20);
          reasons.push("partial_name_match");
        }
      }
    }

    if (client.client_code && client.client_code.length > 2) {
      if (ref.includes(client.client_code.toLowerCase()) || desc.includes(client.client_code.toLowerCase())) {
        confidence += 15;
        reasons.push("client_code_match");
      }
    }

    const matchingInvoice = invoices.find(
      (inv) => inv.type === "client" && inv.client_id === client.id && Math.abs(inv.remaining - amount) < 0.02
    );
    if (matchingInvoice && confidence > 0) {
      confidence += 15;
      reasons.push("amount_match");
    }

    confidence = Math.min(confidence, 99);

    if (confidence >= 50 && (!bestSuggestion || confidence > bestSuggestion.confidence)) {
      bestSuggestion = {
        bankTransactionId: txn.id,
        entityType: "client",
        entityId: client.id,
        expenseCategory: null,
        includesVat: false,
        confidence,
        matchReasons: reasons,
        invoiceId: matchingInvoice?.id || null,
        vendorId: null,
      };
    }
  }

  for (const vendor of vendors) {
    const reasons: string[] = [];
    let confidence = 0;

    const vendorNorm = normalizeText(vendor.name);
    if (vendorNorm.length > 2) {
      if (normalizedDesc.includes(vendorNorm) || vendorNorm.includes(normalizedDesc)) {
        confidence = 80;
        reasons.push("name_match");
      } else {
        const overlap = tokenOverlap(txn.description || "", vendor.name);
        if (overlap >= 0.5) {
          confidence = Math.floor(60 + overlap * 20);
          reasons.push("partial_name_match");
        }
      }
    }

    if (vendor.sort_code) {
      const sc = vendor.sort_code.replace(/[-\s]/g, "");
      const scFormatted = sc.length === 6 ? `${sc.slice(0, 2)}-${sc.slice(2, 4)}-${sc.slice(4, 6)}` : sc;
      if (combined.includes(sc) || combined.includes(scFormatted)) {
        confidence += 20;
        reasons.push("sort_code_match");
      }
    }

    if (vendor.account_number && vendor.account_number.length >= 6) {
      if (combined.includes(vendor.account_number)) {
        confidence += 20;
        reasons.push("account_number_match");
      }
    }

    confidence = Math.min(confidence, 99);

    if (confidence >= 50 && (!bestSuggestion || confidence > bestSuggestion.confidence)) {
      bestSuggestion = {
        bankTransactionId: txn.id,
        entityType: "vendor",
        entityId: null,
        expenseCategory: vendor.default_expense_category,
        includesVat: vendor.vat_registered,
        confidence,
        matchReasons: reasons,
        invoiceId: null,
        vendorId: vendor.id,
      };
    }
  }

  return bestSuggestion;
}

export async function learnFromAllocation(
  tenantId: number,
  bankTransactionId: number,
  entityType: string,
  entityId: number | null,
  expenseCategory: string | null,
  includesVat: boolean = false
): Promise<number> {
  const txnResult = await pool.query(
    `SELECT description FROM bank_transactions WHERE id = $1 AND tenant_id = $2`,
    [bankTransactionId, tenantId]
  );
  if (txnResult.rows.length === 0) return 0;

  const description = txnResult.rows[0].description;
  if (!description || description.trim().length < 3) return 0;

  const pattern = normalizeText(description);
  if (pattern.length < 3) return 0;

  const existing = await pool.query(
    `SELECT id, match_count FROM classification_rules WHERE tenant_id = $1 AND match_pattern = $2 AND entity_type = $3`,
    [tenantId, pattern, entityType]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE classification_rules SET match_count = match_count + 1, entity_id = COALESCE($1, entity_id),
       expense_category = COALESCE($2, expense_category), includes_vat = $3, updated_at = NOW()
       WHERE id = $4`,
      [entityId, expenseCategory, includesVat, existing.rows[0].id]
    );
  } else {
    await pool.query(
      `INSERT INTO classification_rules (tenant_id, match_pattern, entity_type, entity_id, expense_category, includes_vat)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, pattern, entityType, entityId, expenseCategory, includesVat]
    );
  }

  await pool.query(
    `UPDATE auto_classification_suggestions SET status = 'accepted' WHERE tenant_id = $1 AND bank_transaction_id = $2 AND status = 'pending'`,
    [tenantId, bankTransactionId]
  );

  const similarTxns = await pool.query(
    `SELECT bt.id, bt.description FROM bank_transactions bt
     WHERE bt.tenant_id = $1 AND bt.is_allocated = false AND bt.is_general_purchase = false
       AND bt.id != $2
       AND NOT EXISTS (
         SELECT 1 FROM auto_classification_suggestions acs
         WHERE acs.bank_transaction_id = bt.id AND acs.tenant_id = $1 AND acs.status IN ('pending', 'accepted')
       )`,
    [tenantId, bankTransactionId]
  );

  let propagated = 0;
  for (const row of similarTxns.rows) {
    if (!row.description) continue;
    const normDesc = normalizeText(row.description);
    if (normDesc !== pattern) continue;

    await pool.query(
      `INSERT INTO auto_classification_suggestions
       (tenant_id, bank_transaction_id, entity_type, entity_id, expense_category, includes_vat, confidence, match_reasons, status, invoice_id, vendor_id)
       VALUES ($1, $2, $3, $4, $5, $6, 92, $7, 'pending', NULL, NULL)`,
      [
        tenantId,
        row.id,
        entityType,
        entityId,
        expenseCategory,
        includesVat,
        JSON.stringify(["learned_from_similar"]),
      ]
    );
    propagated++;
  }

  return propagated;
}
