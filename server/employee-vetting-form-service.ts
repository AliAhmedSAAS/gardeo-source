import crypto from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db } from "./db";
import { pool } from "./db";
import { storage } from "./storage";
import { staffProfileStorage } from "./staff-profile-storage";
import {
  employeeVettingFormTokens,
  type EmployeeVettingFormToken,
} from "@shared/schema";

const TOKEN_TTL_DAYS = 3;

const POLICY_ACKS = {
  equalOps: { name: "Equal Ops Review", type: "equal_ops" },
  zeroHours: { name: "Zero Hours Contract", type: "contract" },
  codeOfConduct: { name: "Code of Conduct", type: "policy" },
} as const;

export type VettingFormPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  secondPhone: string;
  maritalStatus: string;
  dateOfBirth: string;
  gender: string;
  nationality: string;
  nationalInsurance: string;
  placeOfBirth: string;
  ethnicOrigin: string;
  ethnicOriginSpecify: string;
  hasDisability: string;
  registeredDisabled: string;
  registeredDisabilityNumber: string;
  disabilityNature: string;
  jobTitle: string;
  officerType: string;
  heardAboutRole: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  livingFrom: string;
  previousAddressLine1: string;
  previousAddressLine2: string;
  previousCity: string;
  previousCounty: string;
  previousPostcode: string;
  previousLivingFrom: string;
  previousLivingTo: string;
  drivingLicenceNumber: string;
  carOwner: string;
  siaLicenseNumber: string;
  siaLicenseType: string;
  siaExpiryDate: string;
  height: string;
  weight: string;
  colourOfEyes: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactPhone: string;
  emergencyContactAlternatePhone: string;
  emergencyContactEmail: string;
  emergencyContactAddress: string;
  bankAccountName: string;
  bankName: string;
  bankSortCode: string;
  bankAccountNumber: string;
  buildingSocietyRef: string;
  criminalConviction: string;
  criminalConvictionDetails: string;
  beenBankrupt: string;
  hasCcj: string;
  objectToCreditAgency: string;
  schoolName: string;
  schoolTown: string;
  schoolLeftDate: string;
  collegeDetails: string;
  additionalInformation: string;
  agreeSiaCriminalCheck: string;
  understandConsequences: string;
  agreeCreditCheck: string;
  signaturePrintName: string;
  signatureData: string;
  signatureDate: string;
  employment1EmployerName: string;
  employment1EmployerAddress: string;
  employment1JobTitle: string;
  employment1DateFrom: string;
  employment1DateTo: string;
  employment1ReasonForLeaving: string;
  employment1RefereeName: string;
  employment1RefereePhone: string;
  employment1RefereeEmail: string;
  employment2EmployerName: string;
  employment2EmployerAddress: string;
  employment2JobTitle: string;
  employment2DateFrom: string;
  employment2DateTo: string;
  employment2ReasonForLeaving: string;
  employment2RefereeName: string;
  employment2RefereePhone: string;
  employment2RefereeEmail: string;
  employment3EmployerName: string;
  employment3EmployerAddress: string;
  employment3JobTitle: string;
  employment3DateFrom: string;
  employment3DateTo: string;
  employment3ReasonForLeaving: string;
  employment3RefereeName: string;
  employment3RefereePhone: string;
  employment3RefereeEmail: string;
  employment4EmployerName: string;
  employment4EmployerAddress: string;
  employment4JobTitle: string;
  employment4DateFrom: string;
  employment4DateTo: string;
  employment4ReasonForLeaving: string;
  employment4RefereeName: string;
  employment4RefereePhone: string;
  employment4RefereeEmail: string;
  employment5EmployerName: string;
  employment5EmployerAddress: string;
  employment5JobTitle: string;
  employment5DateFrom: string;
  employment5DateTo: string;
  employment5ReasonForLeaving: string;
  employment5RefereeName: string;
  employment5RefereePhone: string;
  employment5RefereeEmail: string;
};

