/**
 * Profile field keys that supplier and admin can edit, with display labels.
 * Used for "Request information" per field and for change logs.
 */
export const SUPPLIER_PROFILE_FIELD_LABELS: Record<string, string> = {
  companyName: "Company name",
  contactName: "Main contact name",
  email: "Email",
  phone: "Phone",
  address: "Address",
  city: "City",
  postcode: "Postcode",
  registeredOfficeAddress: "Registered office address",
  registeredOfficeCity: "Registered office city",
  registeredOfficePostcode: "Registered office postcode",
  registeredOfficeCountry: "Registered office country",
  tradingSameAsRegistered: "Trading same as registered",
  tradingAddress: "Trading address",
  tradingCity: "Trading city",
  tradingPostcode: "Trading postcode",
  financeContactName: "Finance contact name",
  financeContactEmail: "Finance contact email",
  natureOfSupply: "Nature of supply",
  vatNumber: "VAT number",
  vatStatus: "VAT status",
  nonVatReason: "Non-VAT reason",
  nonVatDeclarationAccepted: "Non-VAT declaration accepted",
  companyRegNumber: "Company registration number",
  bankName: "Bank name",
  accountName: "Account name",
  sortCode: "Sort code",
  accountNumber: "Account number",
  whoEmploysWorkers: "Who employs workers",
  umbrellaName: "Umbrella name",
  umbrellaCrn: "Umbrella CRN",
  subcontractorName: "Subcontractor name",
  subcontractorCrn: "Subcontractor CRN",
  subcontractingYes: "Subcontracting",
  payeCompliance: "PAYE compliance",
  rtwCompliance: "Right to work compliance",
  nmwCompliance: "National minimum wage compliance",
  selfBillingSignatureRequest: "Self Billing Signature request",
};

export function getSupplierFieldLabel(fieldKey: string): string {
  return SUPPLIER_PROFILE_FIELD_LABELS[fieldKey] ?? fieldKey;
}
