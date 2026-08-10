import fs from "fs";
import path from "path";
import JSZip from "jszip";
import type { Employee, Tenant, User } from "@shared/schema";
import {
  getVettingFormByCode,
  LEGACY_TEMPLATE_COMPANY_NAME,
  listVettingFormsForEmployee,
  type VettingDocumentForm,
} from "@shared/vettingDocumentForms";
import { generateVettingCompletionCertPdf } from "./pdf-service";

const VETTING_DOCS_DIR = path.join(process.cwd(), "docs", "8 - SCREENING & VETTING");
const PARA_REGEX = /<w:p[^>]*>[\s\S]*?<\/w:p>/g;
const WT_REGEX = /<w:t([^>]*)>([^<]*)<\/w:t>/g;
const TABLE_REGEX = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
const ROW_REGEX = /<w:tr[^>]*>[\s\S]*?<\/w:tr>/g;
const CELL_REGEX = /<w:tc>[\s\S]*?<\/w:tc>/g;

function formatUkDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatUkLongDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function joinAddress(parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p && String(p).trim()).join(", ");
}

type VettingEmployeeSource = Employee & {
  maritalStatus?: string | null;
  carOwner?: string | null;
  emergencyContacts?: Array<{ name?: string | null; relationship?: string | null; phone?: string | null; address?: string | null; isPrimary?: boolean | null }>;
  bankDetails?: { accountName?: string | null; bankName?: string | null; sortCode?: string | null; accountNumber?: string | null } | null;
  drivingLicences?: Array<{ licenceNumber?: string | null }>;
  health?: {
    height?: string | null;
    weight?: string | null;
    colourOfEyes?: string | null;
  } | null;
  education?: Array<{
    institution?: string | null;
    qualification?: string | null;
    dateFrom?: string | Date | null;
    dateTo?: string | Date | null;
    notes?: string | null;
  }>;
  employmentHistory?: Array<{
    employerName?: string | null;
    jobTitle?: string | null;
    dateFrom?: string | Date | null;
    dateTo?: string | Date | null;
    reasonForLeaving?: string | null;
    duties?: string | null;
    refereePhone?: string | null;
    refereeEmail?: string | null;
    refereeAddress?: string | null;
    requestedDate?: string | Date | null;
    submittedDate?: string | Date | null;
    verificationStatus?: string | null;
    screeningComments?: string | null;
  }>;
  references?: Array<{
    refereeName?: string | null;
    relationship?: string | null;
    howLongKnown?: string | null;
    refereePhone?: string | null;
    requestedDate?: string | Date | null;
    responseDate?: string | Date | null;
    verificationStatus?: string | null;
    screeningComments?: string | null;
    referenceKind?: string | null;
  }>;
  /** Latest public vetting-form answers (screening / yes-no declarations). */
  screeningAnswers?: {
    heardAboutRole?: string | null;
    carOwner?: string | null;
    maritalStatus?: string | null;
    criminalConviction?: string | null;
    criminalConvictionDetails?: string | null;
    beenBankrupt?: string | null;
    hasCcj?: string | null;
    objectToCreditAgency?: string | null;
    agreeSiaCriminalCheck?: string | null;
    understandConsequences?: string | null;
    agreeCreditCheck?: string | null;
  } | null;
};

export type VettingMergeContext = Record<string, string>;

function splitEmployeeName(fullName: string): { firstNames: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstNames: "", surname: "" };
  if (parts.length === 1) return { firstNames: parts[0], surname: "" };
  return { surname: parts[parts.length - 1], firstNames: parts.slice(0, -1).join(" ") };
}