function emptyEmploymentSlot(n: 1 | 2 | 3 | 4 | 5) {
  return {
    [`employment${n}EmployerName`]: "",
    [`employment${n}EmployerAddress`]: "",
    [`employment${n}JobTitle`]: "",
    [`employment${n}DateFrom`]: "",
    [`employment${n}DateTo`]: "",
    [`employment${n}ReasonForLeaving`]: "",
    [`employment${n}RefereeName`]: "",
    [`employment${n}RefereePhone`]: "",
    [`employment${n}RefereeEmail`]: "",
  } as Record<string, string>;
}

function appBaseUrl(): string {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  if (process.env.REPLIT_DOMAINS) return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
  return "http://localhost:5000";
}

export function buildVettingFormUrl(token: string): string {
  return `${appBaseUrl()}/vetting-form/${token}`;
}

function emptyForm(): VettingFormPayload {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    secondPhone: "",
    maritalStatus: "",
    dateOfBirth: "",
    gender: "",
    nationality: "",
    nationalInsurance: "",
    placeOfBirth: "",
    ethnicOrigin: "",
    ethnicOriginSpecify: "",
    hasDisability: "",
    registeredDisabled: "",
    registeredDisabilityNumber: "",
    disabilityNature: "",
    jobTitle: "",
    officerType: "",
    heardAboutRole: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    county: "",
    postcode: "",
    country: "United Kingdom",
    livingFrom: "",
    previousAddressLine1: "",
    previousAddressLine2: "",
    previousCity: "",
    previousCounty: "",
    previousPostcode: "",
    previousLivingFrom: "",
    previousLivingTo: "",
    drivingLicenceNumber: "",
    carOwner: "",
    siaLicenseNumber: "",
    siaLicenseType: "",
    siaExpiryDate: "",
    height: "",
    weight: "",
    colourOfEyes: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    emergencyContactAlternatePhone: "",
    emergencyContactEmail: "",
    emergencyContactAddress: "",
    bankAccountName: "",
    bankName: "",
    bankSortCode: "",
    bankAccountNumber: "",
    buildingSocietyRef: "",
    criminalConviction: "",
    criminalConvictionDetails: "",
    beenBankrupt: "",
    hasCcj: "",
    objectToCreditAgency: "",
    schoolName: "",
    schoolTown: "",
    schoolLeftDate: "",
    collegeDetails: "",
    additionalInformation: "",
    agreeSiaCriminalCheck: "",
    understandConsequences: "",
    agreeCreditCheck: "",
    signaturePrintName: "",
    signatureData: "",
    signatureDate: "",
    ...emptyEmploymentSlot(1),
    ...emptyEmploymentSlot(2),
    ...emptyEmploymentSlot(3),
    ...emptyEmploymentSlot(4),
    ...emptyEmploymentSlot(5),
  } as VettingFormPayload;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

