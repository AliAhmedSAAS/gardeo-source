export type SiaVerificationResult = {
  valid: boolean;
  found: boolean;
  licenceNumber: string;
  status: string;
  holderName: string | null;
  licenceSector: string | null;
  licenceRole: string | null;
  expiryDate: string | null;
  checkedAt: string;
  source: "sia_checker" | "sia_register" | "unconfigured";
  message: string;
  nameMatch: boolean | null;
  raw?: unknown;
};

const SIA_ROLH_API_URL =
  process.env.SIA_ROLH_API_URL?.trim() ||
  "https://api.sia.gov.uk/external/rolh/api/searchbylicencenumber";

const SIA_ROLH_ORIGIN =
  process.env.SIA_ROLH_ORIGIN?.trim() || "https://rolh.services.sia.homeoffice.gov.uk";

export function normalizeSiaLicenceNumber(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidSiaLicenceFormat(value: string): boolean {
  const digits = normalizeSiaLicenceNumber(value);
  return digits.length === 16;
}

function pickString(...values: unknown[]): string | null {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function parseExpiry(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    return value.slice(0, 10);
  }
  return null;
}

function isActiveStatus(status: string): boolean {
  const s = status.toLowerCase();
  return ["active", "valid", "current", "licensed", "granted"].some((k) => s.includes(k));
}

function compareEmployeeName(employeeName: string | undefined, holderName: string | null): boolean | null {
  if (!employeeName || !holderName) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  const emp = norm(employeeName);
  const hold = norm(holderName);
  if (!emp || !hold) return null;
  return (
    hold.includes(emp) ||
    emp.includes(hold) ||
    emp.split(/\s+/).every((part) => part.length > 1 && hold.includes(part))
  );
}

function buildResult(
  licenceNumber: string,
  source: SiaVerificationResult["source"],
  fields: {
    valid: boolean;
    found: boolean;
    status: string;
    holderName: string | null;
    licenceSector: string | null;
    licenceRole: string | null;
    expiryDate: string | null;
    message: string;
    nameMatch: boolean | null;
    raw?: unknown;
  },
): SiaVerificationResult {
  return {
    licenceNumber,
    source,
    checkedAt: new Date().toISOString(),
    ...fields,
  };
}

function parseSiaCheckerResponse(
  licenceNumber: string,
  data: Record<string, unknown>,
  employeeName?: string,
): SiaVerificationResult {
  const holder = (data.holder || data.licenceHolder || data.licence || data) as Record<string, unknown>;
  const holderName = pickString(
    data.holderName,
    data.name,
    holder?.name,
    holder?.fullName,
    holder?.holderName,
  );
  const licenceSector = pickString(
    data.licenceSector,
    data.sector,
    holder?.sector,
    holder?.licenceSector,
    data.role,
    holder?.role,
  );
  const licenceRole = pickString(data.licenceRole, data.role, holder?.role, data.licenceType);
  const status = pickString(data.status, data.licenceStatus, holder?.status, data.state) || (data.found === false ? "not_found" : "unknown");
  const expiryDate = parseExpiry(
    data.expiryDate ?? data.expiry ?? data.expirationDate ?? holder?.expiryDate ?? holder?.expiry,
  );

  const explicitInvalid = data.valid === false || data.found === false || status.toLowerCase().includes("not found");
  const explicitValid = data.valid === true || data.found === true;
  const active = explicitValid || (!explicitInvalid && isActiveStatus(status));
  const expiryOk = !expiryDate || new Date(expiryDate) >= new Date(new Date().toDateString());
  const valid = active && expiryOk && status.toLowerCase() !== "not_found";
  const nameMatch = compareEmployeeName(employeeName, holderName);

  let message = valid
    ? "Licence verified against the SIA public register."
    : explicitInvalid || status.toLowerCase() === "not_found"
      ? "Licence not found on the SIA public register."
      : !expiryOk
        ? "Licence found but expiry date has passed."
        : "Licence found but status is not active.";

  if (nameMatch === false) {
    message += " Register name does not closely match this employee.";
  }

  return buildResult(licenceNumber, "sia_checker", {
    valid,
    found: !explicitInvalid && status.toLowerCase() !== "not_found",
    status,
    holderName,
    licenceSector,
    licenceRole,
    expiryDate,
    message,
    nameMatch,
    raw: data,
  });
}

type SiaRegisterRecord = {
  FirstName?: string;
  Surname?: string;
  LicenceNumber?: string;
  ExpiryDate?: string;
  Status?: string;
  Role?: string;
  LicenceSector?: string;
  StatusExplanation?: string;
  ErrorMessage?: string | null;
};

function formatRegisterHolderName(record: SiaRegisterRecord): string | null {
  const first = record.FirstName?.trim();
  const surname = record.Surname?.trim();
  const parts = [first && first !== "--" ? first : null, surname].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : surname || null;
}

function parseSiaRegisterResponse(
  licenceNumber: string,
  data: { ErrorMessage?: string | null; Records?: SiaRegisterRecord[] },
  employeeName?: string,
): SiaVerificationResult {
  if (data.ErrorMessage) {
    return buildResult(licenceNumber, "sia_register", {
      valid: false,
      found: false,
      status: "error",
      holderName: null,
      licenceSector: null,
      licenceRole: null,
      expiryDate: null,
      message: data.ErrorMessage,
      nameMatch: null,
      raw: data,
    });
  }

  const record = data.Records?.[0];
  if (!record) {
    return buildResult(licenceNumber, "sia_register", {
      valid: false,
      found: false,
      status: "not_found",
      holderName: null,
      licenceSector: null,
      licenceRole: null,
      expiryDate: null,
      message: "Licence not found on the SIA public register.",
      nameMatch: null,
      raw: data,
    });
  }

  const holderName = formatRegisterHolderName(record);
  const status = record.Status || "unknown";
  const licenceSector = record.LicenceSector || null;
  const licenceRole = record.Role || null;
  const expiryDate = parseExpiry(record.ExpiryDate);
  const active = isActiveStatus(status);
  const expiryOk = !expiryDate || new Date(expiryDate) >= new Date(new Date().toDateString());
  const valid = active && expiryOk;
  const nameMatch = compareEmployeeName(employeeName, holderName);

  let message = valid
    ? "Licence verified against the official SIA public register."
    : !active
      ? `Licence found but status is ${status}.`
      : "Licence found but expiry date has passed.";

  if (nameMatch === false) {
    message += " Register name does not closely match this employee.";
  }

  return buildResult(licenceNumber, "sia_register", {
    valid,
    found: true,
    status,
    holderName,
    licenceSector,
    licenceRole,
    expiryDate,
    message,
    nameMatch,
    raw: data,
  });
}

async function verifyViaSiaRegisterProxy(
  licenceNumber: string,
  employeeName?: string,
): Promise<SiaVerificationResult> {
  const res = await fetch(SIA_ROLH_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: SIA_ROLH_ORIGIN,
      Referer: `${SIA_ROLH_ORIGIN}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    },
    body: JSON.stringify({ LicenceNumber: licenceNumber }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await res.text();
  let payload: { ErrorMessage?: string | null; Records?: SiaRegisterRecord[] } = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid response from SIA register (HTTP ${res.status}).`);
  }

  if (!res.ok) {
    const msg = payload.ErrorMessage || `SIA register check failed (HTTP ${res.status}).`;
    throw new Error(msg);
  }

  return parseSiaRegisterResponse(licenceNumber, payload, employeeName);
}

