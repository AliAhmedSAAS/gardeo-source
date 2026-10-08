/**
 * Sage / UK payroll software employee datasheet columns
 * (matches "payroll data sheet -format.csv" import template).
 */
export const PAYROLL_DATASHEET_HEADERS = [
  "Employee Reference",
  "Title",
  "Initial",
  "Forename",
  "Surname",
  "Address 1",
  "Address 2",
  "Address 3",
  "Address 4",
  "Address 5",
  "Post Code",
  "Telephone Number",
  "Mobile Number",
  "E-mail Address",
  "Gender",
  "Marital Status",
  "Previous Surname",
  "Date of Birth",
  "Disabled",
  "Nationality",
  "Ethnic Origin",
  "Contact",
  "Contact Relationship",
  "Contact Permission",
  "Contact Telephone No.",
  "Contact Address 1",
  "Contact Address 2",
  "Contact Address 3",
  "Contact Address 4",
  "Contact Address 5",
  "Contact Postcode",
  "Contact Mobile",
  "Contact Email",
  "Tax Code",
  "Wk1Mth1 Basis",
  "NI Category",
  "Manual NIC",
  "NI Number",
  "Starter Form",
  "Welfare to Work",
  "Works Reference",
  "Director Status",
  "Date Directorship Began",
  "Payment Method",
  "Payment Frequency",
  "Work Start Date",
  "Work End Date",
  "SLR From Date",
  "SLR to Date",
  "SLR Plan Type",
  "Minimum Wage Check",
  "Non UK Worker",
  "Apprenticeship Start Date",
  "Apprenticeship End Date",
  "Status",
  "Gross Salary",
  "Salary Per Period",
  "Contracted Hours",
  "Contracted Hours Per Period",
  "Pension 1",
  "Pension 2",
  "Pension 3",
  "Pension 4",
  "Pension 5",
  "Holiday Scheme",
  "Sort Code",
  "Bank Account Number",
  "Bank Account Name",
  "Bank Account Type",
  "Building Soc Number",
  "BACS Reference",
  "Bank Name",
  "Bank Address 1",
  "Bank Address 2",
  "Bank Address 3",
  "Bank Address 4",
  "Bank Address 5",
  "Bank Post Code",
  "Bank Telephone",
  "Bank Fax",
  "Department Reference",
  "Cost Centre Reference",
  "Notes",
  "Access Level",
  "Analysis 1",
  "Analysis 2",
  "Analysis 3",
  "Last Processed Date",
  "Final Pay Run",
  "Manual SSP",
  "SSP QD Pattern Start Date",
  "SSP Band",
  "Start PIW Date",
  "End PIW Date",
  "SSP Waiting Days",
  "Returned to Work Date",
  "Manual SMP",
  "SMP EWC",
  "SMP Date of Birth",
  "SMP End Work Date",
  "SMP Returned to Work Date",
  "SMP Weeks Worked MPP",
  "SMP Weeks Trade Dispute",
  "SMP Average Gross Pay",
  "SMP Medical Evidence",
  "SMP Pregnancy Related sickness",
  "Manual SAP",
  "SAP Matching Date",
  "SAP Expected Date of Placement",
  "SAP Actual Date of Placement",
  "SAP End Work Date",
  "SAP Returned to Work Date",
  "Weeks Worked during SAP",
  "SAP Weeks Trade Dispute",
  "SAP Average Gross Pay",
  "SAP Evidence",
  "Manual SPP",
  "SPP Baby Due Date",
  "SPP Date of Birth",
  "SPP End Work Date",
  "SPP Returned to Work Date",
  "Weeks Worked during SPP",
  "SPP Weeks Trade Dispute",
  "SPP Average Gross Pay",
  "SPP Declaration Received",
  "ASPP Declaration Received",
  "ASPP Mother Declaration",
  "ASPP Start Date for MPP",
  "ASPP Ended Work Date",
  "ASPP Returned to Work Date",
  "ASPP Started by death",
  "ASPP KIT Days Worked",
  "Weeks Worked during APPP",
  "ASPP Partner Forenames",
  "ASPP Partner Surname",
  "ASPP Partner NINO",
  "Manual SPPA",
  "SPPA Matching Date",
  "SPPA Expected Date of Placement",
  "SPPA Actual Date of Placement",
  "SPPA End Work Date",
  "SPPA Returned to Work Date",
  "Weeks Worked during SPPA",
  "SPPA Weeks Trade Dispute",
  "SPPA Average Gross Pay",
  "SPPA Declaration Received",
  "ASPPA Declaration Received",
  "ASPPA Co-Adopter Declaration",
  "ASPPA Start Date for APP",
  "ASPPA Ended Work Date",
  "ASPPA Returned to Work Date",
  "ASPPA Started by death",
  "ASPPA KIT Days Worked",
  "Weeks Worked during APPPA",
  "ASPPA Partner Forenames",
  "ASPPA Partner Surname",
  "ASPPA Partner NINO",
  "Job Title",
  "Employment Type",
  "Payroll ID",
  "Previous Payroll ID Status",
  "IBAN",
  "BIC",
  "Second Bank Sort Code",
  "Second Bank Account Number",
  "Second Bank Account Name",
  "Second Bank Account Type",
  "Second Building Soc Number",
  "Second BACS Reference",
  "Second Bank Name",
  "Second Bank Address 1",
  "Second Bank Address 2",
  "Second Bank Address 3",
  "Second Bank Address 4",
  "Second Bank Address 5",
  "Second Bank Postcode",
  "Second Bank Telephone",
  "Second Bank Fax",
  "Second Bank Account IBAN",
  "Second Bank Account BIC",
  "ShPP Declaration",
  "ShPP Weeks Available",
  "ShPP Weeks being Taken",
  "ShPP Partner Forenames",
  "ShPP Partner Surname",
  "ShPP Partner NINO",
  "ShPP SPLiT Days",
  "Net of Foreign Tax",
  "Right To Work Confirm Status",
  "Right To Work Document Type",
  "Right To Work Document Expiry Date",
  "Right To Work Reference",
  "Auto Enrolment Exclusion Reason",
  "PGLR From Date",
  "PGLR To Date",
  "Tax Code Effective From Date",
  "First Day of Civilian Employment",
] as const;