export function buildVettingMergeContext(
  tenant: Tenant,
  employee: VettingEmployeeSource,
  empUser: User | null | undefined,
): VettingMergeContext {
  const companyName = tenant.name || LEGACY_TEMPLATE_COMPANY_NAME;
  const tradingName = tenant.tradingName || companyName;
  const companyAddress =
    joinAddress([tenant.addressLine1, tenant.addressLine2, tenant.city, tenant.county, tenant.postcode]) ||
    tenant.address ||
    "";
  const employeeName =
    `${empUser?.firstName || ""} ${empUser?.lastName || ""}`.trim() ||
    employee.employeeNumber ||
    "Employee";
  const { firstNames, surname } = splitEmployeeName(employeeName);
  const employeeAddress = joinAddress([
    employee.addressLine1,
    employee.addressLine2,
    employee.city,
    employee.county,
    employee.postcode,
  ]);
  const previousAddress = joinAddress([
    employee.previousAddressLine1,
    employee.previousAddressLine2,
    employee.previousCity,
    employee.previousCounty,
    employee.previousPostcode,
  ]);
  const primaryEmergency =
    employee.emergencyContacts?.find((c) => c.isPrimary) ||
    employee.emergencyContacts?.[0];
  const bankDetails = employee.bankDetails || null;
  const history = employee.employmentHistory || [];
  const firstHistory = history[0] || null;
  const secondHistory = history[1] || null;
  const thirdHistory = history[2] || null;
  const fourthHistory = history[3] || null;
  const fifthHistory = history[4] || null;
  const drivingLicenceNumber = employee.drivingLicences?.[0]?.licenceNumber || "";
  const screening = employee.screeningAnswers || {};
  const carOwnerRaw = String(screening.carOwner || employee.carOwner || "").trim().toLowerCase();
  const carOwnerLabel =
    carOwnerRaw === "yes" ? "YES" : carOwnerRaw === "no" ? "NO" : String(screening.carOwner || employee.carOwner || "").toUpperCase();
  const maritalStatus = String(screening.maritalStatus || employee.maritalStatus || "").trim();
  const criminalConviction = normalizeYesNo(screening.criminalConviction);
  const beenBankrupt = normalizeYesNo(screening.beenBankrupt);
  const hasCcj = normalizeYesNo(screening.hasCcj);
  const objectToCreditAgency = normalizeYesNo(screening.objectToCreditAgency);
  const agreeSiaCriminalCheck = normalizeYesNo(screening.agreeSiaCriminalCheck);
  const understandConsequences = normalizeYesNo(screening.understandConsequences);
  const agreeCreditCheck = normalizeYesNo(screening.agreeCreditCheck);
  const health = employee.health || null;
  const education = employee.education || [];
  const school =
    education.find((e) => /school|secondary/i.test(`${e.qualification || ""} ${e.notes || ""}`)) ||
    education[0] ||
    null;
  const college =
    education.find(
      (e) => e !== school && /college|university|further/i.test(`${e.qualification || ""} ${e.institution || ""}`),
    ) ||
    education[1] ||
    null;
  const today = formatUkLongDate(new Date());
  const vettingFrom = formatUkDate(employee.vettingStartDate || employee.startDate);
  const vettingFromParts = vettingFrom.split("/");

  const employmentSlot = (row: (typeof history)[0] | null | undefined, n: number) => ({
    [`EMPLOYMENT_${n}_NAME`]: row?.employerName || "",
    [`EMPLOYMENT_${n}_TITLE`]: row?.jobTitle || "",
    [`EMPLOYMENT_${n}_START`]: formatUkDate(row?.dateFrom),
    [`EMPLOYMENT_${n}_END`]: formatUkDate(row?.dateTo),
    [`EMPLOYMENT_${n}_REASON`]: row?.reasonForLeaving || "",
    [`EMPLOYMENT_${n}_PHONE`]: row?.refereePhone || "",
    [`EMPLOYMENT_${n}_ADDRESS`]: row?.refereeAddress || "",
    [`EMPLOYMENT_${n}_REFEREE`]: extractRefereeNameFromDuties(row?.duties),
  });

  return {
    COMPANY_NAME: companyName,
    TRADING_NAME: tradingName,
    COMPANY_ADDRESS: companyAddress,
    COMPANY_REG: tenant.companyRegNumber || "",
    VAT_NUMBER: tenant.vatNumber || "",
    SIA_ACS: tenant.siaAcsNumber || "",
    COMPANY_PHONE: tenant.phone || "",
    COMPANY_EMAIL: tenant.email || "",
    COMPANY_WEBSITE: tenant.website || "",
    HR_SIGNATORY_NAME: tenant.hrSignatoryName || "",
    HR_SIGNATORY_POSITION: tenant.hrSignatoryPosition || "Vetting Officer",
    HR_SIGNATURE_DATE: tenant.hrSignatureDate ? formatUkLongDate(tenant.hrSignatureDate) : today,
    EMPLOYEE_NAME: employeeName,
    EMPLOYEE_FIRST_NAMES: firstNames,
    EMPLOYEE_SURNAME: surname,
    EMPLOYEE_NUMBER: employee.employeeNumber || "",
    NI_NUMBER: employee.nationalInsurance || "",
    MARITAL_STATUS: maritalStatus,
    DOB: formatUkDate(employee.dateOfBirth),
    PLACE_OF_BIRTH: employee.placeOfBirth || "",
    GENDER: employee.gender || "",
    NATIONALITY: employee.nationality || "",
    HEARD_ABOUT_ROLE: String(screening.heardAboutRole || "").trim(),
    CRIMINAL_CONVICTION: criminalConviction,
    CRIMINAL_CONVICTION_DETAILS: String(screening.criminalConvictionDetails || "").trim(),
    BEEN_BANKRUPT: beenBankrupt,
    HAS_CCJ: hasCcj,
    OBJECT_TO_CREDIT_AGENCY: objectToCreditAgency,
    AGREE_SIA_CHECK: agreeSiaCriminalCheck,
    UNDERSTAND_CONSEQUENCES: understandConsequences,
    AGREE_CREDIT_CHECK: agreeCreditCheck,
    EMPLOYEE_ADDRESS: employeeAddress,
    PREVIOUS_ADDRESS: previousAddress,
    PREVIOUS_LIVING_FROM: formatUkDate(employee.previousLivingFrom),
    PREVIOUS_LIVING_TO: formatUkDate(employee.previousLivingTo),
    LIVING_FROM: formatUkDate(employee.livingFrom),
    EMPLOYEE_PHONE: employee.phone || empUser?.phone || "",
    EMPLOYEE_MOBILE: employee.secondPhone || employee.phone || empUser?.phone || "",
    EMPLOYEE_EMAIL: empUser?.email || employee.portalEmail || "",
    SIA_LICENCE: employee.siaLicenseNumber || "",
    SIA_EXPIRY: formatUkDate(employee.siaExpiryDate),
    DRIVING_LICENCE: drivingLicenceNumber,
    CAR_OWNER: carOwnerLabel,
    HEIGHT: health?.height || "",
    WEIGHT: health?.weight || "",
    COLOUR_OF_EYES: health?.colourOfEyes || "",
    SCHOOL_NAME: school?.institution || "",
    SCHOOL_TOWN: school?.notes || "",
    SCHOOL_LEFT: formatUkDate(school?.dateTo),
    COLLEGE_DETAILS: [college?.institution, formatUkDate(college?.dateFrom), formatUkDate(college?.dateTo)]
      .filter(Boolean)
      .join(" — "),
    JOB_TITLE: employee.jobTitle || employee.officerType || "Security Operative",
    OFFICER_TYPE: employee.officerType || "Security Operative",
    START_DATE: formatUkDate(employee.startDate),
    VETTING_START: vettingFrom,
    VETTING_START_DAY: vettingFromParts[0] || "",
    VETTING_START_MONTH: vettingFromParts[1] || "",
    VETTING_START_YEAR: vettingFromParts[2] || "",
    VETTING_COMPLETE: formatUkDate(employee.vettingCompleteAt),
    APPOINTMENT_DATE: formatUkDate(employee.startDate || employee.vettingStartDate),
    EMERGENCY_CONTACT_NAME: primaryEmergency?.name || "",
    EMERGENCY_CONTACT_ADDRESS: primaryEmergency?.address || "",
    EMERGENCY_CONTACT_RELATIONSHIP: primaryEmergency?.relationship || "",
    EMERGENCY_CONTACT_PHONE: primaryEmergency?.phone || "",
    BANK_ACCOUNT_NUMBER: bankDetails?.accountNumber || "",
    BANK_SORT_CODE: bankDetails?.sortCode || "",
    BANK_NAME: bankDetails?.bankName || "",
    BANK_ACCOUNT_NAME: bankDetails?.accountName || "",
    ...employmentSlot(firstHistory, 1),
    ...employmentSlot(secondHistory, 2),
    ...employmentSlot(thirdHistory, 3),
    ...employmentSlot(fourthHistory, 4),
    ...employmentSlot(fifthHistory, 5),
    TODAY: today,
    TODAY_SHORT: formatUkDate(new Date()),
  };
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeYesNo(value: string | null | undefined): "YES" | "NO" | "" {
  const v = String(value || "").trim().toLowerCase();
  if (["yes", "y", "true", "1"].includes(v)) return "YES";
  if (["no", "n", "false", "0"].includes(v)) return "NO";
  return "";
}

function yellowTextRun(text: string): string {
  return `<w:r><w:rPr><w:highlight w:val="yellow"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function plainTextRun(text: string): string {
  return `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function replaceParagraphRuns(paragraphXml: string, runsXml: string): string {
  const withoutRuns = paragraphXml.replace(/<w:r[\s\S]*?<\/w:r>/g, "");
  return withoutRuns.replace(/<\/w:p>\s*$/, `${runsXml}</w:p>`);
}

function setParagraphHighlighted(paragraphXml: string, text: string): string {
  return replaceParagraphRuns(paragraphXml, yellowTextRun(text));
}

/** Rewrite a label that ends with YES/NO, highlighting the selected answer in yellow. */
function markInlineYesNo(paragraphXml: string, originalText: string, choice: "YES" | "NO" | ""): string {
  if (!choice) return paragraphXml;
  if (!/YES\s*\/\s*NO/i.test(originalText)) return paragraphXml;

  // Support one or two YES/NO pairs in the same paragraph (bankrupt + CCJ).
  const parts = originalText.split(/(YES\s*\/\s*NO\s*\??)/i);
  let yesNoIndex = 0;
  const choices = [choice];
  // Caller can pass a second choice via a special delimiter in choice... instead handle multi via dedicated helper.
  let runs = "";
  for (const part of parts) {
    if (/^YES\s*\/\s*NO/i.test(part)) {
      const selected = choices[Math.min(yesNoIndex, choices.length - 1)];
      runs += yellowTextRun(selected);
      yesNoIndex += 1;
    } else if (part) {
      runs += plainTextRun(part);
    }
  }
  return replaceParagraphRuns(paragraphXml, runs);
}

function markDualInlineYesNo(
  paragraphXml: string,
  originalText: string,
  first: "YES" | "NO" | "",
  second: "YES" | "NO" | "",
): string {
  if (!first && !second) return paragraphXml;
  const parts = originalText.split(/(YES\s*\/\s*NO\s*\??)/i);
  let idx = 0;
  const picks = [first, second];
  let runs = "";
  for (const part of parts) {
    if (/^YES\s*\/\s*NO/i.test(part)) {
      const selected = picks[idx] || "";
      runs += selected ? yellowTextRun(selected) : plainTextRun(part);
      idx += 1;
    } else if (part) {
      runs += plainTextRun(part);
    }
  }
  return replaceParagraphRuns(paragraphXml, runs);
}

function getParagraphText(paragraphXml: string): string {
  return Array.from(paragraphXml.matchAll(WT_REGEX)).map((m) => m[2]).join("");
}

function setParagraphText(paragraphXml: string, newText: string): string {
  if (!WT_REGEX.test(paragraphXml)) {
    const run = `<w:r><w:t xml:space="preserve">${escapeXml(newText)}</w:t></w:r>`;
    return paragraphXml.replace(/<\/w:p>\s*$/, `${run}</w:p>`);
  }
  WT_REGEX.lastIndex = 0;
  let used = false;
  return paragraphXml.replace(WT_REGEX, (_match, attrs: string) => {
    if (!used) {
      used = true;
      return `<w:t${attrs}>${escapeXml(newText)}</w:t>`;
    }
    return `<w:t${attrs}></w:t>`;
  });
}

function isBlankish(text: string, paragraphXml?: string): boolean {
  if (paragraphXml && !WT_REGEX.test(paragraphXml)) {
    WT_REGEX.lastIndex = 0;
    return true;
  }
  WT_REGEX.lastIndex = 0;
  const t = text.replace(/\u00a0/g, " ").trim();
  return !t || /^[\s._?\uFFFD/-]+$/.test(t);
}

function fillNextBlankParagraph(paragraphs: string[], startIndex: number, value: string): number {
  if (!value) return startIndex;
  for (let i = startIndex + 1; i < Math.min(startIndex + 4, paragraphs.length); i++) {
    const text = getParagraphText(paragraphs[i]).replace(/\u00a0/g, " ");
    if (isBlankish(text, paragraphs[i])) {
      paragraphs[i] = setParagraphText(paragraphs[i], value.toUpperCase());
      return i;
    }
  }
  return startIndex;
}

function fillSpecificBlankParagraph(paragraphs: string[], index: number, value: string): void {
  if (!value || index < 0 || index >= paragraphs.length) return;
  paragraphs[index] = setParagraphText(paragraphs[index], value.toUpperCase());
}

function applyParagraphFormFills(xml: string, ctx: VettingMergeContext): string {
  const paragraphs = [...xml.matchAll(PARA_REGEX)].map((m) => m[0]);
  if (paragraphs.length === 0) return xml;

  for (let i = 0; i < paragraphs.length; i++) {
    const text = getParagraphText(paragraphs[i]).replace(/\u00a0/g, " ").trim();
    const upper = text.toUpperCase();

    if (text === "Address" && ctx.COMPANY_ADDRESS) {
      paragraphs[i] = setParagraphText(paragraphs[i], ctx.COMPANY_ADDRESS);
      continue;
    }
    if (text === "Dear" && ctx.EMPLOYEE_NAME) {
      paragraphs[i] = setParagraphText(paragraphs[i], `Dear ${ctx.EMPLOYEE_NAME},`);
      continue;
    }
    if (upper === "SURNAME:" || upper === "SURNAME") {
      i = fillNextBlankParagraph(paragraphs, i, ctx.EMPLOYEE_SURNAME || ctx.EMPLOYEE_NAME);
      continue;
    }
    if (upper.startsWith("FIRST NAMES")) {
      i = fillNextBlankParagraph(paragraphs, i, ctx.EMPLOYEE_FIRST_NAMES);
      continue;
    }
    if (upper === "CURRENT" && i + 2 < paragraphs.length) {
      const next = getParagraphText(paragraphs[i + 1]).toUpperCase();
      if (next.startsWith("ADDRESS")) {
        i = fillNextBlankParagraph(paragraphs, i + 1, ctx.EMPLOYEE_ADDRESS);
        continue;
      }
    }
    if (upper === "ADDRESS:" && i > 0) {
      const prev = getParagraphText(paragraphs[i - 1]).toUpperCase();
      if (prev.includes("CURRENT") || prev === "ADDRESS:") {
        i = fillNextBlankParagraph(paragraphs, i, ctx.EMPLOYEE_ADDRESS);
        continue;
      }
    }
    if (upper === "TELEPHONE:") {
      i = fillNextBlankParagraph(paragraphs, i, ctx.EMPLOYEE_PHONE);
      continue;
    }
    if (upper.startsWith("MOBILE NO")) {
      i = fillNextBlankParagraph(paragraphs, i, ctx.EMPLOYEE_MOBILE || ctx.EMPLOYEE_PHONE);
      continue;
    }
    if (upper === "PREVIOUS" && i + 1 < paragraphs.length) {
      const next = getParagraphText(paragraphs[i + 1]).toUpperCase();
      if (next.startsWith("ADDRESS")) {
        // Skip "IF LESS THAN 3 YEARS..." label block, then fill the next blank.
        let fillAt = i + 1;
        for (let j = i + 2; j < Math.min(i + 8, paragraphs.length); j++) {
          const t = getParagraphText(paragraphs[j]).replace(/\u00a0/g, " ").trim().toUpperCase();
          if (!t || t.startsWith("IF LESS") || t.startsWith("3 YEARS") || t === "ABOVE," || t === "ABOVE") {
            fillAt = j;
            continue;
          }
          break;
        }
        i = fillNextBlankParagraph(paragraphs, fillAt, ctx.PREVIOUS_ADDRESS);
        continue;
      }
    }
    if (upper.startsWith("CURRENT DRIVING LICENCE")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.DRIVING_LICENCE
          ? `CURRENT DRIVING LICENCE: ${ctx.DRIVING_LICENCE}`
          : "CURRENT DRIVING LICENCE: NO",
      );
      continue;
    }
    if (upper.startsWith("CAR OWNER")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.CAR_OWNER ? `CAR OWNER: ${ctx.CAR_OWNER}` : "CAR OWNER:",
      );
      if (ctx.CAR_OWNER && i + 1 < paragraphs.length) {
        const choice = getParagraphText(paragraphs[i + 1]).toUpperCase();
        if (choice.includes("YES") && choice.includes("NO")) {
          paragraphs[i + 1] =
            ctx.CAR_OWNER === "YES"
              ? replaceParagraphRuns(paragraphs[i + 1], yellowTextRun("YES") + plainTextRun("     NO"))
              : replaceParagraphRuns(paragraphs[i + 1], plainTextRun("YES     ") + yellowTextRun("NO"));
        }
      }
      continue;
    }
    if (upper === "MARRIED" || upper === "DIVORCED" || upper === "SINGLE" || upper === "OR OTHER" || upper === "SINGLE OR OTHER") {
      const marital = (ctx.MARITAL_STATUS || "").toUpperCase();
      const selected =
        (upper.startsWith("SINGLE") && (marital.includes("SINGLE") || marital.includes("OTHER") || marital.includes("WIDOW"))) ||
        (upper === "OR OTHER" && (marital.includes("OTHER") || marital.includes("WIDOW"))) ||
        (upper === "MARRIED" && marital.includes("MARRIED")) ||
        (upper === "DIVORCED" && marital.includes("DIVORCED"));
      if (selected) {
        paragraphs[i] = setParagraphHighlighted(paragraphs[i], text);
      }
      continue;
    }
    if (upper.startsWith("HOW DID YOU HEAR ABOUT THE ROLE")) {
      if (ctx.HEARD_ABOUT_ROLE) {
        paragraphs[i] = setParagraphText(paragraphs[i], `HOW DID YOU HEAR ABOUT THE ROLE ${ctx.HEARD_ABOUT_ROLE}`);
      }
      continue;
    }
    if (upper.startsWith("4. HAVE YOU EVER APPEARED BEFORE A COURT")) {
      const answer = (ctx.CRIMINAL_CONVICTION || "") as "YES" | "NO" | "";
      for (let j = i + 1; j < Math.min(i + 8, paragraphs.length); j++) {
        const t = getParagraphText(paragraphs[j]).replace(/\u00a0/g, " ").trim().toUpperCase();
        if (t === "YES" || t === "NO") {
          if (answer && t === answer) {
            paragraphs[j] = setParagraphHighlighted(paragraphs[j], t);
          }
        }
        if (t.startsWith("IF YES, GIVE DETAILS") && ctx.CRIMINAL_CONVICTION_DETAILS) {
          fillNextBlankParagraph(paragraphs, j, ctx.CRIMINAL_CONVICTION_DETAILS);
        }
      }
      continue;
    }
    if (upper.startsWith("HAVE YOU BEEN MADE BANKRUPT")) {
      paragraphs[i] = markDualInlineYesNo(paragraphs[i], text, (ctx.BEEN_BANKRUPT || "") as any, (ctx.HAS_CCJ || "") as any);
      continue;
    }
    if (upper.startsWith("DO YOU OBJECT TO THE COMPANY CONTACTING A CREDIT AGENCY")) {
      // Question may span two paragraphs; mark YES/NO on this or the next line.
      if (/YES\s*\/\s*NO/i.test(text)) {
        paragraphs[i] = markInlineYesNo(paragraphs[i], text, (ctx.OBJECT_TO_CREDIT_AGENCY || "") as any);
      } else if (i + 1 < paragraphs.length) {
        const next = getParagraphText(paragraphs[i + 1]).replace(/\u00a0/g, " ").trim();
        if (/YES\s*\/\s*NO/i.test(next)) {
          paragraphs[i + 1] = markInlineYesNo(paragraphs[i + 1], next, (ctx.OBJECT_TO_CREDIT_AGENCY || "") as any);
        }
      }
      continue;
    }
    if (upper.startsWith("WITH REFERENCE TO YOURSELF") && /YES\s*\/\s*NO/i.test(upper)) {
      paragraphs[i] = markInlineYesNo(paragraphs[i], text, (ctx.OBJECT_TO_CREDIT_AGENCY || "") as any);
      continue;
    }
    if (upper.startsWith("DO YOU AGREE TO A S.I.A. CRIMINAL RECORD CHECK") || upper.startsWith("DO YOU AGREE TO A SIA CRIMINAL RECORD CHECK")) {
      paragraphs[i] = markInlineYesNo(paragraphs[i], text, (ctx.AGREE_SIA_CHECK || "") as any);
      continue;
    }
    if (upper.startsWith("DO YOU FULLY UNDERSTAND THE POTENTIAL CONSEQUENCES")) {
      paragraphs[i] = markInlineYesNo(paragraphs[i], text, (ctx.UNDERSTAND_CONSEQUENCES || "") as any);
      continue;
    }
    if (upper.startsWith("DO YOU AGREE TO A CREDIT CHECK")) {
      paragraphs[i] = markInlineYesNo(paragraphs[i], text, (ctx.AGREE_CREDIT_CHECK || "") as any);
      continue;
    }
    if (upper.startsWith("PLACE OF BIRTH")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.PLACE_OF_BIRTH ? `PLACE OF BIRTH: ${ctx.PLACE_OF_BIRTH}` : text,
      );
      continue;
    }
    if (upper === "HEIGHT:") {
      i = fillNextBlankParagraph(paragraphs, i, ctx.HEIGHT);
      continue;
    }
    if (upper === "WEIGHT:") {
      i = fillNextBlankParagraph(paragraphs, i, ctx.WEIGHT);
      continue;
    }
    if (upper.startsWith("COLOUR OF EYES")) {
      i = fillNextBlankParagraph(paragraphs, i, ctx.COLOUR_OF_EYES);
      continue;
    }
    if (upper.startsWith("SCHOOL NAME")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.SCHOOL_NAME ? `SCHOOL NAME: (secondary only) ${ctx.SCHOOL_NAME}` : text,
      );
      continue;
    }
    if (upper.startsWith("TOWN/CITY")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.SCHOOL_TOWN ? `TOWN/CITY: ${ctx.SCHOOL_TOWN}` : text,
      );
      continue;
    }
    if (upper.startsWith("DATE YOU LEFT SCHOOL")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.SCHOOL_LEFT ? `DATE YOU LEFT SCHOOL: ${ctx.SCHOOL_LEFT}` : text,
      );
      continue;
    }
    if (upper.startsWith("COLLEGE")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.COLLEGE_DETAILS ? `COLLEGE & DATES: ${ctx.COLLEGE_DETAILS}` : text,
      );
      continue;
    }
    if (upper.includes("NATIONAL") && i + 1 < paragraphs.length && getParagraphText(paragraphs[i + 1]).toUpperCase().includes("INSURANCE")) {
      i = fillNextBlankParagraph(paragraphs, i + 1, ctx.NI_NUMBER);
      continue;
    }
    if (upper === "STATUS:" && i > 0 && getParagraphText(paragraphs[i - 1]).toUpperCase() === "MARITAL") {
      i = fillNextBlankParagraph(paragraphs, i, ctx.MARITAL_STATUS);
      continue;
    }
    if (upper.includes("INSURANCE NO") || upper === "INSURANCE NO") {
      i = fillNextBlankParagraph(paragraphs, i, ctx.NI_NUMBER);
      continue;
    }
    if (upper.startsWith("BANK ACCOUNT NUMBER")) {
      const account = ctx.BANK_ACCOUNT_NUMBER || "";
      const sortCode = ctx.BANK_SORT_CODE || "";
      const filled = `BANK ACCOUNT NUMBER. ${account}    SORT CODE ${sortCode}`;
      paragraphs[i] = setParagraphText(paragraphs[i], filled);
      continue;
    }
    if (upper.startsWith("NAME OF BANK")) {
      const filled = `NAME OF BANK ${ctx.BANK_NAME || ""}    NAME OF ACCOUNT HOLDER ${ctx.BANK_ACCOUNT_NAME || ""}`.trimEnd();
      paragraphs[i] = setParagraphText(paragraphs[i], filled);
      continue;
    }
    if (upper.startsWith("VETTING FROM")) {
      const filled = ctx.VETTING_START
        ? `VETTING FROM: ${ctx.VETTING_START_DAY} / ${ctx.VETTING_START_MONTH} / ${ctx.VETTING_START_YEAR}`
        : text;
      paragraphs[i] = setParagraphText(paragraphs[i], filled);
      continue;
    }
    if (upper.startsWith("VETTED BY")) {
      i = fillNextBlankParagraph(paragraphs, i, ctx.HR_SIGNATORY_NAME);
      continue;
    }
    if (upper.includes("S.I.A. LICENCE NUMBER") || upper.includes("SIA LICENCE NUMBER")) {
      paragraphs[i] = setParagraphText(
        paragraphs[i],
        ctx.SIA_LICENCE ? `S.I.A. LICENCE NUMBER: ${ctx.SIA_LICENCE}` : text,
      );
      continue;
    }
    if (upper.startsWith("EMPLOYMENT AS:")) {
      paragraphs[i] = setParagraphText(paragraphs[i], `EMPLOYMENT AS: ${(ctx.OFFICER_TYPE || ctx.JOB_TITLE).toUpperCase()}`);
      continue;
    }
    if (upper.startsWith("3. PERSON/NEXT OF KIN TO BE CONTACTED IN ANY EMERGENCY:")) {
      fillSpecificBlankParagraph(paragraphs, i + 2, ctx.EMERGENCY_CONTACT_NAME);
      fillSpecificBlankParagraph(paragraphs, i + 4, ctx.EMERGENCY_CONTACT_ADDRESS);
      fillSpecificBlankParagraph(paragraphs, i + 15, ctx.EMERGENCY_CONTACT_RELATIONSHIP);
      fillSpecificBlankParagraph(paragraphs, i + 19, ctx.EMERGENCY_CONTACT_PHONE);
      continue;
    }
    if (upper === "5.PERSONAL HISTORY (PART A)") {
      fillSpecificBlankParagraph(paragraphs, i + 22, ctx.EMPLOYMENT_1_PHONE);
      fillSpecificBlankParagraph(paragraphs, i + 23, ctx.EMPLOYMENT_1_NAME);
      fillSpecificBlankParagraph(paragraphs, i + 24, ctx.EMPLOYMENT_1_TITLE);
      fillSpecificBlankParagraph(paragraphs, i + 26, ctx.EMPLOYMENT_1_START);
      fillSpecificBlankParagraph(paragraphs, i + 28, ctx.EMPLOYMENT_1_END);
      fillSpecificBlankParagraph(paragraphs, i + 31, ctx.EMPLOYMENT_1_REASON);
      fillSpecificBlankParagraph(paragraphs, i + 35, ctx.EMPLOYMENT_2_PHONE);
      fillSpecificBlankParagraph(paragraphs, i + 36, ctx.EMPLOYMENT_2_NAME);
      fillSpecificBlankParagraph(paragraphs, i + 37, ctx.EMPLOYMENT_2_TITLE);
      fillSpecificBlankParagraph(paragraphs, i + 39, ctx.EMPLOYMENT_2_START);
      fillSpecificBlankParagraph(paragraphs, i + 41, ctx.EMPLOYMENT_2_END);
      fillSpecificBlankParagraph(paragraphs, i + 44, ctx.EMPLOYMENT_2_REASON);
      continue;
    }

    if (/^Name:\s*\.{3,}/i.test(text)) {
      let filled = text;
      if (ctx.EMPLOYEE_NAME) filled = filled.replace(/Name:\s*\.+/i, `Name: ${ctx.EMPLOYEE_NAME}`);
      if (ctx.DOB) filled = filled.replace(/D\.O\.B:\s*[\.\/]+/i, `D.O.B: ${ctx.DOB}`);
      paragraphs[i] = setParagraphText(paragraphs[i], filled);
      continue;
    }
    if (/^Licence Number:\s*\.+/i.test(text)) {
      let filled = text;
      if (ctx.SIA_LICENCE) filled = filled.replace(/Licence Number:\s*\.+/i, `Licence Number: ${ctx.SIA_LICENCE}`);
      if (ctx.SIA_EXPIRY) filled = filled.replace(/Expiry:\s*[\.\/]+/i, `Expiry: ${ctx.SIA_EXPIRY}`);
      paragraphs[i] = setParagraphText(paragraphs[i], filled);
      continue;
    }

    if (/^NAME:\s*_+/i.test(text)) {
      paragraphs[i] = setParagraphText(paragraphs[i], `NAME: ${ctx.EMPLOYEE_NAME}`);
      continue;
    }
    if (/^N\.I:\s*_+/i.test(text)) {
      paragraphs[i] = setParagraphText(paragraphs[i], `N.I: ${ctx.NI_NUMBER}`);
      continue;
    }
    if (/^Date of Appointment:\s*_+/i.test(text)) {
      paragraphs[i] = setParagraphText(paragraphs[i], `Date of Appointment: ${ctx.APPOINTMENT_DATE}`);
      continue;
    }
    if (/^Date Completed:\s*_+/i.test(text)) {
      paragraphs[i] = setParagraphText(paragraphs[i], `Date Completed: ${ctx.VETTING_COMPLETE || ctx.TODAY_SHORT}`);
      continue;
    }
    if (text.startsWith("Position:") && text.toLowerCase().includes("vetting officer")) {
      paragraphs[i] = setParagraphText(paragraphs[i], `Position: ${ctx.HR_SIGNATORY_POSITION}`);
      continue;
    }
  }

  let idx = 0;
  return xml.replace(PARA_REGEX, () => paragraphs[idx++] ?? "");
}

