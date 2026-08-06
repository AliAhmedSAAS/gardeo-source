/**
 * Rules-based required supplier documents (Story 6).
 * Required list depends on VAT status and supplier type.
 */

export type SupplierDocumentType =
  | "companies_house_proof"
  | "bank_proof"
  | "supplier_declaration"
  | "vat_evidence"
  | "sample_vat_invoice"
  | "non_vat_declaration"
  | "el_insurance"
  | "pl_insurance"
  | "rtw_payroll_statement"
  | "labour_supply_chain_statement"
  | "self_billing_agreement"
  | "other";

export interface SupplierForRequiredDocs {
  vatStatus?: string | null;
  supplierType?: string | null;
}

/** Human-readable labels for document types (for checklist UI). */
export const SUPPLIER_DOC_LABELS: Record<SupplierDocumentType, string> = {
  companies_house_proof: "Companies House proof",
  bank_proof: "Bank account proof",
  supplier_declaration: "Signed Supplier Declaration",
  vat_evidence: "VAT evidence",
  sample_vat_invoice: "Sample VAT invoice",
  non_vat_declaration: "Signed Non-VAT Declaration",
  el_insurance: "Employers' Liability Insurance",
  pl_insurance: "Public Liability Insurance",
  rtw_payroll_statement: "Right to Work, PAYE & NMW Compliance Statement",
  labour_supply_chain_statement: "Labour Supply Chain & Employment Model Declaration",
  self_billing_agreement: "Self-Billing Agreement",
  other: "Other document",
};

/** Short description of what the supplier must upload for each type (shown under each box). */
export const SUPPLIER_DOC_DESCRIPTIONS: Record<Exclude<SupplierDocumentType, "other">, string> = {
  companies_house_proof: "Choose ONE: Certificate of Incorporation, OR Companies House company profile PDF/screenshot (showing legal name + CRN).",
  bank_proof: "Bank letter OR redacted bank statement showing: company legal name, sort code, account number.",
  supplier_declaration: "Signed supplier declaration as per your template.",
  vat_evidence: "Choose ONE: VAT Registration Certificate, OR HMRC VAT confirmation showing VAT number.",
  sample_vat_invoice: "One sample VAT invoice.",
  non_vat_declaration: "Signed Non-VAT Declaration (your template).",
  el_insurance: "Current Employers' Liability Insurance certificate.",
  pl_insurance: "Current Public Liability Insurance certificate (if required).",
  rtw_payroll_statement: "Signed 1-page statement: you run PAYE where required, complete and keep Right to Work checks, and comply with National Minimum Wage.",
  labour_supply_chain_statement: "Signed 1-page statement: who employs and pays the workers (your company / umbrella / subcontractor), naming any umbrella/subcontractor used (with company number).",
  self_billing_agreement: "HMRC-compliant self-billing agreement (VAT Notice 700/62). Signed digitally via the platform.",
};

/**
 * Returns the list of required document types for a supplier based on VAT status and supplier type.
 * - All: Companies House proof, Bank proof, Signed Supplier Declaration
 * - VAT Registered: VAT evidence, Sample VAT invoice
 * - Not VAT Registered: Signed Non-VAT Declaration
 * - Labour supplier: EL insurance, PL insurance, RTW/payroll statement, Labour supply chain statement
 */
export function getRequiredSupplierDocumentTypes(supplier: SupplierForRequiredDocs): SupplierDocumentType[] {
  const required: SupplierDocumentType[] = [
    "companies_house_proof",
    "bank_proof",
    "supplier_declaration",
  ];

  const vatStatus = (supplier.vatStatus ?? "").toLowerCase();
  if (vatStatus === "vat_registered") {
    required.push("vat_evidence", "sample_vat_invoice");
  } else if (vatStatus === "not_vat_registered") {
    required.push("non_vat_declaration");
  }

  const supplierType = (supplier.supplierType ?? "").toLowerCase();
  if (supplierType === "labour") {
    required.push("el_insurance", "pl_insurance", "rtw_payroll_statement", "labour_supply_chain_statement");
  }

  return required;
}

/** Returns true if the supplier has uploaded at least one document for every required type. */
export function hasAllRequiredDocuments(
  supplier: SupplierForRequiredDocs,
  uploadedTypes: string[]
): boolean {
  const required = getRequiredSupplierDocumentTypes(supplier);
  return required.every((type) => uploadedTypes.includes(type));
}
