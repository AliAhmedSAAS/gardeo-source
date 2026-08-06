/**
 * UK supplier policy requirements based on:
 * - ISO 9001:2015 (Quality Management System)
 * - UK Health & Safety at Work Act 1974 / HSE requirements
 * - UK GDPR / Data Protection Act 2018
 * - Bribery Act 2010
 * - Modern Slavery Act 2015
 * - Equality Act 2010
 * - Public Interest Disclosure Act 1998 (Whistleblowing)
 * - HMRC IR35 / Off-Payroll Working Rules (Chapter 10 ITEPA 2003)
 * - HMRC PAYE / National Minimum Wage compliance
 * - Working Time Regulations 1998
 * - Immigration Act 2014 (Right to Work)
 */

export type SupplierPolicyType =
  // Required for ALL suppliers
  | "health_safety_policy"
  | "equal_opportunities_policy"
  | "data_protection_policy"
  | "anti_bribery_policy"
  | "quality_policy"
  | "environmental_policy"
  | "modern_slavery_statement"
  | "whistleblowing_policy"
  // Labour suppliers only (HMRC & employment law)
  | "right_to_work_policy"
  | "ir35_policy"
  | "paye_compliance_policy"
  | "working_time_policy"
  // Non-labour suppliers only
  | "supplier_code_of_conduct";

export interface SupplierForRequiredPolicies {
  supplierType?: string | null;
}

/** Human-readable labels for each policy type. */
export const SUPPLIER_POLICY_LABELS: Record<SupplierPolicyType, string> = {
  health_safety_policy: "Health & Safety Policy",
  equal_opportunities_policy: "Equal Opportunities Policy",
  data_protection_policy: "Data Protection & GDPR Policy",
  anti_bribery_policy: "Anti-Bribery & Corruption Policy",
  quality_policy: "Quality Policy (ISO 9001)",
  environmental_policy: "Environmental Policy",
  modern_slavery_statement: "Modern Slavery Statement",
  whistleblowing_policy: "Whistleblowing Policy",
  right_to_work_policy: "Right to Work Policy",
  ir35_policy: "IR35 / Off-Payroll Working Policy",
  paye_compliance_policy: "PAYE & National Minimum Wage Policy",
  working_time_policy: "Working Time Regulations Policy",
  supplier_code_of_conduct: "Supplier Code of Conduct",
};

/** Short description and legal basis shown below each policy item. */
export const SUPPLIER_POLICY_DESCRIPTIONS: Record<SupplierPolicyType, string> = {
  health_safety_policy:
    "Your documented Health & Safety policy as required under the Health & Safety at Work Act 1974 and ISO 9001:2015 clause 7.4. Must be signed by a director/senior manager.",
  equal_opportunities_policy:
    "Policy demonstrating compliance with the Equality Act 2010 covering age, disability, gender, race, religion, and other protected characteristics.",
  data_protection_policy:
    "Your Data Protection and UK GDPR policy as required under the Data Protection Act 2018. Must cover lawful basis for processing, data subject rights, and retention periods.",
  anti_bribery_policy:
    "Policy confirming compliance with the Bribery Act 2010. Must include procedures to prevent bribery and corruption within your organisation and supply chain.",
  quality_policy:
    "Your Quality Policy statement as required by ISO 9001:2015 clause 5.2. Must include commitment to quality objectives and continual improvement.",
  environmental_policy:
    "Environmental policy demonstrating your commitment to reducing environmental impact. Required under ISO 14001 and aligned with ISO 9001:2015 context of organisation.",
  modern_slavery_statement:
    "Statement or policy addressing modern slavery and human trafficking in line with the Modern Slavery Act 2015. Required for all supply chains operating in the UK.",
  whistleblowing_policy:
    "Policy protecting workers who report wrongdoing, as required under the Public Interest Disclosure Act 1998. Must include reporting channels and non-retaliation commitment.",
  right_to_work_policy:
    "Policy detailing your Right to Work checking procedures under the Immigration Act 2014 and HMRC guidelines. Must document checks performed before workers commence employment.",
  ir35_policy:
    "Policy covering your approach to IR35 / Off-Payroll Working Rules (Chapter 10, ITEPA 2003). Required under HMRC guidelines for labour supply chains using personal service companies.",
  paye_compliance_policy:
    "Policy confirming PAYE operation, National Minimum Wage compliance, and correct employment status determination. Required under HMRC guidance for labour suppliers.",
  working_time_policy:
    "Policy ensuring compliance with the Working Time Regulations 1998 including maximum weekly hours, rest breaks, and holiday entitlement for all workers.",
  supplier_code_of_conduct:
    "Your Supplier Code of Conduct setting out ethical, environmental, and quality standards you expect from your own supply chain, aligned with ISO 9001:2015 clause 8.4.",
};

/** Policy applicability category. */
export type PolicyApplicability = "all" | "labour_only" | "non_labour_only";

/** Which supplier types each policy applies to. */
export const SUPPLIER_POLICY_APPLICABILITY: Record<SupplierPolicyType, PolicyApplicability> = {
  health_safety_policy: "all",
  equal_opportunities_policy: "all",
  data_protection_policy: "all",
  anti_bribery_policy: "all",
  quality_policy: "all",
  environmental_policy: "all",
  modern_slavery_statement: "all",
  whistleblowing_policy: "all",
  right_to_work_policy: "labour_only",
  ir35_policy: "labour_only",
  paye_compliance_policy: "labour_only",
  working_time_policy: "labour_only",
  supplier_code_of_conduct: "non_labour_only",
};

/**
 * Returns the list of required policy types for a supplier based on their type.
 * All suppliers share 8 core policies; labour/non-labour have additional requirements.
 */
export function getRequiredSupplierPolicyTypes(
  supplier: SupplierForRequiredPolicies
): SupplierPolicyType[] {
  const allRequired: SupplierPolicyType[] = [
    "health_safety_policy",
    "equal_opportunities_policy",
    "data_protection_policy",
    "anti_bribery_policy",
    "quality_policy",
    "environmental_policy",
    "modern_slavery_statement",
    "whistleblowing_policy",
  ];

  const supplierType = (supplier.supplierType ?? "").toLowerCase();

  if (supplierType === "labour") {
    allRequired.push(
      "right_to_work_policy",
      "ir35_policy",
      "paye_compliance_policy",
      "working_time_policy"
    );
  } else if (supplierType === "non_labour") {
    allRequired.push("supplier_code_of_conduct");
  }

  return allRequired;
}

/** Returns true if all required policies have been uploaded (at least one per type). */
export function hasAllRequiredPolicies(
  supplier: SupplierForRequiredPolicies,
  uploadedTypes: string[]
): boolean {
  const required = getRequiredSupplierPolicyTypes(supplier);
  return required.every((type) => uploadedTypes.includes(type));
}
