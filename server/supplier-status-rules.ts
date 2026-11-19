import { getRequiredSupplierDocumentTypes, SUPPLIER_DOC_LABELS, type SupplierForRequiredDocs } from "@shared/supplierRequiredDocs";

/** Admin status actions and the statuses each may start from (FSD 4.11.1). Terminated is final. */
const ACTION_ALLOWED_FROM = {
  approve: ["draft", "pending", "submitted", "info_required"],
  request_info: ["draft", "pending", "submitted"],
  suspend: ["approved", "active"],
  unsuspend: ["suspended"],
  terminate: ["approved", "active", "suspended"],
} as const;

export type SupplierStatusAction = keyof typeof ACTION_ALLOWED_FROM;

export function getSupplierActionError(action: SupplierStatusAction, currentStatus: string | null | undefined): string | null {
  const status = currentStatus ?? "draft";
  const allowed: readonly string[] = ACTION_ALLOWED_FROM[action];
  if (allowed.includes(status)) return null;
  if (status === "terminated") return "This supplier is terminated. Terminated is a final status.";
  return `Cannot ${action.replace("_", " ")} a supplier whose status is "${status}".`;
}

/** Required document types with no uploaded, non-rejected document. */
export function getMissingRequiredDocuments(
  supplier: SupplierForRequiredDocs,
  documents: { documentType: string; status: string | null }[],
): string[] {
  const present = new Set(documents.filter((d) => d.status !== "rejected").map((d) => d.documentType));
  return getRequiredSupplierDocumentTypes(supplier)
    .filter((type) => !present.has(type))
    .map((type) => SUPPLIER_DOC_LABELS[type]);
}
