export type VettingDocumentForm = {
  code: string;
  filename: string;
  label: string;
  category: "checklist" | "application" | "interview" | "reference" | "offer" | "induction" | "contract" | "job_description" | "hr" | "certificate";
  format: "docx" | "doc";
  /** Officer type slug for role-specific job descriptions (SF 14*) */
  officerTypeMatch?: string;
};

/** Legacy template company name baked into Word files — replaced at generation time. */
export const LEGACY_TEMPLATE_COMPANY_NAME = "CSTM SERVICES LTD";

export const VETTING_DOCUMENT_FORMS: VettingDocumentForm[] = [
  { code: "sf00", filename: "SF 00 S & V Sheet Checklist.docx", label: "S & V Sheet Checklist", category: "checklist", format: "docx" },
  { code: "sf01", filename: "SF 01 Application Form.docx", label: "Application Form", category: "application", format: "docx" },
  { code: "sf02", filename: "SF 02 OPT OUT Agreement.docx", label: "OPT OUT Agreement", category: "contract", format: "docx" },
  { code: "sf03", filename: "SF 03 Interview Notes.docx", label: "Interview Notes", category: "interview", format: "docx" },
  { code: "sf04", filename: "SF 04 Competency assessment for security personnel.docx", label: "Competency Assessment", category: "interview", format: "docx" },
  { code: "sf05", filename: "SF 05 Code of Conduct.docx", label: "Code of Conduct", category: "hr", format: "docx" },
  { code: "sf06", filename: "SF 06 Interview assessment.doc", label: "Interview Assessment", category: "interview", format: "doc" },
  { code: "sf07", filename: "SF 07 Equal Ops Review.docx", label: "Equal Ops Review", category: "interview", format: "docx" },
  { code: "sf08", filename: "SF 08 Reference Tracker.docx", label: "Reference Tracker", category: "reference", format: "docx" },
  { code: "sf09", filename: "SF 09 Offer of employment.docx", label: "Offer of Employment", category: "offer", format: "docx" },
  { code: "sf10", filename: "SF 10 Induction Checklist.docx", label: "Induction Checklist", category: "induction", format: "docx" },
  { code: "sf11", filename: "SF 11 Induction Record .doc", label: "Induction Record", category: "induction", format: "doc" },
  { code: "sf12", filename: "SF 12 Training Record.docx", label: "Training Record", category: "induction", format: "docx" },
  { code: "sf13", filename: "SF 13 Employment Contract.docx", label: "Employment Contract", category: "contract", format: "docx" },
  { code: "sf13b", filename: "SF 13B Zero Hours Contract 2.docx", label: "Zero Hours Contract", category: "contract", format: "docx" },
  { code: "sf14a", filename: "SF 14A Job Description- Door Supervisor.doc", label: "Job Description — Door Supervisor", category: "job_description", format: "doc", officerTypeMatch: "door supervisor" },
  { code: "sf14b", filename: "SF 14B Job Description-head door supervisor.doc", label: "Job Description — Head Door Supervisor", category: "job_description", format: "doc", officerTypeMatch: "head door supervisor" },
  { code: "sf14c", filename: "SF 14C Job Description - Security Guard.docx", label: "Job Description — Security Guard", category: "job_description", format: "docx", officerTypeMatch: "security guard" },
  { code: "sf14d", filename: "SF 14D Job Description - Operations Manager.docx", label: "Job Description — Operations Manager", category: "job_description", format: "docx", officerTypeMatch: "operations manager" },
  { code: "sf14e", filename: "SF 14E Job Description - Managing director.docx", label: "Job Description — Managing Director", category: "job_description", format: "docx", officerTypeMatch: "managing director" },
  { code: "sf14f", filename: "SF 14F Job Description - CCTV.docx", label: "Job Description — CCTV", category: "job_description", format: "docx", officerTypeMatch: "cctv" },
  { code: "sf14f-events", filename: "SF 14F Job Description- Events Staff.doc", label: "Job Description — Events Staff", category: "job_description", format: "doc", officerTypeMatch: "events" },
  { code: "sf14g", filename: "SF 14G Job Description - Vetting Officer.docx", label: "Job Description — Vetting Officer", category: "job_description", format: "docx", officerTypeMatch: "vetting officer" },
  { code: "sf15", filename: "SF 15 Employee Feedback Questionnaire.docx", label: "Employee Feedback Questionnaire", category: "hr", format: "docx" },
  { code: "sf16", filename: "SF 16  Staff Appraisal.docx", label: "Staff Appraisal", category: "hr", format: "docx" },
  { code: "sf17", filename: "SF 17 Completion Cert.docx", label: "Completion Certificate", category: "certificate", format: "docx" },
  { code: "ref01", filename: "LETTERS/REF 01 PERSONAL REFERENCE.docx", label: "Personal Reference Letter", category: "reference", format: "docx" },
  { code: "ref02", filename: "LETTERS/REF 02 CONFIRMATION EX EMPLOYER.doc", label: "Ex-Employer Reference", category: "reference", format: "doc" },
  { code: "ref03", filename: "LETTERS/REF 03 COLLEGE REF FORM.doc", label: "College Reference Form", category: "reference", format: "doc" },
];

export function getVettingFormByCode(code: string): VettingDocumentForm | undefined {
  return VETTING_DOCUMENT_FORMS.find((f) => f.code === code.toLowerCase());
}

export function listVettingFormsForEmployee(officerType?: string | null): VettingDocumentForm[] {
  const normalized = (officerType || "").trim().toLowerCase();
  return VETTING_DOCUMENT_FORMS.filter((form) => {
    if (form.format === "doc") return false;
    if (!form.officerTypeMatch) return true;
    if (!normalized) return true;
    return normalized.includes(form.officerTypeMatch) || form.officerTypeMatch.includes(normalized);
  });
}
