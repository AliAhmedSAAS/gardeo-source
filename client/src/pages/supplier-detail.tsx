import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useUpload } from "@/hooks/use-upload";
import type { Supplier, RateCard } from "@shared/schema";
import { getRequiredSupplierDocumentTypes, SUPPLIER_DOC_LABELS, SUPPLIER_DOC_DESCRIPTIONS } from "@shared/supplierRequiredDocs";
import type { SupplierDocumentType } from "@shared/supplierRequiredDocs";
import { getRequiredSupplierPolicyTypes, SUPPLIER_POLICY_LABELS, SUPPLIER_POLICY_DESCRIPTIONS } from "@shared/supplierRequiredPolicies";
import { SUPPLIER_PROFILE_FIELD_LABELS } from "@shared/supplierProfileFields";
import {
  Building2, CheckCircle2, Mail, Phone, MapPin, FileText, CreditCard, Shield,
  Users, Loader2, ArrowLeft, KeyRound, Send, RefreshCw, Activity, ClipboardList,
  MessageSquare, Ban, RotateCcw, CalendarCheck, Upload, XCircle, Copy, History, X, MessageCircle, Pencil, Save, Plus, Trash2, Square, CheckSquare, Banknote, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  submitted: { label: "Submitted", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  info_required: { label: "Info Required", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  active: { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  terminated: { label: "Terminated", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

/** UK format: dd/mm/yyyy, 24-hour clock */
function formatDateTimeUK(dateStr: string | Date | null | undefined): string {
  if (dateStr == null) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

type PortalStatus = {
  portalAccessEnabled: boolean;
  portalEmail: string;
  invitationAccepted: boolean;
  invitationSentAt: string | null;
  reminderSentAt: string | null;
  inviteLink: string | null;
  loginCount: number;
  lastLoginAt: string | null;
  lastLoginMeta: { ipAddress: string | null; userAgent: string | null; location: string | null } | null;
};

type ActivityItem =
  | { type: "audit"; id: number; action: string; entityType: string; entityId: string | null; details: unknown; ipAddress: string | null; createdAt: Date | string; userId?: string; userName?: string }
  | { type: "login"; id: number; createdAt: Date | string; ipAddress: string | null; userAgent: string | null; location: string | null; userName?: string };

const REQUESTABLE_FIELD_KEYS = [
  "companyName", "contactName", "email", "phone", "address", "city", "postcode",
  "registeredOfficeAddress", "registeredOfficeCity", "registeredOfficePostcode", "registeredOfficeCountry",
  "tradingSameAsRegistered", "tradingAddress", "tradingCity", "tradingPostcode",
  "financeContactName", "financeContactEmail", "natureOfSupply",
  "vatNumber", "vatStatus", "companyRegNumber",
  "bankName", "accountName", "sortCode", "accountNumber",
  "whoEmploysWorkers", "umbrellaName", "umbrellaCrn", "subcontractorName", "subcontractorCrn",
  "selfBillingSignatureRequest",
] as const;

interface AddressHistoryData {
  companyName: string;
  incorporationDate: string | null;
  currentAddress: string;
  addresses: Array<{ address: string; from: string | null; to: string | null; isCurrent: boolean }>;
}

function AddressHistorySection({ supplier }: { supplier: Supplier }) {
  const signingDate = supplier.selfBillingAcceptedAt ? new Date(supplier.selfBillingAcceptedAt as unknown as string).toISOString().split("T")[0] : null;

  const { data: addressHistory, isLoading, isError } = useQuery<AddressHistoryData>({
    queryKey: ["/api/companies-house", supplier.companyRegNumber, "address-history"],
    queryFn: async () => {
      const res = await fetch(`/api/companies-house/${encodeURIComponent(supplier.companyRegNumber!)}/address-history`);
      if (!res.ok) throw new Error("Failed to fetch address history");
      return res.json();
    },
    enabled: !!supplier.companyRegNumber,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Registered Address History
        </h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading from Companies House...
        </div>
      </div>
    );
  }

  if (isError || !addressHistory) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <MapPin className="w-4 h-4" /> Registered Address History
        </h4>
        <p className="text-sm text-muted-foreground">Unable to fetch address history from Companies House.</p>
      </div>
    );
  }

  const isAddressActiveAtSigning = (addr: { from: string | null; to: string | null }) => {
    if (!signingDate) return false;
    const from = addr.from || "0000-00-00";
    const to = addr.to || "9999-99-99";
    return signingDate >= from && signingDate < to;
  };

  return (
    <div data-testid="section-address-history">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <MapPin className="w-4 h-4" /> Registered Address History
        <span className="text-xs font-normal text-muted-foreground">(Companies House)</span>
      </h4>
      {addressHistory.addresses.length <= 1 ? (
        <p className="text-sm text-muted-foreground">No address changes found — address has remained the same since incorporation.</p>
      ) : (
        <div className="space-y-2">
          {addressHistory.addresses.map((addr, i) => {
            const isSigningAddr = isAddressActiveAtSigning(addr);
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-2 rounded-md text-sm ${isSigningAddr ? "bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-800" : "bg-muted/30"}`}
                data-testid={`address-history-item-${i}`}
              >
                <div className="flex-1">
                  <p className="font-medium">{addr.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {addr.from ? formatDate(addr.from) : "Incorporation"} → {addr.to ? formatDate(addr.to) : "Present"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {addr.isCurrent && (
                    <Badge variant="outline" className="text-xs" data-testid="badge-current-address">Current</Badge>
                  )}
                  {isSigningAddr && (
                    <Badge className="text-xs bg-[#FF8C42] hover:bg-[#FF8C42]" data-testid="badge-agreement-address">Agreement Signed</Badge>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {supplier.agreementRegisteredAddress && (
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-muted-foreground mb-0.5">Address stored on agreement:</p>
          <p className="text-sm font-medium" data-testid="text-agreement-stored-address">
            {[supplier.agreementRegisteredAddress, supplier.agreementRegisteredCity, supplier.agreementRegisteredPostcode, supplier.agreementRegisteredCountry].filter(Boolean).join(", ")}
          </p>
        </div>
      )}
    </div>
  );
}

interface OfficersData {
  officers: Array<{ name: string; rawName: string; role: string; appointedOn: string | null; resignedOn: string | null; isActive: boolean; nationality: string | null }>;
  activeCount: number;
  resignedCount: number;
}

function OfficersSection({ supplier }: { supplier: Supplier }) {
  const signingDate = supplier.selfBillingAcceptedAt ? new Date(supplier.selfBillingAcceptedAt as unknown as string).toISOString().split("T")[0] : null;

  const { data: officersData, isLoading, isError } = useQuery<OfficersData>({
    queryKey: ["/api/companies-house", supplier.companyRegNumber, "officers"],
    queryFn: async () => {
      const res = await fetch(`/api/companies-house/${encodeURIComponent(supplier.companyRegNumber!)}/officers`);
      if (!res.ok) throw new Error("Failed to fetch officers");
      return res.json();
    },
    enabled: !!supplier.companyRegNumber,
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" /> Directors / Officers
        </h4>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading from Companies House...
        </div>
      </div>
    );
  }

  if (isError || !officersData) {
    return (
      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <Users className="w-4 h-4" /> Directors / Officers
        </h4>
        <p className="text-sm text-muted-foreground">Unable to fetch officer data from Companies House.</p>
      </div>
    );
  }

  const isActiveAtSigning = (officer: { appointedOn: string | null; resignedOn: string | null }) => {
    if (!signingDate || !officer.appointedOn) return false;
    return officer.appointedOn <= signingDate && (!officer.resignedOn || officer.resignedOn > signingDate);
  };

  const directors = officersData.officers.filter(o => o.role === "director");
  const otherOfficers = officersData.officers.filter(o => o.role !== "director");

  return (
    <div data-testid="section-officers">
      <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
        <Users className="w-4 h-4" /> Directors / Officers
        <span className="text-xs font-normal text-muted-foreground">(Companies House)</span>
      </h4>
      {directors.length === 0 && otherOfficers.length === 0 ? (
        <p className="text-sm text-muted-foreground">No officer records found.</p>
      ) : (
        <div className="space-y-2">
          {directors.map((officer, i) => {
            const isSigningDirector = isActiveAtSigning(officer);
            return (
              <div
                key={`dir-${i}`}
                className={`flex items-start gap-3 p-2 rounded-md text-sm ${isSigningDirector ? "bg-orange-50 border border-orange-200 dark:bg-orange-950/20 dark:border-orange-800" : "bg-muted/30"}`}
                data-testid={`officer-item-${i}`}
              >
                <div className="flex-1">
                  <p className="font-medium">{officer.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Director · Appointed {officer.appointedOn ? formatDate(officer.appointedOn) : "Unknown"}
                    {officer.resignedOn ? ` · Resigned ${formatDate(officer.resignedOn)}` : ""}
                    {officer.nationality ? ` · ${officer.nationality}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {officer.isActive && (
                    <Badge variant="outline" className="text-xs" data-testid={`badge-active-officer-${i}`}>Active</Badge>
                  )}
                  {!officer.isActive && (
                    <Badge variant="secondary" className="text-xs">Resigned</Badge>
                  )}
                  {isSigningDirector && (
                    <Badge className="text-xs bg-[#FF8C42]" data-testid={`badge-signing-director-${i}`}>At Signing</Badge>
                  )}
                </div>
              </div>
            );
          })}
          {otherOfficers.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">Other officers</p>
              {otherOfficers.map((officer, i) => (
                <div key={`other-${i}`} className="flex items-start gap-3 p-2 rounded-md text-sm bg-muted/30" data-testid={`other-officer-item-${i}`}>
                  <div className="flex-1">
                    <p className="font-medium">{officer.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {officer.role.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())} · Appointed {officer.appointedOn ? formatDate(officer.appointedOn) : "Unknown"}
                      {officer.resignedOn ? ` · Resigned ${formatDate(officer.resignedOn)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {officer.isActive ? (
                      <Badge variant="outline" className="text-xs">Active</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Resigned</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  supplier_created: "Supplier created",
  supplier_approved: "Status changed to Approved",
  supplier_updated: "Supplier updated",
  supplier_onboarding_submitted: "Onboarding submitted",
  supplier_info_required: "Info requested",
  supplier_suspended: "Suspended",
  supplier_unsuspended: "Unsuspended",
  supplier_terminated: "Terminated",
  supplier_document_uploaded: "Document uploaded",
  supplier_invitation_sent: "Invitation sent",
  supplier_portal_access_updated: "Portal access updated",
  supplier_vat_change_requested: "VAT change requested",
  supplier_vat_change_approved: "VAT change approved",
  supplier_vat_change_rejected: "VAT change rejected",
  supplier_bank_change_requested: "Bank change requested",
  supplier_bank_change_approved: "Bank change approved",
  supplier_bank_change_rejected: "Bank change rejected",
  supplier_change_requested: "Change requested",
  supplier_change_rejected: "Change rejected",
  supplier_review_completed: "Review completed",
};

function auditActionLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}

function DetailItem({
  icon: Icon,
  label,
  value,
  testId,
}: {
  icon?: typeof Mail;
  label: string;
  value: string | null | undefined;
  testId?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-sm font-medium" data-testid={testId}>{value || "N/A"}</div>
    </div>
  );
}

export default function SupplierDetailPage() {
  const [match, params] = useRoute("/suppliers/:id");
  const id = match && params?.id ? parseInt(params.id, 10) : null;
  const { toast } = useToast();

  const { data: supplier, isLoading, error } = useQuery<Supplier>({
    queryKey: ["/api/suppliers", id],
    enabled: id != null && !Number.isNaN(id),
  });

  const approveMutation = useMutation({
    mutationFn: async (supplierId: number) => {
      await apiRequest("PATCH", `/api/suppliers/${supplierId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      if (id != null) {
        queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id] });
        queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "portal-status"] });
      }
      toast({ title: "Supplier approved", description: "The supplier has been approved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: portalStatus } = useQuery<PortalStatus>({
    queryKey: ["/api/suppliers", id, "portal-status"],
    enabled: id != null && !Number.isNaN(id),
  });

  const { data: activity = [] } = useQuery<ActivityItem[]>({
    queryKey: ["/api/suppliers", id, "activity"],
    enabled: id != null && !Number.isNaN(id),
  });

  const { data: pendingChanges = [] } = useQuery<{ id: number; payload: Record<string, unknown>; status: string; createdAt: string }[]>({
    queryKey: ["/api/suppliers", id, "pending-changes"],
    enabled: id != null && !Number.isNaN(id),
  });

  type SupplierDoc = {
    id: number;
    documentType: string;
    fileName: string;
    fileUrl: string;
    createdAt: string;
    status?: "pending" | "approved" | "rejected";
    rejectionReason?: string | null;
    reviewedBy?: string | null;
    reviewedAt?: string | null;
    displayName?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
  };
  const { data: supplierDocuments = [] } = useQuery<SupplierDoc[]>({
    queryKey: ["/api/suppliers", id, "documents"],
    enabled: id != null && !Number.isNaN(id),
  });

  const [rejectDocId, setRejectDocId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectDocLabel, setRejectDocLabel] = useState("");
  const [auditDocId, setAuditDocId] = useState<number | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<SupplierDocumentType | null>(null);
  const [uploadDisplayName, setUploadDisplayName] = useState("");
  const [uploadExpiryDate, setUploadExpiryDate] = useState("");
  const [uploadNotes, setUploadNotes] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadFormRef = useRef<{ type: SupplierDocumentType; displayName: string; expiryDate: string; notes: string }>({ type: "companies_house_proof", displayName: "", expiryDate: "", notes: "" });

  const { data: documentAudit = [] } = useQuery<{ id: number; action: string; userId: string | null; details: unknown; createdAt: string }[]>({
    queryKey: ["/api/suppliers", id, "documents", auditDocId, "audit"],
    enabled: id != null && auditDocId != null,
  });

  type FieldRequest = { id: number; fieldKey: string; message: string | null; requestedAt: string | null; completedAt: string | null };
  const { data: fieldRequests = [] } = useQuery<FieldRequest[]>({
    queryKey: ["/api/suppliers", id, "field-requests"],
    enabled: id != null,
  });
  const pendingFieldRequests = fieldRequests.filter((r) => !r.completedAt);

  type AgreementArchive = {
    id: number; agreementRef: string | null; signatoryName: string | null;
    signatoryPosition: string | null; signedAt: string | null; expiryDate: string | null;
    archivedAt: string; archivedReason: string | null;
  };
  const { data: agreementArchives = [] } = useQuery<AgreementArchive[]>({
    queryKey: ["/api/suppliers", id, "agreement-archives"],
    enabled: id != null,
  });

  type ProfileChangeLogEntry = {
    id: number;
    userId: string;
    action: string;
    fieldChanges: Array<{ field: string; oldValue: unknown; newValue: unknown }> | null;
    pendingChangeId: number | null;
    createdAt: string;
  };
  const { data: profileChangeLog = [] } = useQuery<ProfileChangeLogEntry[]>({
    queryKey: ["/api/suppliers", id, "profile-change-log"],
    enabled: id != null,
  });

  type SupplierTransaction = {
    id: number;
    transactionDate: string;
    description: string | null;
    amount: string;
    reference: string | null;
    isAllocated: boolean;
    allocatedAmount: string;
    status: string;
    allocations: Array<{
      id: number;
      invoiceId: number | null;
      amount: string;
      notes: string | null;
      allocatedAt: string;
      invoiceNumber: string | null;
    }>;
  };
  type SupplierTransactionsData = {
    transactions: SupplierTransaction[];
    totalPayments: number;
    transactionCount: number;
  };
  const { data: supplierTransactions, isLoading: transactionsLoading } = useQuery<SupplierTransactionsData>({
    queryKey: ["/api/accounting/supplier-transactions", id],
    enabled: id != null && !Number.isNaN(id),
  });

  type SupplierPolicy = {
    id: number;
    policyType: string;
    fileName: string;
    fileUrl: string;
    issueDate?: string | null;
    expiryDate?: string | null;
    notes?: string | null;
    status: "pending" | "approved" | "rejected";
    rejectionReason?: string | null;
    reviewedAt?: string | null;
    createdAt: string;
  };
  const { data: supplierPolicies = [] } = useQuery<SupplierPolicy[]>({
    queryKey: ["/api/suppliers", id, "policies"],
    enabled: id != null && !Number.isNaN(id),
  });

  const [rejectPolicyId, setRejectPolicyId] = useState<number | null>(null);
  const [rejectPolicyReason, setRejectPolicyReason] = useState("");
  const [rejectPolicyLabel, setRejectPolicyLabel] = useState("");

  const approvePolicyMutation = useMutation({
    mutationFn: async (policyId: number) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/policies/${policyId}/approve`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Policy approved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectPolicyMutation = useMutation({
    mutationFn: async ({ policyId, reason }: { policyId: number; reason: string }) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/policies/${policyId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      setRejectPolicyId(null);
      setRejectPolicyReason("");
      toast({ title: "Policy rejected", description: "Supplier has been notified with the reason." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  type RateCardWithName = RateCard & { supplierName?: string; siteName?: string; employeeName?: string };
  const { data: allRateCards = [], isLoading: rateCardsLoading } = useQuery<RateCardWithName[]>({
    queryKey: ["/api/rate-cards"],
  });
  const supplierRateCards = allRateCards.filter(rc => rc.supplierId === id);

  const { data: supplierEmployees = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers", id, "employees"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${id}/employees`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!id,
  });

  const [siteSearch, setSiteSearch] = useState("");
  const [siteSearchResults, setSiteSearchResults] = useState<any[]>([]);
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);

  const siteSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const siteDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (siteSearchTimerRef.current) clearTimeout(siteSearchTimerRef.current);
    if (siteSearch.length < 2) { setSiteSearchResults([]); return; }
    siteSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sites/search?q=${encodeURIComponent(siteSearch)}&limit=20`);
        if (res.ok) setSiteSearchResults(await res.json());
      } catch {}
    }, 300);
    return () => { if (siteSearchTimerRef.current) clearTimeout(siteSearchTimerRef.current); };
  }, [siteSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(e.target as Node)) {
        setShowSiteDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  type VatCheckResult = {
    vatNumber: string;
    isValid: boolean;
    verificationResult: string;
    businessName?: string;
    address?: { line1?: string; line2?: string; line3?: string; postCode?: string; countryCode?: string };
    savedVerificationId?: number;
  };
  const [vatCheckResult, setVatCheckResult] = useState<VatCheckResult | null>(null);
  const [vatCheckError, setVatCheckError] = useState<string | null>(null);
  const vatCheckMutation = useMutation({
    mutationFn: async (vatNumber: string) => {
      const res = await fetch(`/api/vat-check/${encodeURIComponent(vatNumber)}?supplierId=${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "VAT check failed");
      return data as VatCheckResult;
    },
    onSuccess: (data) => {
      setVatCheckResult(data);
      setVatCheckError(null);
      queryClient.invalidateQueries({ queryKey: ["/api/vat-verifications", id] });
    },
    onError: (err: Error) => {
      setVatCheckResult(null);
      setVatCheckError(err.message);
    },
  });

  const [rcDialogOpen, setRcDialogOpen] = useState(false);
  const [rcRateType, setRcRateType] = useState<"general" | "site" | "employee" | "both">("general");
  const [rcForm, setRcForm] = useState({ siteId: "", employeeId: "", roleType: "", hourlyRate: "", overtimeRate: "", effectiveFrom: "", effectiveTo: "" });

  const createRcMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/rate-cards", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      setRcDialogOpen(false);
      setRcForm({ siteId: "", employeeId: "", roleType: "", hourlyRate: "", overtimeRate: "", effectiveFrom: "", effectiveTo: "" });
      setRcRateType("general");
      toast({ title: "Rate Card Created", description: "The rate card has been added." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteRcMutation = useMutation({
    mutationFn: async (rcId: number) => { await apiRequest("DELETE", `/api/rate-cards/${rcId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate Card Deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const handleCreateRc = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!rcForm.roleType || !rcForm.hourlyRate || !rcForm.effectiveFrom) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createRcMutation.mutate({
      supplierId: id,
      siteId: (rcRateType === "site" || rcRateType === "both") && rcForm.siteId ? parseInt(rcForm.siteId) : null,
      employeeId: (rcRateType === "employee" || rcRateType === "both") && rcForm.employeeId ? parseInt(rcForm.employeeId) : null,
      roleType: rcForm.roleType,
      hourlyRate: rcForm.hourlyRate,
      overtimeRate: rcForm.overtimeRate || null,
      effectiveFrom: rcForm.effectiveFrom,
      effectiveTo: rcForm.effectiveTo || null,
    });
  };

  const approveDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/documents/${docId}/approve`);
    },
    onSuccess: (_, docId) => {
      invalidateSupplier();
      if (id != null) queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "documents", docId, "audit"] });
      toast({ title: "Document approved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectDocMutation = useMutation({
    mutationFn: async ({ docId, reason }: { docId: number; reason: string }) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/documents/${docId}/reject`, { reason });
    },
    onSuccess: (_, { docId }) => {
      invalidateSupplier();
      setRejectDocId(null);
      setRejectReason("");
      if (id != null) queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "documents", docId, "audit"] });
      toast({ title: "Document rejected", description: "Supplier will receive an email with the reason." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [deleteDocId, setDeleteDocId] = useState<number | null>(null);
  const [deleteDocName, setDeleteDocName] = useState<string>("");

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/suppliers/${id!}/documents/${docId}`);
    },
    onSuccess: () => {
      invalidateSupplier();
      setDeleteDocId(null);
      setDeleteDocName("");
      toast({ title: "Document deleted" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [uploadFileSelected, setUploadFileSelected] = useState<File | null>(null);

  const { uploadFile, isUploading } = useUpload({
    onSuccess: async (res) => {
      const meta = uploadFormRef.current;
      if (!id || !meta?.type) return;
      const fileUrl = res.objectPath.startsWith("http") ? res.objectPath : `${window.location.origin}${res.objectPath}`;
      await apiRequest("POST", `/api/suppliers/${id}/documents`, {
        documentType: meta.type,
        fileName: res.metadata.name,
        fileUrl,
        fileSize: res.metadata.size,
        mimeType: res.metadata.contentType,
        displayName: meta.displayName.trim() || undefined,
        expiryDate: meta.expiryDate || undefined,
        notes: meta.notes.trim() || undefined,
      });
      invalidateSupplier();
      setUploadDialogOpen(false);
      setUploadDocType(null);
      setUploadDisplayName("");
      setUploadExpiryDate("");
      setUploadNotes("");
      setUploadFileSelected(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast({ title: "Document uploaded" });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });

  const invalidateSupplier = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
    if (id != null) {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "portal-status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "activity"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "pending-changes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "policies"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "field-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "profile-change-log"] });
    }
  };

  const portalAccessMutation = useMutation({
    mutationFn: async (payload: { portalAccessEnabled?: boolean; portalEmail?: string; dataVisibilityMonths?: number | null }) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/portal-access`, payload);
    },
    onSuccess: () => { invalidateSupplier(); toast({ title: "Portal access updated" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendInvitationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/suppliers/${id!}/send-invitation`);
      return (await res.json()) as { inviteLink?: string };
    },
    onSuccess: (data) => {
      invalidateSupplier();
      toast({ title: "Invitation sent", description: data.inviteLink ? "Share the invite link with the supplier." : undefined });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const sendReminderMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/suppliers/${id!}/send-reminder`);
    },
    onSuccess: () => { invalidateSupplier(); toast({ title: "Reminder sent" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const regenerateIpPoolMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/suppliers/generate-ip-pools`, { supplierId: id });
      return (await res.json()) as { results: Array<{ id: number; name: string; ips: string[] }> };
    },
    onSuccess: (data) => {
      invalidateSupplier();
      const ips = data.results?.[0]?.ips || [];
      toast({ title: "IP pool regenerated", description: `${ips.length} IPs generated` });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/suppliers/${id!}/reset-password`);
      return (await res.json()) as { resetLink?: string };
    },
    onSuccess: (data) => {
      invalidateSupplier();
      toast({ title: "Reset link created", description: data.resetLink ? "Share the link with the supplier." : undefined });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveChangeMutation = useMutation({
    mutationFn: async (changeId: number) => {
      await apiRequest("POST", `/api/suppliers/${id!}/pending-changes/${changeId}/approve`);
    },
    onSuccess: () => {
      invalidateSupplier();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Changes approved" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectChangeMutation = useMutation({
    mutationFn: async (changeId: number) => {
      await apiRequest("POST", `/api/suppliers/${id!}/pending-changes/${changeId}/reject`);
    },
    onSuccess: () => {
      invalidateSupplier();
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Changes rejected" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [requestInfoOpen, setRequestInfoOpen] = useState(false);
  const [requestInfoNotes, setRequestInfoNotes] = useState("");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminateReason, setTerminateReason] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const requestInfoMutation = useMutation({
    mutationFn: async (notes: string) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/request-info`, { notes });
    },
    onSuccess: () => {
      invalidateSupplier();
      setRequestInfoOpen(false);
      setRequestInfoNotes("");
      toast({ title: "Info requested", description: "Supplier will be notified to provide more information." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const suspendMutation = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/suspend`, { reason });
    },
    onSuccess: () => {
      invalidateSupplier();
      setSuspendOpen(false);
      setSuspendReason("");
      toast({ title: "Supplier suspended" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const unsuspendMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/unsuspend`);
    },
    onSuccess: () => { invalidateSupplier(); toast({ title: "Supplier unsuspended" }); },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const terminateMutation = useMutation({
    mutationFn: async (reason: string) => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/terminate`, { reason });
    },
    onSuccess: () => {
      invalidateSupplier();
      setTerminateOpen(false);
      setTerminateReason("");
      toast({ title: "Supplier terminated", variant: "destructive" });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [, navigate] = useLocation();
  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/suppliers/${id!}`);
    },
    onSuccess: () => {
      setDeleteOpen(false);
      setDeleteConfirmText("");
      toast({ title: "Supplier deleted", description: "The supplier and all related records have been permanently removed.", variant: "destructive" });
      navigate("/suppliers");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const completeReviewMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/suppliers/${id!}/complete-review`);
    },
    onSuccess: () => {
      invalidateSupplier();
      toast({ title: "Review completed", description: "Next review due date set (Labour: 3 months, Non-labour: 12 months)." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});

  function openEditDialog() {
    if (!supplier) return;
    setEditForm({
      companyName: supplier.companyName || "",
      contactName: supplier.contactName || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
      city: supplier.city || "",
      postcode: supplier.postcode || "",
      vatNumber: supplier.vatNumber || "",
      vatStatus: supplier.vatStatus || "",
      vatRegisteredFrom: supplier.vatRegisteredFrom || "",
      companyRegNumber: supplier.companyRegNumber || "",
      bankName: supplier.bankName || "",
      accountName: supplier.accountName || "",
      sortCode: supplier.sortCode || "",
      accountNumber: supplier.accountNumber || "",
      financeContactName: supplier.financeContactName || "",
      financeContactEmail: supplier.financeContactEmail || "",
      registeredOfficeAddress: supplier.registeredOfficeAddress || "",
      registeredOfficeCity: supplier.registeredOfficeCity || "",
      registeredOfficePostcode: supplier.registeredOfficePostcode || "",
      tradingAddress: supplier.tradingAddress || "",
      tradingCity: supplier.tradingCity || "",
      tradingPostcode: supplier.tradingPostcode || "",
      natureOfSupply: supplier.natureOfSupply || "",
      notes: supplier.notes || "",
      approvedAt: supplier.approvedAt ? new Date(supplier.approvedAt).toISOString().split("T")[0] : "",
    });
    setEditDialogOpen(true);
  }

  const editSupplierMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const payload: Record<string, unknown> = { ...data };
      if (data.approvedAt) {
        if (supplier.incorporationDate && supplier.incorporationDate.trim()) {
          const parts = supplier.incorporationDate.split("/");
          const incDate = parts.length === 3
            ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
            : new Date(supplier.incorporationDate);
          if (!isNaN(incDate.getTime()) && new Date(data.approvedAt) < incDate) {
            throw new Error(`Onboarding date cannot be before the company incorporation date (${supplier.incorporationDate})`);
          }
        }
        payload.approvedAt = new Date(data.approvedAt).toISOString();
      } else {
        payload.approvedAt = null;
      }
      await apiRequest("PATCH", `/api/suppliers/${id!}`, payload);
    },
    onSuccess: () => {
      invalidateSupplier();
      setEditDialogOpen(false);
      toast({ title: "Supplier updated", description: "Details have been saved successfully." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const [requestFieldOpen, setRequestFieldOpen] = useState(false);
  const [selectedRequestFields, setSelectedRequestFields] = useState<Set<string>>(new Set());
  const [requestFieldMessage, setRequestFieldMessage] = useState("");
  const requestFieldMutation = useMutation({
    mutationFn: async (payload: { fieldKeys: string[]; message?: string }) => {
      for (const fieldKey of payload.fieldKeys) {
        await apiRequest("POST", `/api/suppliers/${id!}/request-field`, { fieldKey, message: payload.message });
      }
    },
    onSuccess: () => {
      invalidateSupplier();
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", id, "field-requests"] });
      setRequestFieldOpen(false);
      setSelectedRequestFields(new Set());
      setRequestFieldMessage("");
      toast({ title: "Request sent", description: "Supplier will receive an email and see the request in their portal." });
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });
  const toggleRequestField = (fieldKey: string) => {
    setSelectedRequestFields((prev) => {
      const next = new Set(prev);
      if (next.has(fieldKey)) next.delete(fieldKey);
      else next.add(fieldKey);
      return next;
    });
  };

  if (!match || id == null || Number.isNaN(id)) {
    return (
      <div className="p-6">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to suppliers
          </Button>
        </Link>
        <div className="mt-6 text-center text-muted-foreground">Invalid supplier.</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to suppliers
          </Button>
        </Link>
        <div className="mt-6 text-center text-destructive" data-testid="supplier-detail-error">
          Failed to load supplier.
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to suppliers
          </Button>
        </Link>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="p-6 space-y-6">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to suppliers
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center h-48 gap-3">
          <AlertCircle className="w-8 h-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{error?.message || "Supplier not found"}</p>
          <Link href="/suppliers">
            <Button size="sm" variant="outline">Return to suppliers</Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConf = STATUS_CONFIG[supplier.status || "pending"];

  return (
    <div className="p-6 space-y-6 w-full max-w-7xl mx-auto" data-testid="supplier-detail-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <Link href="/suppliers">
          <Button variant="ghost" size="sm" data-testid="button-back-suppliers">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to suppliers
          </Button>
        </Link>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate" data-testid="text-detail-company-name">
                  {supplier.companyName}
                </h1>
                <p className="text-muted-foreground">{supplier.contactName}</p>
              </div>
            </div>
            <Badge className={`${statusConf.className}`} data-testid="badge-detail-status">
              {statusConf.label}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="w-full space-y-4">
        <TabsList className="grid w-full grid-cols-4 sm:grid-cols-9">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">
            Documents
            {supplierDocuments.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{supplierDocuments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="rate-cards" data-testid="tab-supplier-rate-cards">
            Rate Cards
            {supplierRateCards.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{supplierRateCards.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="policies">
            Policies
            {supplierPolicies.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{supplierPolicies.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="portal">Portal</TabsTrigger>
          <TabsTrigger value="pending">
            Pending
            {pendingChanges.filter((c) => c.status === "pending").length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{pendingChanges.filter((c) => c.status === "pending").length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="agreements" data-testid="tab-supplier-agreements">
            Agreements
            {agreementArchives.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{agreementArchives.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-supplier-payments">
            Payments
            {supplierTransactions && supplierTransactions.transactionCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{supplierTransactions.transactionCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="activity">
            Activity
            {activity.length > 0 && (
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">{activity.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          <Card>
            <CardContent className="p-6 space-y-6">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={openEditDialog} data-testid="btn-edit-supplier-details">
                <Pencil className="w-4 h-4 mr-1" />
                Edit Details
              </Button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4" /> Contact Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <DetailItem icon={Mail} label="Email" value={supplier.email} testId="text-detail-email" />
                <DetailItem icon={Phone} label="Phone" value={supplier.phone} testId="text-detail-phone" />
                <div className="col-span-2">
                  <DetailItem
                    icon={MapPin}
                    label="Address"
                    value={[supplier.address, supplier.city, supplier.postcode].filter(Boolean).join(", ") || null}
                    testId="text-detail-address"
                  />
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4" /> Company Information
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <DetailItem label="VAT Number" value={supplier.vatNumber} testId="text-detail-vat" />
                <DetailItem label="VAT Status" value={supplier.vatStatus === "vat_registered" ? "VAT Registered" : supplier.vatStatus === "not_vat_registered" ? "Not VAT Registered" : "Not Set"} testId="text-detail-vat-status" />
                {supplier.vatStatus === "vat_registered" && (
                  <DetailItem label="VAT Registered From" value={supplier.vatRegisteredFrom ? new Date(supplier.vatRegisteredFrom).toLocaleDateString("en-GB") : "Not set (all periods)"} testId="text-detail-vat-from" />
                )}
                <DetailItem label="Company Reg." value={supplier.companyRegNumber} testId="text-detail-reg" />
              </div>
              {supplier.vatStatus === "vat_registered" && supplier.vatNumber && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      variant="outline"
                      data-testid="button-check-vat"
                      onClick={() => {
                        setVatCheckResult(null);
                        setVatCheckError(null);
                        vatCheckMutation.mutate(supplier.vatNumber!);
                      }}
                      disabled={vatCheckMutation.isPending}
                    >
                      {vatCheckMutation.isPending ? (
                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Validating…</>
                      ) : (
                        <><Shield className="w-4 h-4 mr-2" /> Validate VAT Number</>
                      )}
                    </Button>
                  </div>
                  {vatCheckResult && (
                    <div
                      data-testid="vat-check-result"
                      className={`rounded-md border px-4 py-3 text-sm space-y-1 ${vatCheckResult.isValid ? "border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-950/30" : "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30"}`}
                    >
                      <div className="flex items-center gap-2 font-semibold">
                        {vatCheckResult.isValid ? (
                          <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                        )}
                        <span data-testid="vat-check-status">
                          {vatCheckResult.isValid ? "VAT number is valid (passes UK modulus 97 check)" : "VAT number is invalid (fails UK modulus 97 checksum)"}
                        </span>
                      </div>
                      {vatCheckResult.businessName && (
                        <div data-testid="vat-check-business-name" className="text-muted-foreground">
                          Registered name: <span className="font-medium text-foreground">{vatCheckResult.businessName}</span>
                        </div>
                      )}
                      {vatCheckResult.address && (
                        <div data-testid="vat-check-address" className="text-muted-foreground">
                          Address: <span className="font-medium text-foreground">
                            {[vatCheckResult.address.line1, vatCheckResult.address.line2, vatCheckResult.address.line3, vatCheckResult.address.postCode, vatCheckResult.address.countryCode].filter(Boolean).join(", ")}
                          </span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {vatCheckResult.savedVerificationId && (
                          <span>Result saved to verification history (ID: {vatCheckResult.savedVerificationId}). </span>
                        )}
                        <a href="https://www.tax.service.gov.uk/check-vat-number/" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Verify on HMRC website →</a>
                      </div>
                    </div>
                  )}
                  {vatCheckError && (
                    <div
                      data-testid="vat-check-error"
                      className="rounded-md border border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{vatCheckError}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CreditCard className="w-4 h-4" /> Bank Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <DetailItem label="Account Title" value={supplier.bankName} testId="text-detail-bank" />
                <DetailItem label="Sort Code" value={supplier.sortCode} testId="text-detail-sort-code" />
                <DetailItem label="Account Number" value={supplier.accountNumber} testId="text-detail-account" />
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" /> Billing Frequency
              </h4>
              <div className="flex items-center gap-3">
                <Select
                  value={supplier.billingFrequency || "monthly"}
                  onValueChange={async (val) => {
                    try {
                      await apiRequest("PATCH", `/api/suppliers/${supplier.id}`, { billingFrequency: val });
                      queryClient.invalidateQueries({ queryKey: ["/api/suppliers", supplier.id] });
                      toast({ title: "Billing frequency updated", description: `Set to ${val} for ${supplier.companyName}` });
                    } catch (err: any) {
                      toast({ title: "Error", description: err.message, variant: "destructive" });
                    }
                  }}
                >
                  <SelectTrigger className="w-[200px]" data-testid="select-billing-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="fortnightly">Fortnightly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-muted-foreground">Admin-only setting</span>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4" /> Rate Type
              </h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Select
                    value={(supplier as any).rateType || "rate_card"}
                    onValueChange={async (val) => {
                      try {
                        await apiRequest("PATCH", `/api/suppliers/${supplier.id}`, { rateType: val });
                        queryClient.invalidateQueries({ queryKey: ["/api/suppliers", supplier.id] });
                        toast({ title: "Rate type updated", description: `Set to ${val === "per_shift" ? "Per-Shift Rate" : "Rate Card"} for ${supplier.companyName}` });
                      } catch (err: any) {
                        toast({ title: "Error", description: err.message, variant: "destructive" });
                      }
                    }}
                  >
                    <SelectTrigger className="w-[200px]" data-testid="select-rate-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rate_card">Rate Card</SelectItem>
                      <SelectItem value="per_shift">Per-Shift Rate</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">Admin-only setting</span>
                </div>
                {((supplier as any).rateType === "per_shift") && (
                  <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2" data-testid="text-per-shift-info">
                    Invoice rates are taken from the rate stored on each individual shift (imported via CSV). Rate cards are not used for this supplier.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold mb-2">Company profile</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <DetailItem label="Registered office" value={[supplier.registeredOfficeAddress, supplier.registeredOfficeCity, supplier.registeredOfficePostcode, supplier.registeredOfficeCountry].filter(Boolean).join(", ")} />
                <DetailItem label="Trading address" value={[supplier.tradingAddress, supplier.tradingCity, supplier.tradingPostcode].filter(Boolean).join(", ")} />
                <DetailItem label="Finance contact" value={[supplier.financeContactName, supplier.financeContactEmail].filter(Boolean).join(" — ")} />
                <DetailItem label="Nature of supply" value={supplier.natureOfSupply} />
                <DetailItem label="Supplier type" value={supplier.supplierType === "labour" ? "Labour" : supplier.supplierType === "non_labour" ? "Non-labour" : undefined} />
                <DetailItem label="Company category" value={supplier.companyCategory} />
                <DetailItem label="Company status" value={supplier.companyStatus} />
                <DetailItem label="Country of origin" value={supplier.countryOfOrigin} />
                <DetailItem label="Incorporation date" value={supplier.incorporationDate} />
                <DetailItem label="SIC codes" value={supplier.sicCodes} />
              </div>
            </div>
            </div>

            {(supplier.accountsNextDue || supplier.accountsLastMadeUpDate || supplier.accountCategory || supplier.accountsAccountRefDay || supplier.accountsAccountRefMonth || supplier.returnsNextDue || supplier.returnsLastMadeUpDate || (Array.isArray(supplier.previousNames) && supplier.previousNames.length > 0) || (supplier.mortgages && typeof supplier.mortgages === "object")) && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Companies House (filing & charges)</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {supplier.accountsNextDue && <DetailItem label="Accounts next due" value={supplier.accountsNextDue} />}
                  {supplier.accountsLastMadeUpDate && <DetailItem label="Accounts last made up" value={supplier.accountsLastMadeUpDate} />}
                  {supplier.accountCategory && <DetailItem label="Account category" value={supplier.accountCategory} />}
                  {(supplier.accountsAccountRefDay || supplier.accountsAccountRefMonth) && <DetailItem label="Accounting reference date" value={[supplier.accountsAccountRefDay, supplier.accountsAccountRefMonth].filter(Boolean).join("/")} />}
                  {supplier.returnsNextDue && <DetailItem label="Returns next due" value={supplier.returnsNextDue} />}
                  {supplier.returnsLastMadeUpDate && <DetailItem label="Returns last made up" value={supplier.returnsLastMadeUpDate} />}
                  {supplier.mortgages && typeof supplier.mortgages === "object" && (
                    <DetailItem
                      label="Mortgages / charges"
                      value={[
                        (supplier.mortgages as Record<string, string>).NumMortCharges != null && `Total: ${(supplier.mortgages as Record<string, string>).NumMortCharges}`,
                        (supplier.mortgages as Record<string, string>).NumMortOutstanding != null && `Outstanding: ${(supplier.mortgages as Record<string, string>).NumMortOutstanding}`,
                        (supplier.mortgages as Record<string, string>).NumMortSatisfied != null && `Satisfied: ${(supplier.mortgages as Record<string, string>).NumMortSatisfied}`,
                      ].filter(Boolean).join(" · ")}
                    />
                  )}
                </div>
                {Array.isArray(supplier.previousNames) && supplier.previousNames.length > 0 && (
                  <div className="mt-3">
                    <div className="text-xs text-muted-foreground mb-1">Previous names</div>
                    <ul className="text-sm space-y-1">
                      {supplier.previousNames.map((pn: { CompanyName?: string; CONDate?: string }, i: number) => (
                        <li key={i}>{pn.CompanyName ?? "—"}{pn.CONDate ? ` (from ${pn.CONDate})` : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {supplier.companyRegNumber && <AddressHistorySection supplier={supplier} />}

            {supplier.companyRegNumber && <OfficersSection supplier={supplier} />}

            <div>
              <h4 className="text-sm font-semibold mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground" data-testid="text-detail-notes">{supplier.notes || "—"}</p>
            </div>

            {supplier.approvedAt && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span data-testid="text-audit-approved">
                      Approved on {formatDateTimeUK(supplier.approvedAt as unknown as string)}
                      {supplier.approvedBy ? ` by User ${supplier.approvedBy}` : ""}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {(supplier.status === "approved" || supplier.status === "active") && ((supplier as Record<string, unknown>).lastReviewAt != null || (supplier as Record<string, unknown>).nextReviewDueAt != null) && (
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4" /> Periodic review
                  </h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {(supplier as Record<string, unknown>).lastReviewAt != null && (
                      <p>Last review: {formatDateTimeUK((supplier as Record<string, unknown>).lastReviewAt as string)}</p>
                    )}
                    {(supplier as Record<string, unknown>).nextReviewDueAt != null && (
                      <p>Next review due: {formatDateTimeUK((supplier as Record<string, unknown>).nextReviewDueAt as string)}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {(supplier.status === "info_required" || supplier.infoRequiredNotes) && (
              <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
                <CardContent className="p-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" /> Info requested
                  </h4>
                  <p className="text-sm text-muted-foreground" data-testid="text-info-required-notes">
                    {supplier.infoRequiredNotes || "Admin requested additional information."}
                  </p>
                </CardContent>
              </Card>
            )}

            {supplier.portalAccessEnabled && (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <MessageCircle className="w-4 h-4" />
                      Request information from supplier
                    </CardTitle>
                    <CardDescription>
                      Select the fields you need and send a single request. The supplier will receive an email and see it in their portal.
                      {pendingFieldRequests.length > 0 && (
                        <span className="block mt-1 text-amber-600 dark:text-amber-400">
                          {pendingFieldRequests.length} pending request(s).
                        </span>
                      )}
                    </CardDescription>
                  </div>
                  <Button
                    size="sm"
                    disabled={selectedRequestFields.size === 0}
                    onClick={() => {
                      setRequestFieldMessage("");
                      setRequestFieldOpen(true);
                    }}
                    data-testid="button-request-selected"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    Request Selected ({selectedRequestFields.size})
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {REQUESTABLE_FIELD_KEYS.map((fieldKey) => {
                      const label = SUPPLIER_PROFILE_FIELD_LABELS[fieldKey] ?? fieldKey;
                      const isSbaRequest = fieldKey === "selfBillingSignatureRequest";
                      const value = isSbaRequest
                        ? (supplier.selfBillingAgreementStatus === "active" ? "Active" : supplier.selfBillingAgreementStatus === "none" ? "Not Signed" : supplier.selfBillingAgreementStatus ?? "—")
                        : (supplier as Record<string, unknown>)[fieldKey];
                      const displayValue = value != null && value !== "" ? String(value) : "—";
                      const isPending = pendingFieldRequests.some((r) => r.fieldKey === fieldKey);
                      const isSelected = selectedRequestFields.has(fieldKey);
                      return (
                        <div
                          key={fieldKey}
                          className={`flex items-center gap-2 rounded border p-2 text-sm cursor-pointer transition-colors ${isPending ? "opacity-50 cursor-not-allowed" : isSelected ? "border-[#1F3A5F] bg-[#1F3A5F]/5 dark:border-blue-400 dark:bg-blue-900/10" : "hover:bg-muted/50"}`}
                          onClick={() => !isPending && toggleRequestField(fieldKey)}
                          data-testid={`field-request-${fieldKey}`}
                        >
                          <div className="shrink-0">
                            {isPending ? (
                              <CheckCircle2 className="w-4 h-4 text-amber-500" />
                            ) : isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#1F3A5F] dark:text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-muted-foreground truncate">{label}</div>
                            <div className="truncate text-xs">{displayValue}</div>
                          </div>
                          {isPending && <Badge variant="secondary" className="text-xs shrink-0">Requested</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Edit Supplier Details</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-2">
                  <div>
                    <p className="text-sm font-semibold mb-3">Contact Information</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Company Name</Label>
                        <Input value={editForm.companyName || ""} onChange={(e) => setEditForm((p) => ({ ...p, companyName: e.target.value }))} data-testid="edit-supplier-company-name" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Contact Name</Label>
                        <Input value={editForm.contactName || ""} onChange={(e) => setEditForm((p) => ({ ...p, contactName: e.target.value }))} data-testid="edit-supplier-contact-name" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email</Label>
                        <Input type="email" value={editForm.email || ""} onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))} data-testid="edit-supplier-email" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Phone</Label>
                        <Input value={editForm.phone || ""} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} data-testid="edit-supplier-phone" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Address</Label>
                        <Input value={editForm.address || ""} onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))} data-testid="edit-supplier-address" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">City</Label>
                        <Input value={editForm.city || ""} onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))} data-testid="edit-supplier-city" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Postcode</Label>
                        <Input value={editForm.postcode || ""} onChange={(e) => setEditForm((p) => ({ ...p, postcode: e.target.value }))} data-testid="edit-supplier-postcode" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3">Company Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">VAT Number</Label>
                        <Input value={editForm.vatNumber || ""} onChange={(e) => setEditForm((p) => ({ ...p, vatNumber: e.target.value }))} data-testid="edit-supplier-vat" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">VAT Status</Label>
                        <Select value={editForm.vatStatus || ""} onValueChange={(v) => setEditForm((p) => ({ ...p, vatStatus: v }))}>
                          <SelectTrigger data-testid="edit-supplier-vat-status">
                            <SelectValue placeholder="Select VAT status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="vat_registered">VAT Registered</SelectItem>
                            <SelectItem value="not_vat_registered">Not VAT Registered</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {editForm.vatStatus === "vat_registered" && (
                        <div className="space-y-1">
                          <Label className="text-xs">VAT Registered From</Label>
                          <Input type="date" value={editForm.vatRegisteredFrom || ""} onChange={(e) => setEditForm((p) => ({ ...p, vatRegisteredFrom: e.target.value }))} data-testid="edit-supplier-vat-from" />
                          <p className="text-xs text-muted-foreground">Invoices before this date will use non-VAT series (SBI-NV). Leave blank for all periods.</p>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs">Company Reg. Number</Label>
                        <Input value={editForm.companyRegNumber || ""} onChange={(e) => setEditForm((p) => ({ ...p, companyRegNumber: e.target.value }))} data-testid="edit-supplier-reg" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nature of Supply</Label>
                        <Input value={editForm.natureOfSupply || ""} onChange={(e) => setEditForm((p) => ({ ...p, natureOfSupply: e.target.value }))} data-testid="edit-supplier-nature" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3">Registered Office</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Address</Label>
                        <Input value={editForm.registeredOfficeAddress || ""} onChange={(e) => setEditForm((p) => ({ ...p, registeredOfficeAddress: e.target.value }))} data-testid="edit-supplier-reg-addr" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">City</Label>
                        <Input value={editForm.registeredOfficeCity || ""} onChange={(e) => setEditForm((p) => ({ ...p, registeredOfficeCity: e.target.value }))} data-testid="edit-supplier-reg-city" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Postcode</Label>
                        <Input value={editForm.registeredOfficePostcode || ""} onChange={(e) => setEditForm((p) => ({ ...p, registeredOfficePostcode: e.target.value }))} data-testid="edit-supplier-reg-postcode" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3">Trading Address</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Address</Label>
                        <Input value={editForm.tradingAddress || ""} onChange={(e) => setEditForm((p) => ({ ...p, tradingAddress: e.target.value }))} data-testid="edit-supplier-trading-addr" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">City</Label>
                        <Input value={editForm.tradingCity || ""} onChange={(e) => setEditForm((p) => ({ ...p, tradingCity: e.target.value }))} data-testid="edit-supplier-trading-city" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Postcode</Label>
                        <Input value={editForm.tradingPostcode || ""} onChange={(e) => setEditForm((p) => ({ ...p, tradingPostcode: e.target.value }))} data-testid="edit-supplier-trading-postcode" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3">Bank Details</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Account Title</Label>
                        <Input value={editForm.bankName || ""} onChange={(e) => setEditForm((p) => ({ ...p, bankName: e.target.value }))} data-testid="edit-supplier-bank" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Account Name</Label>
                        <Input value={editForm.accountName || ""} onChange={(e) => setEditForm((p) => ({ ...p, accountName: e.target.value }))} data-testid="edit-supplier-acc-name" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Sort Code</Label>
                        <Input value={editForm.sortCode || ""} onChange={(e) => setEditForm((p) => ({ ...p, sortCode: e.target.value }))} data-testid="edit-supplier-sort" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Account Number</Label>
                        <Input value={editForm.accountNumber || ""} onChange={(e) => setEditForm((p) => ({ ...p, accountNumber: e.target.value }))} data-testid="edit-supplier-acc-num" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3">Finance Contact</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Finance Contact Name</Label>
                        <Input value={editForm.financeContactName || ""} onChange={(e) => setEditForm((p) => ({ ...p, financeContactName: e.target.value }))} data-testid="edit-supplier-fin-name" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Finance Contact Email</Label>
                        <Input type="email" value={editForm.financeContactEmail || ""} onChange={(e) => setEditForm((p) => ({ ...p, financeContactEmail: e.target.value }))} data-testid="edit-supplier-fin-email" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-semibold mb-3">Dates & Notes</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Onboarding Date (Approved At)</Label>
                        <Input type="date" value={editForm.approvedAt || ""} onChange={(e) => setEditForm((p) => ({ ...p, approvedAt: e.target.value }))} data-testid="edit-supplier-approved-at" />
                      </div>
                    </div>
                    <div className="space-y-1 mt-3">
                      <Label className="text-xs">Notes</Label>
                      <Textarea value={editForm.notes || ""} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={3} data-testid="edit-supplier-notes" />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                  <Button onClick={() => editSupplierMutation.mutate(editForm)} disabled={editSupplierMutation.isPending} data-testid="btn-save-supplier-edit">
                    {editSupplierMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={requestFieldOpen} onOpenChange={setRequestFieldOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Request information</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Request that the supplier provide or update the following {selectedRequestFields.size} field{selectedRequestFields.size !== 1 ? "s" : ""}:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(selectedRequestFields).map((fk) => (
                    <Badge key={fk} variant="secondary" className="text-xs">
                      {SUPPLIER_PROFILE_FIELD_LABELS[fk] ?? fk}
                    </Badge>
                  ))}
                </div>
                <Label htmlFor="request-field-message">Optional message (included in email)</Label>
                <Textarea
                  id="request-field-message"
                  placeholder="e.g. Please ensure this matches your bank statement."
                  value={requestFieldMessage}
                  onChange={(e) => setRequestFieldMessage(e.target.value)}
                  rows={3}
                />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setRequestFieldOpen(false)}>Cancel</Button>
                  <Button
                    onClick={() => requestFieldMutation.mutate({ fieldKeys: Array.from(selectedRequestFields), message: requestFieldMessage.trim() || undefined })}
                    disabled={requestFieldMutation.isPending || selectedRequestFields.size === 0}
                  >
                    {requestFieldMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Send {selectedRequestFields.size} request{selectedRequestFields.size !== 1 ? "s" : ""}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="flex flex-wrap gap-2">
              {(supplier.status === "draft" || supplier.status === "pending" || supplier.status === "submitted") && (
                <Button
                  onClick={() => approveMutation.mutate(supplier.id)}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve-detail"
                >
                  {approveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Shield className="w-4 h-4 mr-2" />
                  )}
                  Approve Supplier
                </Button>
              )}
              {(supplier.status === "submitted") && (
                <Button variant="outline" onClick={() => setRequestInfoOpen(true)} data-testid="button-request-info">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Request info
                </Button>
              )}
              {(supplier.status === "approved" || supplier.status === "active") && (
                <>
                  <Button variant="outline" onClick={() => completeReviewMutation.mutate()} disabled={completeReviewMutation.isPending} data-testid="button-complete-review">
                    <CalendarCheck className="w-4 h-4 mr-2" />
                    Complete review
                  </Button>
                  <Button variant="outline" onClick={() => setSuspendOpen(true)} data-testid="button-suspend">
                    <Ban className="w-4 h-4 mr-2" />
                    Suspend
                  </Button>
                  <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setTerminateOpen(true)} data-testid="button-terminate">
                    <XCircle className="w-4 h-4 mr-2" />
                    Terminate
                  </Button>
                </>
              )}
              {supplier.status === "suspended" && (
                <>
                  <Button variant="outline" onClick={() => unsuspendMutation.mutate()} disabled={unsuspendMutation.isPending} data-testid="button-unsuspend">
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Unsuspend
                  </Button>
                  <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setTerminateOpen(true)} data-testid="button-terminate">
                    <XCircle className="w-4 h-4 mr-2" />
                    Terminate
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setDeleteOpen(true)} data-testid="button-delete-supplier">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="w-5 h-5" />
                Documents
              </CardTitle>
              <CardDescription>
                Upload documents for this supplier or review documents they uploaded. You can approve or reject; rejected documents trigger an email to the supplier with the reason.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(() => {
                const requiredTypes = getRequiredSupplierDocumentTypes(supplier);
                return (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => setUploadDialogOpen(true)}>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload document
                      </Button>
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold">By document type</h4>
                      {requiredTypes.map((docType) => {
                        const docsOfType = supplierDocuments.filter((d) => d.documentType === docType);
                        const label = SUPPLIER_DOC_LABELS[docType];
                        const description = docType !== "other" && SUPPLIER_DOC_DESCRIPTIONS[docType as keyof typeof SUPPLIER_DOC_DESCRIPTIONS];
                        return (
                          <div key={docType} className="rounded-lg border p-4 space-y-3">
                            <div>
                              <div className="text-sm font-medium text-muted-foreground">{label}</div>
                              {description && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
                            </div>
                            {docsOfType.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No file uploaded yet.</p>
                            ) : (
                              <ul className="space-y-2">
                                {docsOfType.map((doc) => {
                                  const status = doc.status ?? "pending";
                                  const isPending = status === "pending";
                                  const isRejected = status === "rejected";
                                  const docTitle = doc.displayName?.trim() || doc.fileName;
                                  return (
                                    <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/30 p-3">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="font-medium text-sm truncate">{docTitle}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Uploaded {doc.createdAt ? formatDateTimeUK(doc.createdAt) : "—"}
                                            {doc.expiryDate && ` · Expires ${formatDate(doc.expiryDate)}`}
                                            {doc.reviewedAt && ` · Reviewed ${formatDateTimeUK(doc.reviewedAt)}`}
                                          </p>
                                          {doc.notes?.trim() && <p className="text-xs text-muted-foreground mt-0.5">{doc.notes}</p>}
                                          {isRejected && doc.rejectionReason && (
                                            <p className="text-xs text-destructive mt-1">Reason: {doc.rejectionReason}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <Badge
                                          variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}
                                          className="shrink-0"
                                        >
                                          {status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending review"}
                                        </Badge>
                                        <a
                                          href={doc.fileUrl.startsWith("http") ? doc.fileUrl : `${window.location.origin}${doc.fileUrl}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-primary text-xs font-medium underline shrink-0"
                                        >
                                          Open
                                        </a>
                                        {isPending && (
                                          <>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs"
                                              onClick={() => approveDocMutation.mutate(doc.id)}
                                              disabled={approveDocMutation.isPending}
                                            >
                                              {approveDocMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-7 text-xs text-destructive hover:text-destructive"
                                              onClick={() => {
                                                setRejectDocId(doc.id);
                                                setRejectDocLabel(label);
                                                setRejectReason("");
                                              }}
                                            >
                                              Reject
                                            </Button>
                                          </>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 text-xs text-destructive hover:text-destructive"
                                          data-testid={`button-delete-doc-${doc.id}`}
                                          onClick={() => { setDeleteDocId(doc.id); setDeleteDocName(doc.fileName || label); }}
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </Button>
                                        <Collapsible open={auditDocId === doc.id} onOpenChange={(open) => setAuditDocId(open ? doc.id : null)}>
                                          <CollapsibleTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                                              <History className="w-3 h-3" />
                                              History
                                            </Button>
                                          </CollapsibleTrigger>
                                          <CollapsibleContent>
                                            <div className="mt-2 pl-4 border-l-2 border-muted text-xs space-y-1.5">
                                              {auditDocId === doc.id && (
                                                documentAudit.length === 0 ? (
                                                  <p className="text-muted-foreground">No audit entries.</p>
                                                ) : (
                                                  documentAudit.map((a) => (
                                                    <div key={a.id} className="flex flex-wrap gap-x-2">
                                                      <span className="font-medium capitalize">{a.action}</span>
                                                      {a.userId && <span className="text-muted-foreground">by {a.userId}</span>}
                                                      <span className="text-muted-foreground">{formatDateTimeUK(a.createdAt)}</span>
                                                      {a.action === "rejected" && a.details && typeof a.details === "object" && "reason" in a.details && (
                                                        <span className="text-destructive">— {(a.details as { reason?: string }).reason}</span>
                                                      )}
                                                    </div>
                                                  ))
                                                )
                                              )}
                                            </div>
                                          </CollapsibleContent>
                                        </Collapsible>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                      {supplierDocuments.some((d) => d.documentType === "other") && (
                        <div className="rounded-lg border p-4 space-y-3">
                          <div className="text-sm font-medium text-muted-foreground">{SUPPLIER_DOC_LABELS.other}</div>
                          <ul className="space-y-2">
                            {supplierDocuments.filter((d) => d.documentType === "other").map((doc) => {
                              const status = doc.status ?? "pending";
                              const isPending = status === "pending";
                              const isRejected = status === "rejected";
                              const docTitle = doc.displayName?.trim() || doc.fileName;
                              return (
                                <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/30 p-3">
                                  <div className="flex items-center gap-3 min-w-0 flex-1">
                                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                    <div className="min-w-0">
                                      <p className="font-medium text-sm truncate">{docTitle}</p>
                                      <p className="text-xs text-muted-foreground">
                                        Uploaded {doc.createdAt ? formatDateTimeUK(doc.createdAt) : "—"}
                                        {doc.expiryDate && ` · Expires ${formatDate(doc.expiryDate)}`}
                                        {doc.notes?.trim() && ` · ${doc.notes}`}
                                      </p>
                                      {isRejected && doc.rejectionReason && <p className="text-xs text-destructive mt-1">Reason: {doc.rejectionReason}</p>}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant={status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"}>{status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending review"}</Badge>
                                    <a href={doc.fileUrl.startsWith("http") ? doc.fileUrl : `${window.location.origin}${doc.fileUrl}`} target="_blank" rel="noopener noreferrer" className="text-primary text-xs font-medium underline">Open</a>
                                    {isPending && (
                                      <>
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => approveDocMutation.mutate(doc.id)} disabled={approveDocMutation.isPending}>{approveDocMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Approve"}</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => { setRejectDocId(doc.id); setRejectDocLabel(docTitle); setRejectReason(""); }}>Reject</Button>
                                      </>
                                    )}
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" data-testid={`button-delete-doc-${doc.id}`} onClick={() => { setDeleteDocId(doc.id); setDeleteDocName(docTitle); }}><Trash2 className="w-3 h-3" /></Button>
                                    <Collapsible open={auditDocId === doc.id} onOpenChange={(open) => setAuditDocId(open ? doc.id : null)}>
                                      <CollapsibleTrigger asChild><Button size="sm" variant="ghost" className="h-7 text-xs gap-1"><History className="w-3 h-3" /> History</Button></CollapsibleTrigger>
                                      <CollapsibleContent>
                                        <div className="mt-2 pl-4 border-l-2 border-muted text-xs space-y-1.5">
                                          {auditDocId === doc.id && (documentAudit.length === 0 ? <p className="text-muted-foreground">No audit entries.</p> : documentAudit.map((a) => (
                                            <div key={a.id} className="flex flex-wrap gap-x-2">
                                              <span className="font-medium capitalize">{a.action}</span>
                                              {a.userId && <span className="text-muted-foreground">by {a.userId}</span>}
                                              <span className="text-muted-foreground">{formatDateTimeUK(a.createdAt)}</span>
                                              {a.action === "rejected" && a.details && typeof a.details === "object" && "reason" in a.details && <span className="text-destructive">— {(a.details as { reason?: string }).reason}</span>}
                                            </div>
                                          )))}
                                        </div>
                                      </CollapsibleContent>
                                    </Collapsible>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          <Dialog open={uploadDialogOpen} onOpenChange={(open) => { setUploadDialogOpen(open); if (!open) { setUploadFileSelected(null); setUploadDocType(null); setUploadDisplayName(""); setUploadExpiryDate(""); setUploadNotes(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload document</DialogTitle>
                <p className="text-sm text-muted-foreground">Choose type, select a file, and optionally add a name, expiry date, or notes.</p>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Document type</Label>
                  <Select value={uploadDocType ?? ""} onValueChange={(v) => setUploadDocType(v ? (v as SupplierDocumentType) : null)}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {getRequiredSupplierDocumentTypes(supplier).map((t) => <SelectItem key={t} value={t}>{SUPPLIER_DOC_LABELS[t]}</SelectItem>)}
                      <SelectItem value="other">{SUPPLIER_DOC_LABELS.other}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>File (PDF, JPG, PNG)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setUploadFileSelected(e.target.files?.[0] ?? null)}
                  />
                  <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => fileInputRef.current?.click()}>
                    {uploadFileSelected ? uploadFileSelected.name : "Choose file"}
                  </Button>
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
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>Cancel</Button>
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

          <Dialog open={rejectDocId != null} onOpenChange={(open) => !open && setRejectDocId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject document</DialogTitle>
                {rejectDocLabel && (
                  <p className="text-sm text-muted-foreground">
                    Reject &quot;{rejectDocLabel}&quot;. The supplier will receive an email with the reason below.
                  </p>
                )}
              </DialogHeader>
                <div className="space-y-2 py-2">
                  <Label htmlFor="reject-reason">Reason (required)</Label>
                  <Textarea
                    id="reject-reason"
                    placeholder="e.g. Document is blurry; please upload a clear scan showing company name and CRN."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                  />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setRejectDocId(null)}>Cancel</Button>
                  <Button
                    variant="destructive"
                    disabled={!rejectReason.trim() || rejectDocMutation.isPending}
                    onClick={() => rejectDocId != null && rejectDocMutation.mutate({ docId: rejectDocId, reason: rejectReason.trim() })}
                  >
                    {rejectDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                    Reject and send email
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

          <AlertDialog open={deleteDocId != null} onOpenChange={(open) => { if (!open) { setDeleteDocId(null); setDeleteDocName(""); } }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete document</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to permanently delete &quot;{deleteDocName}&quot;? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteDocMutation.isPending}
                  onClick={() => deleteDocId != null && deleteDocMutation.mutate(deleteDocId)}
                >
                  {deleteDocMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="rate-cards" className="mt-4" data-testid="tab-content-supplier-rate-cards">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-lg font-semibold">Rate Cards</h2>
            <Button onClick={() => setRcDialogOpen(true)} data-testid="button-add-supplier-rate-card">
              <Plus className="w-4 h-4 mr-2" />
              Add Rate Card
            </Button>
          </div>

          {rateCardsLoading ? (
            <Card>
              <CardContent className="p-8 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Loading rate cards...</span>
              </CardContent>
            </Card>
          ) : supplierRateCards.length === 0 ? (
            <Card data-testid="card-empty-supplier-rate-cards">
              <CardContent className="p-8 text-center">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold" data-testid="text-empty-supplier-rate-cards">No Rate Cards</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add rate cards to define hourly pay rates for this supplier.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-supplier-rate-cards">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium text-muted-foreground">Applies To</th>
                      <th className="p-3 font-medium text-muted-foreground">Role Type</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Hourly Rate</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Overtime Rate</th>
                      <th className="p-3 font-medium text-muted-foreground">Effective From</th>
                      <th className="p-3 font-medium text-muted-foreground">Effective To</th>
                      <th className="p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplierRateCards.map((rc) => {
                      const parts: string[] = [];
                      if (rc.employeeName) parts.push(`Employee: ${rc.employeeName}`);
                      if (rc.siteName) parts.push(`Site: ${rc.siteName}`);
                      const appliesTo = parts.length > 0 ? parts.join(" · ") : "General (All)";
                      return (
                      <tr key={rc.id} className="border-b last:border-0" data-testid={`row-supplier-rc-${rc.id}`}>
                        <td className="p-3 text-muted-foreground" data-testid={`text-src-applies-${rc.id}`}>{appliesTo}</td>
                        <td className="p-3" data-testid={`text-src-role-${rc.id}`}>{rc.roleType}</td>
                        <td className="p-3 text-right font-medium" data-testid={`text-src-hourly-${rc.id}`}>£{Number(rc.hourlyRate).toFixed(2)}</td>
                        <td className="p-3 text-right text-muted-foreground" data-testid={`text-src-overtime-${rc.id}`}>{rc.overtimeRate ? `£${Number(rc.overtimeRate).toFixed(2)}` : "N/A"}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(rc.effectiveFrom)}</td>
                        <td className="p-3 text-muted-foreground">{rc.effectiveTo ? formatDate(rc.effectiveTo) : "Ongoing"}</td>
                        <td className="p-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteRcMutation.mutate(rc.id)}
                            disabled={deleteRcMutation.isPending}
                            data-testid={`button-delete-src-${rc.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <Dialog open={rcDialogOpen} onOpenChange={(open) => { setRcDialogOpen(open); if (!open) { setSiteSearch(""); setSelectedSiteName(""); setSiteSearchResults([]); setShowSiteDropdown(false); } }}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Rate Card for {supplier?.companyName}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateRc} className="space-y-4" data-testid="form-add-supplier-rate-card">
                <div className="space-y-2">
                  <Label>Rate Type</Label>
                  <Select value={rcRateType} onValueChange={(v: any) => setRcRateType(v)} data-testid="select-src-rate-type">
                    <SelectTrigger data-testid="trigger-src-rate-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General (All employees & sites)</SelectItem>
                      <SelectItem value="site">Site-specific</SelectItem>
                      <SelectItem value="employee">Employee-specific</SelectItem>
                      <SelectItem value="both">Employee + Site specific</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(rcRateType === "site" || rcRateType === "both") && (
                  <div className="space-y-2">
                    <Label>Site</Label>
                    <div className="relative" ref={siteDropdownRef}>
                      <Input
                        value={selectedSiteName || siteSearch}
                        onChange={(e) => {
                          setSiteSearch(e.target.value);
                          setSelectedSiteName("");
                          setRcForm({ ...rcForm, siteId: "" });
                          setShowSiteDropdown(true);
                        }}
                        onFocus={() => setShowSiteDropdown(true)}
                        placeholder="Type to search sites..."
                        data-testid="input-src-site-search"
                      />
                      {rcForm.siteId && (
                        <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setRcForm({ ...rcForm, siteId: "" }); setSelectedSiteName(""); setSiteSearch(""); }}>✕</button>
                      )}
                      {showSiteDropdown && siteSearch.length >= 2 && (
                        <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                          {siteSearchResults.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-muted-foreground">No sites found</div>
                          ) : (
                            siteSearchResults.map((s: any) => (
                              <button
                                key={s.id}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent truncate"
                                onClick={() => {
                                  setRcForm({ ...rcForm, siteId: String(s.id) });
                                  setSelectedSiteName(s.name);
                                  setSiteSearch("");
                                  setShowSiteDropdown(false);
                                }}
                                data-testid={`option-src-site-${s.id}`}
                              >
                                {s.name}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(rcRateType === "employee" || rcRateType === "both") && (
                  <div className="space-y-2">
                    <Label>Employee</Label>
                    <Select value={rcForm.employeeId} onValueChange={(v) => setRcForm({ ...rcForm, employeeId: v })} data-testid="select-src-employee">
                      <SelectTrigger data-testid="trigger-src-employee">
                        <SelectValue placeholder="Select an employee" />
                      </SelectTrigger>
                      <SelectContent>
                        {supplierEmployees.map((emp: any) => (
                          <SelectItem key={emp.id} value={String(emp.id)}>{emp.firstName} {emp.lastName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="src-role-type">Role Type</Label>
                  <Input
                    id="src-role-type"
                    value={rcForm.roleType}
                    onChange={(e) => setRcForm({ ...rcForm, roleType: e.target.value })}
                    placeholder="e.g. Security Officer"
                    required
                    data-testid="input-src-role-type"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="src-hourly-rate">Hourly Rate (£)</Label>
                    <Input
                      id="src-hourly-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={rcForm.hourlyRate}
                      onChange={(e) => setRcForm({ ...rcForm, hourlyRate: e.target.value })}
                      placeholder="0.00"
                      required
                      data-testid="input-src-hourly-rate"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="src-overtime-rate">Overtime Rate (£)</Label>
                    <Input
                      id="src-overtime-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={rcForm.overtimeRate}
                      onChange={(e) => setRcForm({ ...rcForm, overtimeRate: e.target.value })}
                      placeholder="0.00"
                      data-testid="input-src-overtime-rate"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="src-effective-from">Effective From</Label>
                    <Input
                      id="src-effective-from"
                      type="date"
                      value={rcForm.effectiveFrom}
                      onChange={(e) => setRcForm({ ...rcForm, effectiveFrom: e.target.value })}
                      required
                      data-testid="input-src-effective-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="src-effective-to">Effective To</Label>
                    <Input
                      id="src-effective-to"
                      type="date"
                      value={rcForm.effectiveTo}
                      onChange={(e) => setRcForm({ ...rcForm, effectiveTo: e.target.value })}
                      data-testid="input-src-effective-to"
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setRcDialogOpen(false)} data-testid="button-cancel-src">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createRcMutation.isPending} data-testid="button-submit-src">
                    {createRcMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Add Rate Card
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="policies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                Policies
              </CardTitle>
              <CardDescription>
                UK ISO 9001 and HMRC-required company policies. Required policies depend on supplier type. Each policy must be reviewed and approved by an admin.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {(() => {
                const requiredPolicyTypes = getRequiredSupplierPolicyTypes(supplier);
                const pendingPolicies = supplierPolicies.filter((p) => p.status === "pending").length;
                return (
                  <>
                    {pendingPolicies > 0 && (
                      <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
                        {pendingPolicies} policy document{pendingPolicies > 1 ? "s" : ""} awaiting review.
                      </div>
                    )}

                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold">Required policies for this supplier</h4>
                      {requiredPolicyTypes.map((policyType) => {
                        const policiesOfType = supplierPolicies.filter((p) => p.policyType === policyType);
                        const label = SUPPLIER_POLICY_LABELS[policyType as keyof typeof SUPPLIER_POLICY_LABELS] ?? policyType;
                        const description = SUPPLIER_POLICY_DESCRIPTIONS[policyType as keyof typeof SUPPLIER_POLICY_DESCRIPTIONS];
                        const hasApproved = policiesOfType.some((p) => p.status === "approved");
                        return (
                          <div key={policyType} className="rounded-lg border p-4 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-medium flex items-center gap-2">
                                  {hasApproved ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                                  ) : policiesOfType.length > 0 ? (
                                    <div className="w-4 h-4 rounded-full border-2 border-amber-400 flex-shrink-0" />
                                  ) : (
                                    <XCircle className="w-4 h-4 text-muted-foreground/50 flex-shrink-0" />
                                  )}
                                  {label}
                                </div>
                                {description && <p className="text-xs text-muted-foreground mt-1 ml-6">{description}</p>}
                              </div>
                            </div>
                            {policiesOfType.length === 0 ? (
                              <p className="text-xs text-muted-foreground ml-6">No policy uploaded yet.</p>
                            ) : (
                              <ul className="space-y-2 ml-6">
                                {policiesOfType.map((policy) => {
                                  const policyStatus = policy.status ?? "pending";
                                  const isPending = policyStatus === "pending";
                                  const isRejected = policyStatus === "rejected";
                                  const isApproved = policyStatus === "approved";
                                  return (
                                    <li key={policy.id} className="flex flex-wrap items-center justify-between gap-2 rounded border bg-muted/30 p-3">
                                      <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                        <div className="min-w-0">
                                          <p className="font-medium text-sm truncate">{policy.fileName}</p>
                                          <p className="text-xs text-muted-foreground">
                                            Uploaded {policy.createdAt ? formatDateTimeUK(policy.createdAt) : "—"}
                                            {policy.issueDate && ` · Issued ${formatDate(policy.issueDate)}`}
                                            {policy.expiryDate && ` · Expires ${formatDate(policy.expiryDate)}`}
                                            {policy.reviewedAt && ` · Reviewed ${formatDateTimeUK(policy.reviewedAt)}`}
                                          </p>
                                          {policy.notes?.trim() && <p className="text-xs text-muted-foreground mt-0.5">{policy.notes}</p>}
                                          {isRejected && policy.rejectionReason && (
                                            <p className="text-xs text-destructive mt-1">Reason: {policy.rejectionReason}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        <Badge
                                          className={
                                            isApproved ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" :
                                            isRejected ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" :
                                            "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                          }
                                        >
                                          {isApproved ? "Approved" : isRejected ? "Rejected" : "Pending"}
                                        </Badge>
                                        <a href={policy.fileUrl} target="_blank" rel="noopener noreferrer">
                                          <Button size="sm" variant="outline">View</Button>
                                        </a>
                                        {isPending && (
                                          <>
                                            <Button
                                              size="sm"
                                              onClick={() => approvePolicyMutation.mutate(policy.id)}
                                              disabled={approvePolicyMutation.isPending}
                                            >
                                              {approvePolicyMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                                              Approve
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              onClick={() => {
                                                setRejectPolicyId(policy.id);
                                                setRejectPolicyLabel(label);
                                                setRejectPolicyReason("");
                                              }}
                                            >
                                              <XCircle className="w-3 h-3 mr-1" />
                                              Reject
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}
            </CardContent>
          </Card>

          {/* Reject policy dialog */}
          <Dialog open={rejectPolicyId != null} onOpenChange={(open) => { if (!open) { setRejectPolicyId(null); setRejectPolicyReason(""); } }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Reject policy</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                Rejecting: <strong>{rejectPolicyLabel}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Please provide a clear reason. The supplier will receive an in-app notification and email with this reason.
              </p>
              <Label htmlFor="reject-policy-reason">Reason for rejection</Label>
              <Textarea
                id="reject-policy-reason"
                placeholder="e.g. Policy is out of date — please upload the version signed in the last 12 months."
                value={rejectPolicyReason}
                onChange={(e) => setRejectPolicyReason(e.target.value)}
                rows={3}
              />
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setRejectPolicyId(null); setRejectPolicyReason(""); }}>Cancel</Button>
                <Button
                  variant="destructive"
                  disabled={!rejectPolicyReason.trim() || rejectPolicyMutation.isPending}
                  onClick={() => {
                    if (rejectPolicyId != null && rejectPolicyReason.trim()) {
                      rejectPolicyMutation.mutate({ policyId: rejectPolicyId, reason: rejectPolicyReason.trim() });
                    }
                  }}
                >
                  {rejectPolicyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <X className="w-4 h-4 mr-2" />}
                  Reject and notify supplier
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="portal" className="mt-4">
          {(supplier.status === "approved" || supplier.status === "active") ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <KeyRound className="w-5 h-5" />
              Portal Access
            </CardTitle>
            <CardDescription>
              Allow this supplier to log in and view or update their details. You will be notified when they request changes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label htmlFor="portal-toggle" className="text-base font-medium">Enable portal access</Label>
                <p className="text-sm text-muted-foreground">Supplier can log in and see their profile</p>
              </div>
              <Switch
                id="portal-toggle"
                checked={portalStatus?.portalAccessEnabled ?? supplier.portalAccessEnabled ?? false}
                onCheckedChange={(checked) => portalAccessMutation.mutate({ portalAccessEnabled: checked })}
                disabled={portalAccessMutation.isPending}
              />
            </div>
            {((portalStatus?.portalAccessEnabled ?? supplier.portalAccessEnabled) || portalStatus?.portalEmail) && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="portal-email">Portal login email</Label>
                  <div className="flex gap-2">
                    <Input
                      id="portal-email"
                      type="email"
                      placeholder={supplier.email ?? "supplier@example.com"}
                      defaultValue={portalStatus?.portalEmail ?? supplier.portalEmail ?? supplier.email ?? ""}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== (portalStatus?.portalEmail ?? supplier.portalEmail ?? supplier.email ?? "")) {
                          portalAccessMutation.mutate({ portalEmail: v });
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => sendInvitationMutation.mutate()}
                    disabled={sendInvitationMutation.isPending || !(portalStatus?.portalAccessEnabled ?? supplier.portalAccessEnabled)}
                  >
                    {sendInvitationMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Send invitation
                  </Button>
                  {!portalStatus?.invitationAccepted && portalStatus?.invitationSentAt && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => sendReminderMutation.mutate()}
                      disabled={sendReminderMutation.isPending}
                    >
                      {sendReminderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Send reminder
                    </Button>
                  )}
                  {portalStatus?.invitationAccepted && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetPasswordMutation.mutate()}
                      disabled={resetPasswordMutation.isPending}
                    >
                      {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                      Reset password
                    </Button>
                  )}
                </div>
                {portalStatus?.inviteLink && !portalStatus?.invitationAccepted && (
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Invitation link</Label>
                    <p className="text-xs text-muted-foreground">If the supplier did not receive the email, copy this link and send it to them.</p>
                    <div className="flex gap-2 items-center rounded-lg border bg-muted/30 p-3">
                      <code className="text-xs flex-1 truncate" title={portalStatus.inviteLink}>{portalStatus.inviteLink}</code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(portalStatus!.inviteLink!);
                          toast({ title: "Copied", description: "Invitation link copied to clipboard." });
                        }}
                      >
                        <Copy className="w-4 h-4 mr-1" />
                        Copy link
                      </Button>
                    </div>
                  </div>
                )}
                {portalStatus?.invitationAccepted && (
                  <p className="text-xs text-muted-foreground">The invitation link is only shown while the invitation is pending. This supplier has already accepted; use &quot;Reset password&quot; if they need to sign in again.</p>
                )}
                <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Invitation</span>
                    <p className="font-medium">{portalStatus?.invitationAccepted ? "Accepted" : portalStatus?.invitationSentAt ? "Pending" : "Not sent"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Logins</span>
                    <p className="font-medium">{portalStatus?.loginCount ?? 0}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last login</span>
                    <p className="font-medium">{formatDateTimeUK(portalStatus?.lastLoginAt ?? null)}</p>
                  </div>
                  {portalStatus?.lastLoginMeta && (portalStatus.lastLoginMeta.ipAddress || portalStatus.lastLoginMeta.userAgent) && (
                    <div className="col-span-2 text-xs text-muted-foreground">
                      {portalStatus.lastLoginMeta.ipAddress && <span>IP: {portalStatus.lastLoginMeta.ipAddress}</span>}
                      {portalStatus.lastLoginMeta.userAgent && <span className="ml-2">Browser: {portalStatus.lastLoginMeta.userAgent.slice(0, 60)}…</span>}
                    </div>
                  )}
                </div>
                <div className="space-y-2 pt-2 border-t">
                  <Label>Data visibility override (months)</Label>
                  <p className="text-xs text-muted-foreground">
                    Override the tenant default for this supplier. Leave blank to use the tenant default.
                  </p>
                  <Select
                    value={supplier.dataVisibilityMonths?.toString() || "default"}
                    onValueChange={(v) => {
                      portalAccessMutation.mutate({ dataVisibilityMonths: v === "default" ? null : parseInt(v) });
                    }}
                  >
                    <SelectTrigger data-testid="select-supplier-visibility-override">
                      <SelectValue placeholder="Use tenant default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Use tenant default</SelectItem>
                      <SelectItem value="1">1 month</SelectItem>
                      <SelectItem value="3">3 months</SelectItem>
                      <SelectItem value="6">6 months</SelectItem>
                      <SelectItem value="12">12 months</SelectItem>
                      <SelectItem value="24">24 months</SelectItem>
                      <SelectItem value="36">36 months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
        </Card>
          ) : (
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Portal access can be enabled after this supplier is approved.</p>
          </CardContent>
        </Card>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ClipboardList className="w-5 h-5" />
                Pending change requests
              </CardTitle>
              <CardDescription>VAT, bank or profile change requests from the supplier. Approve or reject to apply or discard.</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingChanges.filter((c) => c.status === "pending").length > 0 ? (
                <div className="space-y-3">
                  {pendingChanges.filter((c) => c.status === "pending").map((change) => (
                    <div key={change.id} className="flex items-center justify-between rounded-lg border p-3">
                      <pre className="text-xs overflow-auto max-h-24">{JSON.stringify(change.payload, null, 2)}</pre>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveChangeMutation.mutate(change.id)} disabled={approveChangeMutation.isPending}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => rejectChangeMutation.mutate(change.id)} disabled={rejectChangeMutation.isPending}>Reject</Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4">No pending change requests.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agreements" className="mt-4" data-testid="tab-content-agreements">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-4 h-4" />
                Current Agreement
              </CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.selfBillingAgreementStatus === "active" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Active</Badge>
                      <span className="text-sm text-muted-foreground">Ref: {supplier.selfBillingAgreementRef || "—"}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(`/api/admin/suppliers/${id}/agreement-pdf`, "_blank")}
                      data-testid="button-download-current-agreement-pdf"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      Download PDF
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Signatory</span>
                      <p className="font-medium" data-testid="text-agreement-signatory">{supplier.selfBillingSignatoryName || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Position</span>
                      <p className="font-medium">{supplier.selfBillingSignatoryPosition || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Signed</span>
                      <p className="font-medium">{supplier.selfBillingAcceptedAt ? new Date(supplier.selfBillingAcceptedAt).toLocaleDateString("en-GB") : "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expires</span>
                      <p className="font-medium">{supplier.selfBillingExpiryDate ? new Date(supplier.selfBillingExpiryDate).toLocaleDateString("en-GB") : "—"}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Not Signed</Badge>
                  <span className="text-sm text-muted-foreground">No active self-billing agreement</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="w-4 h-4" />
                Agreement History
              </CardTitle>
              <CardDescription>
                Archived self-billing agreements for this supplier
              </CardDescription>
            </CardHeader>
            <CardContent>
              {agreementArchives.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No archived agreements</p>
              ) : (
                <div className="space-y-3">
                  {agreementArchives.map((archive) => (
                    <div key={archive.id} className="flex items-center justify-between rounded-lg border p-3" data-testid={`agreement-archive-${archive.id}`}>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 flex-1 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Reference</span>
                          <p className="font-medium">{archive.agreementRef || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Signed</span>
                          <p className="font-medium">{archive.signedAt ? new Date(archive.signedAt).toLocaleDateString("en-GB") : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Expired</span>
                          <p className="font-medium">{archive.expiryDate ? new Date(archive.expiryDate).toLocaleDateString("en-GB") : "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Signatory</span>
                          <p className="font-medium">{archive.signatoryName || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Reason</span>
                          <p className="font-medium capitalize">{archive.archivedReason?.replace(/_/g, " ") || "—"}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="ml-3 shrink-0"
                        onClick={() => window.open(`/api/suppliers/${id}/agreement-archives/${archive.id}/pdf`, "_blank")}
                        data-testid={`button-view-archive-pdf-${archive.id}`}
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        View PDF
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4" data-testid="tab-content-payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Banknote className="w-5 h-5" />
                Bank Transactions
              </CardTitle>
              <CardDescription>Bank transactions linked to this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              {transactionsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="loading-payments">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading transactions...
                </div>
              ) : !supplierTransactions || supplierTransactions.transactionCount === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-payments">No bank transactions linked to this supplier yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground">Total Payments</div>
                        <div className="text-lg font-semibold" data-testid="text-total-payments">
                          {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(supplierTransactions.totalPayments)}
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-4">
                        <div className="text-xs text-muted-foreground">Number of Transactions</div>
                        <div className="text-lg font-semibold" data-testid="text-transaction-count">{supplierTransactions.transactionCount}</div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="overflow-auto">
                    <table className="w-full text-sm" data-testid="table-supplier-payments">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Date</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Description</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Amount</th>
                          <th className="pb-2 pr-4 font-medium text-muted-foreground">Invoice</th>
                          <th className="pb-2 font-medium text-muted-foreground">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierTransactions.transactions.map((tx) => (
                          <tr key={tx.id} className="border-b last:border-0" data-testid={`row-payment-${tx.id}`}>
                            <td className="py-2 pr-4 whitespace-nowrap">{formatDate(tx.transactionDate)}</td>
                            <td className="py-2 pr-4 max-w-[250px] truncate" title={tx.description || ""}>{tx.description || "—"}</td>
                            <td className="py-2 pr-4 text-right whitespace-nowrap font-medium">
                              {new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Math.abs(parseFloat(tx.amount)))}
                            </td>
                            <td className="py-2 pr-4">
                              {tx.allocations.length > 0 ? (
                                <div className="space-y-0.5">
                                  {tx.allocations.map((alloc) => (
                                    <span key={alloc.id} className="text-xs">
                                      {alloc.invoiceNumber || `#${alloc.invoiceId}`}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="py-2">
                              <Badge
                                variant={tx.status === "Allocated" ? "default" : tx.status === "Partial" ? "secondary" : "outline"}
                                data-testid={`badge-payment-status-${tx.id}`}
                              >
                                {tx.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card className="mb-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="w-5 h-5" />
                IP Address Pool
              </CardTitle>
              <CardDescription>Geographically realistic IPs based on supplier postcode, used in audit trail generation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                {supplier?.ipPool && supplier.ipPool.length > 0 ? (
                  supplier.ipPool.map((ip: string, idx: number) => (
                    <Badge key={idx} variant="outline" className="font-mono text-xs" data-testid={`badge-ip-${idx}`}>{ip}</Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground" data-testid="text-no-ip-pool">No IP pool generated yet</span>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="ml-auto"
                  onClick={() => regenerateIpPoolMutation.mutate()}
                  disabled={regenerateIpPoolMutation.isPending}
                  data-testid="button-regenerate-ip-pool"
                >
                  {regenerateIpPoolMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                  {supplier?.ipPool && supplier.ipPool.length > 0 ? "Regenerate" : "Generate"} IPs
                </Button>
              </div>
              {supplier?.postcode && (
                <p className="text-xs text-muted-foreground mt-2">Based on postcode: {supplier.registeredOfficePostcode || supplier.postcode}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Activity className="w-5 h-5" />
                Activity & audit log
              </CardTitle>
              <CardDescription>Logins, invitations, and changes for this supplier</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-80 overflow-auto">
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity yet.</p>
                ) : (
                  activity.map((item, i) => (
                    <div key={item.type === "audit" ? item.id : `login-${item.id}-${i}`} className="flex flex-wrap items-start gap-2 rounded border p-2 text-sm">
                      <span className="text-muted-foreground shrink-0" title={String(item.createdAt)}>{formatDateTimeUK(item.createdAt)}</span>
                      {"userName" in item && item.userName && (
                        <span className="font-medium shrink-0">By: {item.userName}</span>
                      )}
                      {item.type === "audit" ? (
                        <>
                          <Badge variant="secondary">{auditActionLabel(item.action)}</Badge>
                          {item.ipAddress && <span className="text-xs text-muted-foreground">IP: {item.ipAddress}</span>}
                          {item.details && typeof item.details === "object" && Object.keys(item.details as object).length > 0 && (
                            <details className="w-full">
                              <summary className="cursor-pointer text-xs">Details</summary>
                              <pre className="text-xs mt-1 overflow-auto">{JSON.stringify(item.details, null, 2)}</pre>
                            </details>
                          )}
                        </>
                      ) : (
                        <>
                          <Badge variant="outline">Login</Badge>
                          {item.ipAddress && <span>IP: {item.ipAddress}</span>}
                          {item.userAgent && <span className="text-xs text-muted-foreground truncate max-w-[200px]" title={item.userAgent}>{item.userAgent}</span>}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
              {profileChangeLog.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <History className="w-4 h-4" /> Profile change log
                  </h4>
                  <p className="text-xs text-muted-foreground mb-2">Every profile edit (direct or approved pending change) is logged here.</p>
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {profileChangeLog.map((entry) => (
                      <div key={entry.id} className="rounded border p-2 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-muted-foreground shrink-0">{formatDateTimeUK(entry.createdAt)}</span>
                          <Badge variant={entry.action === "pending_rejected" ? "destructive" : "secondary"}>
                            {entry.action === "direct_edit" ? "Direct edit" : entry.action === "pending_approved" ? "Change approved" : "Change rejected"}
                          </Badge>
                        </div>
                        {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-xs text-muted-foreground">Field changes</summary>
                            <ul className="text-xs mt-1 space-y-0.5 pl-3">
                              {entry.fieldChanges.map((fc, i) => (
                                <li key={i}>
                                  <strong>{SUPPLIER_PROFILE_FIELD_LABELS[fc.field] ?? fc.field}</strong>: “
                                  {fc.oldValue != null && fc.oldValue !== "" ? String(fc.oldValue) : "(empty)"}” → “
                                  {fc.newValue != null && fc.newValue !== "" ? String(fc.newValue) : "(empty)"}”
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={requestInfoOpen} onOpenChange={setRequestInfoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request information</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Add notes for the supplier. Status will be set to Info Required and they can resubmit.</p>
          <Textarea
            placeholder="What information is needed?"
            value={requestInfoNotes}
            onChange={(e) => setRequestInfoNotes(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestInfoOpen(false)}>Cancel</Button>
            <Button onClick={() => requestInfoMutation.mutate(requestInfoNotes)} disabled={requestInfoMutation.isPending}>
              {requestInfoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Request info
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend supplier</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Optionally provide a reason. The supplier will remain in the system but can be unsuspended later.</p>
          <Textarea
            placeholder="Reason for suspension (optional)"
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => suspendMutation.mutate(suspendReason)} disabled={suspendMutation.isPending}>
              {suspendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Suspend
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={terminateOpen} onOpenChange={setTerminateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Terminate supplier</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This sets the supplier status to Terminated. Optionally provide a reason (stored in audit log). This action does not delete the record.</p>
          <Textarea
            placeholder="Reason for termination (optional)"
            value={terminateReason}
            onChange={(e) => setTerminateReason(e.target.value)}
            className="min-h-[80px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setTerminateOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => terminateMutation.mutate(terminateReason)} disabled={terminateMutation.isPending} data-testid="button-terminate-confirm">
              {terminateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Terminate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => { setDeleteOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently delete supplier</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This will permanently delete <strong>{supplier?.companyName}</strong> and all related records including documents, policies, audit events, rate cards, invoices, and agreements. Shifts and employees linked to this supplier will be unlinked but not deleted.</p>
          <p className="text-sm font-medium text-destructive">This action cannot be undone.</p>
          <div>
            <Label className="text-sm">Type <strong>DELETE</strong> to confirm</Label>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              className="mt-1"
              data-testid="input-delete-confirm"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeleteConfirmText(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending || deleteConfirmText !== "DELETE"} data-testid="button-delete-confirm">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
