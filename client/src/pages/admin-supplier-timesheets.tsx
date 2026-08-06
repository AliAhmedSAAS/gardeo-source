import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Clock, MapPin, User, CheckCircle2, XCircle, AlertTriangle,
  FileText, Loader2, MessageSquare, Calendar, Filter,
  ChevronDown, ChevronUp, Building2, ChevronLeft, ChevronRight, CalendarRange,
  Download, Receipt, FileSpreadsheet,
} from "lucide-react";

type AdminTimesheetShift = {
  id: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  status: string;
  notes: string | null;
  siteName: string;
  siteCity: string;
  employeeName: string;
  supplierName: string;
  supplierApprovalStatus: string | null;
  supplierApprovalComment: string | null;
  supplierApprovedAt: string | null;
};

type PaginatedResponse = {
  data: AdminTimesheetShift[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; pending: number; approved: number; disputed: number };
  suppliers: { id: number; name: string }[];
};

type BilledShift = {
  date: string;
  siteName: string;
  startTime: string;
  endTime: string;
  hours: number;
  rate: number;
  amount: number;
  employeeName?: string;
};

type BilledInvoice = {
  invoiceId: number;
  invoiceNumber: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalHours: number;
  totalAmount: number;
  vatAmount: number;
  shifts: BilledShift[];
};

const APPROVAL_STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: AlertTriangle },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  resolved: { label: "Resolved", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle2 },
};

const INVOICE_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400" },
};