function getCellText(cellXml: string): string {
  return Array.from(cellXml.matchAll(WT_REGEX))
    .map((m) => m[2])
    .join("")
    .replace(/\u00a0/g, " ")
    .trim();
}

function setCellText(cellXml: string, value: string): string {
  const paras = Array.from(cellXml.matchAll(PARA_REGEX)).map((m) => m[0]);
  if (paras.length === 0) return cellXml;
  const filled = setParagraphText(paras[0], value);
  return cellXml.replace(paras[0], filled);
}

function getRowCells(rowXml: string): string[] {
  return Array.from(rowXml.matchAll(CELL_REGEX)).map((m) => m[0]);
}

function getTableRows(tableXml: string): string[] {
  return Array.from(tableXml.matchAll(ROW_REGEX)).map((m) => m[0]);
}

function fillReferenceTable(tableXml: string, records: Array<Array<string | null | undefined>>): string {
  const rows = getTableRows(tableXml);
  const dataRows = rows.slice(1);
  let out = tableXml;
  for (let i = 0; i < Math.min(records.length, dataRows.length); i++) {
    const cells = getRowCells(dataRows[i]);
    let filledRow = dataRows[i];
    records[i].forEach((value, colIndex) => {
      if (!value || colIndex >= cells.length) return;
      filledRow = filledRow.replace(cells[colIndex], setCellText(cells[colIndex], value));
    });
    out = out.replace(dataRows[i], filledRow);
  }
  return out;
}