export type PayrollDatasheetHeader = (typeof PAYROLL_DATASHEET_HEADERS)[number];

/** DD-MM-YY to match Sage import samples (e.g. 13-01-89, 01-08-26). */
export function formatDatasheetDate(v: unknown): string {
  if (v == null || v === "") return "";
  let y: number;
  let m: number;
  let d: number;
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    y = v.getFullYear();
    m = v.getMonth() + 1;
    d = v.getDate();
  } else {
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      y = parseInt(s.slice(0, 4), 10);
      m = parseInt(s.slice(5, 7), 10);
      d = parseInt(s.slice(8, 10), 10);
    } else if (/^\d{2}-\d{2}-\d{2,4}$/.test(s)) {
      return s.length === 8 ? s : s; // already DD-MM-YY(YY)
    } else {
      const parsed = new Date(s);
      if (Number.isNaN(parsed.getTime())) return "";
      y = parsed.getFullYear();
      m = parsed.getMonth() + 1;
      d = parsed.getDate();
    }
  }
  if (!y || y < 1900) return "";
  return `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-${String(y).slice(-2)}`;
}

export function titleFromGender(gender: string | null | undefined): string {
  const g = String(gender || "").trim().toLowerCase();
  if (g === "female" || g === "f") return "Miss.";
  if (g === "male" || g === "m") return "Mr.";
  return "";
}

export type PayrollDatasheetSource = {
  employeeNumber?: string | null;
  externalId?: string | null;
  employeeId: number;
  firstName?: string | null;
  lastName?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  county?: string | null;
  postcode?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  dateOfBirth?: unknown;
  nationality?: string | null;
  ethnicOrigin?: string | null;
  nationalInsurance?: string | null;
  jobTitle?: string | null;
  employmentType?: string | null;
  department?: string | null;
  startDate?: unknown;
  /** First day of the payroll month being exported (Work Start Date). */
  workStartDate?: unknown;
  contactName?: string | null;
  contactRelationship?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactAddress?: string | null;
  sortCode?: string | null;
  accountNumber?: string | null;
  accountName?: string | null;
  bankName?: string | null;
};

