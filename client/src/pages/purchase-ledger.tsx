import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BookOpen, Plus, Download, FileDown, Pencil, Trash2, Loader2,
  Search, X, AlertTriangle, CheckCircle2, Filter, Calendar,
  PoundSterling, Receipt, Building2, FileText, RefreshCw, Upload,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

const EXPENSE_CATEGORIES = [
  "Software & Subscriptions", "Office Supplies", "Travel & Transport", "Insurance",
  "Professional Services", "Utilities", "Vehicle Costs", "Marketing & Advertising",
  "Training", "Telecommunications", "Rent & Rates", "Wages & Salaries",
  "Labour (Sub-Contractors)", "Other",
];

const VAT_RATES = ["0", "5", "20"];

const SOURCE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  supplier_invoice: {
    label: "Supplier Invoice",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    icon: <Receipt className="w-3 h-3" />,
  },
  bank_general_purchase: {
    label: "Bank Purchase",
    color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    icon: <Building2 className="w-3 h-3" />,
  },
  manual: {
    label: "Bank Feed",
    color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    icon: <Pencil className="w-3 h-3" />,
  },
  financial_document: {
    label: "Document/Receipt",
    color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
    icon: <FileText className="w-3 h-3" />,
  },
};

function formatGBP(val: string | number | null | undefined) {
  const n = parseFloat(String(val || "0"));
  if (isNaN(n)) return "£0.00";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// VAT stagger (matches VAT Return / Remittance / Audit pages):
// Q1 = Nov–Jan, Q2 = Feb–Apr, Q3 = May–Jul, Q4 = Aug–Oct.
// The `year` is the year in which the quarter ENDS (e.g. Q1 of 2022 = Nov 2021 – Jan 2022).
function vatQuarterDates(year: number, quarter: number): { from: string; to: string } {
  let startMonth: number, startYear: number, endMonth: number, endYear: number;
  if (quarter === 1) { startMonth = 11; startYear = year - 1; endMonth = 1; endYear = year; }
  else if (quarter === 2) { startMonth = 2; startYear = year; endMonth = 4; endYear = year; }
  else if (quarter === 3) { startMonth = 5; startYear = year; endMonth = 7; endYear = year; }
  else { startMonth = 8; startYear = year; endMonth = 10; endYear = year; }

  const from = `${startYear}-${String(startMonth).padStart(2, "0")}-01`;
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const to = `${endYear}-${String(endMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function getCurrentVatQuarter(): { year: number; quarter: number } {
  const now = new Date();
  const month = now.getMonth() + 1;
  const calYear = now.getFullYear();
  // Q1 (Nov–Jan): Nov & Dec belong to next year's Q1; Jan belongs to this year's Q1.
  if (month === 11 || month === 12) return { year: calYear + 1, quarter: 1 };
  if (month === 1) return { year: calYear, quarter: 1 };
  if (month >= 2 && month <= 4) return { year: calYear, quarter: 2 };
  if (month >= 5 && month <= 7) return { year: calYear, quarter: 3 };
  return { year: calYear, quarter: 4 }; // Aug–Oct
}

const EMPTY_FORM = {
  purchaseDate: "",
  vendorName: "",
  vendorVatNumber: "",
  description: "",
  netAmount: "",
  vatRate: "20",
  vatAmount: "",
  grossAmount: "",
  expenseCategory: "",
  vatStatus: "standard",
  paymentStatus: "unpaid",
  bankReference: "",
  receiptUrl: "",
  notes: "",
};

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PurchaseLedgerPage() {
  const { toast } = useToast();

  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [showImportConfirm, setShowImportConfirm] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);

  const [periodMode, setPeriodMode] = useState<"all" | "quarter" | "custom">("all");
  const { year: curYear, quarter: curQ } = getCurrentVatQuarter();
  const [selectedYear, setSelectedYear] = useState(curYear);
  const [selectedQuarter, setSelectedQuarter] = useState(curQ);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [dupWarning, setDupWarning] = useState<any>(null);
  const [forceCreate, setForceCreate] = useState(false);

  const ALL_TIME_FROM = "2000-01-01";
  const ALL_TIME_TO = "2100-12-31";
  const computedDateFrom = periodMode === "all"
    ? ALL_TIME_FROM
    : periodMode === "quarter"
    ? vatQuarterDates(selectedYear, selectedQuarter).from
    : dateFrom;
  const computedDateTo = periodMode === "all"
    ? ALL_TIME_TO
    : periodMode === "quarter"
    ? vatQuarterDates(selectedYear, selectedQuarter).to
    : dateTo;

  const periodLabel = periodMode === "all"
    ? "All time"
    : periodMode === "quarter"
    ? `Q${selectedQuarter} ${selectedYear}`
    : (computedDateFrom && computedDateTo ? `${formatDate(computedDateFrom)} – ${formatDate(computedDateTo)}` : "Custom");

  const { data: ledgerData, isLoading, refetch } = useQuery<any>({
    queryKey: ["/api/purchase-ledger", computedDateFrom, computedDateTo, sourceFilter, search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (computedDateFrom) params.set("dateFrom", computedDateFrom);
      if (computedDateTo) params.set("dateTo", computedDateTo);
      if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/purchase-ledger?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch ledger");
      return res.json();
    },
    enabled: !!(computedDateFrom && computedDateTo),
  });

  const entries: any[] = ledgerData?.entries || [];
  const totals = ledgerData?.totals || { net: 0, vat: 0, gross: 0 };
  const vatReconciliation = ledgerData?.vatReconciliation || null;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const pagedEntries = entries.slice(pageStart, pageStart + pageSize);

  useEffect(() => {
    setPage(1);
  }, [computedDateFrom, computedDateTo, sourceFilter, search, pageSize]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/purchase-ledger/manual", data);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.duplicateWarning) {
        setDupWarning(data.duplicateWarning);
      } else {
        toast({ title: "Purchase added", description: "Manual purchase entry has been recorded." });
        setShowAddDialog(false);
        setForm({ ...EMPTY_FORM });
        queryClient.invalidateQueries({ queryKey: ["/api/purchase-ledger"] });
      }
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/purchase-ledger/manual/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Updated", description: "Manual purchase entry has been updated." });
      setEditEntry(null);
      setForm({ ...EMPTY_FORM });
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-ledger"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/purchase-ledger/manual/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Manual purchase entry has been removed." });
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-ledger"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const handleFormChange = (field: string, value: string) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "netAmount" || field === "vatRate") {
        const net = parseFloat(next.netAmount || "0");
        const rate = parseFloat(next.vatRate || "0");
        if (!isNaN(net) && !isNaN(rate)) {
          const vat = Math.round(net * rate / 100 * 100) / 100;
          next.vatAmount = vat.toFixed(2);
          next.grossAmount = (net + vat).toFixed(2);
        }
      }
      if (field === "vatAmount" && next.netAmount) {
        const net = parseFloat(next.netAmount || "0");
        const vat = parseFloat(value || "0");
        if (!isNaN(net) && !isNaN(vat)) {
          next.grossAmount = (net + vat).toFixed(2);
        }
      }
      return next;
    });
  };

  const handleSubmitForm = (force = false) => {
    if (!form.purchaseDate || !form.vendorName || !form.description || !form.netAmount) {
      toast({ title: "Required fields missing", variant: "destructive" });
      return;
    }
    const payload = {
      ...form,
      netAmount: parseFloat(form.netAmount).toFixed(2),
      vatRate: parseFloat(form.vatRate || "0").toFixed(2),
      vatAmount: parseFloat(form.vatAmount || "0").toFixed(2),
      grossAmount: parseFloat(form.grossAmount || form.netAmount).toFixed(2),
      force,
    };
    if (editEntry) {
      updateMutation.mutate({ id: editEntry.source_id, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleSaveAnyway = () => {
    setDupWarning(null);
    setForceCreate(true);
    handleSubmitForm(true);
  };

  const openEdit = (entry: any) => {
    setEditEntry(entry);
    setForceCreate(false);
    setDupWarning(null);
    setForm({
      purchaseDate: entry.purchase_date?.toString().substring(0, 10) || "",
      vendorName: entry.vendor_name || "",
      vendorVatNumber: entry.vendor_vat_number || "",
      description: entry.description || "",
      netAmount: parseFloat(entry.net_amount || "0").toFixed(2),
      vatRate: parseFloat(entry.vat_rate || "0").toFixed(0),
      vatAmount: parseFloat(entry.vat_amount || "0").toFixed(2),
      grossAmount: parseFloat(entry.gross_amount || "0").toFixed(2),
      expenseCategory: entry.expense_category || "",
      vatStatus: entry.vat_status || "standard",
      paymentStatus: entry.payment_status || "unpaid",
      bankReference: entry.bank_reference || "",
      receiptUrl: entry.receipt_url || "",
      notes: entry.notes || "",
    });
    setShowAddDialog(true);
  };

  const yearsStart = 2021;
  const yearsEnd = Math.max(curYear + 1, yearsStart);
  const years = Array.from({ length: yearsEnd - yearsStart + 1 }, (_, i) => yearsEnd - i);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (computedDateFrom) params.set("dateFrom", computedDateFrom);
    if (computedDateTo) params.set("dateTo", computedDateTo);
    if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
    if (search) params.set("search", search);
    params.set("period", periodLabel);
    window.open(`/api/purchase-ledger/export/csv?${params}`, "_blank");
  };

  const handleExportPdf = () => {
    const params = new URLSearchParams();
    if (computedDateFrom) params.set("dateFrom", computedDateFrom);
    if (computedDateTo) params.set("dateTo", computedDateTo);
    if (sourceFilter && sourceFilter !== "all") params.set("source", sourceFilter);
    if (search) params.set("search", search);
    params.set("period", periodLabel);
    window.open(`/api/purchase-ledger/export/pdf?${params}`, "_blank");
  };

  const importMutation = useMutation({
    mutationFn: async (opts?: { replaceMode?: boolean }) => {
      const res = await apiRequest("POST", "/api/purchase-ledger/import-ledger-csv", { replaceMode: opts?.replaceMode === true });
      return res.json();
    },
    onSuccess: (data) => {
      setImportResult(data.summary);
      setShowImportConfirm(false);
      setShowImportDialog(true);
      queryClient.invalidateQueries({ queryKey: ["/api/purchase-ledger"] });
      toast({ title: "Import complete", description: "Purchase ledger CSV has been processed." });
    },
    onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const isDialogOpen = showAddDialog || !!editEntry;
  const isFormPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1F3A5F, #FF8C42)" }}
          >
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Purchase Ledger</h1>
            <p className="text-sm text-muted-foreground">
              Consolidated HMRC purchase ledger — supplier invoices, bank purchases, bank feed &amp; receipts
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-1.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf} data-testid="button-export-pdf">
            <FileDown className="w-4 h-4 mr-1.5" /> PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setReplaceMode(false); setShowImportConfirm(true); }}
            disabled={importMutation.isPending}
            data-testid="button-import-csv"
          >
            {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            Sync from CSV
          </Button>
          <Button size="sm" onClick={() => { setEditEntry(null); setForm({ ...EMPTY_FORM }); setShowAddDialog(true); }} data-testid="button-add-manual">
            <Plus className="w-4 h-4 mr-1.5" /> Add Manual Purchase
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Period Mode</Label>
              <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as any)}>
                <SelectTrigger className="w-36" data-testid="select-period-mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="quarter">VAT Quarter</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {periodMode === "quarter" ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Year</Label>
                  <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                    <SelectTrigger className="w-24" data-testid="select-year">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Quarter</Label>
                  <Select value={String(selectedQuarter)} onValueChange={(v) => setSelectedQuarter(parseInt(v))}>
                    <SelectTrigger className="w-32" data-testid="select-quarter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Q1 (Nov–Jan)</SelectItem>
                      <SelectItem value="2">Q2 (Feb–Apr)</SelectItem>
                      <SelectItem value="3">Q3 (May–Jul)</SelectItem>
                      <SelectItem value="4">Q4 (Aug–Oct)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : periodMode === "custom" ? (
              <>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">From</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" data-testid="input-date-from" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">To</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" data-testid="input-date-to" />
                </div>
              </>
            ) : null}

            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Source</Label>
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-44" data-testid="select-source-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="supplier_invoice">Supplier Invoices</SelectItem>
                  <SelectItem value="bank_general_purchase">Bank Purchases</SelectItem>
                  <SelectItem value="manual">Bank Feed</SelectItem>
                  <SelectItem value="financial_document">Documents/Receipts</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Vendor, description..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-search"
                />
              </div>
            </div>

            {search && (
              <Button variant="ghost" size="icon" onClick={() => setSearch("")}>
                <X className="h-4 w-4" />
              </Button>
            )}

            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {vatReconciliation && (
        <Alert className={vatReconciliation.reconciled ? "border-green-200 bg-green-50 dark:bg-green-900/10" : "border-amber-200 bg-amber-50 dark:bg-amber-900/10"}>
          <div className="flex items-center gap-2">
            {vatReconciliation.reconciled
              ? <CheckCircle2 className="w-4 h-4 text-green-600" />
              : <AlertTriangle className="w-4 h-4 text-amber-600" />}
            <AlertDescription className="text-sm">
              <strong>VAT Reconciliation:</strong>{" "}
              Ledger input VAT <strong>{formatGBP(totals.vat)}</strong>
              {vatReconciliation.vatReturnInputVat != null && (
                <>
                  {" · "}VAT Return input VAT <strong>{formatGBP(vatReconciliation.vatReturnInputVat)}</strong>
                  {vatReconciliation.reconciled
                    ? " — ✓ Reconciled"
                    : ` — ⚠ Difference: ${formatGBP(vatReconciliation.difference)}`}
                </>
              )}
            </AlertDescription>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Net</p>
                <p className="text-xl font-bold" data-testid="text-total-net">{formatGBP(totals.net)}</p>
              </div>
              <PoundSterling className="h-7 w-7 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Input VAT</p>
                <p className="text-xl font-bold text-blue-600" data-testid="text-total-vat">{formatGBP(totals.vat)}</p>
              </div>
              <Receipt className="h-7 w-7 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Gross</p>
                <p className="text-xl font-bold" data-testid="text-total-gross">{formatGBP(totals.gross)}</p>
              </div>
              <BookOpen className="h-7 w-7 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              Ledger Entries — {periodLabel}
            </CardTitle>
            <span className="text-sm text-muted-foreground" data-testid="text-entry-count">
              {isLoading ? "Loading…" : `${entries.length} entries`}
            </span>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!computedDateFrom || !computedDateTo ? (
            <div className="p-8 text-center text-muted-foreground">
              <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Select a period to view the ledger</p>
            </div>
          ) : isLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Loading ledger entries…</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>No purchase entries found for the selected period.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-ledger">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap">Vendor / Supplier</th>
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">VAT No.</th>
                    <th className="p-3 text-left font-medium text-muted-foreground">Description</th>
                    <th className="p-3 text-left font-medium text-muted-foreground hidden lg:table-cell">Category</th>
                    <th className="p-3 text-right font-medium text-muted-foreground whitespace-nowrap">Net</th>
                    <th className="p-3 text-right font-medium text-muted-foreground whitespace-nowrap">VAT%</th>
                    <th className="p-3 text-right font-medium text-muted-foreground whitespace-nowrap">VAT</th>
                    <th className="p-3 text-right font-medium text-muted-foreground whitespace-nowrap">Gross</th>
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">VAT Status</th>
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">Payment</th>
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap hidden xl:table-cell">Bank Ref</th>
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap">Source</th>
                    <th className="p-3 text-left font-medium text-muted-foreground whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedEntries.map((entry: any, idx: number) => {
                    const srcConf = SOURCE_CONFIG[entry.source] || { label: entry.source, color: "bg-gray-100 text-gray-700", icon: null };
                    const isManual = entry.source === "manual";
                    const vatStatusLabel: Record<string, string> = {
                      standard: "Standard", zero: "Zero", exempt: "Exempt",
                      reverse_charge: "Rev.Charge", unknown: "—",
                    };
                    return (
                      <tr
                        key={entry.entry_id}
                        className={`border-b last:border-0 ${idx % 2 === 0 ? "" : "bg-muted/20"} ${isManual ? "font-medium" : ""}`}
                        data-testid={`row-entry-${entry.entry_id}`}
                      >
                        <td className="p-3 whitespace-nowrap text-muted-foreground" data-testid={`text-date-${entry.entry_id}`}>
                          {formatDate(entry.purchase_date)}
                        </td>
                        <td className="p-3 font-medium" data-testid={`text-vendor-${entry.entry_id}`}>
                          {entry.vendor_name}
                        </td>
                        <td className="p-3 text-muted-foreground hidden md:table-cell text-xs" data-testid={`text-vatno-${entry.entry_id}`}>
                          {entry.vendor_vat_number || "—"}
                        </td>
                        <td className="p-3 text-muted-foreground max-w-[200px]" data-testid={`text-desc-${entry.entry_id}`}>
                          <div className="truncate">{entry.description}</div>
                          {entry.receipt_url && (
                            <a
                              href={entry.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:underline text-xs flex items-center gap-1 mt-0.5"
                              data-testid={`link-receipt-${entry.entry_id}`}
                            >
                              <FileText className="w-3 h-3" /> Receipt
                            </a>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground hidden lg:table-cell text-xs" data-testid={`text-cat-${entry.entry_id}`}>
                          {entry.expense_category || "—"}
                        </td>
                        <td className="p-3 text-right font-medium" data-testid={`text-net-${entry.entry_id}`}>
                          {formatGBP(entry.net_amount)}
                        </td>
                        <td className="p-3 text-right text-muted-foreground text-xs" data-testid={`text-vatrate-${entry.entry_id}`}>
                          {parseFloat(entry.vat_rate || "0").toFixed(0)}%
                        </td>
                        <td className="p-3 text-right text-blue-600" data-testid={`text-vat-${entry.entry_id}`}>
                          {formatGBP(entry.vat_amount)}
                        </td>
                        <td className="p-3 text-right font-semibold" data-testid={`text-gross-${entry.entry_id}`}>
                          {formatGBP(entry.gross_amount)}
                        </td>
                        <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground" data-testid={`text-vatstatus-${entry.entry_id}`}>
                          {vatStatusLabel[entry.vat_status] || entry.vat_status || "—"}
                        </td>
                        <td className="p-3 hidden xl:table-cell" data-testid={`text-status-${entry.entry_id}`}>
                          <Badge
                            variant="outline"
                            className={`text-xs ${entry.payment_status === "paid" ? "border-green-300 text-green-700" : "border-amber-300 text-amber-700"}`}
                          >
                            {entry.payment_status || "—"}
                          </Badge>
                        </td>
                        <td className="p-3 hidden xl:table-cell text-xs text-muted-foreground" data-testid={`text-bankref-${entry.entry_id}`}>
                          {entry.bank_reference || "—"}
                        </td>
                        <td className="p-3" data-testid={`text-source-${entry.entry_id}`}>
                          <Badge className={`text-xs gap-1 ${srcConf.color}`}>
                            {srcConf.icon}
                            {srcConf.label}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {isManual && (
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                onClick={() => openEdit(entry)}
                                data-testid={`button-edit-${entry.entry_id}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                onClick={() => setDeleteConfirm(entry)}
                                data-testid={`button-delete-${entry.entry_id}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold bg-muted/40">
                    <td className="p-3" colSpan={5}>Totals — all {entries.length} entries</td>
                    <td className="p-3 text-right" data-testid="text-footer-net">{formatGBP(totals.net)}</td>
                    <td className="p-3" />
                    <td className="p-3 text-right text-blue-600" data-testid="text-footer-vat">{formatGBP(totals.vat)}</td>
                    <td className="p-3 text-right" data-testid="text-footer-gross">{formatGBP(totals.gross)}</td>
                    <td className="p-3" colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {entries.length > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t p-3" data-testid="pagination-controls">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span data-testid="text-pagination-range">
                  Showing {pageStart + 1}–{Math.min(pageStart + pageSize, entries.length)} of {entries.length}
                </span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(parseInt(v))}>
                  <SelectTrigger className="h-8 w-[110px]" data-testid="select-page-size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100, 200].map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(1)} data-testid="button-page-first">
                  <ChevronsLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} data-testid="button-page-prev">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="px-2 text-sm whitespace-nowrap" data-testid="text-page-indicator">
                  Page {currentPage} of {totalPages}
                </span>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} data-testid="button-page-next">
                  <ChevronRight className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" disabled={currentPage >= totalPages} onClick={() => setPage(totalPages)} data-testid="button-page-last">
                  <ChevronsRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) { setShowAddDialog(false); setEditEntry(null); setForm({ ...EMPTY_FORM }); setDupWarning(null); }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">
              {editEntry ? "Edit Manual Purchase" : "Add Manual Purchase"}
            </DialogTitle>
            <DialogDescription>
              {editEntry
                ? "Update this manually entered purchase record."
                : "Enter a purchase that isn't already captured from a bank statement or supplier invoice."}
            </DialogDescription>
          </DialogHeader>

          {dupWarning && (
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-900/10">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <AlertDescription className="text-sm">
                <strong>Possible duplicate detected:</strong> A bank transaction on {formatDate(dupWarning.transactionDate)} for {formatGBP(dupWarning.amount)} (<em>{dupWarning.description}</em>) may already capture this purchase. If this is a different expense, click "Save Anyway" to record it.
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleSaveAnyway}
                    data-testid="button-save-anyway"
                  >
                    Save Anyway
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setDupWarning(null); setShowAddDialog(false); setEditEntry(null); setForm({ ...EMPTY_FORM }); }}
                    data-testid="button-cancel-dup"
                  >
                    Cancel
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={form.purchaseDate}
                  onChange={(e) => handleFormChange("purchaseDate", e.target.value)}
                  data-testid="input-purchase-date"
                />
              </div>
              <div>
                <Label className="text-xs">Payment Status</Label>
                <Select value={form.paymentStatus} onValueChange={(v) => handleFormChange("paymentStatus", v)}>
                  <SelectTrigger data-testid="select-payment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="unpaid">Unpaid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Vendor / Supplier Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.vendorName}
                onChange={(e) => handleFormChange("vendorName", e.target.value)}
                placeholder="e.g. Office Depot Ltd"
                data-testid="input-vendor-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vendor VAT Number</Label>
                <Input
                  value={form.vendorVatNumber}
                  onChange={(e) => handleFormChange("vendorVatNumber", e.target.value)}
                  placeholder="GB123456789"
                  data-testid="input-vendor-vat-number"
                />
              </div>
              <div>
                <Label className="text-xs">VAT Status</Label>
                <Select value={form.vatStatus} onValueChange={(v) => handleFormChange("vatStatus", v)}>
                  <SelectTrigger data-testid="select-vat-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Rate</SelectItem>
                    <SelectItem value="zero">Zero Rated</SelectItem>
                    <SelectItem value="exempt">Exempt</SelectItem>
                    <SelectItem value="reverse_charge">Reverse Charge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Description <span className="text-red-500">*</span></Label>
              <Input
                value={form.description}
                onChange={(e) => handleFormChange("description", e.target.value)}
                placeholder="Brief description of the purchase"
                data-testid="input-description"
              />
            </div>

            <div>
              <Label className="text-xs">Expense Category</Label>
              <Select value={form.expenseCategory} onValueChange={(v) => handleFormChange("expenseCategory", v)}>
                <SelectTrigger data-testid="select-expense-category">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Net Amount (£) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.netAmount}
                  onChange={(e) => handleFormChange("netAmount", e.target.value)}
                  placeholder="0.00"
                  data-testid="input-net-amount"
                />
              </div>
              <div>
                <Label className="text-xs">VAT Rate</Label>
                <Select value={form.vatRate} onValueChange={(v) => handleFormChange("vatRate", v)}>
                  <SelectTrigger data-testid="select-vat-rate">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0%</SelectItem>
                    <SelectItem value="5">5%</SelectItem>
                    <SelectItem value="20">20%</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">VAT Amount (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.vatAmount}
                  onChange={(e) => handleFormChange("vatAmount", e.target.value)}
                  placeholder="0.00"
                  data-testid="input-vat-amount"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Gross Amount (£)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.grossAmount}
                  readOnly
                  className="bg-muted/50"
                  placeholder="0.00"
                  data-testid="input-gross-amount"
                />
              </div>
              <div>
                <Label className="text-xs">Bank Reference</Label>
                <Input
                  value={form.bankReference}
                  onChange={(e) => handleFormChange("bankReference", e.target.value)}
                  placeholder="e.g. CHQ 001234"
                  data-testid="input-bank-reference"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Receipt / Document URL</Label>
              <Input
                value={form.receiptUrl}
                onChange={(e) => handleFormChange("receiptUrl", e.target.value)}
                placeholder="https://... (link to scanned receipt or document)"
                data-testid="input-receipt-url"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Paste a link to a scanned receipt or upload document. Used as HMRC audit evidence.
              </p>
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => handleFormChange("notes", e.target.value)}
                placeholder="Optional notes for audit trail"
                rows={2}
                data-testid="input-notes"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setShowAddDialog(false); setEditEntry(null); setForm({ ...EMPTY_FORM }); setDupWarning(null); }}
              data-testid="button-cancel-form"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitForm}
              disabled={isFormPending}
              data-testid="button-submit-form"
            >
              {isFormPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editEntry ? "Save Changes" : "Add Purchase"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle data-testid="text-delete-dialog-title">Delete Manual Purchase</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the purchase from <strong>{deleteConfirm?.vendor_name}</strong> on {formatDate(deleteConfirm?.purchase_date)} for {formatGBP(deleteConfirm?.gross_amount)}?
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteMutation.mutate(deleteConfirm.source_id)}
              disabled={deleteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportConfirm} onOpenChange={(open) => { if (!open) setShowImportConfirm(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle data-testid="text-import-confirm-title">
              <Upload className="w-5 h-5 inline mr-2" style={{ color: "#1F3A5F" }} />
              Sync Purchase Ledger from CSV
            </DialogTitle>
            <DialogDescription>
              Re-running a sync is safe: rows already imported are skipped automatically.
              Matching uses date, supplier and gross amount, so corrected descriptions or
              minor supplier-name changes won't create duplicates.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="replace-mode"
                checked={replaceMode}
                onCheckedChange={(v) => setReplaceMode(v === true)}
                data-testid="checkbox-replace-mode"
              />
              <div className="space-y-1">
                <Label htmlFor="replace-mode" className="cursor-pointer font-medium">
                  Replace mode — wipe existing imported data first
                </Label>
                <p className="text-xs text-muted-foreground">
                  Deletes all previously imported purchases and wages for this tenant before
                  re-importing from the CSV. Manually-added entries are preserved.
                </p>
              </div>
            </div>
            {replaceMode && (
              <Alert variant="destructive" data-testid="alert-replace-warning">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  This permanently deletes all CSV-imported purchases and wages for this tenant,
                  then rebuilds them from the source file. This cannot be undone.
                </AlertDescription>
              </Alert>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportConfirm(false)} data-testid="button-cancel-import">
              Cancel
            </Button>
            <Button
              variant={replaceMode ? "destructive" : "default"}
              onClick={() => importMutation.mutate({ replaceMode })}
              disabled={importMutation.isPending}
              data-testid="button-confirm-import"
            >
              {importMutation.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
              {replaceMode ? "Wipe & Re-import" : "Start Sync"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showImportDialog} onOpenChange={(open) => { if (!open) setShowImportDialog(false); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle data-testid="text-import-result-title">
              <CheckCircle2 className="w-5 h-5 text-green-600 inline mr-2" />
              CSV Import Complete
            </DialogTitle>
            <DialogDescription>
              Purchase ledger data has been processed. Review the summary below.
            </DialogDescription>
          </DialogHeader>

          {importResult && (
            <div className="space-y-4">
              {importResult.replaceMode && (
                <Alert data-testid="alert-replace-summary">
                  <RefreshCw className="w-4 h-4" />
                  <AlertDescription>
                    Replace mode: removed {importResult.replaced?.purchases ?? 0} imported purchases
                    and {importResult.replaced?.wages ?? 0} wages entries before re-importing.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3 bg-green-50 dark:bg-green-900/10">
                  <p className="text-xs text-muted-foreground font-medium">General Purchases Added</p>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-import-purchases-count">
                    {importResult.generalPurchases?.created ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {importResult.generalPurchases?.skippedDuplicate ?? 0} duplicates
                    · {importResult.generalPurchases?.skippedChanged ?? 0} changed-row matches skipped
                    · Gross: {formatGBP(importResult.generalPurchases?.grossTotal)}
                  </p>
                </div>
                <div className="rounded-lg border p-3 bg-blue-50 dark:bg-blue-900/10">
                  <p className="text-xs text-muted-foreground font-medium">Wages Ledger Entries Added</p>
                  <p className="text-2xl font-bold text-blue-700 dark:text-blue-400" data-testid="text-import-wages-count">
                    {importResult.wages?.created ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {importResult.wages?.skippedDuplicate ?? 0} duplicates
                    · {importResult.wages?.skippedChanged ?? 0} changed-row matches skipped
                    · Gross: {formatGBP(importResult.wages?.grossTotal)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground font-medium">Skipped — Labour in System</p>
                  <p className="text-2xl font-bold" data-testid="text-import-labour-skipped">
                    {importResult.skippedLabourInSystem ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Already covered by self-billing</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground font-medium">Skipped — Fund Transfers</p>
                  <p className="text-2xl font-bold" data-testid="text-import-fund-skipped">
                    {importResult.skippedFundTransfer ?? 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Internal transfers (TOPUP ANNA etc.)</p>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-semibold mb-2">Review Files — Download &amp; Action Later</p>
                <div className="space-y-2">
                  {importResult.reviewFiles?.labourLike && (
                    <div className="flex items-center justify-between rounded border p-2.5">
                      <div>
                        <p className="text-sm font-medium">Labour-like suppliers (not in system)</p>
                        <p className="text-xs text-muted-foreground">
                          {importResult.reviewFiles.labourLike.count} rows · {formatGBP(importResult.reviewFiles.labourLike.grossTotal)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadCsv(importResult.reviewFiles.labourLike.csvContent, importResult.reviewFiles.labourLike.filename)}
                        data-testid="button-download-labour-like"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> Download
                      </Button>
                    </div>
                  )}
                  {importResult.reviewFiles?.creditInvoice && (
                    <div className="flex items-center justify-between rounded border p-2.5">
                      <div>
                        <p className="text-sm font-medium">Credit Invoice rows</p>
                        <p className="text-xs text-muted-foreground">
                          {importResult.reviewFiles.creditInvoice.count} rows · {formatGBP(importResult.reviewFiles.creditInvoice.grossTotal)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadCsv(importResult.reviewFiles.creditInvoice.csvContent, importResult.reviewFiles.creditInvoice.filename)}
                        data-testid="button-download-credit-invoices"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> Download
                      </Button>
                    </div>
                  )}
                  {importResult.reviewFiles?.blankSupplier && (
                    <div className="flex items-center justify-between rounded border p-2.5">
                      <div>
                        <p className="text-sm font-medium">Blank supplier rows</p>
                        <p className="text-xs text-muted-foreground">
                          {importResult.reviewFiles.blankSupplier.count} rows · {formatGBP(importResult.reviewFiles.blankSupplier.grossTotal)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadCsv(importResult.reviewFiles.blankSupplier.csvContent, importResult.reviewFiles.blankSupplier.filename)}
                        data-testid="button-download-blank-supplier"
                      >
                        <Download className="w-3.5 h-3.5 mr-1" /> Download
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 rounded p-2">
                Total rows in CSV: {importResult.totalDataRows ?? 0} · Re-running is safe — duplicates are automatically skipped.
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setShowImportDialog(false)} data-testid="button-close-import-result">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