function extractRefereeNameFromDuties(duties?: string | null): string {
  if (!duties) return "";
  const m = duties.match(/reported\s+to:?\s*([^.\n]+)/i);
  return m ? m[1].trim() : "";
}

function formatDateRange(from?: string | Date | null, to?: string | Date | null): string {
  const f = formatUkDate(from);
  const t = to ? formatUkDate(to) : from ? "Present" : "";
  if (!f && !t) return "";
  return `${f} - ${t}`;
}

function applyReferenceTrackerFills(
  xml: string,
  ctx: VettingMergeContext,
  employmentHistory: VettingEmployeeSource["employmentHistory"],
  references: VettingEmployeeSource["references"],
): string {
  const tables = Array.from(xml.matchAll(TABLE_REGEX)).map((m) => m[0]);
  let out = xml;

  for (const tableXml of tables) {
    const rows = getTableRows(tableXml);
    if (rows.length < 2) continue;
    const headerText = getRowCells(rows[0]).map(getCellText).join(" ").toUpperCase();

    if (headerText.startsWith("EMPLOYED")) {
      const records = (employmentHistory || []).map((h) => [
        formatDateRange(h.dateFrom, h.dateTo),
        extractRefereeNameFromDuties(h.duties),
        h.employerName || "",
        h.refereePhone || "",
        "",
        "",
        formatUkDate(h.requestedDate),
        formatUkDate(h.submittedDate),
        h.screeningComments || h.reasonForLeaving || "",
        h.verificationStatus === "verified" ? ctx.HR_SIGNATORY_NAME : "",
      ]);
      out = out.replace(tableXml, fillReferenceTable(tableXml, records));
      continue;
    }

    if (headerText.startsWith("YEARS KNOWN FOR")) {
      const personalRefs = (references || []).filter(
        (r) => !r.referenceKind || r.referenceKind === "personal",
      );
      const records = personalRefs.map((r) => [
        r.howLongKnown || "",
        r.refereeName || "",
        r.relationship || "",
        r.refereePhone || "",
        "",
        "",
        formatUkDate(r.requestedDate),
        formatUkDate(r.responseDate),
        r.screeningComments || "",
        r.verificationStatus === "verified" ? ctx.HR_SIGNATORY_NAME : "",
      ]);
      out = out.replace(tableXml, fillReferenceTable(tableXml, records));
      continue;
    }
  }

  return out;
}

