import type { Response } from "express";

interface MappedError {
  status: number;
  message: string;
}

function isPostgresError(err: any): boolean {
  return typeof err?.code === "string" && /^[0-9A-Z]{5}$/.test(err.code) && typeof err?.severity === "string";
}

/** Translates Postgres errors into client-safe messages so table and constraint names never leak. */
export function mapDatabaseError(err: any): MappedError | null {
  if (!isPostgresError(err)) return null;
  switch (err.code) {
    case "23503":
      return String(err.detail || "").includes("is still referenced")
        ? { status: 409, message: "This record cannot be deleted because other records are linked to it" }
        : { status: 400, message: "A referenced record does not exist" };
    case "23505":
      return { status: 409, message: "A record with these details already exists" };
    case "23502":
      return { status: 400, message: err.column ? `${err.column.replace(/_/g, " ")} is required` : "A required field is missing" };
    case "22P02":
    case "22023":
      return { status: 400, message: "One of the values has an invalid format" };
    case "22007":
    case "22008":
      return { status: 400, message: "Invalid date or time" };
    case "22003":
      return { status: 400, message: "A number is out of range" };
    case "22001":
      return { status: 400, message: "A value is too long" };
    case "23514":
      return { status: 400, message: "A value is not allowed" };
    case "57014":
      return { status: 503, message: "The request took too long. Please try again." };
    default:
      return { status: 500, message: "Unexpected database error" };
  }
}

export function sendRouteError(res: Response, err: any): void {
  const mapped = mapDatabaseError(err);
  if (mapped) {
    if (mapped.status >= 500) console.error("[route-error]", err?.code, err?.message);
    res.status(mapped.status).json({ message: mapped.message });
    return;
  }
  console.error("[route-error]", err?.message);
  res.status(500).json({ message: err?.message || "Internal server error" });
}