export function buildPayrollDatasheetRow(src: PayrollDatasheetSource): Record<PayrollDatasheetHeader, string> {
  const row = Object.fromEntries(PAYROLL_DATASHEET_HEADERS.map((h) => [h, ""])) as Record<
    PayrollDatasheetHeader,
    string
  >;

  const forename = String(src.firstName || "").trim().toUpperCase();
  const surname = String(src.lastName || "").trim().toUpperCase();
  const ref = String(src.employeeNumber || src.externalId || src.employeeId).trim();
  const phone = String(src.phone || src.mobile || "").trim();
  const mobile = String(src.mobile || src.phone || "").trim();

  row["Employee Reference"] = ref;
  row["Title"] = titleFromGender(src.gender);
  row["Initial"] = [forename, surname].filter(Boolean).join(" ");
  row["Forename"] = forename;
  row["Surname"] = surname;
  row["Address 1"] = String(src.addressLine1 || "").trim();
  row["Address 2"] = String(src.county || src.city || "").trim().toUpperCase();
  row["Address 3"] = String(src.externalId || src.addressLine2 || src.employeeId).trim();
  row["Post Code"] = String(src.postcode || "").trim().toUpperCase();
  row["Telephone Number"] = phone;
  row["Mobile Number"] = mobile;
  row["E-mail Address"] = String(src.email || "").trim();
  row["Gender"] = String(src.gender || "").trim();
  row["Marital Status"] = String(src.maritalStatus || "").trim().toLowerCase();
  row["Date of Birth"] = formatDatasheetDate(src.dateOfBirth);
  row["Nationality"] = String(src.nationality || "").trim();
  row["Ethnic Origin"] = String(src.ethnicOrigin || "").trim();
  row["Contact"] = String(src.contactName || "").trim();
  row["Contact Relationship"] = String(src.contactRelationship || "").trim();
  row["Contact Telephone No."] = String(src.contactPhone || "").trim();
  row["Contact Address 1"] = String(src.contactAddress || "").trim();
  row["Contact Email"] = String(src.contactEmail || "").trim();
  row["Tax Code"] = "1257L";
  row["NI Category"] = "A";
  row["NI Number"] = String(src.nationalInsurance || "").trim();
  row["Works Reference"] = ref;
  row["Payment Frequency"] = "Monthly";
  row["Work Start Date"] = formatDatasheetDate(src.workStartDate || src.startDate);
  row["Sort Code"] = String(src.sortCode || "").replace(/\s/g, "");
  row["Bank Account Number"] = String(src.accountNumber || "").trim();
  row["Bank Account Name"] = String(src.accountName || "").trim();
  row["Bank Name"] = String(src.bankName || "").trim();
  row["Department Reference"] = String(src.department || "").trim();
  row["Job Title"] = String(src.jobTitle || "").trim();
  row["Employment Type"] = String(src.employmentType || "").trim();
  row["Right To Work Confirm Status"] = "1";

  return row;
}

export function payrollDatasheetRowToCells(row: Record<PayrollDatasheetHeader, string>): string[] {
  return PAYROLL_DATASHEET_HEADERS.map((h) => row[h] ?? "");
}

export function escapePayrollDatasheetCsv(val: unknown): string {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildPayrollDatasheetCsv(rows: Record<PayrollDatasheetHeader, string>[]): string {
  const lines = [
    PAYROLL_DATASHEET_HEADERS.map(escapePayrollDatasheetCsv).join(","),
    ...rows.map((r) => payrollDatasheetRowToCells(r).map(escapePayrollDatasheetCsv).join(",")),
  ];
  return `\uFEFF${lines.join("\r\n")}`;
}