function applyReplacements(xml: string, ctx: VettingMergeContext): string {
  let out = xml;

  out = out.split(LEGACY_TEMPLATE_COMPANY_NAME).join(escapeXml(ctx.COMPANY_NAME));
  out = out.split(escapeXml(LEGACY_TEMPLATE_COMPANY_NAME)).join(escapeXml(ctx.COMPANY_NAME));
  out = out.split("(ADDRESS)").join(escapeXml(ctx.COMPANY_ADDRESS));

  for (const [key, value] of Object.entries(ctx)) {
    out = out.split(`{{${key}}}`).join(escapeXml(value));
  }

  out = out.split("[Employee Name]").join(escapeXml(ctx.EMPLOYEE_NAME));
  out = out.split("[Employee Address]").join(escapeXml(ctx.EMPLOYEE_ADDRESS));
  out = out.split("[Name of Employee]").join(escapeXml(ctx.EMPLOYEE_NAME));
  out = out.split("[Job Title]").join(escapeXml(ctx.JOB_TITLE));
  out = out.split("[Start Date]").join(escapeXml(ctx.START_DATE));
  out = out.split("[Date]").join(escapeXml(ctx.TODAY_SHORT));

  if (ctx.COMPANY_REG) {
    out = out.replace(/Company Registration No\.\s*[\u00a0\s\uFFFD.]+/gi, `Company Registration No. ${escapeXml(ctx.COMPANY_REG)}`);
    out = out.replace(/Registration Number Company Registration No\.\s*[\u00a0\s\uFFFD.]+/gi, `Registration Number Company Registration No. ${escapeXml(ctx.COMPANY_REG)}`);
  }
  if (ctx.COMPANY_ADDRESS) {
    out = out.replace(/registered office is at\s*[\u00a0\s\uFFFD.]+/gi, `registered office is at ${escapeXml(ctx.COMPANY_ADDRESS)}`);
  }

  out = applyParagraphFormFills(out, ctx);

  return out;
}