async function buildFormFromEmployee(employeeId: number): Promise<VettingFormPayload> {
  const employee = await storage.getEmployee(employeeId);
  if (!employee) return emptyForm();

  const empUser = employee.userId ? await storage.getUser(employee.userId) : null;
  const [extras, emergencyContacts, bankDetails, employmentHistory] = await Promise.all([
    staffProfileStorage.getStaffProfileExtras(employeeId),
    storage.getEmergencyContacts(employeeId),
    storage.getBankDetails(employeeId),
    storage.getEmploymentHistory(employeeId),
  ]);
  const licence = extras.drivingLicences[0];
  const health = extras.health;
  const education = extras.education || [];
  const primaryEmergency =
    emergencyContacts.find((c) => c.isPrimary) || emergencyContacts[0] || null;

  const stored = emptyForm();
  stored.firstName = empUser?.firstName || "";
  stored.lastName = empUser?.lastName || "";
  stored.email = empUser?.email || employee.portalEmail || "";
  stored.phone = employee.phone || empUser?.phone || "";
  stored.secondPhone = employee.secondPhone || "";
  stored.maritalStatus = employee.maritalStatus || "";
  stored.dateOfBirth = employee.dateOfBirth || "";
  stored.gender = employee.gender || "";
  stored.nationality = employee.nationality || "";
  stored.nationalInsurance = employee.nationalInsurance || "";
  stored.placeOfBirth = employee.placeOfBirth || "";
  stored.ethnicOrigin = employee.ethnicOrigin || "";
  if (stored.ethnicOrigin.startsWith("Other:")) {
    stored.ethnicOriginSpecify = stored.ethnicOrigin.replace(/^Other:\s*/i, "");
    stored.ethnicOrigin = "Other";
  }
  if (health?.disability) {
    const d = health.disability;
    if (/^yes\b/i.test(d)) stored.hasDisability = "yes";
    else if (/^no\b/i.test(d)) stored.hasDisability = "no";
    const regMatch = d.match(/Registered:\s*([^|;]+)/i);
    if (regMatch) {
      stored.registeredDisabled = "yes";
      stored.registeredDisabilityNumber = regMatch[1].trim();
    } else if (/registered:\s*no/i.test(d)) {
      stored.registeredDisabled = "no";
    }
    const natureMatch = d.match(/Nature:\s*(.+)$/i);
    if (natureMatch) stored.disabilityNature = natureMatch[1].trim();
  }
  stored.height = health?.height || "";
  stored.weight = health?.weight || "";
  stored.colourOfEyes = health?.colourOfEyes || "";
  stored.jobTitle = employee.jobTitle || "";
  stored.officerType = employee.officerType || employee.jobTitle || "";
  stored.addressLine1 = employee.addressLine1 || "";
  stored.addressLine2 = employee.addressLine2 || "";
  stored.city = employee.city || "";
  stored.county = employee.county || "";
  stored.postcode = employee.postcode || "";
  stored.country = employee.country || "United Kingdom";
  stored.livingFrom = employee.livingFrom || "";
  stored.previousAddressLine1 = employee.previousAddressLine1 || "";
  stored.previousAddressLine2 = employee.previousAddressLine2 || "";
  stored.previousCity = employee.previousCity || "";
  stored.previousCounty = employee.previousCounty || "";
  stored.previousPostcode = employee.previousPostcode || "";
  stored.previousLivingFrom = employee.previousLivingFrom || "";
  stored.previousLivingTo = employee.previousLivingTo || "";
  stored.drivingLicenceNumber = licence?.licenceNumber || "";
  stored.siaLicenseNumber = employee.siaLicenseNumber || "";
  stored.siaLicenseType = employee.siaLicenseType || "";
  stored.siaExpiryDate = employee.siaExpiryDate || "";
  stored.emergencyContactName = primaryEmergency?.name || "";
  stored.emergencyContactRelationship = primaryEmergency?.relationship || "";
  stored.emergencyContactPhone = primaryEmergency?.phone || "";
  stored.emergencyContactAlternatePhone = primaryEmergency?.alternatePhone || "";
  stored.emergencyContactEmail = primaryEmergency?.email || "";
  stored.emergencyContactAddress = primaryEmergency?.address || "";
  stored.bankAccountName = bankDetails?.accountName || "";
  stored.bankName = bankDetails?.bankName || "";
  stored.bankSortCode = bankDetails?.sortCode || "";
  stored.bankAccountNumber = bankDetails?.accountNumber || "";
  stored.buildingSocietyRef = bankDetails?.buildingSocietyRef || "";

  const school = education.find((e) => /school|secondary/i.test(`${e.qualification || ""} ${e.notes || ""}`)) || education[0];
  const college = education.find((e) => e !== school && /college|university/i.test(`${e.qualification || ""} ${e.institution || ""}`)) || education[1];
  if (school) {
    stored.schoolName = school.institution || "";
    stored.schoolTown = school.notes || "";
    stored.schoolLeftDate = school.dateTo || "";
  }
  if (college) {
    stored.collegeDetails = [college.institution, college.dateFrom, college.dateTo].filter(Boolean).join(" — ");
  }

  const fillEmployment = (n: 1 | 2 | 3 | 4 | 5, row: (typeof employmentHistory)[0] | null | undefined) => {
    if (!row) return;
    stored[`employment${n}EmployerName` as keyof VettingFormPayload] = row.employerName || "";
    stored[`employment${n}EmployerAddress` as keyof VettingFormPayload] = row.refereeAddress || "";
    stored[`employment${n}JobTitle` as keyof VettingFormPayload] = row.jobTitle || "";
    stored[`employment${n}DateFrom` as keyof VettingFormPayload] = row.dateFrom || "";
    stored[`employment${n}DateTo` as keyof VettingFormPayload] = row.dateTo || "";
    stored[`employment${n}ReasonForLeaving` as keyof VettingFormPayload] = row.reasonForLeaving || "";
    const duties = row.duties || "";
    const reported = duties.match(/Reported to:\s*(.+)/i);
    stored[`employment${n}RefereeName` as keyof VettingFormPayload] = reported ? reported[1].trim() : "";
    stored[`employment${n}RefereePhone` as keyof VettingFormPayload] = row.refereePhone || "";
    stored[`employment${n}RefereeEmail` as keyof VettingFormPayload] = row.refereeEmail || "";
  };
  fillEmployment(1, employmentHistory[0]);
  fillEmployment(2, employmentHistory[1]);
  fillEmployment(3, employmentHistory[2]);
  fillEmployment(4, employmentHistory[3]);
  fillEmployment(5, employmentHistory[4]);

  return stored;
}

