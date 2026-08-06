import { useState, useEffect, useCallback } from "react";
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
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2, XCircle, Clock, AlertTriangle, Filter, Loader2,
  ArrowUpDown, DollarSign, Shield, Calendar, MapPin, Users, ChevronDown,
  ChevronLeft, ChevronRight, Search,
} from "lucide-react";

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
}

interface PaginatedResponse {
  data: EnrichedShift[];
  total: number;
  page: number;
  limit: number;
  stats: { total: number; pending: number; approved: number; rejected: number; late_arrivals: number };
  sites: { id: number; name: string }[];
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

export default function FinanceApprovalPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterFinanceStatus, setFilterFinanceStatus] = useState<string>("pending");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterSite, setFilterSite] = useState("all");
  const [filterShiftStatus, setFilterShiftStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState("");
  const [rejectTarget, setRejectTarget] = useState<"single" | "bulk">("bulk");
  const [rejectSingleId, setRejectSingleId] = useState<number | null>(null);
  const limit = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const resetPage = useCallback(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    financeStatus: filterFinanceStatus,
    shiftStatus: filterShiftStatus,
    siteId: filterSite !== "all" ? filterSite : "",
    dateFrom: filterDateFrom,
    dateTo: filterDateTo,
    search: debouncedSearch,
  }).toString();

  const { data: response, isLoading } = useQuery<PaginatedResponse>({
    queryKey: ["/api/finance-approval/shifts", page, filterFinanceStatus, filterShiftStatus, filterSite, filterDateFrom, filterDateTo, debouncedSearch],
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
  const totalPages = Math.ceil(total / limit);

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
            {(filterDateFrom || filterDateTo || filterSite !== "all" || filterShiftStatus !== "all" || searchTerm) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterSite("all"); setFilterShiftStatus("all"); setSearchTerm(""); resetPage(); }} data-testid="button-clear-filters">
                Clear Filters
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
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
              <Input type="date" value={filterDateFrom} onChange={(e) => { setFilterDateFrom(e.target.value); resetPage(); }} className="w-36" data-testid="input-date-from" />
            </div>
            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">To:</Label>
              <Input type="date" value={filterDateTo} onChange={(e) => { setFilterDateTo(e.target.value); resetPage(); }} className="w-36" data-testid="input-date-to" />
            </div>
            <Select value={filterSite} onValueChange={(val) => { setFilterSite(val); resetPage(); }}>
              <SelectTrigger className="w-44" data-testid="select-site-filter">
                <SelectValue placeholder="All Sites" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites.map((site) => (
                  <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search shifts, officers, sites..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="input-search"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-[#1F3A5F]/5 dark:bg-[#1F3A5F]/20 border border-[#1F3A5F]/20 rounded-lg" data-testid="bulk-action-bar">
          <span className="text-sm font-medium">{selectedIds.size} shift{selectedIds.size > 1 ? "s" : ""} selected</span>
          <Separator orientation="vertical" className="h-6" />
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
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Shift</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Date & Time</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Officer</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Site</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Shift Status</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Arrival</th>
                    <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Finance</th>
                    <th className="p-3 text-right text-xs font-semibold text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => {
                    const financeConf = FINANCE_STATUS_CONFIG[(shift.financeStatus || "pending")] || FINANCE_STATUS_CONFIG.pending;
                    const shiftConf = SHIFT_STATUS_CONFIG[shift.status || "scheduled"] || SHIFT_STATUS_CONFIG.scheduled;
                    const isLate = (shift.lateMinutes || 0) > 0;
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
                          <div className="font-medium" data-testid={`text-shift-title-${shift.id}`}>{shift.title}</div>
                          {shift.shiftCode && <div className="text-xs text-muted-foreground font-mono">{shift.shiftCode}</div>}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            {shift.date}
                          </div>
                          <div className="text-xs text-muted-foreground">{shift.startTime} – {shift.endTime}</div>
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
                        <td className="p-3">
                          <Badge variant="secondary" className={`text-[10px] ${shiftConf.className}`} data-testid={`badge-shift-status-${shift.id}`}>
                            {shiftConf.label}
                          </Badge>
                        </td>
                        <td className="p-3">
                          {isLate ? (
                            <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" data-testid={`text-late-${shift.id}`}>
                              <AlertTriangle className="w-3 h-3" />
                              {shift.lateMinutes} min late
                            </div>
                          ) : shift.bookedOnAt ? (
                            <div className="text-xs text-green-600 dark:text-green-400" data-testid={`text-ontime-${shift.id}`}>On time</div>
                          ) : (
                            <div className="text-xs text-muted-foreground">—</div>
                          )}
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
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => singleApproveMutation.mutate(shift.id)}
                                disabled={singleApproveMutation.isPending}
                                data-testid={`button-approve-${shift.id}`}
                              >
                                <CheckCircle2 className="w-3 h-3 mr-0.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleSingleReject(shift.id)}
                                data-testid={`button-reject-${shift.id}`}
                              >
                                <XCircle className="w-3 h-3 mr-0.5" /> Reject
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
              <li>Late arrivals are highlighted with the number of minutes late for your review</li>
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
    </div>
  );
}
