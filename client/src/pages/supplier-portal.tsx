import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Supplier } from "@shared/schema";
import {
  getRequiredSupplierDocumentTypes,
  SUPPLIER_DOC_LABELS,
  SUPPLIER_DOC_DESCRIPTIONS,
} from "@shared/supplierRequiredDocs";
import type { SupplierDocumentType } from "@shared/supplierRequiredDocs";
import { useUpload } from "@/hooks/use-upload";
import { getSubmitOnboardingReadiness } from "@shared/supplierOnboardingValidation";
import { getSupplierFieldLabel } from "@shared/supplierProfileFields";
import {
  Building2, Mail, Phone, MapPin, FileText, CreditCard, Pencil, Save, Loader2,
  Send, AlertTriangle, Users, Briefcase, Banknote, Check, Circle, Upload, User,
  FileX2, CalendarClock, XCircle, RefreshCw, MessageSquare, History, ClipboardList,
} from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
const PROFILE_KEYS = [
  "contactName", "email", "phone",
  "registeredOfficeAddress", "registeredOfficeCity", "registeredOfficePostcode",
  "tradingSameAsRegistered", "tradingAddress", "tradingCity", "tradingPostcode",
  "financeContactName", "financeContactEmail", "natureOfSupply",
] as const;

const BANK_KEYS = ["bankName", "accountName", "sortCode", "accountNumber"] as const;
const VAT_KEYS = ["vatStatus", "vatNumber", "nonVatReason", "nonVatDeclarationAccepted"] as const;
const COMPANY_KEYS = ["companyRegNumber"] as const;
const LABOUR_KEYS = [
  "whoEmploysWorkers", "umbrellaName", "umbrellaCrn", "subcontractorName", "subcontractorCrn",
  "subcontractingYes", "payeCompliance", "rtwCompliance", "nmwCompliance",
] as const;

type EditSection = "company" | "vat" | "bank" | "labour" | null;