function calculateHours(start: string, end: string, breakMins: number): string {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let totalMins = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMins < 0) totalMins += 24 * 60;
  totalMins -= breakMins || 0;
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function buildPeriodOptions(): { value: string; label: string; start: string; end: string }[] {
  const options: { value: string; label: string; start: string; end: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth();
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    options.push({ value: `${year}-${String(month + 1).padStart(2, "0")}`, label, start, end });
  }
  return options;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

function BilledTab({ suppliers }: { suppliers: { id: number; name: string }[] }) {
  const [billedSupplierFilter, setBilledSupplierFilter] = useState<string>("all");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<number>>(new Set());

  const supplierId = billedSupplierFilter !== "all" && billedSupplierFilter !== "none" ? billedSupplierFilter : null;

  const { data: billedInvoices, isLoading: billedLoading } = useQuery<BilledInvoice[]>({
    queryKey: ["/api/admin/supplier-timesheets/billed", billedSupplierFilter],
    queryFn: async () => {
      const url = supplierId
        ? `/api/admin/supplier-timesheets/billed?supplierId=${supplierId}`
        : `/api/admin/supplier-timesheets/billed`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch billed timesheets");
      return res.json();
    },
    enabled: billedSupplierFilter !== "none",
  });

  const invoices = billedInvoices || [];

  const allSelected = invoices.length > 0 && invoices.every((inv) => selectedInvoiceIds.has(inv.invoiceId));
  const someSelected = invoices.some((inv) => selectedInvoiceIds.has(inv.invoiceId));

  const handleToggleSelectAll = () => {
    if (allSelected) {
      setSelectedInvoiceIds(new Set());
    } else {
      setSelectedInvoiceIds(new Set(invoices.map((inv) => inv.invoiceId)));
    }
  };

  const handleToggleInvoice = (invoiceId: number) => {
    setSelectedInvoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(invoiceId)) {
        next.delete(invoiceId);
      } else {
        next.add(invoiceId);
      }
      return next;
    });
  };

  const handleExportCsv = () => {
    const selected = invoices.filter((inv) => selectedInvoiceIds.has(inv.invoiceId));
    if (selected.length === 0) return;

    const headers = ["Supplier Name", "Invoice Number", "Invoice Status", "Period", "Shift Date", "Site", "Officer", "Start Time", "End Time", "Hours", "Rate", "Amount"];
    const rows: string[][] = [];
    for (const inv of selected) {
      const statusConf = INVOICE_STATUS_CONFIG[inv.status] || INVOICE_STATUS_CONFIG.draft;
      const period = `${formatDate(inv.periodStart)} - ${formatDate(inv.periodEnd)}`;
      for (const shift of inv.shifts) {
        rows.push([
          inv.supplierName || "",
          inv.invoiceNumber,
          statusConf.label,
          period,
          formatDate(shift.date),
          shift.siteName,
          shift.employeeName || "",
          shift.startTime,
          shift.endTime,
          shift.hours.toFixed(2),
          shift.rate.toFixed(2),
          shift.amount.toFixed(2),
        ]);
      }
    }

    const escapeCsv = (val: string) => {
      if (val.includes(",") || val.includes('"') || val.includes("\n")) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };

    const csvContent = [headers.map(escapeCsv).join(","), ...rows.map((r) => r.map(escapeCsv).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const selectedSupplier = suppliers.find(s => String(s.id) === billedSupplierFilter);
    const supplierPrefix = selectedSupplier ? selectedSupplier.name.replace(/[^a-zA-Z0-9]/g, "_") : "all_suppliers";
    a.download = `${supplierPrefix}_billed_timesheets.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async (invoiceId: number, invoiceNumber: string) => {
    setDownloadingId(invoiceId);
    try {
      const res = await fetch(`/api/admin/supplier-timesheets/billed/${invoiceId}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Timesheet_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download failed:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={billedSupplierFilter} onValueChange={(val) => { setBilledSupplierFilter(val); setSelectedInvoiceIds(new Set()); }}>
          <SelectTrigger className="w-64" data-testid="select-billed-supplier-filter">
            <Building2 className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Select a supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {invoices.length > 0 && !billedLoading && (
          <>
            <div className="flex items-center gap-2 ml-auto">
              <Checkbox
                id="select-all-invoices"
                checked={allSelected ? true : someSelected ? "indeterminate" : false}
                onCheckedChange={handleToggleSelectAll}
                data-testid="checkbox-select-all-invoices"
              />
              <label htmlFor="select-all-invoices" className="text-sm text-muted-foreground cursor-pointer select-none">
                Select All
              </label>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={selectedInvoiceIds.size === 0}
              data-testid="button-export-csv"
            >
              <FileSpreadsheet className="w-4 h-4 mr-1.5" />
              Export CSV
            </Button>
          </>
        )}
      </div>

      {billedLoading && (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading billed timesheets...</span>
          </CardContent>
        </Card>
      )}

      {!billedLoading && invoices.length === 0 && (
        <Card data-testid="card-no-billed">
          <CardContent className="p-8 text-center">
            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No Billed Timesheets</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No invoiced timesheets found{supplierId ? " for this supplier" : ""}.
            </p>
          </CardContent>
        </Card>
      )}

      {!billedLoading && invoices.length > 0 && (
        <div className="space-y-3" data-testid="billed-invoice-list">
          {invoices.map((invoice) => {
            const isExpanded = expandedInvoiceId === invoice.invoiceId;
            const statusConf = INVOICE_STATUS_CONFIG[invoice.status] || INVOICE_STATUS_CONFIG.draft;
            const isDownloading = downloadingId === invoice.invoiceId;

            return (
              <Card key={invoice.invoiceId} data-testid={`card-invoice-${invoice.invoiceId}`}>
                <CardContent className="p-4">
                  <div
                    className="flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.invoiceId)}
                    data-testid={`row-invoice-${invoice.invoiceId}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={selectedInvoiceIds.has(invoice.invoiceId)}
                        onCheckedChange={() => handleToggleInvoice(invoice.invoiceId)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0"
                        data-testid={`checkbox-invoice-${invoice.invoiceId}`}
                      />
                      <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
                        <Receipt className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm" data-testid={`text-invoice-number-${invoice.invoiceId}`}>
                            {invoice.invoiceNumber}
                          </p>
                          <Badge className={statusConf.className + " text-xs"} data-testid={`badge-invoice-status-${invoice.invoiceId}`}>
                            {statusConf.label}
                          </Badge>
                          {!supplierId && invoice.supplierName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {invoice.supplierName}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <CalendarRange className="w-3 h-3" />
                            {formatDate(invoice.periodStart)} - {formatDate(invoice.periodEnd)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {invoice.totalHours.toFixed(1)} hrs
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(invoice.totalAmount)}
                          </span>
                          {invoice.vatAmount > 0 && (
                            <span className="text-muted-foreground">
                              (VAT: {formatCurrency(invoice.vatAmount)})
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadPdf(invoice.invoiceId, invoice.invoiceNumber);
                        }}
                        disabled={isDownloading}
                        data-testid={`button-download-pdf-${invoice.invoiceId}`}
                      >
                        {isDownloading ? (
                          <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                        ) : (
                          <Download className="w-4 h-4 mr-1.5" />
                        )}
                        PDF
                      </Button>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t" data-testid={`details-invoice-${invoice.invoiceId}`}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-xs text-muted-foreground">
                              <th className="text-left py-2 pr-3 font-medium">Date</th>
                              <th className="text-left py-2 pr-3 font-medium">Site</th>
                              <th className="text-left py-2 pr-3 font-medium">Start</th>
                              <th className="text-left py-2 pr-3 font-medium">End</th>
                              <th className="text-right py-2 pr-3 font-medium">Hours</th>
                              <th className="text-right py-2 pr-3 font-medium">Rate</th>
                              <th className="text-right py-2 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invoice.shifts.map((shift, idx) => (
                              <tr key={idx} className="border-b last:border-b-0" data-testid={`row-billed-shift-${invoice.invoiceId}-${idx}`}>
                                <td className="py-2 pr-3">{formatDate(shift.date)}</td>
                                <td className="py-2 pr-3">{shift.siteName}</td>
                                <td className="py-2 pr-3">{shift.startTime}</td>
                                <td className="py-2 pr-3">{shift.endTime}</td>
                                <td className="py-2 pr-3 text-right">{shift.hours.toFixed(1)}</td>
                                <td className="py-2 pr-3 text-right">{formatCurrency(shift.rate)}</td>
                                <td className="py-2 text-right font-medium">{formatCurrency(shift.amount)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t font-medium">
                              <td colSpan={4} className="py-2 pr-3 text-right">Totals</td>
                              <td className="py-2 pr-3 text-right">{invoice.totalHours.toFixed(1)}</td>
                              <td className="py-2 pr-3"></td>
                              <td className="py-2 text-right">{formatCurrency(invoice.totalAmount)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminSupplierTimesheetsPage() {
  const [activeTab, setActiveTab] = useState("pending");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [supplierFilter, setSupplierFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const limit = 50;
  const periodOptions = buildPeriodOptions();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleStatusChange = useCallback((val: string) => {
    setStatusFilter(val);
    setPage(1);
  }, []);

  const handleSupplierChange = useCallback((val: string) => {
    setSupplierFilter(val);
    setPage(1);
  }, []);

  const handlePeriodChange = useCallback((val: string) => {
    setPeriodFilter(val);
    if (val !== "all") {
      const opt = buildPeriodOptions().find((p) => p.value === val);
      if (opt) {
        setCustomStartDate(opt.start);
        setCustomEndDate(opt.end);
      }
    } else {
      setCustomStartDate("");
      setCustomEndDate("");
    }
    setPage(1);
  }, []);

  const handleStartDateChange = useCallback((val: string) => {
    setCustomStartDate(val);
    setPeriodFilter("all");
    if (customEndDate && val > customEndDate) {
      setCustomEndDate(val);
    }
    setPage(1);
  }, [customEndDate]);

  const handleEndDateChange = useCallback((val: string) => {
    setCustomEndDate(val);
    setPeriodFilter("all");
    if (customStartDate && val < customStartDate) {
      setCustomStartDate(val);
    }
    setPage(1);
  }, [customStartDate]);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));
  if (statusFilter !== "all") queryParams.set("status", statusFilter);
  if (supplierFilter !== "all") queryParams.set("supplierId", supplierFilter);
  if (debouncedSearch) queryParams.set("search", debouncedSearch);
  if (customStartDate) queryParams.set("periodStart", customStartDate);
  if (customEndDate) queryParams.set("periodEnd", customEndDate);

  const { data: response, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/admin/supplier-timesheets", page, statusFilter, supplierFilter, debouncedSearch, customStartDate, customEndDate],
    queryFn: async () => {
      const res = await fetch(`/api/admin/supplier-timesheets?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    },
  });

  const shifts = response?.data || [];
  const total = response?.total || 0;
  const stats = response?.stats || { total: 0, pending: 0, approved: 0, disputed: 0 };
  const suppliers = response?.suppliers || [];
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6" data-testid="admin-supplier-timesheets-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Supplier Timesheets</h1>
          <p className="text-muted-foreground text-sm">
            Admin overview of all supplier shift approvals and disputes
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-timesheet-view">
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="w-4 h-4 mr-1.5" />
            Pending
          </TabsTrigger>
          <TabsTrigger value="billed" data-testid="tab-billed">
            <Receipt className="w-4 h-4 mr-1.5" />
            Billed
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="timesheet-summary">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-500" />
                    <div>
                      <p className="text-lg font-bold" data-testid="stat-total">{stats.total.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Total Supplier Shifts</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    <div>
                      <p className="text-lg font-bold" data-testid="stat-pending">{stats.pending.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Pending Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <div>
                      <p className="text-lg font-bold" data-testid="stat-approved">{stats.approved.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Approved</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <div>
                      <p className="text-lg font-bold" data-testid="stat-disputed">{stats.disputed.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Disputed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-3" data-testid="timesheet-filters">
              <div className="flex-1">
                <Input
                  placeholder="Search by site, officer, supplier, or shift title..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-48" data-testid="select-status-filter">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="disputed">Disputed</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
              <Select value={supplierFilter} onValueChange={handleSupplierChange}>
                <SelectTrigger className="w-48" data-testid="select-supplier-filter">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by supplier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={periodFilter} onValueChange={handlePeriodChange}>
                <SelectTrigger className="w-52" data-testid="select-period-filter">
                  <CalendarRange className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Filter by period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Periods</SelectItem>
                  {periodOptions.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-end" data-testid="date-range-filters">
              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="filter-start-date">Start Date</label>
                <Input
                  id="filter-start-date"
                  type="date"
                  value={customStartDate}
                  max={customEndDate || undefined}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="filter-end-date">End Date</label>
                <Input
                  id="filter-end-date"
                  type="date"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
              {(customStartDate || customEndDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-9"
                  onClick={() => { setCustomStartDate(""); setCustomEndDate(""); setPeriodFilter("all"); setPage(1); }}
                  data-testid="button-clear-dates"
                >
                  Clear Dates
                </Button>
              )}
            </div>

            {isLoading && (
              <Card>
                <CardContent className="p-8 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Loading supplier timesheets...</span>
                </CardContent>
              </Card>
            )}

            {!isLoading && shifts.length === 0 && (
              <Card data-testid="card-empty">
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold">No Supplier Timesheets Found</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {stats.total === 0
                      ? "No supplier shifts have been recorded yet."
                      : "No shifts match your current filters."}
                  </p>
                </CardContent>
              </Card>
            )}

            {!isLoading && shifts.length > 0 && (
              <>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span data-testid="text-results-count">
                    Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()} shifts
                  </span>
                </div>

                <div className="space-y-3" data-testid="timesheet-list">
                  {shifts.map((shift) => {
                    const approvalStatus = shift.supplierApprovalStatus || "pending";
                    const statusConf = APPROVAL_STATUS_CONFIG[approvalStatus] || APPROVAL_STATUS_CONFIG.pending;
                    const StatusIcon = statusConf.icon;
                    const isExpanded = expandedId === shift.id;
                    const hours = calculateHours(shift.startTime, shift.endTime, shift.breakMinutes || 0);

                    return (
                      <Card key={shift.id} data-testid={`card-shift-${shift.id}`}>
                        <CardContent className="p-4">
                          <div
                            className="flex items-center justify-between gap-3 cursor-pointer"
                            onClick={() => setExpandedId(isExpanded ? null : shift.id)}
                            data-testid={`row-shift-${shift.id}`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                                style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
                                <Calendar className="w-4 h-4 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className="font-medium text-sm truncate">{shift.title}</p>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> {shift.date}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> {shift.startTime} - {shift.endTime} ({hours})
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" /> {shift.siteName}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" /> {shift.employeeName}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {shift.supplierName}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={statusConf.className + " text-xs"} data-testid={`badge-approval-${shift.id}`}>
                                <StatusIcon className="w-3 h-3 mr-1" />
                                {statusConf.label}
                              </Badge>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t space-y-3" data-testid={`details-shift-${shift.id}`}>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                                <div>
                                  <p className="text-xs text-muted-foreground">Site</p>
                                  <p className="font-medium">{shift.siteName}</p>
                                  {shift.siteCity && <p className="text-xs text-muted-foreground">{shift.siteCity}</p>}
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Officer</p>
                                  <p className="font-medium">{shift.employeeName}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Supplier</p>
                                  <p className="font-medium">{shift.supplierName}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Hours</p>
                                  <p className="font-medium">{hours}</p>
                                  {(shift.breakMinutes || 0) > 0 && (
                                    <p className="text-xs text-muted-foreground">{shift.breakMinutes}min break</p>
                                  )}
                                </div>
                                <div>
                                  <p className="text-xs text-muted-foreground">Approval Status</p>
                                  <Badge className={statusConf.className + " text-xs mt-0.5"}>
                                    <StatusIcon className="w-3 h-3 mr-1" />
                                    {statusConf.label}
                                  </Badge>
                                </div>
                              </div>

                              {shift.notes && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Shift Notes</p>
                                  <p className="text-sm">{shift.notes}</p>
                                </div>
                              )}

                              {shift.supplierApprovalComment && (
                                <div className="p-3 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/10 dark:border-red-800/30">
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <MessageSquare className="w-3 h-3" /> Dispute Comment
                                  </p>
                                  <p className="text-sm mt-1">{shift.supplierApprovalComment}</p>
                                </div>
                              )}

                              {shift.supplierApprovedAt && (
                                <div className="flex items-center gap-1.5 text-xs pt-1">
                                  <StatusIcon className={`w-3.5 h-3.5 ${approvalStatus === "approved" ? "text-green-600" : approvalStatus === "disputed" ? "text-red-500" : approvalStatus === "resolved" ? "text-blue-500" : "text-yellow-500"}`} />
                                  <span className="font-medium">
                                    {approvalStatus === "approved" ? "Approved by supplier" : approvalStatus === "disputed" ? "Disputed by supplier" : approvalStatus === "resolved" ? "Resolved" : "Pending review"}
                                  </span>
                                  <span className="text-muted-foreground ml-1">
                                    on {new Date(shift.supplierApprovedAt).toLocaleDateString("en-GB")}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between pt-2" data-testid="pagination">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      data-testid="button-prev-page"
                    >
                      <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                    </Button>
                    <span className="text-sm text-muted-foreground" data-testid="text-page-info">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      data-testid="button-next-page"
                    >
                      Next <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="billed">
          <BilledTab suppliers={suppliers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
