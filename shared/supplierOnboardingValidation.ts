/**
 * Supplier onboarding submit validation (Stories 2, 3, 4, 5).
 * Used by portal (client) to gate Submit and by server on submit-onboarding.
 */

import { getRequiredSupplierDocumentTypes } from "./supplierRequiredDocs";

export interface SupplierForValidation {
  contactName?: string | null;
  email?: string | null;
  registeredOfficeAddress?: string | null;
  registeredOfficeCity?: string | null;
  registeredOfficePostcode?: string | null;
  tradingSameAsRegistered?: boolean | null;
  tradingAddress?: string | null;
  tradingCity?: string | null;
  tradingPostcode?: string | null;
  financeContactName?: string | null;
  financeContactEmail?: string | null;
  natureOfSupply?: string | null;
  vatStatus?: string | null;
  vatNumber?: string | null;
  nonVatReason?: string | null;
  nonVatDeclarationAccepted?: boolean | null;
  accountName?: string | null;
  sortCode?: string | null;
  accountNumber?: string | null;
  supplierType?: string | null;
  whoEmploysWorkers?: string | null;
  umbrellaName?: string | null;
  umbrellaCrn?: string | null;
  subcontractorName?: string | null;
  subcontractorCrn?: string | null;
}

function trim(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/** Story 2: Company profile required for submit */
export function isCompanyProfileComplete(s: SupplierForValidation): boolean {
  if (!trim(s.contactName) || !trim(s.email)) return false;
  const hasRegistered =
    trim(s.registeredOfficeAddress) || trim(s.registeredOfficeCity) || trim(s.registeredOfficePostcode);
  if (!hasRegistered) return false;
  const sameAsRegistered = s.tradingSameAsRegistered !== false;
  const hasTrading =
    sameAsRegistered ||
    trim(s.tradingAddress) ||
    trim(s.tradingCity) ||
    trim(s.tradingPostcode);
  if (!hasTrading) return false;
  if (!trim(s.financeContactName) || !trim(s.financeContactEmail)) return false;
  if (!trim(s.natureOfSupply)) return false;
  return true;
}

/** Story 3: VAT path complete — status set and path-specific fields filled */
export function isVatPathComplete(s: SupplierForValidation): boolean {
  const status = (s.vatStatus ?? "").toLowerCase();
  if (status !== "vat_registered" && status !== "not_vat_registered") return false;
  if (status === "vat_registered") {
    return !!trim(s.vatNumber);
  }
  // not_vat_registered
  return !!trim(s.nonVatReason) && s.nonVatDeclarationAccepted === true;
}

/** Story 4: Bank details and proof (proof is required docs; here we check details) */
export function isBankDetailsComplete(s: SupplierForValidation): boolean {
  return !!trim(s.accountName) && !!trim(s.sortCode) && !!trim(s.accountNumber);
}

/** Story 5: Labour section complete when supplier type is labour */
export function isLabourSectionComplete(s: SupplierForValidation): boolean {
  if ((s.supplierType ?? "").toLowerCase() !== "labour") return true;
  const who = (s.whoEmploysWorkers ?? "").toLowerCase();
  if (!who || !["supplier", "umbrella", "subcontractor"].includes(who)) return false;
  if (who === "umbrella") {
    return !!trim(s.umbrellaName) && !!trim(s.umbrellaCrn);
  }
  if (who === "subcontractor") {
    return !!trim(s.subcontractorName) && !!trim(s.subcontractorCrn);
  }
  return true;
}

export type SubmitReadiness =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "company_profile"
        | "vat_path"
        | "bank_details"
        | "labour_section"
        | "documents";
      message: string;
      missingDocumentTypes?: string[];
    };

/**
 * Returns whether the supplier can submit onboarding (all sections + required docs).
 * Server and client can use this for consistent validation.
 */
export function getSubmitOnboardingReadiness(
  supplier: SupplierForValidation,
  uploadedDocumentTypes: string[]
): SubmitReadiness {
  if (!isCompanyProfileComplete(supplier)) {
    return {
      ok: false,
      reason: "company_profile",
      message:
        "Complete company profile: registered and trading address, finance contact, nature of supply.",
    };
  }
  if (!isVatPathComplete(supplier)) {
    return {
      ok: false,
      reason: "vat_path",
      message:
        "Complete VAT path: select VAT status and fill VAT number (if registered) or reason and declaration (if not registered).",
    };
  }
  if (!isBankDetailsComplete(supplier)) {
    return {
      ok: false,
      reason: "bank_details",
      message: "Complete bank details: account name, sort code, and account number.",
    };
  }
  if (!isLabourSectionComplete(supplier)) {
    return {
      ok: false,
      reason: "labour_section",
      message:
        "Complete labour section: who employs workers and umbrella/subcontractor details if applicable.",
    };
  }
  const required = getRequiredSupplierDocumentTypes(supplier);
  const missing = required.filter((t) => !uploadedDocumentTypes.includes(t));
  if (missing.length > 0) {
    return {
      ok: false,
      reason: "documents",
      message: "Upload all required documents before submitting.",
      missingDocumentTypes: missing,
    };
  }
  return { ok: true };
}

/** Convenience: can submit when status allows and readiness is ok */
export function canSubmitOnboarding(
  supplier: SupplierForValidation & { status?: string | null },
  uploadedDocumentTypes: string[]
): boolean {
  const status = supplier.status ?? "";
  if (status !== "draft" && status !== "info_required") return false;
  const readiness = getSubmitOnboardingReadiness(supplier, uploadedDocumentTypes);
  return readiness.ok;
}