async function mergeDocxTemplate(
  templatePath: string,
  ctx: VettingMergeContext,
  postProcess?: (xml: string) => string,
): Promise<Buffer> {
  const fileData = fs.readFileSync(templatePath);
  const zip = await JSZip.loadAsync(fileData);

  const xmlPaths = Object.keys(zip.files).filter(
    (name) => name.startsWith("word/") && name.endsWith(".xml") && !name.includes("_rels"),
  );

  for (const xmlPath of xmlPaths) {
    const entry = zip.file(xmlPath);
    if (!entry) continue;
    const content = await entry.async("string");
    let merged = applyReplacements(content, ctx);
    if (postProcess) merged = postProcess(merged);
    zip.file(xmlPath, merged);
  }

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function resolveTemplatePath(form: VettingDocumentForm): string {
  return path.join(VETTING_DOCS_DIR, ...form.filename.split("/"));
}

export function listAvailableVettingDocuments(officerType?: string | null) {
  return listVettingFormsForEmployee(officerType).map((form) => ({
    code: form.code,
    label: form.label,
    category: form.category,
    format: form.format,
    downloadable: form.format === "docx" && fs.existsSync(resolveTemplatePath(form)),
  }));
}

export async function generateVettingDocument(
  formCode: string,
  tenant: Tenant,
  employee: VettingEmployeeSource,
  empUser: User | null | undefined,
  options?: { asPdf?: boolean; screeningExceptions?: string },
): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
  const form = getVettingFormByCode(formCode);
  if (!form) {
    throw new Error("Unknown vetting document form");
  }

  const ctx = buildVettingMergeContext(tenant, employee, empUser);

  if (form.code === "sf17" && options?.asPdf) {
    const pdf = await generateVettingCompletionCertPdf({
      companyName: ctx.COMPANY_NAME,
      companyAddress: ctx.COMPANY_ADDRESS,
      employeeName: ctx.EMPLOYEE_NAME,
      niNumber: ctx.NI_NUMBER,
      appointmentDate: ctx.APPOINTMENT_DATE,
      completedDate: ctx.VETTING_COMPLETE || ctx.TODAY_SHORT,
      signatoryName: ctx.HR_SIGNATORY_NAME,
      signatoryPosition: ctx.HR_SIGNATORY_POSITION,
      signatureImage: tenant.hrSignatureData || undefined,
      screeningExceptions: options.screeningExceptions,
    });
    const safeName = ctx.EMPLOYEE_NAME.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
    return {
      buffer: pdf,
      filename: `SF17-Completion-Cert-${safeName || employee.id}.pdf`,
      contentType: "application/pdf",
    };
  }

  if (form.format !== "docx") {
    throw new Error(`${form.label} uses legacy .doc format — convert to .docx or open the template manually`);
  }

  const templatePath = resolveTemplatePath(form);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Template file not found: ${form.filename}`);
  }

  const postProcess =
    form.code === "sf08"
      ? (xml: string) => applyReferenceTrackerFills(xml, ctx, employee.employmentHistory, employee.references)
      : undefined;
  const buffer = await mergeDocxTemplate(templatePath, ctx, postProcess);
  const safeName = ctx.EMPLOYEE_NAME.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");
  const base = form.code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return {
    buffer,
    filename: `${base}-${safeName || employee.id}.docx`,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}

export function vettingDocsDirectoryExists(): boolean {
  return fs.existsSync(VETTING_DOCS_DIR);
}