export default function SupplierPortalPage() {
  const { toast } = useToast();
  const [editingSection, setEditingSection] = useState<EditSection>(null);
  const editing = editingSection !== null;
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [fieldRequestValues, setFieldRequestValues] = useState<Record<string, string>>({});

  const { data: supplier, isLoading } = useQuery<Supplier>({
    queryKey: ["/api/supplier-portal/me"],
  });

  const { data: documents = [] } = useQuery<{ id: number; documentType: string; fileName: string; fileUrl: string; createdAt?: string; status?: "pending" | "approved" | "rejected"; rejectionReason?: string | null; reviewedAt?: string | null; displayName?: string | null; expiryDate?: string | null; notes?: string | null }[]>({
    queryKey: ["/api/supplier-portal/documents"],
    enabled: !!supplier?.id,
  });

  type FieldRequest = { id: number; fieldKey: string; message: string | null; requestedAt: string | null };
  const { data: fieldRequests = [], isLoading: fieldRequestsLoading } = useQuery<FieldRequest[]>({
    queryKey: ["/api/supplier-portal/field-requests"],
    enabled: !!supplier?.id,
    staleTime: 30 * 1000,
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery<{ id: number; type: string; title: string; body: string | null; link: string | null; readAt: string | null; createdAt: string }[]>({
    queryKey: ["/api/notifications"],
    enabled: !!supplier?.id,
    staleTime: 30 * 1000,
  });
  const unreadNotifications = notifications.filter((n) => !n.readAt);
  const hasAnyRequestsOrNotifications = fieldRequests.length > 0 || notifications.length > 0;
  const requestsOrNotificationsLoading = fieldRequestsLoading || notificationsLoading;

  type PendingChange = { id: number; payload: Record<string, unknown>; status: string; createdAt: string; reviewedAt: string | null };
  const { data: pendingChanges = [] } = useQuery<PendingChange[]>({
    queryKey: ["/api/supplier-portal/pending-changes"],
    enabled: !!supplier?.id,
    staleTime: 30 * 1000,
  });

  type ProfileChangeLogEntry = {
    id: number;
    action: string;
    fieldChanges: Array<{ field: string; oldValue: unknown; newValue: unknown }> | null;
    createdAt: string;
  };
  const { data: profileChangeLog = [] } = useQuery<ProfileChangeLogEntry[]>({
    queryKey: ["/api/supplier-portal/profile-change-log"],
    enabled: !!supplier?.id,
    staleTime: 30 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", "/api/supplier-portal/me", payload);
      const data = await res.json().catch(() => ({}));
      return data as { message?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/pending-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/profile-change-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/field-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      const msg = data?.message || "Your changes have been saved.";
      toast({
        title: msg.includes("approval") ? "Change request submitted" : "Profile updated",
        description: msg,
      });
      setEditingSection(null);
      setForm({});
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const submitOnboardingMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/supplier-portal/submit-onboarding");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/me"] });
      toast({ title: "Onboarding submitted", description: "Admin will review your profile." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canEditDirectly = supplier && (
    supplier.status === "draft" ||
    supplier.status === "info_required" ||
    supplier.status === "pending" ||
    supplier.status === "submitted"
  );
  /** Approved/active can submit change requests (pending admin approval). */
  const canRequestChanges = supplier && (supplier.status === "approved" || supplier.status === "active");
  const canEdit = canEditDirectly || canRequestChanges;
  const canUploadDocuments = supplier && (
    supplier.status === "draft" ||
    supplier.status === "info_required" ||
    supplier.status === "pending" ||
    supplier.status === "submitted" ||
    supplier.status === "approved" ||
    supplier.status === "active"
  );
  const isApprovedOrActive = supplier && (supplier.status === "approved" || supplier.status === "active");
  const requiredDocTypes = supplier ? getRequiredSupplierDocumentTypes(supplier) : [];
  const uploadedDocTypes = Array.from(new Set(documents.map((d) => d.documentType)));
  // Effective values for submit validation (form overrides when editing)
  const effectiveSupplier = supplier
    ? { ...supplier, ...(Object.keys(form).length ? form : {}) }
    : null;
  const submitReadiness = effectiveSupplier
    ? getSubmitOnboardingReadiness(effectiveSupplier, uploadedDocTypes)
    : { ok: false as const, reason: "company_profile", message: "" };
  const canSubmit =
    canEdit &&
    supplier!.status !== "submitted" &&
    (supplier!.status === "draft" || supplier!.status === "info_required" || supplier!.status === "pending") &&
    submitReadiness.ok;

  const [vatRequestOpen, setVatRequestOpen] = useState(false);
  const [bankRequestOpen, setBankRequestOpen] = useState(false);
  const [vatRequestForm, setVatRequestForm] = useState<Record<string, string | boolean>>({});
  const [vatRequestEvidenceIds, setVatRequestEvidenceIds] = useState<number[]>([]);
  const [bankRequestForm, setBankRequestForm] = useState<Record<string, string>>({});
  const [bankRequestDocId, setBankRequestDocId] = useState<number | null>(null);

  const [uploadDocOpen, setUploadDocOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<SupplierDocumentType | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFileSelected, setUploadFileSelected] = useState<File | null>(null);
  const uploadFormRef = useRef<{ type: SupplierDocumentType; displayName: string; expiryDate: string; notes: string } | null>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const openUploadDialog = (preselectType?: SupplierDocumentType) => {
    setUploadDocType(preselectType ?? null);
    setUploadDisplayName("");
    setUploadExpiryDate("");
    setUploadNotes("");
    setUploadFileSelected(null);
    setUploadDocOpen(true);
  };

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (res) => {
      const meta = uploadFormRef.current;
      if (!supplier?.id || !meta?.type) return;
      const fileUrl = res.objectPath.startsWith("http") ? res.objectPath : `${window.location.origin}${res.objectPath}`;
      await apiRequest("POST", "/api/supplier-portal/documents", {
        documentType: meta.type,
        fileName: res.metadata.name,
        fileUrl,
        fileSize: res.metadata.size,
        mimeType: res.metadata.contentType,
        displayName: meta.displayName.trim() || undefined,
        expiryDate: meta.expiryDate || undefined,
        notes: meta.notes.trim() || undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/documents"] });
      setUploadDocOpen(false);
      setUploadDocType(null);
      setUploadDisplayName("");
      setUploadExpiryDate("");
      setUploadNotes("");
      setUploadFileSelected(null);
      toast({ title: "Document uploaded", description: "It will be reviewed by admin." });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const changeRequestMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      await apiRequest("PATCH", "/api/supplier-portal/me", payload);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/pending-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/profile-change-log"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      const t = variables.changeType === "vat" ? "VAT change request" : "Bank change request";
      toast({ title: `${t} submitted`, description: "Admin will review and approve or reject." });
      setVatRequestOpen(false);
      setBankRequestOpen(false);
      setVatRequestForm({});
      setVatRequestEvidenceIds([]);
      setBankRequestForm({});
      setBankRequestDocId(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const SECTION_KEYS: Record<string, readonly string[]> = {
    company: [...PROFILE_KEYS, ...COMPANY_KEYS],
    vat: VAT_KEYS,
    bank: BANK_KEYS,
    labour: LABOUR_KEYS,
  };

  const startEdit = (section: EditSection = "company") => {
    if (supplier && section) {
      const keys = SECTION_KEYS[section] ?? [...PROFILE_KEYS, ...COMPANY_KEYS];
      const initial: Record<string, string | boolean> = {};
      keys.forEach((key) => {
        const v = (supplier as Record<string, unknown>)[key];
        initial[key] = typeof v === "boolean" ? v : (v as string) ?? "";
      });
      setForm(initial);
      setEditingSection(section);
    }
  };

  const buildPayload = (): Record<string, unknown> => {
    const payload: Record<string, unknown> = {};
    const keys = editingSection ? (SECTION_KEYS[editingSection] ?? []) : [...PROFILE_KEYS, ...BANK_KEYS, ...VAT_KEYS, ...COMPANY_KEYS, ...LABOUR_KEYS];
    keys.forEach((key) => {
      if (form[key] !== undefined) {
        const current = (supplier as Record<string, unknown>)[key];
        const currentVal = typeof current === "boolean" ? current : (current as string) ?? "";
        if (form[key] !== currentVal) payload[key] = form[key];
      }
    });
    return payload;
  };

  const handleSave = () => {
    const payload = buildPayload();
    if (Object.keys(payload).length === 0) {
      toast({ title: "No changes", description: "Nothing to save.", variant: "destructive" });
      return;
    }
    updateMutation.mutate(payload);
  };

  const accountNameMismatch = supplier && form.accountName !== undefined
    ? (form.accountName as string).trim().toLowerCase() !== (supplier.companyName || "").trim().toLowerCase()
    : supplier && supplier.accountName
      ? (supplier.accountName as string).trim().toLowerCase() !== (supplier.companyName || "").trim().toLowerCase()
      : false;

  if (isLoading || !supplier) {
    return (
      <div className="p-6 flex items-center justify-center h-48">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {supplier.status === "suspended" && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Account suspended</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your supplier account is suspended. You cannot edit your profile or submit onboarding. Please contact the administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications & requests – always visible so supplier sees what admin requested and can update profile */}
      <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="w-5 h-5" />
            Notifications & requests
          </CardTitle>
          <CardDescription>
            {requestsOrNotificationsLoading
              ? "Loading…"
              : fieldRequests.length > 0 && notifications.length > 0
                ? "Admin has requested information and you have other updates below. Use “Update profile” to provide the information; changes may need admin approval."
                : fieldRequests.length > 0
                  ? "Admin has requested that you provide or update the following (including any comments below). Use “Update profile” to make changes."
                  : notifications.length > 0
                    ? "Your recent updates and notifications."
                    : "When admin requests information or sends updates, they will appear here. You can always update your profile using the button next to your company name."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {requestsOrNotificationsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading requests and notifications…
            </div>
          ) : (
            <>
              {/* Field requests – inline editable so supplier can respond immediately */}
              {fieldRequests.length > 0 ? (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    Information requested from you
                  </h4>
                  <ul className="space-y-3">
                    {fieldRequests.map((req) => {
                      const currentValue = (supplier as Record<string, unknown>)?.[req.fieldKey];
                      const displayCurrent = currentValue != null && currentValue !== "" ? String(currentValue) : "";
                      const inputValue = fieldRequestValues[req.fieldKey] ?? "";
                      const hasInput = inputValue.trim().length > 0;
                      return (
                        <li key={req.id} className="rounded-lg border border-amber-200 dark:border-amber-800/50 bg-background/50 p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-medium text-sm">{getSupplierFieldLabel(req.fieldKey)}</span>
                            {displayCurrent && (
                              <span className="text-xs text-muted-foreground shrink-0">Current: {displayCurrent}</span>
                            )}
                          </div>
                          {req.message?.trim() ? (
                            <p className="text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1.5 border-l-2 border-amber-500">
                              {req.message}
                            </p>
                          ) : null}
                          <div className="flex gap-2">
                            <Input
                              placeholder={`Enter ${getSupplierFieldLabel(req.fieldKey).toLowerCase()}`}
                              value={inputValue}
                              onChange={(e) => setFieldRequestValues((prev) => ({ ...prev, [req.fieldKey]: e.target.value }))}
                              className="flex-1"
                            />
                            <Button
                              size="sm"
                              disabled={!hasInput || updateMutation.isPending}
                              onClick={() => {
                                updateMutation.mutate({ [req.fieldKey]: inputValue.trim() });
                                setFieldRequestValues((prev) => {
                                  const next = { ...prev };
                                  delete next[req.fieldKey];
                                  return next;
                                });
                              }}
                            >
                              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No pending information requests.</p>
              )}

              {/* In-app notifications (field request, change approved/rejected, etc.) */}
              {notifications.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Recent notifications</h4>
                  <ul className="space-y-2">
                    {notifications.slice(0, 10).map((n) => (
                      <li
                        key={n.id}
                        className={`rounded border p-3 text-sm ${!n.readAt ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"}`}
                      >
                        <p className="font-medium">{n.title}</p>
                        {n.body && <p className="text-muted-foreground mt-0.5">{n.body}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(n.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">You can also see all notifications in the bell icon in the top header.</p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="w-6 h-6 text-primary" />
            </div>
            <div>
              <CardTitle>{supplier.companyName}</CardTitle>
              <CardDescription>
                {supplier.status === "suspended"
                  ? "Your account is suspended."
                  : supplier.status === "approved" || supplier.status === "active"
                    ? "Click Edit on any section below to update your details. Changes need admin approval."
                    : "Complete your profile. Click Edit on each section to fill in the details."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Document status overview: missing, expiring/expired, rejected (revision) – always visible */}
      {(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in30Days = new Date(today);
        in30Days.setDate(in30Days.getDate() + 30);
        const missingTypes = requiredDocTypes.filter((type) => {
          const docsOfType = documents.filter((d) => d.documentType === type);
          const latest = [...docsOfType].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
          return !latest || latest.status !== "approved";
        });
        // Only approved documents with expiry – rejected/pending stay in their own sections
        const expiringOrExpired = documents
          .filter((d) => d.status === "approved" && d.expiryDate)
          .filter((d) => {
            const exp = new Date(d.expiryDate!);
            exp.setHours(0, 0, 0, 0);
            return exp <= in30Days;
          })
          .map((d) => ({
            ...d,
            isExpired: new Date(d.expiryDate!).setHours(0, 0, 0, 0) < today.getTime(),
          }));
        const rejectedDocs = documents.filter((d) => d.status === "rejected");
        const hasAlerts = missingTypes.length > 0 || expiringOrExpired.length > 0 || rejectedDocs.length > 0;
        const scrollToDocuments = () => document.getElementById("supplier-documents")?.scrollIntoView({ behavior: "smooth" });
        return (
          <Card className={hasAlerts ? "border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/50" : "border-green-200 bg-green-50/30 dark:bg-green-950/20 dark:border-green-800/50"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Document status
              </CardTitle>
              <CardDescription>
                {hasAlerts
                  ? "Missing documents, expiring or expired items, and rejected documents that need revision (re-upload)."
                  : "Summary of your document compliance. Upload and manage files in the Documents section below."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasAlerts ? (
                <>
                  {missingTypes.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <FileX2 className="w-4 h-4 shrink-0" />
                        Missing or not yet approved ({missingTypes.length})
                      </div>
                      <ul className="list-disc list-inside text-sm text-muted-foreground space-y-0.5 pl-1">
                        {missingTypes.map((type) => (
                          <li key={type}>
                            {SUPPLIER_DOC_LABELS[type as keyof typeof SUPPLIER_DOC_LABELS] ?? type}
                          </li>
                        ))}
                      </ul>
                      <p className="text-xs text-muted-foreground">Upload or get approval for these in the Documents section below.</p>
                    </div>
                  )}
                  {expiringOrExpired.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-200">
                        <CalendarClock className="w-4 h-4 shrink-0" />
                        Expiring or expired ({expiringOrExpired.length})
                      </div>
                      <ul className="space-y-2 text-sm">
                        {expiringOrExpired.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded border border-amber-200 dark:border-amber-800/50 bg-background/50 p-2">
                            <span className="font-medium">{d.displayName?.trim() || d.fileName}</span>
                            <span className="text-muted-foreground">
                              {SUPPLIER_DOC_LABELS[d.documentType as keyof typeof SUPPLIER_DOC_LABELS] ?? d.documentType}
                            </span>
                            <span className={d.isExpired ? "text-destructive font-medium" : "text-amber-700 dark:text-amber-400"}>
                              {d.isExpired ? "Expired" : "Expiring"}{" "}
                              {d.expiryDate && new Date(d.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                            </span>
                            {d.notes?.trim() && <span className="text-muted-foreground text-xs">· {d.notes}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {rejectedDocs.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <XCircle className="w-4 h-4 shrink-0" />
                        Rejected – revision required ({rejectedDocs.length})
                      </div>
                      <p className="text-xs text-muted-foreground">Re-upload a corrected document for each item below. Admin feedback is shown.</p>
                      <ul className="space-y-2 text-sm">
                        {rejectedDocs.map((d) => (
                          <li key={d.id} className="rounded border border-destructive/30 bg-destructive/5 dark:bg-destructive/10 p-3 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <RefreshCw className="w-4 h-4 text-destructive shrink-0" />
                              <span className="font-medium">{d.displayName?.trim() || d.fileName}</span>
                              <span className="text-muted-foreground">
                                ({SUPPLIER_DOC_LABELS[d.documentType as keyof typeof SUPPLIER_DOC_LABELS] ?? d.documentType})
                              </span>
                            </div>
                            <p className="text-destructive text-xs pl-6 font-medium">
                              Reason: {d.rejectionReason?.trim() || "No reason provided – contact admin if you need details."}
                            </p>
                            {d.reviewedAt && (
                              <p className="text-xs text-muted-foreground pl-6">
                                Rejected on {new Date(d.reviewedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground pl-6">Re-upload this document in the Documents section below.</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-2 text-sm text-green-800 dark:text-green-200">
                  <Check className="w-4 h-4 shrink-0" />
                  All required documents are approved. No expiring or rejected documents.
                </div>
              )}
              <Button variant="outline" size="sm" onClick={scrollToDocuments} className="mt-2">
                Go to Documents
              </Button>
            </CardContent>
          </Card>
        );
      })()}

      {/* My details – full overview so supplier sees everything clearly */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="w-5 h-5" />
            My details
          </CardTitle>
          <CardDescription>Complete view of your supplier profile. Edit profile above to change details when allowed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <DetailSection title="Company & contact" items={[
            { label: "Company name", value: supplier.companyName },
            { label: "Main contact", value: supplier.contactName },
            { label: "Email", value: supplier.email },
            { label: "Phone", value: supplier.phone ?? "—" },
            { label: "Supplier type", value: supplier.supplierType === "labour" ? "Labour" : supplier.supplierType === "non_labour" ? "Non-labour" : "—" },
            { label: "Address (legacy)", value: [supplier.address, supplier.city, supplier.postcode].filter(Boolean).join(", ") || "—" },
            { label: "Company registration number (CRN)", value: supplier.companyRegNumber ?? "—" },
          ]} />
          <DetailSection title="Registered office" items={[
            { label: "Address", value: supplier.registeredOfficeAddress ?? "—" },
            { label: "City", value: supplier.registeredOfficeCity ?? "—" },
            { label: "Postcode", value: supplier.registeredOfficePostcode ?? "—" },
            { label: "Country", value: supplier.registeredOfficeCountry ?? "—" },
          ]} />
          <DetailSection title="Trading address" items={[
            { label: "Same as registered office", value: supplier.tradingSameAsRegistered === false ? "No" : "Yes" },
            { label: "Address", value: supplier.tradingAddress ?? "—" },
            { label: "City", value: supplier.tradingCity ?? "—" },
            { label: "Postcode", value: supplier.tradingPostcode ?? "—" },
          ]} />
          <DetailSection title="Finance & supply" items={[
            { label: "Finance contact name", value: supplier.financeContactName ?? "—" },
            { label: "Finance contact email", value: supplier.financeContactEmail ?? "—" },
            { label: "Nature of supply", value: supplier.natureOfSupply ?? "—" },
          ]} />
          <DetailSection title="Companies House" items={[
            { label: "Company category", value: supplier.companyCategory ?? "—" },
            { label: "Company status", value: supplier.companyStatus ?? "—" },
            { label: "Country of origin", value: supplier.countryOfOrigin ?? "—" },
            { label: "Incorporation date", value: supplier.incorporationDate ? new Date(supplier.incorporationDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—" },
            { label: "SIC codes", value: supplier.sicCodes ?? "—" },
            { label: "Accounts next due", value: supplier.accountsNextDue ?? "—" },
            { label: "Accounts last made up", value: supplier.accountsLastMadeUpDate ?? "—" },
            { label: "Account category", value: supplier.accountCategory ?? "—" },
            { label: "Returns next due", value: supplier.returnsNextDue ?? "—" },
            { label: "Returns last made up", value: supplier.returnsLastMadeUpDate ?? "—" },
          ]} />
          <DetailSection title="VAT" items={[
            { label: "VAT status", value: supplier.vatStatus === "vat_registered" ? "VAT Registered" : supplier.vatStatus === "not_vat_registered" ? "Not VAT Registered" : "—" },
            { label: "VAT number", value: supplier.vatNumber ?? "—" },
            { label: "Non-VAT reason", value: supplier.nonVatReason ?? "—" },
            { label: "Non-VAT declaration accepted", value: supplier.nonVatDeclarationAccepted ? "Yes" : "No" },
          ]} />
          <DetailSection title="Bank details" items={[
            { label: "Account name", value: supplier.accountName ?? "—" },
            { label: "Bank name", value: supplier.bankName ?? "—" },
            { label: "Sort code", value: supplier.sortCode ?? "—" },
            { label: "Account number", value: supplier.accountNumber ?? "—" },
          ]} />
          <DetailSection title="Billing" items={[
            { label: "Billing frequency", value: supplier.billingFrequency === "weekly" ? "Weekly" : supplier.billingFrequency === "fortnightly" ? "Fortnightly" : "Monthly" },
          ]} />
          {supplier.supplierType === "labour" && (
            <DetailSection title="Labour supply" items={[
              { label: "Who employs workers", value: supplier.whoEmploysWorkers ?? "—" },
              { label: "Umbrella name", value: supplier.umbrellaName ?? "—" },
              { label: "Umbrella CRN", value: supplier.umbrellaCrn ?? "—" },
              { label: "Subcontractor name", value: supplier.subcontractorName ?? "—" },
              { label: "Subcontractor CRN", value: supplier.subcontractorCrn ?? "—" },
              { label: "Subcontracting used", value: supplier.subcontractingYes ? "Yes" : "No" },
              { label: "PAYE compliance", value: supplier.payeCompliance ? "Yes" : "No" },
              { label: "Right to Work compliance", value: supplier.rtwCompliance ? "Yes" : "No" },
              { label: "National Minimum Wage compliance", value: supplier.nmwCompliance ? "Yes" : "No" },
            ]} />
          )}
          <DetailSection title="Status & review" items={[
            { label: "Status", value: supplier.status ?? "—" },
            { label: "Submitted at", value: supplier.submittedAt ? new Date(supplier.submittedAt as string).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—" },
            { label: "Approved at", value: supplier.approvedAt ? new Date(supplier.approvedAt as string).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—" },
            { label: "Info required notes", value: supplier.infoRequiredNotes ?? "—" },
            { label: "Last review at", value: (supplier as Record<string, unknown>).lastReviewAt ? new Date((supplier as Record<string, unknown>).lastReviewAt as string).toLocaleDateString("en-GB") : "—" },
            { label: "Next review due", value: (supplier as Record<string, unknown>).nextReviewDueAt ? new Date((supplier as Record<string, unknown>).nextReviewDueAt as string).toLocaleDateString("en-GB") : "—" },
          ]} />
        </CardContent>
      </Card>

      {/* Company profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Briefcase className="w-5 h-5" />
                Company profile
              </CardTitle>
              <CardDescription>Registered office, trading address, main and finance contacts, nature of supply.</CardDescription>
            </div>
            {!editing && (canEditDirectly || canRequestChanges) && (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label>Main contact</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="contactName" label="Contact name" supplier={supplier} />
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="phone" label="Phone" supplier={supplier} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Registered office address</Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-1">
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="registeredOfficeAddress" label="Address" supplier={supplier} />
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="registeredOfficeCity" label="City" supplier={supplier} />
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="registeredOfficePostcode" label="Postcode" supplier={supplier} />
              </div>
            </div>
            <div className="sm:col-span-2">
              <Label>Trading address</Label>
              <div className="flex items-center gap-2 mt-1 mb-2">
                <Checkbox
                  checked={form.tradingSameAsRegistered !== false && (supplier.tradingSameAsRegistered ?? true)}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, tradingSameAsRegistered: c === true }))}
                  disabled={!editing}
                />
                <Label className="font-normal">Same as registered office</Label>
              </div>
              {!(form.tradingSameAsRegistered !== false && (supplier.tradingSameAsRegistered ?? true)) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="tradingAddress" label="Address" supplier={supplier} />
                  <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="tradingCity" label="City" supplier={supplier} />
                  <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="tradingPostcode" label="Postcode" supplier={supplier} />
                </div>
              )}
            </div>
            <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="financeContactName" label="Finance contact name" supplier={supplier} />
            <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="financeContactEmail" label="Finance contact email" supplier={supplier} />
            <div className="sm:col-span-2">
              <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="natureOfSupply" label="Nature of supply" supplier={supplier} />
            </div>
            <div className="sm:col-span-2">
              <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="companyRegNumber" label="Company Registration Number (CRN)" supplier={supplier} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VAT */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                VAT status
              </CardTitle>
              <CardDescription>Select VAT Registered or Not VAT Registered and complete the required details.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!editing && (canEditDirectly || canRequestChanges) && (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            {isApprovedOrActive && (
              <Dialog open={vatRequestOpen} onOpenChange={setVatRequestOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Request VAT change</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request VAT status change</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div>
                      <Label>New VAT status</Label>
                      <Select
                        value={vatRequestForm.vatStatus ?? ""}
                        onValueChange={(v) => setVatRequestForm((f) => ({ ...f, vatStatus: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vat_registered">VAT Registered</SelectItem>
                          <SelectItem value="not_vat_registered">Not VAT Registered</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {vatRequestForm.vatStatus === "vat_registered" && (
                      <div>
                        <Label>VAT number</Label>
                        <Input
                          value={vatRequestForm.vatNumber ?? ""}
                          onChange={(e) => setVatRequestForm((f) => ({ ...f, vatNumber: e.target.value }))}
                          placeholder="VAT number"
                        />
                      </div>
                    )}
                    {vatRequestForm.vatStatus === "not_vat_registered" && (
                      <>
                        <div>
                          <Label>Reason</Label>
                          <Input
                            value={vatRequestForm.nonVatReason ?? ""}
                            onChange={(e) => setVatRequestForm((f) => ({ ...f, nonVatReason: e.target.value }))}
                            placeholder="Reason for not being VAT registered"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={vatRequestForm.nonVatDeclarationAccepted === true}
                            onCheckedChange={(c) => setVatRequestForm((f) => ({ ...f, nonVatDeclarationAccepted: c === true }))}
                          />
                          <Label className="font-normal">No VAT charged; I will notify if status changes.</Label>
                        </div>
                      </>
                    )}
                    <div>
                      <Label>Supporting documents (select at least one)</Label>
                      <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                        {documents
                          .filter((d) => ["vat_evidence", "sample_vat_invoice", "non_vat_declaration"].includes(d.documentType))
                          .map((d) => (
                            <div key={d.id} className="flex items-center gap-2">
                              <Checkbox
                                checked={vatRequestEvidenceIds.includes(d.id)}
                                onCheckedChange={(c) =>
                                  setVatRequestEvidenceIds((prev) =>
                                    c === true ? [...prev, d.id] : prev.filter((id) => id !== d.id)
                                  )
                                }
                              />
                              <span className="text-sm">{d.fileName}</span>
                            </div>
                          ))}
                        {documents.filter((d) => ["vat_evidence", "sample_vat_invoice", "non_vat_declaration"].includes(d.documentType)).length === 0 && (
                          <p className="text-sm text-muted-foreground">No supporting documents uploaded yet.</p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setVatRequestOpen(false);
                          openUploadDialog("vat_evidence" as SupplierDocumentType);
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload VAT evidence document
                      </Button>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!vatRequestForm.vatStatus || vatRequestEvidenceIds.length === 0 || changeRequestMutation.isPending}
                      onClick={() => {
                        changeRequestMutation.mutate({
                          changeType: "vat",
                          vatStatus: vatRequestForm.vatStatus,
                          vatNumber: vatRequestForm.vatStatus === "vat_registered" ? vatRequestForm.vatNumber : undefined,
                          nonVatReason: vatRequestForm.vatStatus === "not_vat_registered" ? vatRequestForm.nonVatReason : undefined,
                          nonVatDeclarationAccepted: vatRequestForm.vatStatus === "not_vat_registered" ? vatRequestForm.nonVatDeclarationAccepted : undefined,
                          evidenceDocumentIds: vatRequestEvidenceIds,
                        });
                      }}
                    >
                      {changeRequestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit VAT change request"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>VAT status</Label>
            {editing ? (
              <Select
                value={(form.vatStatus as string) ?? (supplier.vatStatus as string) ?? ""}
                onValueChange={(v) => setForm((f) => ({ ...f, vatStatus: v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat_registered">VAT Registered</SelectItem>
                  <SelectItem value="not_vat_registered">Not VAT Registered</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-medium py-2">{supplier.vatStatus === "vat_registered" ? "VAT Registered" : supplier.vatStatus === "not_vat_registered" ? "Not VAT Registered" : "—"}</p>
            )}
          </div>
          {(form.vatStatus === "vat_registered" || (!form.vatStatus && supplier.vatStatus === "vat_registered")) && (
            <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="vatNumber" label="VAT number" supplier={supplier} />
          )}
          {(form.vatStatus === "not_vat_registered" || (!form.vatStatus && supplier.vatStatus === "not_vat_registered")) && (
            <>
              <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="nonVatReason" label="Reason for not being VAT registered" supplier={supplier} />
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.nonVatDeclarationAccepted === true || (supplier.nonVatDeclarationAccepted ?? false)}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, nonVatDeclarationAccepted: c === true }))}
                  disabled={!editing}
                />
                <Label className="font-normal">I confirm no VAT is charged and I will notify if my status changes.</Label>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bank */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="w-5 h-5" />
                Bank details
              </CardTitle>
              <CardDescription>Account name should match your legal company name. Bank proof may be required.</CardDescription>
            </div>
            <div className="flex gap-2 flex-wrap">
              {!editing && (canEditDirectly || canRequestChanges) && (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            {isApprovedOrActive && (
              <Dialog open={bankRequestOpen} onOpenChange={setBankRequestOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">Request bank change</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Request bank details change</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <p className="text-sm text-muted-foreground">Provide new bank details and select a bank proof document dated within the last 3 months.</p>
                    <div>
                      <Label>Account name</Label>
                      <Input
                        value={bankRequestForm.accountName ?? ""}
                        onChange={(e) => setBankRequestForm((f) => ({ ...f, accountName: e.target.value }))}
                        placeholder="Account name"
                      />
                    </div>
                    <div>
                      <Label>Bank name</Label>
                      <Input
                        value={bankRequestForm.bankName ?? ""}
                        onChange={(e) => setBankRequestForm((f) => ({ ...f, bankName: e.target.value }))}
                        placeholder="Bank name"
                      />
                    </div>
                    <div>
                      <Label>Sort code</Label>
                      <Input
                        value={bankRequestForm.sortCode ?? ""}
                        onChange={(e) => setBankRequestForm((f) => ({ ...f, sortCode: e.target.value }))}
                        placeholder="Sort code"
                      />
                    </div>
                    <div>
                      <Label>Account number</Label>
                      <Input
                        value={bankRequestForm.accountNumber ?? ""}
                        onChange={(e) => setBankRequestForm((f) => ({ ...f, accountNumber: e.target.value }))}
                        placeholder="Account number"
                      />
                    </div>
                    <div>
                      <Label>Bank proof (must be within last 3 months)</Label>
                      <Select
                        value={bankRequestDocId != null ? String(bankRequestDocId) : ""}
                        onValueChange={(v) => setBankRequestDocId(v ? parseInt(v, 10) : null)}
                      >
                        <SelectTrigger><SelectValue placeholder="Select document" /></SelectTrigger>
                        <SelectContent>
                          {(() => {
                            const threeMonthsAgo = new Date(); threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
                            return documents
                              .filter((d) => d.documentType === "bank_proof" && (!d.createdAt || new Date(d.createdAt) >= threeMonthsAgo))
                              .map((d) => (
                                <SelectItem key={d.id} value={String(d.id)}>{d.fileName}</SelectItem>
                              ));
                          })()}
                        </SelectContent>
                      </Select>
                      {documents.filter((d) => d.documentType === "bank_proof").length === 0 && (
                        <p className="text-xs text-muted-foreground mt-1">No bank proof documents uploaded yet.</p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        onClick={() => {
                          setBankRequestOpen(false);
                          openUploadDialog("bank_proof" as SupplierDocumentType);
                        }}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload bank proof document
                      </Button>
                    </div>
                    <Button
                      className="w-full"
                      disabled={!bankRequestForm.accountName || !bankRequestForm.sortCode || !bankRequestForm.accountNumber || bankRequestDocId == null || changeRequestMutation.isPending}
                      onClick={() => {
                        changeRequestMutation.mutate({
                          changeType: "bank",
                          accountName: bankRequestForm.accountName,
                          bankName: bankRequestForm.bankName,
                          sortCode: bankRequestForm.sortCode,
                          accountNumber: bankRequestForm.accountNumber,
                          bankProofDocumentId: bankRequestDocId,
                        });
                      }}
                    >
                      {changeRequestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Submit bank change request"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="accountName" label="Account name" supplier={supplier} />
            <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="bankName" label="Bank name" supplier={supplier} />
            <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="sortCode" label="Sort code" supplier={supplier} />
            <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="accountNumber" label="Account number" supplier={supplier} />
          </div>
          {accountNameMismatch && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <span>Account name should match your legal company name ({supplier.companyName}).</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Labour (only when Labour supplier) */}
      {supplier.supplierType === "labour" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Users className="w-5 h-5" />
                  Labour supply details
                </CardTitle>
                <CardDescription>Who employs workers, umbrella/subcontractor details, compliance confirmations.</CardDescription>
              </div>
              {!editing && (canEditDirectly || canRequestChanges) && (
                <Button size="sm" variant="outline" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Who employs workers</Label>
              {editing ? (
                <Select
                  value={(form.whoEmploysWorkers as string) ?? (supplier.whoEmploysWorkers as string) ?? ""}
                  onValueChange={(v) => setForm((f) => ({ ...f, whoEmploysWorkers: v }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Supplier</SelectItem>
                    <SelectItem value="umbrella">Umbrella</SelectItem>
                    <SelectItem value="subcontractor">Subcontractor</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm font-medium py-2">{supplier.whoEmploysWorkers || "—"}</p>
              )}
            </div>
            {(form.whoEmploysWorkers === "umbrella" || supplier.whoEmploysWorkers === "umbrella") && (
              <>
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="umbrellaName" label="Umbrella name" supplier={supplier} />
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="umbrellaCrn" label="Umbrella CRN" supplier={supplier} />
              </>
            )}
            {((form.whoEmploysWorkers === "subcontractor" || supplier.whoEmploysWorkers === "subcontractor") || (form.subcontractingYes || supplier.subcontractingYes)) && (
              <>
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="subcontractorName" label="Subcontractor name" supplier={supplier} />
                <FieldOrInput editing={editing} form={form} setForm={setForm} keyName="subcontractorCrn" label="Subcontractor CRN" supplier={supplier} />
              </>
            )}
            <div className="flex items-center gap-2">
              <Checkbox
                checked={form.subcontractingYes === true || (supplier.subcontractingYes ?? false)}
                onCheckedChange={(c) => setForm((f) => ({ ...f, subcontractingYes: c === true }))}
                disabled={!editing}
              />
              <Label className="font-normal">Subcontracting used</Label>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.payeCompliance === true || (supplier.payeCompliance ?? false)}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, payeCompliance: c === true }))}
                  disabled={!editing}
                />
                <Label className="font-normal">PAYE compliance</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.rtwCompliance === true || (supplier.rtwCompliance ?? false)}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, rtwCompliance: c === true }))}
                  disabled={!editing}
                />
                <Label className="font-normal">Right to Work</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={form.nmwCompliance === true || (supplier.nmwCompliance ?? false)}
                  onCheckedChange={(c) => setForm((f) => ({ ...f, nmwCompliance: c === true }))}
                  disabled={!editing}
                />
                <Label className="font-normal">National Minimum Wage</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documents */}
      <Card id="supplier-documents">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Documents
              </CardTitle>
              <CardDescription>Upload required documents. Types may vary by VAT status and supplier type. You can set a document name, expiry date, and notes when uploading.</CardDescription>
            </div>
            {canUploadDocuments && (
              <Dialog open={uploadDocOpen} onOpenChange={(open) => { setUploadDocOpen(open); if (!open) { setUploadFileSelected(null); setUploadDocType(null); setUploadDisplayName(""); setUploadExpiryDate(""); setUploadNotes(""); } }}>
                <Button size="sm" onClick={() => openUploadDialog()}>
                  <Upload className="w-4 h-4 mr-2" /> Upload document
                </Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Upload document</DialogTitle>
                    <p className="text-sm text-muted-foreground">Choose type, select a file. Optionally add a name, expiry date, or notes.</p>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <Label>Document type</Label>
                      <Select value={uploadDocType ?? ""} onValueChange={(v) => setUploadDocType(v ? (v as SupplierDocumentType) : null)}>
                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                        <SelectContent>
                          {requiredDocTypes.map((t) => <SelectItem key={t} value={t}>{SUPPLIER_DOC_LABELS[t]}</SelectItem>)}
                          <SelectItem value="other">{SUPPLIER_DOC_LABELS.other}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>File (PDF, JPG, PNG)</Label>
                      <input ref={uploadInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setUploadFileSelected(e.target.files?.[0] ?? null)} />
                      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => uploadInputRef.current?.click()}>{uploadFileSelected ? uploadFileSelected.name : "Choose file"}</Button>
                    </div>
                    <div>
                      <Label>Document name (optional{uploadDocType === "other" ? ", required for Other" : ""})</Label>
                      <Input placeholder="e.g. Certificate of Incorporation" value={uploadDisplayName} onChange={(e) => setUploadDisplayName(e.target.value)} />
                    </div>
                    <div>
                      <Label>Expiry date (optional)</Label>
                      <Input type="date" value={uploadExpiryDate} onChange={(e) => setUploadExpiryDate(e.target.value)} />
                    </div>
                    <div>
                      <Label>Notes (optional)</Label>
                      <Textarea placeholder="Any notes about this document" value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} rows={2} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setUploadDocOpen(false)}>Cancel</Button>
                    <Button
                      disabled={!uploadDocType || !uploadFileSelected || isUploading || (uploadDocType === "other" && !uploadDisplayName.trim())}
                      onClick={() => {
                        if (!uploadFileSelected || !uploadDocType) return;
                        uploadFormRef.current = { type: uploadDocType, displayName: uploadDisplayName, expiryDate: uploadExpiryDate, notes: uploadNotes };
                        uploadFile(uploadFileSelected);
                      }}
                    >
                      {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      {isUploading ? "Uploading…" : "Upload"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Uploaded: {documents.length} file(s). Use the buttons below to upload each document type (you can add a name, expiry date, and notes in the upload dialog).</p>
            {canUploadDocuments && (
              <Button size="sm" onClick={() => openUploadDialog()} variant="secondary">
                <Upload className="w-4 h-4 mr-2" /> Upload document
              </Button>
            )}
          </div>
          <ul className="space-y-4">
            {requiredDocTypes.map((type) => {
              const docsOfType = documents.filter((d) => d.documentType === type);
              const latest = [...docsOfType].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
              const uploaded = docsOfType.length > 0;
              const status = latest?.status ?? "pending";
              const label = SUPPLIER_DOC_LABELS[type as keyof typeof SUPPLIER_DOC_LABELS] ?? type;
              const description = type !== "other" && SUPPLIER_DOC_DESCRIPTIONS[type as keyof typeof SUPPLIER_DOC_DESCRIPTIONS];
              const uploadedDate = latest?.createdAt ? new Date(latest.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
              return (
                <li key={type} className="rounded-lg border p-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      {uploaded && status === "approved" ? (
                        <Check className="w-4 h-4 text-green-600 shrink-0" />
                      ) : uploaded && status === "rejected" ? (
                        <Circle className="w-4 h-4 text-destructive shrink-0" />
                      ) : uploaded ? (
                        <Circle className="w-4 h-4 text-amber-500 shrink-0" />
                      ) : (
                        <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="font-medium text-sm">{label}</span>
                      {uploaded && (
                        <span className={`text-xs ${status === "rejected" ? "text-destructive" : "text-muted-foreground"}`}>
                          {status === "approved" ? "Approved" : status === "rejected" ? `Rejected: ${latest?.rejectionReason ?? "see email"}` : "Pending review"}
                          {uploadedDate && ` · Uploaded ${uploadedDate}`}
                          {latest?.expiryDate && ` · Expires ${new Date(latest.expiryDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
                        </span>
                      )}
                    </div>
                    {canUploadDocuments && (
                      <Button
                        variant={uploaded ? "outline" : "default"}
                        size="sm"
                        onClick={() => openUploadDialog(type as SupplierDocumentType)}
                        className="shrink-0"
                      >
                        <Upload className="w-3 h-3 mr-1" />
                        {uploaded ? "Replace" : "Upload"}
                      </Button>
                    )}
                  </div>
                  {description && <p className="text-xs text-muted-foreground pl-6">{description}</p>}
                </li>
              );
            })}
          </ul>
          {documents.some((d) => d.documentType === "other") && (
            <div className="pt-2 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">Other documents</p>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {documents.filter((d) => d.documentType === "other").map((d) => (
                  <li key={d.id}>
                    {d.displayName?.trim() || d.fileName}
                    {d.createdAt && ` · Uploaded ${new Date(d.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {canEdit && !submitReadiness.ok && supplier.status !== "submitted" && (
            <p className="text-xs text-amber-600 dark:text-amber-500">
              {submitReadiness.reason === "documents"
                ? "Complete all required documents above before submitting onboarding."
                : submitReadiness.message}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Submit onboarding */}
      {canSubmit && (
        <Card>
          <CardContent className="pt-6">
            <Button
              className="w-full"
              size="lg"
              onClick={() => submitOnboardingMutation.mutate()}
              disabled={submitOnboardingMutation.isPending}
            >
              {submitOnboardingMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              Submit onboarding for review
            </Button>
          </CardContent>
        </Card>
      )}

      {supplier.status === "submitted" && (
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <p className="text-sm font-medium">Your onboarding has been submitted. Admin will review and either approve or request more information.</p>
          </CardContent>
        </Card>
      )}

      {pendingChanges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ClipboardList className="w-5 h-5" />
              Your change requests
            </CardTitle>
            <CardDescription>Changes you submitted for admin approval.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingChanges.map((change) => {
              const dataKeys = Object.keys(change.payload).filter((k) => !["changeType", "evidenceDocumentIds", "bankProofDocumentId"].includes(k));
              return (
                <div key={change.id} className="rounded-lg border p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={change.status === "pending" ? "secondary" : change.status === "approved" ? "default" : "destructive"}>
                      {change.status === "pending" ? "Pending review" : change.status === "approved" ? "Approved" : "Rejected"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Submitted {new Date(change.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    {change.reviewedAt && (
                      <span className="text-xs text-muted-foreground">
                        — Reviewed {new Date(change.reviewedAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                      </span>
                    )}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Fields: </span>
                    {dataKeys.map((k) => getSupplierFieldLabel(k)).join(", ")}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {profileChangeLog.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="w-5 h-5" />
              Profile change history
            </CardTitle>
            <CardDescription>Log of all profile changes (direct edits and approved/rejected requests).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-80 overflow-auto">
              {profileChangeLog.map((entry) => (
                <div key={entry.id} className="rounded border p-2 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-muted-foreground shrink-0">
                      {new Date(entry.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                    <Badge variant={entry.action === "pending_rejected" ? "destructive" : entry.action === "pending_approved" ? "default" : "secondary"}>
                      {entry.action === "direct_edit" ? "Direct edit" : entry.action === "pending_approved" ? "Approved" : "Rejected"}
                    </Badge>
                  </div>
                  {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-muted-foreground">Field changes</summary>
                      <ul className="text-xs mt-1 space-y-0.5 pl-3">
                        {entry.fieldChanges.map((fc, i) => (
                          <li key={i}>
                            <strong>{getSupplierFieldLabel(fc.field)}</strong>:{" "}
                            "{fc.oldValue != null && fc.oldValue !== "" ? String(fc.oldValue) : "(empty)"}" → "{fc.newValue != null && fc.newValue !== "" ? String(fc.newValue) : "(empty)"}"
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {editing && (
        <div className="sticky bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur border-t shadow-lg p-4 -mx-6 -mb-6">
          <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {canRequestChanges ? "Your changes will be sent for admin approval." : "Edit mode — save when ready."}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => setEditingSection(null)}>Cancel</Button>
              <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                {canRequestChanges ? "Submit for approval" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailSection({ title, items }: { title: string; items: { label: string; value: string }[] }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
        {items.map(({ label, value }) => (
          <div key={label} className="flex flex-col sm:flex-row sm:gap-2 min-w-0">
            <dt className="text-muted-foreground shrink-0 sm:w-44">{label}</dt>
            <dd className="font-medium break-words">{value || "—"}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FieldOrInput({
  editing,
  form,
  setForm,
  keyName,
  label,
  supplier,
}: {
  editing: boolean;
  form: Record<string, string | boolean>;
  setForm: React.Dispatch<React.SetStateAction<Record<string, string | boolean>>>;
  keyName: string;
  label: string;
  supplier: Supplier;
}) {
  const value = form[keyName] !== undefined ? String(form[keyName]) : ((supplier as Record<string, unknown>)[keyName] as string) ?? "";
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {editing ? (
        <Input
          value={value}
          onChange={(e) => setForm((f) => ({ ...f, [keyName]: e.target.value }))}
          placeholder={label}
        />
      ) : (
        <p className="text-sm font-medium py-2">{value || "—"}</p>
      )}
    </div>
  );
}
