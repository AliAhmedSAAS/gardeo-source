import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, Clock, Filter, Loader2,
  ArrowUpDown, DollarSign, Shield, Calendar, MapPin, Users, ChevronDown,
  ChevronLeft, ChevronRight, Search, Pencil, Download,
} from "lucide-react";

const FINANCE_EDIT_ROLES = new Set([
  "super_admin", "tenant_admin", "ceo", "accountant", "admin", "payroll_manager",
  "operations_manager", "regional_manager",
]);

type FinanceEditableField =
  | "holidayHours"
  | "deductionHours"
  | "breakMinutes"
  | "payRate"
  | "chargeRate"
  | "lateHours";

function FinanceNumInput({
  value,
  onSave,
  disabled,
  step = "0.01",
  min = "0",
  prefix,
  suffix,
  testId,
  className,
}: {
  value: number | null | undefined;
  onSave: (next: number | null) => void;
  disabled?: boolean;
  step?: string;
  min?: string;
  prefix?: string;
  suffix?: string;
  testId?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value == null || Number.isNaN(Number(value)) ? "" : String(value));
  useEffect(() => {
    setDraft(value == null || Number.isNaN(Number(value)) ? "" : String(value));
  }, [value]);

  const commit = () => {
    if (disabled) return;
    const trimmed = draft.trim();
    if (trimmed === "") {
      if (value == null || value === 0) {
        setDraft(value == null || Number.isNaN(Number(value)) ? "" : String(value));
        return;
      }
      onSave(0);
      return;
    }
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      setDraft(value == null || Number.isNaN(Number(value)) ? "" : String(value));
      return;
    }
    if (Number(value) === n) return;
    onSave(n);
  };

  return (
    <div className={`flex items-center justify-end gap-0.5 ${className || ""}`}>
      {prefix ? <span className="text-[10px] text-muted-foreground">{prefix}</span> : null}
      <Input
        type="number"
        step={step}
        min={min}
        value={draft}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="h-7 w-[4.5rem] px-1.5 text-right text-xs tabular-nums"
        data-testid={testId}
      />
      {suffix ? <span className="text-[10px] text-muted-foreground">{suffix}</span> : null}
    </div>
  );
}

interface EnrichedShift {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string | null;
  financeStatus: string | null;
  financeNote: string | null;
  financeApprovedBy: string | null;
  financeApprovedAt: string | null;
  employeeId: number | null;
  siteId: number | null;
  supplierId: number | null;
  bookedOnAt: string | null;
  bookedOffAt: string | null;
  lateMinutes: number | null;
  verifiedAt: string | null;
  shiftCode: string | null;
  employeeName?: string;
  siteName?: string;
  supplierName?: string;
  payRate?: number | null;
  chargeRate?: number | null;
  hours?: number | null;
  holidayHours?: number | null;
  lateHours?: number | null;
  breakMinutes?: number | null;
  deductionHours?: number | null;
  /** Persisted £ self-employed / payroll deduction */
  deductionAmount?: number | null;
}

