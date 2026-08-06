import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Clock, MapPin, User, CheckCircle2, XCircle, AlertTriangle,
  FileText, Loader2, MessageSquare, Calendar, Filter,
  ChevronDown, ChevronUp, ListChecks, ChevronLeft, ChevronRight,
  Download, FileSpreadsheet, Receipt,
} from "lucide-react";

type TimesheetShift = {
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
  supplierApprovalStatus: string | null;
  supplierApprovalComment: string | null;
  supplierApprovedAt: string | null;
};

type PaginatedResponse = {
  data: TimesheetShift[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; pending: number; approved: number; disputed: number };
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  approved: { label: "Approved", className: "bg-green-100 text-green-800", icon: CheckCircle2 },
  disputed: { label: "Disputed", className: "bg-red-100 text-red-800", icon: XCircle },
  pending: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800", icon: AlertTriangle },
};

const SHIFT_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800" },
  in_progress: { label: "In Progress", className: "bg-green-100 text-green-800" },
  completed: { label: "Completed", className: "bg-gray-100 text-gray-700" },
  cancelled: { label: "Cancelled", className: "bg-red-100 text-red-800" },
  no_show: { label: "No Show", className: "bg-orange-100 text-orange-800" },
};

type BilledShift = {
  date: string;
  siteName: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  rate: number;
  amount: number;
};

type BilledInvoice = {
  invoiceId: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalHours: number;
  totalAmount: number;
  vatAmount: number;
  shifts: BilledShift[];
};