function mergeForm(base: VettingFormPayload, patch: Record<string, unknown>): VettingFormPayload {
  const out: VettingFormPayload = { ...emptyForm(), ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    if (!(key in out)) continue;
    const strValue = str(value);
    // An empty stored value must not clobber fresher, non-empty data that
    // buildFormFromEmployee() just pulled live from the employee record.
    // Without this guard, a token snapshot taken before a field (e.g. job
    // title) was filled in on the Employee Profile would permanently mask
    // later edits for the lifetime of the link (up to 3 days, or longer if
    // reused) — the two screens would silently drift out of sync.
    if (strValue === "" && (out as Record<string, string>)[key] !== "") continue;
    (out as Record<string, string>)[key] = strValue;
  }
  return out;
}

async function applyFormToEmployee(employeeId: number, form: VettingFormPayload) {
  const employee = await storage.getEmployee(employeeId);
  if (!employee) throw new Error("Employee not found");

  if (employee.userId) {
    await storage.updateUser(employee.userId, {
      firstName: form.firstName || undefined,
      lastName: form.lastName || undefined,
      email: form.email || undefined,
      phone: form.phone || undefined,
    });
  }

  await storage.updateEmployee(employeeId, {
    phone: form.phone || null,
    secondPhone: form.secondPhone || null,
    maritalStatus: form.maritalStatus || null,
    dateOfBirth: form.dateOfBirth || null,
    gender: form.gender || null,
    nationality: form.nationality || null,
    nationalInsurance: form.nationalInsurance || null,
    placeOfBirth: form.placeOfBirth || null,
    ethnicOrigin: form.ethnicOrigin
      ? form.ethnicOrigin === "Other" && form.ethnicOriginSpecify
        ? `Other: ${form.ethnicOriginSpecify}`
        : form.ethnicOrigin
      : null,
    jobTitle: form.jobTitle || null,
    officerType: form.officerType || null,
    addressLine1: form.addressLine1 || null,
    addressLine2: form.addressLine2 || null,
    city: form.city || null,
    county: form.county || null,
    postcode: form.postcode || null,
    country: form.country || null,
    livingFrom: form.livingFrom || null,
    previousAddressLine1: form.previousAddressLine1 || null,
    previousAddressLine2: form.previousAddressLine2 || null,
    previousCity: form.previousCity || null,
    previousCounty: form.previousCounty || null,
    previousPostcode: form.previousPostcode || null,
    previousLivingFrom: form.previousLivingFrom || null,
    previousLivingTo: form.previousLivingTo || null,
    siaLicenseNumber: form.siaLicenseNumber || null,
    siaLicenseType: form.siaLicenseType || null,
    siaExpiryDate: form.siaExpiryDate || null,
    portalEmail: form.email || employee.portalEmail,
  });

  if (form.drivingLicenceNumber.trim()) {
    const extras = await staffProfileStorage.getStaffProfileExtras(employeeId);
    const existing = extras.drivingLicences[0];
    if (existing) {
      await staffProfileStorage.updateDrivingLicence(existing.id, employeeId, {
        licenceNumber: form.drivingLicenceNumber,
      });
    } else if (employee.tenantId) {
      await staffProfileStorage.createDrivingLicence({
        employeeId,
        tenantId: employee.tenantId,
        licenceNumber: form.drivingLicenceNumber,
      });
    }
  }

  if (
    form.hasDisability ||
    form.registeredDisabled ||
    form.disabilityNature ||
    form.height ||
    form.weight ||
    form.colourOfEyes
  ) {
    const parts: string[] = [];
    if (form.hasDisability) parts.push(form.hasDisability === "yes" ? "Yes" : "No");
    if (form.registeredDisabled === "yes") {
      parts.push(`Registered: ${form.registeredDisabilityNumber || "Yes"}`);
    } else if (form.registeredDisabled === "no") {
      parts.push("Registered: No");
    }
    if (form.disabilityNature.trim()) parts.push(`Nature: ${form.disabilityNature.trim()}`);
    await staffProfileStorage.upsertHealth(employeeId, employee.tenantId ?? null, {
      ...(parts.length ? { disability: parts.join(" | ") } : {}),
      height: form.height || null,
      weight: form.weight || null,
      colourOfEyes: form.colourOfEyes || null,
    });
  }

  if (form.schoolName.trim() || form.collegeDetails.trim()) {
    const extras = await staffProfileStorage.getStaffProfileExtras(employeeId);
    const education = extras.education || [];
    if (form.schoolName.trim()) {
      const schoolPayload = {
        institution: form.schoolName.trim(),
        qualification: "Secondary school",
        dateTo: form.schoolLeftDate || null,
        notes: form.schoolTown || null,
      };
      const existingSchool =
        education.find((e) => /school|secondary/i.test(`${e.qualification || ""} ${e.notes || ""}`)) ||
        education[0];
      if (existingSchool) {
        await staffProfileStorage.updateEducation(existingSchool.id, employeeId, schoolPayload);
      } else {
        await staffProfileStorage.createEducation({
          ...schoolPayload,
          employeeId,
          tenantId: employee.tenantId ?? null,
        });
      }
    }
    if (form.collegeDetails.trim()) {
      const collegePayload = {
        institution: form.collegeDetails.trim(),
        qualification: "College / further education",
        notes: null,
      };
      const existingCollege = education.find(
        (e) => /college|university|further/i.test(`${e.qualification || ""} ${e.institution || ""}`),
      );
      if (existingCollege) {
        await staffProfileStorage.updateEducation(existingCollege.id, employeeId, collegePayload);
      } else {
        await staffProfileStorage.createEducation({
          ...collegePayload,
          employeeId,
          tenantId: employee.tenantId ?? null,
        });
      }
    }
  }

  // Screening declarations, criminal/CCJ answers, and additional info are retained on the token formData.

  const emergencyContacts = await storage.getEmergencyContacts(employeeId);
  const primaryEmergency =
    emergencyContacts.find((c) => c.isPrimary) || emergencyContacts[0] || null;
  const emergencyPayload = {
    name: form.emergencyContactName,
    relationship: form.emergencyContactRelationship,
    phone: form.emergencyContactPhone,
    alternatePhone: form.emergencyContactAlternatePhone || null,
    email: form.emergencyContactEmail || null,
    address: form.emergencyContactAddress || null,
    isPrimary: true,
  };
  if (
    form.emergencyContactName.trim() &&
    form.emergencyContactRelationship.trim() &&
    form.emergencyContactPhone.trim()
  ) {
    if (primaryEmergency) {
      await storage.updateEmergencyContact(primaryEmergency.id, emergencyPayload);
    } else {
      await storage.createEmergencyContact({ ...emergencyPayload, employeeId });
    }
  }

  if (
    form.bankAccountName.trim() &&
    form.bankName.trim() &&
    form.bankSortCode.trim() &&
    form.bankAccountNumber.trim()
  ) {
    const bankPayload = {
      accountName: form.bankAccountName.trim(),
      bankName: form.bankName.trim(),
      sortCode: form.bankSortCode.trim(),
      accountNumber: form.bankAccountNumber.trim(),
      buildingSocietyRef: form.buildingSocietyRef || null,
    };
    const existingBank = await storage.getBankDetails(employeeId);
    if (existingBank) {
      await storage.updateBankDetails(existingBank.id, bankPayload);
    } else {
      await storage.createBankDetails({ ...bankPayload, employeeId });
    }
  }

  const employmentHistory = await storage.getEmploymentHistory(employeeId);
  const upsertEmployment = async (
    index: number,
    employerName: string,
    employerAddress: string,
    jobTitle: string,
    dateFrom: string,
    dateTo: string,
    reasonForLeaving: string,
    refereeName: string,
    refereePhone: string,
    refereeEmail: string,
  ) => {
    if (!employerName.trim() || !jobTitle.trim() || !dateFrom.trim()) return;
    const payload = {
      employerName: employerName.trim(),
      jobTitle: jobTitle.trim(),
      dateFrom: dateFrom.trim(),
      dateTo: dateTo.trim() || null,
      reasonForLeaving: reasonForLeaving.trim() || null,
      refereeAddress: employerAddress.trim() || null,
      refereePhone: refereePhone.trim() || null,
      refereeEmail: refereeEmail.trim() || null,
      duties: refereeName.trim() ? `Reported to: ${refereeName.trim()}` : null,
      isCurrent: !dateTo.trim(),
    };
    const existing = employmentHistory[index];
    if (existing) {
      await storage.updateEmploymentHistory(existing.id, payload);
    } else {
      await storage.createEmploymentHistory({ ...payload, employeeId });
    }
  };

  for (const n of [1, 2, 3, 4, 5] as const) {
    await upsertEmployment(
      n - 1,
      form[`employment${n}EmployerName`],
      form[`employment${n}EmployerAddress`],
      form[`employment${n}JobTitle`],
      form[`employment${n}DateFrom`],
      form[`employment${n}DateTo`],
      form[`employment${n}ReasonForLeaving`],
      form[`employment${n}RefereeName`],
      form[`employment${n}RefereePhone`],
      form[`employment${n}RefereeEmail`],
    );
  }
}