async function verifyViaSiaChecker(
  licenceNumber: string,
  employeeName?: string,
): Promise<SiaVerificationResult> {
  const apiKey = process.env.SIA_CHECK_API_KEY!.trim();
  const baseUrl = (process.env.SIA_CHECK_API_URL || "https://api.siachecker.co.uk").replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/v1/licences/verify`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ licenceNumber }),
    signal: AbortSignal.timeout(30000),
  });

  let payload: Record<string, unknown> = {};
  const text = await res.text();
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (res.status === 401) {
    throw new Error("SIA check API key is invalid or expired.");
  }

  if (res.status === 404 || payload.code === "NOT_FOUND") {
    return buildResult(licenceNumber, "sia_checker", {
      valid: false,
      found: false,
      status: "not_found",
      holderName: null,
      licenceSector: null,
      licenceRole: null,
      expiryDate: null,
      message: pickString(payload.message) || "Licence not found on the SIA public register.",
      nameMatch: null,
      raw: payload,
    });
  }

  if (!res.ok) {
    const msg = pickString(payload.message, payload.error) || `SIA register check failed (${res.status}).`;
    throw new Error(msg);
  }

  return parseSiaCheckerResponse(licenceNumber, payload, employeeName);
}

export async function verifySiaLicence(
  licenceNumberInput: string,
  options?: { employeeName?: string },
): Promise<SiaVerificationResult> {
  const licenceNumber = normalizeSiaLicenceNumber(licenceNumberInput);
  if (!isValidSiaLicenceFormat(licenceNumber)) {
    return buildResult(licenceNumber, "unconfigured", {
      valid: false,
      found: false,
      status: "invalid_format",
      holderName: null,
      licenceSector: null,
      licenceRole: null,
      expiryDate: null,
      message: "SIA licence number must be 16 digits.",
      nameMatch: null,
    });
  }

  const apiKey = process.env.SIA_CHECK_API_KEY?.trim();

  if (apiKey) {
    try {
      return await verifyViaSiaChecker(licenceNumber, options?.employeeName);
    } catch (err) {
      // Fall through to official register proxy if third-party API fails
      console.warn("[SIA] Third-party API failed, falling back to official register:", (err as Error).message);
    }
  }

  return verifyViaSiaRegisterProxy(licenceNumber, options?.employeeName);
}

export function isEmployeeSiaRegisterValid(employee: {
  siaLastVerifiedAt?: Date | string | null;
  siaRegisterStatus?: string | null;
  siaExpiryDate?: string | null;
  siaLicenseNumber?: string | null;
}): boolean {
  if (employee.siaLastVerifiedAt && employee.siaRegisterStatus) {
    const verifiedAt = new Date(employee.siaLastVerifiedAt);
    const ageMs = Date.now() - verifiedAt.getTime();
    const maxAgeMs = 90 * 24 * 60 * 60 * 1000;
    if (ageMs <= maxAgeMs && isActiveStatus(employee.siaRegisterStatus)) {
      if (employee.siaExpiryDate && new Date(employee.siaExpiryDate) < new Date()) return false;
      return true;
    }
  }
  if (!employee.siaLicenseNumber) return false;
  if (!employee.siaExpiryDate) return false;
  return new Date(employee.siaExpiryDate) > new Date();
}