function BilledTab() {
  const { toast } = useToast();
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState<number | null>(null);

  const { data: billedInvoices, isLoading } = useQuery<BilledInvoice[]>({
    queryKey: ["/api/supplier-portal/timesheets/billed"],
  });

  const handleDownloadPdf = async (invoiceId: number, invoiceNumber: string) => {
    setDownloadingPdf(invoiceId);
    try {
      const res = await fetch(`/api/supplier-portal/timesheets/billed/${invoiceId}/pdf`, { credentials: "include" });
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
      toast({ title: "Download Complete", description: `Timesheet PDF for ${invoiceNumber} has been downloaded.` });
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloadingPdf(null);
    }
  };

  const invoiceStatusBadge = (status: string) => {
    const configs: Record<string, { label: string; className: string }> = {
      paid: { label: "Paid", className: "bg-green-100 text-green-800" },
      sent: { label: "Sent", className: "bg-blue-100 text-blue-800" },
      draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
      overdue: { label: "Overdue", className: "bg-red-100 text-red-800" },
    };
    const conf = configs[status] || { label: status, className: "bg-gray-100 text-gray-700" };
    return <Badge variant="secondary" className={conf.className + " text-xs"}>{conf.label}</Badge>;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 flex items-center justify-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Loading billed timesheets...</span>
        </CardContent>
      </Card>
    );
  }

  if (!billedInvoices || billedInvoices.length === 0) {
    return (
      <Card data-testid="card-billed-empty">
        <CardContent className="p-8 text-center">
          <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold">No Billed Timesheets</h3>
          <p className="text-sm text-muted-foreground mt-1">
            No invoices have been generated for your timesheets yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3" data-testid="billed-timesheets-list">
      {billedInvoices.map((invoice) => {
        const isExpanded = expandedInvoiceId === invoice.invoiceId;

        return (
          <Card key={invoice.invoiceId} data-testid={`card-invoice-${invoice.invoiceId}`}>
            <CardContent className="p-4">
              <div
                className="flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => setExpandedInvoiceId(isExpanded ? null : invoice.invoiceId)}
                data-testid={`row-invoice-${invoice.invoiceId}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
                    <Receipt className="w-4 h-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm" data-testid={`text-invoice-number-${invoice.invoiceId}`}>
                        {invoice.invoiceNumber}
                      </p>
                      {invoiceStatusBadge(invoice.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {invoice.periodStart} — {invoice.periodEnd}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {invoice.totalHours.toFixed(1)}h
                      </span>
                      <span className="font-medium text-foreground">
                        £{invoice.totalAmount.toFixed(2)}
                      </span>
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
                    disabled={downloadingPdf === invoice.invoiceId}
                    data-testid={`button-download-invoice-pdf-${invoice.invoiceId}`}
                  >
                    {downloadingPdf === invoice.invoiceId ? (
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
                        <tr className="text-left text-xs text-muted-foreground border-b">
                          <th className="pb-2 pr-3">Date</th>
                          <th className="pb-2 pr-3">Site</th>
                          <th className="pb-2 pr-3">Officer</th>
                          <th className="pb-2 pr-3">Start</th>
                          <th className="pb-2 pr-3">End</th>
                          <th className="pb-2 pr-3 text-right">Hours</th>
                          <th className="pb-2 pr-3 text-right">Rate</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoice.shifts.map((shift, idx) => (
                          <tr key={idx} className="border-b last:border-b-0" data-testid={`row-billed-shift-${invoice.invoiceId}-${idx}`}>
                            <td className="py-2 pr-3">{shift.date}</td>
                            <td className="py-2 pr-3">{shift.siteName}</td>
                            <td className="py-2 pr-3">{shift.employeeName || "—"}</td>
                            <td className="py-2 pr-3">{shift.startTime}</td>
                            <td className="py-2 pr-3">{shift.endTime}</td>
                            <td className="py-2 pr-3 text-right">{shift.hours.toFixed(1)}</td>
                            <td className="py-2 pr-3 text-right">£{shift.rate.toFixed(2)}</td>
                            <td className="py-2 text-right">£{shift.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-medium border-t">
                          <td colSpan={5} className="pt-2 pr-3">Totals</td>
                          <td className="pt-2 pr-3 text-right">{invoice.totalHours.toFixed(1)}</td>
                          <td className="pt-2 pr-3"></td>
                          <td className="pt-2 text-right">£{invoice.totalAmount.toFixed(2)}</td>
                        </tr>
                        {invoice.vatAmount > 0 && (
                          <tr className="text-muted-foreground text-xs">
                            <td colSpan={7} className="pt-1 pr-3 text-right">VAT</td>
                            <td className="pt-1 text-right">£{invoice.vatAmount.toFixed(2)}</td>
                          </tr>
                        )}
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
  );
}

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

export default function SupplierTimesheetsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [disputeDialog, setDisputeDialog] = useState<TimesheetShift | null>(null);
  const [disputeComment, setDisputeComment] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDisputeOpen, setBulkDisputeOpen] = useState(false);
  const [bulkDisputeComment, setBulkDisputeComment] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [downloading, setDownloading] = useState<string | null>(null);
  const limit = 50;

  const { data: visibilityData } = useQuery<{ cutoffDate: string | null }>({
    queryKey: ["/api/supplier-portal/data-visibility"],
  });
  const cutoffDate = visibilityData?.cutoffDate ?? null;

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
    setSelectedIds(new Set());
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status: statusFilter,
    search: debouncedSearch,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
  }).toString();

  const { data: response, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/supplier-portal/timesheets", page, statusFilter, debouncedSearch, dateFrom, dateTo],
    queryFn: async () => {
      const res = await fetch(`/api/supplier-portal/timesheets?${queryParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load timesheets");
      return res.json();
    },
  });

  const timesheets = response?.data || [];
  const total = response?.total || 0;
  const stats = response?.stats || { total: 0, pending: 0, approved: 0, disputed: 0 };
  const totalPages = Math.ceil(total / limit);

  const approveMutation = useMutation({
    mutationFn: async (shiftId: number) => {
      const res = await apiRequest("PATCH", `/api/supplier-portal/timesheets/${shiftId}/approve`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/timesheets"] });
      toast({ title: "Timesheet Approved", description: "Shift has been approved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async ({ shiftId, comment }: { shiftId: number; comment: string }) => {
      const res = await apiRequest("PATCH", `/api/supplier-portal/timesheets/${shiftId}/dispute`, { comment });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/timesheets"] });
      setDisputeDialog(null);
      setDisputeComment("");
      toast({ title: "Dispute Submitted", description: "Your dispute has been recorded and will be reviewed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (shiftIds: number[]) => {
      const res = await apiRequest("POST", "/api/supplier-portal/timesheets/bulk-approve", { shiftIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/timesheets"] });
      setSelectedIds(new Set());
      const count = data.approved?.length || 0;
      const skipped = data.skipped?.length || 0;
      toast({
        title: "Bulk Approve Complete",
        description: `${count} timesheet${count !== 1 ? "s" : ""} approved${skipped > 0 ? `, ${skipped} skipped` : ""}.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const bulkDisputeMutation = useMutation({
    mutationFn: async ({ shiftIds, comment }: { shiftIds: number[]; comment: string }) => {
      const res = await apiRequest("POST", "/api/supplier-portal/timesheets/bulk-dispute", { shiftIds, comment });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/timesheets"] });
      setSelectedIds(new Set());
      setBulkDisputeOpen(false);
      setBulkDisputeComment("");
      const count = data.disputed?.length || 0;
      toast({
        title: "Bulk Dispute Complete",
        description: `${count} timesheet${count !== 1 ? "s" : ""} disputed.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDispute = () => {
    if (!disputeDialog || !disputeComment.trim()) {
      toast({ title: "Comment Required", description: "Please provide a reason for disputing this timesheet entry.", variant: "destructive" });
      return;
    }
    disputeMutation.mutate({ shiftId: disputeDialog.id, comment: disputeComment });
  };

  const selectableShifts = timesheets.filter(t => {
    const status = t.supplierApprovalStatus || "pending";
    return status === "pending" || !t.supplierApprovalStatus;
  });

  const allSelectableSelected = selectableShifts.length > 0 && selectableShifts.every(s => selectedIds.has(s.id));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelectableSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableShifts.map(s => s.id)));
    }
  };

  const handleBulkApprove = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkApproveMutation.mutate(ids);
  };

  const handleBulkDispute = () => {
    if (!bulkDisputeComment.trim()) {
      toast({ title: "Comment Required", description: "Please provide a reason for disputing these timesheets.", variant: "destructive" });
      return;
    }
    bulkDisputeMutation.mutate({ shiftIds: Array.from(selectedIds), comment: bulkDisputeComment });
  };

  const handleDownload = async (format: "csv" | "pdf") => {
    setDownloading(format);
    try {
      const downloadParams = new URLSearchParams({
        format,
        status: statusFilter,
        search: debouncedSearch,
        ...(dateFrom ? { dateFrom } : {}),
        ...(dateTo ? { dateTo } : {}),
      }).toString();
      const res = await fetch(`/api/supplier-portal/timesheets/download?${downloadParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timesheets.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast({ title: "Download Complete", description: `Timesheet ${format.toUpperCase()} has been downloaded.` });
    } catch (err: any) {
      toast({ title: "Download Failed", description: err.message, variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="supplier-timesheets-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Timesheets</h1>
          <p className="text-muted-foreground text-sm">
            Review and approve shifts assigned to your officers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("csv")}
            disabled={downloading === "csv"}
            data-testid="button-download-csv"
          >
            {downloading === "csv" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 mr-1.5" />}
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleDownload("pdf")}
            disabled={downloading === "pdf"}
            data-testid="button-download-pdf"
          >
            {downloading === "pdf" ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Download className="w-4 h-4 mr-1.5" />}
            PDF
          </Button>
        </div>
      </div>

      <Tabs defaultValue="pending" className="w-full" data-testid="timesheets-tabs">
        <TabsList data-testid="timesheets-tab-list">
          <TabsTrigger value="pending" data-testid="tab-pending">Pending</TabsTrigger>
          <TabsTrigger value="billed" data-testid="tab-billed">Billed</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-6">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="timesheet-summary">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-total">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Shifts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-pending">{stats.pending}</p>
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
                <p className="text-lg font-bold" data-testid="stat-approved">{stats.approved}</p>
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
                <p className="text-lg font-bold" data-testid="stat-disputed">{stats.disputed}</p>
                <p className="text-xs text-muted-foreground">Disputed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3" data-testid="timesheet-filters">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              placeholder="Search by site, officer, or shift title..."
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
              <SelectItem value="all">All Shifts</SelectItem>
              <SelectItem value="pending">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="disputed">Disputed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">From</span>
            <Input
              type="date"
              value={dateFrom}
              min={cutoffDate || undefined}
              max={dateTo || undefined}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              className="w-40"
              data-testid="input-date-from"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">To</span>
            <Input
              type="date"
              value={dateTo}
              min={dateFrom || cutoffDate || undefined}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              className="w-40"
              data-testid="input-date-to"
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
              data-testid="button-clear-dates"
            >
              Clear dates
            </Button>
          )}
        </div>
        {cutoffDate && (
          <p className="text-xs text-muted-foreground mt-1" data-testid="text-visibility-notice">
            Data available from {new Date(cutoffDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} onwards
          </p>
        )}
      </div>

      {selectedIds.size > 0 && (
        <Card className="border-[#1F3A5F]/30 bg-[#1F3A5F]/5" data-testid="bulk-action-bar">
          <CardContent className="p-3 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-[#1F3A5F]" />
              <span className="text-sm font-medium" data-testid="text-selected-count">
                {selectedIds.size} timesheet{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-green-700 border-green-200 hover:bg-green-50"
                onClick={handleBulkApprove}
                disabled={bulkApproveMutation.isPending}
                data-testid="button-bulk-approve"
              >
                {bulkApproveMutation.isPending ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                )}
                Approve Selected
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setBulkDisputeOpen(true)}
                disabled={bulkDisputeMutation.isPending}
                data-testid="button-bulk-dispute"
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Dispute Selected
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                data-testid="button-clear-selection"
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading timesheets...</span>
          </CardContent>
        </Card>
      )}

      {!isLoading && timesheets.length === 0 && (
        <Card data-testid="card-empty">
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No Timesheets Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {stats.total === 0
                ? "No shifts have been assigned to your company yet."
                : "No shifts match your current filters."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && timesheets.length > 0 && (
        <div className="space-y-3" data-testid="timesheet-list">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              {selectableShifts.length > 0 && (
                <>
                  <Checkbox
                    checked={allSelectableSelected}
                    onCheckedChange={toggleSelectAll}
                    data-testid="checkbox-select-all"
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all pending ({selectableShifts.length})
                  </span>
                </>
              )}
            </div>
            <span className="text-sm text-muted-foreground" data-testid="text-result-count">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total} shifts
            </span>
          </div>

          {timesheets.map((shift) => {
            const approvalStatus = shift.supplierApprovalStatus || "pending";
            const statusConf = STATUS_CONFIG[approvalStatus] || STATUS_CONFIG.pending;
            const shiftConf = SHIFT_STATUS_CONFIG[shift.status] || SHIFT_STATUS_CONFIG.scheduled;
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === shift.id;
            const hours = calculateHours(shift.startTime, shift.endTime, shift.breakMinutes || 0);
            const isSelectable = approvalStatus === "pending" || !shift.supplierApprovalStatus;
            const isSelected = selectedIds.has(shift.id);

            return (
              <Card key={shift.id} className={isSelected ? "ring-2 ring-[#1F3A5F]/40" : ""} data-testid={`card-shift-${shift.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {isSelectable && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(shift.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-shrink-0"
                        data-testid={`checkbox-shift-${shift.id}`}
                      />
                    )}
                    {!isSelectable && <div className="w-4 flex-shrink-0" />}

                    <div
                      className="flex items-center justify-between gap-3 cursor-pointer flex-1 min-w-0"
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
                            <Badge variant="secondary" className={shiftConf.className + " text-xs"}>
                              {shiftConf.label}
                            </Badge>
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
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-3 ml-7" data-testid={`details-shift-${shift.id}`}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
                          <p className="text-xs text-muted-foreground">Hours</p>
                          <p className="font-medium">{hours}</p>
                          {(shift.breakMinutes || 0) > 0 && (
                            <p className="text-xs text-muted-foreground">{shift.breakMinutes}min break</p>
                          )}
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Shift Status</p>
                          <Badge variant="secondary" className={shiftConf.className + " text-xs"}>
                            {shiftConf.label}
                          </Badge>
                        </div>
                      </div>

                      {shift.notes && (
                        <div>
                          <p className="text-xs text-muted-foreground">Notes</p>
                          <p className="text-sm">{shift.notes}</p>
                        </div>
                      )}

                      {shift.supplierApprovalComment && (
                        <div className="p-3 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/10">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Dispute Comment
                          </p>
                          <p className="text-sm mt-1">{shift.supplierApprovalComment}</p>
                        </div>
                      )}

                      {approvalStatus === "pending" || !shift.supplierApprovalStatus ? (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-200 hover:bg-green-50"
                            onClick={(e) => { e.stopPropagation(); approveMutation.mutate(shift.id); }}
                            disabled={approveMutation.isPending}
                            data-testid={`button-approve-${shift.id}`}
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={(e) => { e.stopPropagation(); setDisputeDialog(shift); }}
                            disabled={disputeMutation.isPending}
                            data-testid={`button-dispute-${shift.id}`}
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />
                            Dispute
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4" data-testid="pagination-controls">
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
                Page {page} of {totalPages}
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
        </div>
      )}

        </TabsContent>

        <TabsContent value="billed">
          <BilledTab />
        </TabsContent>
      </Tabs>

      <Dialog open={!!disputeDialog} onOpenChange={(open) => { if (!open) { setDisputeDialog(null); setDisputeComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute Timesheet Entry</DialogTitle>
            <DialogDescription>
              Provide a reason for disputing this shift record. This will be reviewed by the administrator.
            </DialogDescription>
          </DialogHeader>
          {disputeDialog && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/50 text-sm">
                <p className="font-medium">{disputeDialog.title}</p>
                <p className="text-muted-foreground text-xs mt-1">
                  {disputeDialog.date} · {disputeDialog.startTime} - {disputeDialog.endTime} · {disputeDialog.siteName}
                </p>
              </div>
              <Textarea
                placeholder="Explain your reason for disputing this entry..."
                value={disputeComment}
                onChange={(e) => setDisputeComment(e.target.value)}
                rows={4}
                data-testid="textarea-dispute-comment"
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisputeDialog(null); setDisputeComment(""); }} data-testid="button-cancel-dispute">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDispute}
              disabled={disputeMutation.isPending || !disputeComment.trim()}
              data-testid="button-submit-dispute"
            >
              {disputeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDisputeOpen} onOpenChange={(open) => { if (!open) { setBulkDisputeOpen(false); setBulkDisputeComment(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dispute Selected Timesheets</DialogTitle>
            <DialogDescription>
              Provide a reason for disputing {selectedIds.size} selected timesheet{selectedIds.size !== 1 ? "s" : ""}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Explain your reason for disputing these entries..."
            value={bulkDisputeComment}
            onChange={(e) => setBulkDisputeComment(e.target.value)}
            rows={4}
            data-testid="textarea-bulk-dispute-comment"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBulkDisputeOpen(false); setBulkDisputeComment(""); }} data-testid="button-cancel-bulk-dispute">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDispute}
              disabled={bulkDisputeMutation.isPending || !bulkDisputeComment.trim()}
              data-testid="button-submit-bulk-dispute"
            >
              {bulkDisputeMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Dispute {selectedIds.size} Timesheet{selectedIds.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