async function upsertPolicyAcknowledgement(
  employeeId: number,
  tenantId: number,
  policyKey: keyof typeof POLICY_ACKS,
  acknowledgedBy: string,
) {
  const meta = POLICY_ACKS[policyKey];
  const existing = await pool.query(
    "SELECT id FROM employee_policies WHERE employee_id = $1 AND tenant_id = $2 AND policy_type = $3 LIMIT 1",
    [employeeId, tenantId, meta.type],
  );
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE employee_policies SET acknowledged_at = NOW(), acknowledged_by = $1, status = 'acknowledged'
       WHERE id = $2`,
      [acknowledgedBy, existing.rows[0].id],
    );
  } else {
    await pool.query(
      `INSERT INTO employee_policies (employee_id, tenant_id, policy_name, policy_type, version, issued_by, status, acknowledged_at, acknowledged_by)
       VALUES ($1, $2, $3, $4, '1.0', 'vetting-form', 'acknowledged', NOW(), $5)`,
      [employeeId, tenantId, meta.name, meta.type, acknowledgedBy],
    );
  }
}

async function loadTokenRow(token: string): Promise<EmployeeVettingFormToken | undefined> {
  const [row] = await db
    .select()
    .from(employeeVettingFormTokens)
    .where(eq(employeeVettingFormTokens.token, token))
    .limit(1);
  return row;
}

function tokenExpired(row: EmployeeVettingFormToken): boolean {
  return row.expiresAt.getTime() < Date.now();
}

export async function createEmployeeVettingFormToken(params: {
  tenantId: number | null;
  employeeId: number;
  recipientEmail: string;
  createdBy?: string | null;
}): Promise<{ token: string; formUrl: string; expiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TOKEN_TTL_DAYS);

  // Reuse an existing active (not expired, not submitted) token for this employee
  // instead of creating a duplicate row every time a link is (re)sent.
  const [existing] = await db
    .select()
    .from(employeeVettingFormTokens)
    .where(
      and(
        eq(employeeVettingFormTokens.employeeId, params.employeeId),
        isNull(employeeVettingFormTokens.submittedAt),
        gt(employeeVettingFormTokens.expiresAt, now),
      ),
    )
    .orderBy(desc(employeeVettingFormTokens.createdAt))
    .limit(1);

  if (existing) {
    await db
      .update(employeeVettingFormTokens)
      .set({
        recipientEmail: params.recipientEmail.trim(),
        expiresAt,
        createdBy: params.createdBy || existing.createdBy,
      })
      .where(eq(employeeVettingFormTokens.id, existing.id));

    return { token: existing.token, formUrl: buildVettingFormUrl(existing.token), expiresAt };
  }

  const token = crypto.randomBytes(32).toString("hex");
  const formData = await buildFormFromEmployee(params.employeeId);

  await db.insert(employeeVettingFormTokens).values({
    token,
    tenantId: params.tenantId,
    employeeId: params.employeeId,
    recipientEmail: params.recipientEmail.trim(),
    expiresAt,
    formData,
    createdBy: params.createdBy || null,
  });

  return { token, formUrl: buildVettingFormUrl(token), expiresAt };
}

export async function getVettingFormByToken(token: string) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid application form link", status: 404 };
  if (tokenExpired(row)) {
    return { ok: false as const, error: "This application form link has expired", status: 410 };
  }

  const employee = await storage.getEmployee(row.employeeId);
  if (!employee) return { ok: false as const, error: "Employee not found", status: 404 };

  const tenant = row.tenantId ? await storage.getTenant(row.tenantId) : null;
  const companyName = (tenant?.tradingName || tenant?.name || "Company").trim();
  const base = await buildFormFromEmployee(row.employeeId);
  const stored = (row.formData as Partial<VettingFormPayload> | null) || {};
  // Prefer token formData over live employee record so edits persist reliably.
  const form = mergeForm(base, stored as Record<string, unknown>);

  return {
    ok: true as const,
    data: {
      companyName,
      expiresAt: row.expiresAt,
      submittedAt: row.submittedAt,
      lastSavedAt: row.lastSavedAt,
      acknowledgements: {
        equalOps: !!row.equalOpsAcknowledgedAt,
        zeroHours: !!row.zeroHoursAcknowledgedAt,
        codeOfConduct: !!row.codeOfConductAcknowledgedAt,
      },
      form,
    },
  };
}

export async function saveVettingFormByToken(token: string, patch: Record<string, unknown>) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid application form link", status: 404 };
  if (tokenExpired(row)) {
    return { ok: false as const, error: "This application form link has expired", status: 410 };
  }

  const base = await buildFormFromEmployee(row.employeeId);
  const stored = (row.formData as Partial<VettingFormPayload> | null) || {};
  const mergedStored = mergeForm(base, { ...stored, ...patch });
  const now = new Date();

  await db
    .update(employeeVettingFormTokens)
    .set({ formData: mergedStored, lastSavedAt: now })
    .where(eq(employeeVettingFormTokens.id, row.id));

  try {
    await applyFormToEmployee(row.employeeId, mergedStored);
  } catch (err) {
    console.error("[vetting-form] employee write-back failed (form data was still saved):", err);
  }

  return { ok: true as const, lastSavedAt: now, form: mergedStored };
}

export async function submitVettingFormByToken(
  token: string,
  body: {
    form?: Record<string, unknown>;
    acknowledgeEqualOps?: boolean;
    acknowledgeZeroHours?: boolean;
    acknowledgeCodeOfConduct?: boolean;
  },
) {
  const row = await loadTokenRow(token);
  if (!row) return { ok: false as const, error: "Invalid application form link", status: 404 };
  if (tokenExpired(row)) {
    return { ok: false as const, error: "This application form link has expired", status: 410 };
  }

  const employee = await storage.getEmployee(row.employeeId);
  if (!employee?.tenantId) {
    return { ok: false as const, error: "Employee tenant not found", status: 400 };
  }

  const base = await buildFormFromEmployee(row.employeeId);
  const stored = (row.formData as Partial<VettingFormPayload> | null) || {};
  const merged = mergeForm(base, { ...stored, ...(body.form || {}) });

  if (!merged.firstName || !merged.lastName) {
    return { ok: false as const, error: "First and last name are required", status: 400 };
  }
  if (!merged.email || !merged.email.includes("@")) {
    return { ok: false as const, error: "A valid email is required", status: 400 };
  }
  if (!body.acknowledgeEqualOps || !body.acknowledgeZeroHours || !body.acknowledgeCodeOfConduct) {
    return {
      ok: false as const,
      error: "You must acknowledge Equal Ops Review, Zero Hours Contract, and Code of Conduct",
      status: 400,
    };
  }
  if (!merged.signaturePrintName.trim() || !merged.signatureData.trim()) {
    return {
      ok: false as const,
      error: "Applicant print name and signature are required before submitting",
      status: 400,
    };
  }
  if (!merged.signatureDate) {
    merged.signatureDate = new Date().toISOString().slice(0, 10);
  }

  await applyFormToEmployee(row.employeeId, merged);

  const now = new Date();
  const ackBy = `vetting-form:${row.token.slice(0, 12)}`;

  await upsertPolicyAcknowledgement(row.employeeId, employee.tenantId, "equalOps", ackBy);
  await upsertPolicyAcknowledgement(row.employeeId, employee.tenantId, "zeroHours", ackBy);
  await upsertPolicyAcknowledgement(row.employeeId, employee.tenantId, "codeOfConduct", ackBy);

  await db
    .update(employeeVettingFormTokens)
    .set({
      formData: merged,
      lastSavedAt: now,
      submittedAt: now,
      equalOpsAcknowledgedAt: now,
      zeroHoursAcknowledgedAt: now,
      codeOfConductAcknowledgedAt: now,
    })
    .where(eq(employeeVettingFormTokens.id, row.id));

  await staffProfileStorage.addVettingAudit({
    employeeId: row.employeeId,
    tenantId: row.tenantId,
    code: "AR",
    action: "Application form submitted",
    details: `Public vetting form submitted by ${merged.email}, signed by ${merged.signaturePrintName} on ${merged.signatureDate}. SIA check: ${merged.agreeSiaCriminalCheck || "n/a"}; Credit check: ${merged.agreeCreditCheck || "n/a"}; Convictions: ${merged.criminalConviction || "n/a"}`,
    colorKey: "green",
  });

  return { ok: true as const, submittedAt: now };
}