function formatShiftDate(value: string | null | undefined): string {
  if (!value) return "—";
  const s = String(value);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatShiftTime(value: string | null | undefined): string {
  if (!value) return "—";
  const s = String(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(11, 16) || s;
  return s.slice(0, 5);
}

function fmtNum(value: number | null | undefined, digits = 2): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return Number(value).toFixed(digits);
}

function escapeCsv(val: unknown): string {
  if (val == null) return "";
  const s = String(val);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsvBlob(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const FINANCE_CSV_HEADERS = [
  "Date",
  "Start",
  "End",
  "Officer",
  "Site",
  "Supplier",
  "Hours",
  "Break (min)",
  "Holiday hrs",
  "Late hrs",
  "Deduction hrs",
  "Deduction £",
  "Pay rate",
  "Charge rate",
  "Shift status",
  "Finance status",
  "Finance note",
  "Shift ID",
] as const;

/** Fallback hours from duty window when API doesn't send hours yet. */
function calcHoursFromTimes(
  startTime?: string | null,
  endTime?: string | null,
): number | null {
  const start = formatShiftTime(startTime);
  const end = formatShiftTime(endTime);
  if (!start || start === "—" || !end || end === "—") return null;
  const [sh, sm] = start.split(":").map((x) => parseInt(x, 10) || 0);
  const [eh, em] = end.split(":").map((x) => parseInt(x, 10) || 0);
  let hours = eh + em / 60 - (sh + sm / 60);
  if (hours < 0) hours += 24;
  return Math.round(Math.max(0, hours) * 100) / 100;
}

function shiftDisplayHours(shift: EnrichedShift): number | null {
  if (shift.hours != null && !Number.isNaN(Number(shift.hours))) return Number(shift.hours);
  return calcHoursFromTimes(shift.startTime, shift.endTime);
}

interface PaginatedResponse {
  data: EnrichedShift[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; pending: number; approved: number; rejected: number; late_arrivals: number };
  sites: { id: number; name: string }[];
  clients: { id: number; name: string }[];
  officers: { id: number; name: string }[];
  suppliers: { id: number; name: string }[];
}

const FINANCE_STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
};

const SHIFT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  booked_on: { label: "Booked On", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300" },
  in_progress: { label: "In Progress", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  booked_off: { label: "Booked Off", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  verified: { label: "Verified", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  completed: { label: "Completed", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300" },
  no_show: { label: "No Show", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  missed: { label: "Missed", className: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
};

type TenantInfo = {
  companyName?: string;
};

export default function FinanceApprovalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterFinanceStatus, setFilterFinanceStatus] = useState<string>("pending");
  const [draftDateFrom, setDraftDateFrom] = useState("");
  const [draftDateTo, setDraftDateTo] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSite, setFilterSite] = useState("all");
  const [filterClient, setFilterClient] = useState("all");
  const [filterOfficer, setFilterOfficer] = useState("all");
  const [filterSupplier, setFilterSupplier] = useState("all");
  const [filterShiftStatus, setFilterShiftStatus] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<"single" | "bulk">("bulk");
  const [rejectSingleId, setRejectSingleId] = useState<number | null>(null);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEdit, setBulkEdit] = useState({
    holidayHours: "",
    deductionHours: "",
    breakMinutes: "",
    payRate: "",
    chargeRate: "",
    lateHours: "",
  });
  const [csvExporting, setCsvExporting] = useState(false);
  const limit = 50;
  const canEditFields = !!user?.role && FINANCE_EDIT_ROLES.has(user.role);

  const resetPage = useCallback(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const applyDateFrom = () => {
    if (draftDateFrom === filterDateFrom) return;
    setFilterDateFrom(draftDateFrom);
    resetPage();
  };

  const applyDateTo = () => {
    if (draftDateTo === filterDateTo) return;
    setFilterDateTo(draftDateTo);
    resetPage();
  };

  const applySearch = () => {
    if (searchTerm === appliedSearch) return;
    setAppliedSearch(searchTerm);
    resetPage();
  };

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    financeStatus: filterFinanceStatus,
    shiftStatus: filterShiftStatus,
    siteId: filterSite !== "all" ? filterSite : "",
    clientId: filterClient !== "all" ? filterClient : "",
    officerId: filterOfficer !== "all" ? filterOfficer : "",
    supplierId: filterSupplier !== "all" ? filterSupplier : "",
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
    search: appliedSearch,
  }).toString();

  const { data: response, isLoading } = useQuery<PaginatedResponse>({
    queryKey: [
      "/api/finance-approval/shifts",
      page,
      filterFinanceStatus,
      filterShiftStatus,
      filterSite,
      filterClient,
      filterOfficer,
      filterSupplier,
      filterDateFrom,
      filterDateTo,
      appliedSearch,
    ],
    queryFn: async () => {
      const res = await fetch(`/api/finance-approval/shifts?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load shifts");
      return res.json();
    },
  });

  const shifts = response?.data || [];
  const total = response?.total || 0;
  const stats = response?.stats || { total: 0, pending: 0, approved: 0, rejected: 0, late_arrivals: 0 };
  const sites = response?.sites || [];
  const clients = response?.clients || [];
  const officers = response?.officers || [];
  const suppliers = response?.suppliers || [];
  const { data: permissionsData } = useQuery<{ tenant?: TenantInfo }>({
    queryKey: ["/api/my-permissions"],
  });
  const tenantCompanyName = permissionsData?.tenant?.companyName || "Own Company";
  const inhouseLabel = `${tenantCompanyName} (In-house)`;
  const supplierOptions = [
    { value: "inhouse", label: inhouseLabel },
    ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const totalPages = Math.ceil(total / limit);
  const hasAdvancedFilters =
    filterSite !== "all" || filterClient !== "all" || filterOfficer !== "all" || filterSupplier !== "all";
  const hasActiveFilters =
    !!filterDateFrom ||
    !!filterDateTo ||
    filterShiftStatus !== "all" ||
    !!appliedSearch ||
    hasAdvancedFilters;

  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/shifts/bulk-finance", {
        shiftIds: ids,
        action: "approve",
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Shifts Approved", description: `${data.processed?.length || 0} shifts approved for invoicing.` });
      queryClient.invalidateQueries({ queryKey: ["/api/finance-approval/shifts"] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkRejectMutation = useMutation({
    mutationFn: async ({ ids, note }: { ids: number[]; note: string }) => {
      const res = await apiRequest("POST", "/api/shifts/bulk-finance", {
        shiftIds: ids,
        action: "reject",
        note,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Shifts Rejected", description: `${data.processed?.length || 0} shifts rejected.` });
      queryClient.invalidateQueries({ queryKey: ["/api/finance-approval/shifts"] });
      setSelectedIds(new Set());
      setRejectDialogOpen(false);
      setRejectNote("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const singleApproveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/shifts/${id}/finance-approve`, {});
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Shift Approved", description: "Shift approved for invoicing." });
      queryClient.invalidateQueries({ queryKey: ["/api/finance-approval/shifts"] });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const singleRejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await apiRequest("POST", `/api/shifts/${id}/finance-reject`, { note });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Shift Rejected", description: "Shift has been rejected." });
      queryClient.invalidateQueries({ queryKey: ["/api/finance-approval/shifts"] });
      setRejectDialogOpen(false);
      setRejectNote("");
      setRejectSingleId(null);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateFieldsMutation = useMutation({
    mutationFn: async ({ id, fields }: { id: number; fields: Partial<Record<FinanceEditableField, number | null>> }) => {
      const res = await apiRequest("PATCH", `/api/finance-approval/shifts/${id}`, fields);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/finance-approval/shifts"] });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, fields }: { ids: number[]; fields: Partial<Record<FinanceEditableField, number | null>> }) => {
      const res = await apiRequest("POST", "/api/finance-approval/shifts/bulk-update", {
        shiftIds: ids,
        fields,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Bulk update complete",
        description: `Updated ${data.processed?.length || 0} shift${(data.processed?.length || 0) === 1 ? "" : "s"}.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/finance-approval/shifts"] });
      setBulkEditOpen(false);
      setBulkEdit({
        holidayHours: "",
        deductionHours: "",
        breakMinutes: "",
        payRate: "",
        chargeRate: "",
        lateHours: "",
      });
    },
    onError: (err: any) => {
      toast({ title: "Bulk update failed", description: err.message, variant: "destructive" });
    },
  });

  const saveField = (id: number, field: FinanceEditableField, next: number | null) => {
    updateFieldsMutation.mutate({ id, fields: { [field]: next } });
  };

  const handleBulkEditApply = () => {
    const fields: Partial<Record<FinanceEditableField, number | null>> = {};
    const map: Array<[FinanceEditableField, string]> = [
      ["holidayHours", bulkEdit.holidayHours],
      ["deductionHours", bulkEdit.deductionHours],
      ["breakMinutes", bulkEdit.breakMinutes],
      ["payRate", bulkEdit.payRate],
      ["chargeRate", bulkEdit.chargeRate],
      ["lateHours", bulkEdit.lateHours],
    ];
    for (const [key, raw] of map) {
      const t = raw.trim();
      if (!t) continue;
      const n = Number(t);
      if (!Number.isFinite(n)) {
        toast({ title: "Invalid value", description: `Check ${key}`, variant: "destructive" });
        return;
      }
      fields[key] = n;
    }
    if (Object.keys(fields).length === 0) {
      toast({ title: "Nothing to update", description: "Fill at least one field.", variant: "destructive" });
      return;
    }
    bulkUpdateMutation.mutate({ ids: Array.from(selectedIds), fields });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === shifts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(shifts.map((s) => s.id)));
    }
  };

  const handleBulkApprove = () => {
    if (selectedIds.size === 0) return;
    bulkApproveMutation.mutate(Array.from(selectedIds));
  };

  const handleBulkReject = () => {
    if (selectedIds.size === 0) return;
    setRejectTarget("bulk");
    setRejectDialogOpen(true);
  };

  const handleSingleReject = (id: number) => {
    setRejectSingleId(id);
    setRejectTarget("single");
    setRejectDialogOpen(true);
  };

  const confirmReject = () => {
    if (!rejectNote.trim()) return;
    if (rejectTarget === "bulk") {
      bulkRejectMutation.mutate({ ids: Array.from(selectedIds), note: rejectNote.trim() });
    } else if (rejectSingleId !== null) {
      singleRejectMutation.mutate({ id: rejectSingleId, note: rejectNote.trim() });
    }
  };

  const buildFilterParams = useCallback(
    (pageNum: number, pageLimit: number) =>
      new URLSearchParams({
        page: String(pageNum),
        limit: String(pageLimit),
        financeStatus: filterFinanceStatus,
        shiftStatus: filterShiftStatus,
        siteId: filterSite !== "all" ? filterSite : "",
        clientId: filterClient !== "all" ? filterClient : "",
        officerId: filterOfficer !== "all" ? filterOfficer : "",
        supplierId: filterSupplier !== "all" ? filterSupplier : "",
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        search: appliedSearch,
      }),
    [
      filterFinanceStatus,
      filterShiftStatus,
      filterSite,
      filterClient,
      filterOfficer,
      filterSupplier,
      filterDateFrom,
      filterDateTo,
      appliedSearch,
    ],
  );

  const handleExportCsv = async () => {
    if (csvExporting) return;
    setCsvExporting(true);
    try {
      const pageLimit = 100;
      const all: EnrichedShift[] = [];
      let pageNum = 1;
      let totalCount = Infinity;

      while (all.length < totalCount) {
        const params = buildFilterParams(pageNum, pageLimit);
        const res = await fetch(`/api/finance-approval/shifts?${params}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to load shifts for CSV");
        const body = (await res.json()) as PaginatedResponse;
        totalCount = body.total || 0;
        const batch = body.data || [];
        all.push(...batch);
        if (batch.length === 0 || all.length >= totalCount) break;
        pageNum += 1;
        if (pageNum > 500) break;
      }

      if (all.length === 0) {
        toast({
          title: "Nothing to export",
          description: "No shifts match the current filters.",
          variant: "destructive",
        });
        return;
      }

      const supplierLabel = (s: EnrichedShift) => s.supplierName?.trim() || inhouseLabel;
      const rows = all.map((s) => [
        formatShiftDate(s.date),
        formatShiftTime(s.startTime),
        formatShiftTime(s.endTime),
        s.employeeName || "Unassigned",
        s.siteName || "",
        supplierLabel(s),
        shiftDisplayHours(s) ?? "",
        s.breakMinutes ?? 0,
        s.holidayHours ?? 0,
        s.lateHours ?? 0,
        s.deductionHours ?? 0,
        s.deductionAmount ?? 0,
        s.payRate ?? "",
        s.chargeRate ?? "",
        s.status || "",
        s.financeStatus || "pending",
        s.financeNote || "",
        s.id,
      ]);

      const lines = [
        FINANCE_CSV_HEADERS.map(escapeCsv).join(","),
        ...rows.map((r) => r.map(escapeCsv).join(",")),
      ];
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsvBlob(`\uFEFF${lines.join("\n")}`, `finance-approval-${stamp}.csv`);
      toast({ title: "CSV downloaded", description: `${all.length} shift(s) exported.` });
    } catch (err: any) {
      toast({
        title: "CSV export failed",
        description: err?.message || "Could not export CSV",
        variant: "destructive",
      });
    } finally {
      setCsvExporting(false);
    }
  };

  if (isLoading && !response) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1F3A5F]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="finance-approval-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#1F3A5F] rounded-lg">
            <DollarSign className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F] dark:text-white" data-testid="text-page-title">Shift Finance Approval</h1>
            <p className="text-sm text-muted-foreground">Review and approve worked shifts for invoicing and payroll</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCsv}
          disabled={csvExporting || total === 0}
          data-testid="button-export-csv"
        >
          {csvExporting ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <Download className="w-4 h-4 mr-1" />
          )}
          {csvExporting ? "Exporting…" : "Download CSV"}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold" data-testid="text-total-workable">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Worked</div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 dark:border-amber-800">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-amber-600" data-testid="text-pending-count">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending Review</div>
          </CardContent>
        </Card>
        <Card className="border-green-200 dark:border-green-800">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-green-600" data-testid="text-approved-count">{stats.approved}</div>
            <div className="text-xs text-muted-foreground">Approved</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-800">
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-red-600" data-testid="text-rejected-count">{stats.rejected}</div>
            <div className="text-xs text-muted-foreground">Rejected</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <div className="text-xl font-bold text-orange-600" data-testid="text-late-count">{stats.late_arrivals}</div>
            <div className="text-xs text-muted-foreground">Late Arrivals</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {canEditFields && (
                <Button
                  size="sm"
                  onClick={() => {
                    if (selectedIds.size === 0) {
                      toast({
                        title: "Select shifts first",
                        description: "Tick one or more rows, then use Bulk Update.",
                      });
                      return;
                    }
                    setBulkEditOpen(true);
                  }}
                  data-testid="button-bulk-edit-toolbar"
                >
                  <Pencil className="w-3.5 h-3.5 mr-1" />
                  Bulk Update{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvancedFilters((v) => !v)}
                data-testid="button-advanced-filters"
              >
                <ChevronDown className={`w-3.5 h-3.5 mr-1 transition-transform ${showAdvancedFilters || hasAdvancedFilters ? "rotate-180" : ""}`} />
                Advanced
                {hasAdvancedFilters && (
                  <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                    On
                  </Badge>
                )}
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDraftDateFrom("");
                    setDraftDateTo("");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                    setFilterSite("all");
                    setFilterClient("all");
                    setFilterOfficer("all");
                    setFilterSupplier("all");
                    setFilterShiftStatus("all");
                    setSearchTerm("");
                    setAppliedSearch("");
                    resetPage();
                  }}
                  data-testid="button-clear-filters"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={filterFinanceStatus} onValueChange={(val) => { setFilterFinanceStatus(val); resetPage(); }}>
              <SelectTrigger className="w-40" data-testid="select-finance-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Finance</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterShiftStatus} onValueChange={(val) => { setFilterShiftStatus(val); resetPage(); }}>
              <SelectTrigger className="w-40" data-testid="select-shift-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shift Status</SelectItem>
                <SelectItem value="booked_on">Booked On</SelectItem>
                <SelectItem value="booked_off">Booked Off</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">From:</Label>
              <Input
                type="date"
                value={draftDateFrom}
                onChange={(e) => setDraftDateFrom(e.target.value)}
                onBlur={applyDateFrom}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), applyDateFrom())}
                className="w-36"
                data-testid="input-date-from"
              />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
              <Input
                type="date"
                value={draftDateTo}
                onChange={(e) => setDraftDateTo(e.target.value)}
                onBlur={applyDateTo}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), applyDateTo())}
                className="w-36"
                data-testid="input-date-to"
              />
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shifts, officers, sites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onBlur={applySearch}
                onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), applySearch())}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>

          {(showAdvancedFilters || hasAdvancedFilters) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Client</Label>
                <SearchableSelect
                  value={filterClient}
                  onValueChange={(val) => { setFilterClient(val); resetPage(); }}
                  options={clients.map((c) => ({ value: String(c.id), label: c.name }))}
                  noneValue="all"
                  noneLabel="All Clients"
                  placeholder="All Clients"
                  searchPlaceholder="Search clients…"
                  triggerClassName="w-full"
                  data-testid="select-client-filter"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Officer</Label>
                <SearchableSelect
                  value={filterOfficer}
                  onValueChange={(val) => { setFilterOfficer(val); resetPage(); }}
                  options={officers.map((o) => ({ value: String(o.id), label: o.name }))}
                  noneValue="all"
                  noneLabel="All Officers"
                  placeholder="All Officers"
                  searchPlaceholder="Search officers…"
                  triggerClassName="w-full"
                  data-testid="select-officer-filter"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Supplier</Label>
                <SearchableSelect
                  value={filterSupplier}
                  onValueChange={(val) => { setFilterSupplier(val); resetPage(); }}
                  options={supplierOptions}
                  noneValue="all"
                  noneLabel="All Suppliers"
                  placeholder="All Suppliers"
                  searchPlaceholder="Search suppliers…"
                  triggerClassName="w-full"
                  data-testid="select-supplier-filter"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Location</Label>
                <SearchableSelect
                  value={filterSite}
                  onValueChange={(val) => { setFilterSite(val); resetPage(); }}
                  options={sites.map((site) => ({ value: String(site.id), label: site.name }))}
                  noneValue="all"
                  noneLabel="All Locations"
                  placeholder="All Locations"
                  searchPlaceholder="Search locations…"
                  triggerClassName="w-full"
                  data-testid="select-site-filter"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#1F3A5F]/5 dark:bg-[#1F3A5F]/20 border border-[#1F3A5F]/20 rounded-lg flex-wrap" data-testid="bulk-action-bar">
          <span className="text-sm font-medium">{selectedIds.size} shift{selectedIds.size > 1 ? "s" : ""} selected</span>
          <Separator orientation="vertical" className="h-6" />
          {canEditFields && (
            <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)} data-testid="button-bulk-edit">
              <Pencil className="w-3 h-3 mr-1" />
              Bulk Update Fields
            </Button>
          )}
          <Button size="sm" onClick={handleBulkApprove} disabled={bulkApproveMutation.isPending} className="bg-green-600 hover:bg-green-700" data-testid="button-bulk-approve">
            {bulkApproveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
            Approve Selected
          </Button>
          <Button size="sm" variant="destructive" onClick={handleBulkReject} disabled={bulkRejectMutation.isPending} data-testid="button-bulk-reject">
            {bulkRejectMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
            Reject Selected
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())} data-testid="button-clear-selection">
            Clear
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {shifts.length === 0 ? (
            <div className="p-8 text-center">
              <Shield className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold">No shifts to review</h3>
              <p className="text-sm text-muted-foreground">
                {filterFinanceStatus === "pending" ? "All shifts have been reviewed. Great work!" : "No shifts match the current filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="finance-approval-table">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left w-10">
                      <Checkbox
                        checked={selectedIds.size === shifts.length && shifts.length > 0}
                        onCheckedChange={toggleSelectAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Date & Time</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Officer</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Site</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Supplier</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Hours</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Break</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Holiday hrs</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Late hrs</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Deduction</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Pay rate</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">Charge rate</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Shift Status</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Finance</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => {
                    const financeConf = FINANCE_STATUS_CONFIG[(shift.financeStatus || "pending")] || FINANCE_STATUS_CONFIG.pending;
                    const shiftConf = SHIFT_STATUS_CONFIG[shift.status || "scheduled"] || SHIFT_STATUS_CONFIG.scheduled;
                    const isLate = (shift.lateHours ?? 0) > 0 || (shift.lateMinutes || 0) > 0;
                    const isPending = !shift.financeStatus || shift.financeStatus === "pending";

                    return (
                      <tr key={shift.id} className={`border-b hover:bg-muted/20 transition-colors ${isLate ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}`} data-testid={`row-shift-${shift.id}`}>
                        <td className="p-3">
                          <Checkbox
                            checked={selectedIds.has(shift.id)}
                            onCheckedChange={() => toggleSelect(shift.id)}
                            data-testid={`checkbox-shift-${shift.id}`}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {formatShiftDate(shift.date)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatShiftTime(shift.startTime)} – {formatShiftTime(shift.endTime)}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-xs">
                            <Users className="w-3 h-3 text-muted-foreground" />
                            <span data-testid={`text-officer-${shift.id}`}>{shift.employeeName || "Unassigned"}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-xs">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span data-testid={`text-site-${shift.id}`}>{shift.siteName || "—"}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs" data-testid={`text-supplier-${shift.id}`}>
                          {shift.supplierName?.trim() || inhouseLabel}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs" data-testid={`text-hours-${shift.id}`}>
                          {fmtNum(shiftDisplayHours(shift))}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs" data-testid={`text-break-${shift.id}`}>
                          {canEditFields ? (
                            <FinanceNumInput
                              value={shift.breakMinutes ?? 0}
                              step="1"
                              min="0"
                              suffix="m"
                              testId={`input-break-${shift.id}`}
                              onSave={(n) => saveField(shift.id, "breakMinutes", n ?? 0)}
                              disabled={updateFieldsMutation.isPending}
                            />
                          ) : (
                            (shift.breakMinutes || 0) > 0 ? `${shift.breakMinutes}m` : "—"
                          )}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs" data-testid={`text-holiday-hours-${shift.id}`}>
                          {canEditFields ? (
                            <FinanceNumInput
                              value={shift.holidayHours ?? 0}
                              testId={`input-holiday-${shift.id}`}
                              onSave={(n) => saveField(shift.id, "holidayHours", n ?? 0)}
                              disabled={updateFieldsMutation.isPending}
                            />
                          ) : (
                            fmtNum(shift.holidayHours ?? 0)
                          )}
                        </td>
                        <td className={`p-3 text-right tabular-nums text-xs ${(shift.lateHours ?? 0) > 0 ? "text-amber-600" : ""}`} data-testid={`text-late-hours-${shift.id}`}>
                          {canEditFields ? (
                            <FinanceNumInput
                              value={shift.lateHours ?? 0}
                              testId={`input-late-hours-${shift.id}`}
                              onSave={(n) => saveField(shift.id, "lateHours", n ?? 0)}
                              disabled={updateFieldsMutation.isPending}
                            />
                          ) : (
                            fmtNum(shift.lateHours ?? 0)
                          )}
                        </td>
                        <td className={`p-3 text-right tabular-nums text-xs ${(shift.deductionAmount ?? 0) > 0 ? "text-red-600" : ""}`} data-testid={`text-deduction-${shift.id}`}>
                          {canEditFields ? (
                            <FinanceNumInput
                              value={shift.deductionHours ?? 0}
                              min="-999"
                              testId={`input-deduction-${shift.id}`}
                              onSave={(n) => saveField(shift.id, "deductionHours", n ?? 0)}
                              disabled={updateFieldsMutation.isPending}
                            />
                          ) : (shift.deductionAmount ?? 0) > 0
                            ? `£${fmtNum(shift.deductionAmount)}`
                            : fmtNum(shift.deductionHours ?? 0)}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs" data-testid={`text-pay-rate-${shift.id}`}>
                          {canEditFields ? (
                            <FinanceNumInput
                              value={shift.payRate ?? null}
                              prefix="£"
                              testId={`input-pay-rate-${shift.id}`}
                              onSave={(n) => saveField(shift.id, "payRate", n)}
                              disabled={updateFieldsMutation.isPending}
                            />
                          ) : shift.payRate == null || Number.isNaN(Number(shift.payRate))
                            ? "—"
                            : `£${fmtNum(shift.payRate)}`}
                        </td>
                        <td className="p-3 text-right tabular-nums text-xs" data-testid={`text-charge-rate-${shift.id}`}>
                          {canEditFields ? (
                            <FinanceNumInput
                              value={shift.chargeRate ?? null}
                              prefix="£"
                              testId={`input-charge-rate-${shift.id}`}
                              onSave={(n) => saveField(shift.id, "chargeRate", n)}
                              disabled={updateFieldsMutation.isPending}
                            />
                          ) : shift.chargeRate == null || Number.isNaN(Number(shift.chargeRate))
                            ? "—"
                            : `£${fmtNum(shift.chargeRate)}`}
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={`text-[10px] ${shiftConf.className}`} data-testid={`badge-shift-status-${shift.id}`}>
                            {shiftConf.label}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <Badge variant="secondary" className={`text-[10px] ${financeConf.className}`} data-testid={`badge-finance-${shift.id}`}>
                            {financeConf.label}
                          </Badge>
                          {shift.financeNote && (
                            <div className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[120px]" title={shift.financeNote}>
                              {shift.financeNote}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {isPending ? (
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Approve"
                                onClick={() => singleApproveMutation.mutate(shift.id)}
                                disabled={singleApproveMutation.isPending}
                                data-testid={`button-approve-${shift.id}`}
                              >
                                {singleApproveMutation.isPending
                                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  : <CheckCircle2 className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Reject"
                                onClick={() => handleSingleReject(shift.id)}
                                data-testid={`button-reject-${shift.id}`}
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between" data-testid="pagination-controls">
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPage(p => Math.max(1, p - 1)); setSelectedIds(new Set()); }}
            disabled={page <= 1}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Previous
          </Button>
          <span className="text-sm text-muted-foreground" data-testid="text-page-info">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} shifts · Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setSelectedIds(new Set()); }}
            disabled={page >= totalPages}
            data-testid="button-next-page"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      <div className="p-3 bg-muted/30 rounded-lg border">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium mb-1">Shift Finance Approval Rules</p>
            <ul className="space-y-0.5 list-disc ml-4">
              <li>Only shifts that have been booked on and booked off (or verified/completed) appear for finance review</li>
              <li>Shifts with no book-on remain as "scheduled" or "missed" and are not eligible for invoicing</li>
              <li>Late shifts are highlighted when Late hrs is greater than zero</li>
              <li>Account/admin can edit Break, Holiday hrs, Late hrs, Deduction, Pay rate, and Charge rate</li>
              <li>Select multiple shifts and use Bulk Update Fields to apply the same values</li>
              <li>Rejected shifts require a reason and will not be included in invoices or payroll</li>
              <li>Only approved shifts can be invoiced to clients or paid to officers</li>
            </ul>
          </div>
        </div>
      </div>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" />
              Reject {rejectTarget === "bulk" ? `${selectedIds.size} Shift${selectedIds.size > 1 ? "s" : ""}` : "Shift"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Please provide a reason for rejecting {rejectTarget === "bulk" ? "these shifts" : "this shift"}. Rejected shifts will not be included in invoices or payroll.
            </p>
            <div className="space-y-2">
              <Label htmlFor="reject-note">Rejection Reason *</Label>
              <Textarea
                id="reject-note"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="e.g. Officer did not complete full shift, Timesheet discrepancy..."
                rows={3}
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectNote(""); }} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmReject}
              disabled={!rejectNote.trim() || bulkRejectMutation.isPending || singleRejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              {(bulkRejectMutation.isPending || singleRejectMutation.isPending) ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Rejecting...</>
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkEditOpen} onOpenChange={setBulkEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              Bulk update {selectedIds.size} shift{selectedIds.size === 1 ? "" : "s"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Leave a field blank to keep existing values. Only filled fields are applied.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="bulk-break">Break (minutes)</Label>
              <Input
                id="bulk-break"
                type="number"
                min={0}
                step={1}
                value={bulkEdit.breakMinutes}
                onChange={(e) => setBulkEdit((p) => ({ ...p, breakMinutes: e.target.value }))}
                data-testid="input-bulk-break"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-holiday">Holiday hrs</Label>
              <Input
                id="bulk-holiday"
                type="number"
                min={0}
                step={0.01}
                value={bulkEdit.holidayHours}
                onChange={(e) => setBulkEdit((p) => ({ ...p, holidayHours: e.target.value }))}
                data-testid="input-bulk-holiday"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-deduction">Deduction hrs</Label>
              <Input
                id="bulk-deduction"
                type="number"
                step={0.01}
                value={bulkEdit.deductionHours}
                onChange={(e) => setBulkEdit((p) => ({ ...p, deductionHours: e.target.value }))}
                data-testid="input-bulk-deduction"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-late-hours">Late hrs</Label>
              <Input
                id="bulk-late-hours"
                type="number"
                min={0}
                step={0.01}
                value={bulkEdit.lateHours}
                onChange={(e) => setBulkEdit((p) => ({ ...p, lateHours: e.target.value }))}
                data-testid="input-bulk-late-hours"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-pay">Pay rate (£)</Label>
              <Input
                id="bulk-pay"
                type="number"
                min={0}
                step={0.01}
                value={bulkEdit.payRate}
                onChange={(e) => setBulkEdit((p) => ({ ...p, payRate: e.target.value }))}
                data-testid="input-bulk-pay"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bulk-charge">Charge rate (£)</Label>
              <Input
                id="bulk-charge"
                type="number"
                min={0}
                step={0.01}
                value={bulkEdit.chargeRate}
                onChange={(e) => setBulkEdit((p) => ({ ...p, chargeRate: e.target.value }))}
                data-testid="input-bulk-charge"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkEditOpen(false)} data-testid="button-cancel-bulk-edit">
              Cancel
            </Button>
            <Button
              onClick={handleBulkEditApply}
              disabled={bulkUpdateMutation.isPending || selectedIds.size === 0}
              data-testid="button-apply-bulk-edit"
            >
              {bulkUpdateMutation.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Updating...</>
              ) : (
                "Apply to selected"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
