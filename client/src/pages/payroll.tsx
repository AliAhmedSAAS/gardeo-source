import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Banknote, Clock, CheckCircle2, XCircle, AlertTriangle,
  Loader2, FileText, Users, CalendarDays, PoundSterling, TrendingUp,
  Eye, Play, CreditCard, Plus, Filter, Download,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type PayrollSummary = {
  pendingCount: number;
  pendingHours: string;
  pendingValue: string;
  approvedCount: number;
  approvedHours: string;
  approvedValue: string;
  paidCount: number;
  totalBilled: string;
  totalPayrollApproved: string;
  totalPaid: string;
  variance: string;
};

type PendingShift = {
  id: number;
  date: string;
  title: string;
  startTime: string;
  endTime: string;
  breakMinutes: number | null;
  status: string;
  payrollStatus: string;
  employeeName: string;
  siteName: string;
  hoursWorked: number;
  hourlyRate: string;
  grossAmount: string;
};

type PayrollRun = {
  id: number;
  runCode: string | null;
  periodStart: string;
  periodEnd: string;
  totalHours: string | null;
  totalGross: string | null;
  totalDeductions: string | null;
  totalNet: string | null;
  shiftCount: number | null;
  employeeCount: number | null;
  status: string | null;
  finalisedAt: string | null;
  paidAt: string | null;
  notes: string | null;
  createdAt: string | null;
};

type PayrollRunDetail = PayrollRun & {
  items: Array<{
    id: number;
    shiftId: number;
    employeeId: number;
    hours: string;
    hourlyRate: string;
    grossAmount: string;
    deductions: string | null;
    netAmount: string;
    employeeName: string;
    shiftDate: string | null;
    siteName: string;
  }>;
};

function formatCurrency(value: string | number | null | undefined): string {
  const num = parseFloat(String(value || "0"));
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const RUN_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  finalised: { label: "Finalised", variant: "default" },
  paid: { label: "Paid", variant: "default" },
};

export default function PayrollPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedShifts, setSelectedShifts] = useState<Set<number>>(new Set());
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("all");
  const [filterEmployeeName, setFilterEmployeeName] = useState("all");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [createRunDialogOpen, setCreateRunDialogOpen] = useState(false);
  const [runPeriodStart, setRunPeriodStart] = useState("");
  const [runPeriodEnd, setRunPeriodEnd] = useState("");
  const [runNotes, setRunNotes] = useState("");
  const [viewRunId, setViewRunId] = useState<number | null>(null);
  const [finaliseRunId, setFinaliseRunId] = useState<number | null>(null);
  const [payRunId, setPayRunId] = useState<number | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery<PayrollSummary>({
    queryKey: ["/api/payroll/summary"],
  });

  const { data: pendingShifts = [], isLoading: pendingLoading } = useQuery<PendingShift[]>({
    queryKey: ["/api/payroll/pending"],
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery<PayrollRun[]>({
    queryKey: ["/api/payroll/runs"],
  });

  const { data: runDetail, isLoading: runDetailLoading } = useQuery<PayrollRunDetail>({
    queryKey: ["/api/payroll/runs", viewRunId],
    enabled: viewRunId !== null,
  });

  // Extract unique sites and employees for filter dropdowns
  const uniqueSites = Array.from(
    new Map(pendingShifts.map((s) => [s.siteName, s.siteName])).values()
  ).sort();
  const uniqueEmployees = Array.from(
    new Map(pendingShifts.map((s) => [s.employeeName, s.employeeName])).values()
  ).sort();

  const filteredShifts = pendingShifts.filter((s) => {
    if (dateFrom && s.date < dateFrom) return false;
    if (dateTo && s.date > dateTo) return false;
    if (filterSiteId !== "all" && s.siteName !== filterSiteId) return false;
    if (filterEmployeeName !== "all" && s.employeeName !== filterEmployeeName) return false;
    return true;
  });

  const selectedArray = Array.from(selectedShifts);
  const selectedTotal = filteredShifts
    .filter((s) => selectedShifts.has(s.id))
    .reduce((sum, s) => sum + parseFloat(s.grossAmount), 0);
  const selectedHours = filteredShifts
    .filter((s) => selectedShifts.has(s.id))
    .reduce((sum, s) => sum + s.hoursWorked, 0);

  const toggleShift = (id: number) => {
    setSelectedShifts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedShifts.size === filteredShifts.length) {
      setSelectedShifts(new Set());
    } else {
      setSelectedShifts(new Set(filteredShifts.map((s) => s.id)));
    }
  };

  const approveMutation = useMutation({
    mutationFn: async (shiftIds: number[]) => {
      await apiRequest("POST", "/api/payroll/approve", { shiftIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      setSelectedShifts(new Set());
      setApproveDialogOpen(false);
      toast({ title: "Shifts approved", description: `${selectedArray.length} shift(s) approved for payroll.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ shiftIds, reason }: { shiftIds: number[]; reason: string }) => {
      await apiRequest("POST", "/api/payroll/reject", { shiftIds, reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      setSelectedShifts(new Set());
      setRejectDialogOpen(false);
      setRejectReason("");
      toast({ title: "Shifts rejected", description: "Selected shifts have been rejected." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createRunMutation = useMutation({
    mutationFn: async (data: { periodStart: string; periodEnd: string; notes: string }) => {
      const res = await apiRequest("POST", "/api/payroll/runs", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      setCreateRunDialogOpen(false);
      setRunPeriodStart("");
      setRunPeriodEnd("");
      setRunNotes("");
      toast({ title: "Payroll run created", description: "A new payroll run has been created from approved shifts." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const finaliseMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/payroll/runs/${id}/finalise`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      setFinaliseRunId(null);
      toast({ title: "Run finalised", description: "The payroll run has been finalised." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const payMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/payroll/runs/${id}/pay`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary"] });
      setPayRunId(null);
      toast({ title: "Run marked as paid", description: "All shifts in this run have been marked as paid." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const variance = parseFloat(summary?.variance || "0");
  const hasVariance = Math.abs(variance) > 0.01;

  return (
    <div className="p-6 space-y-6" data-testid="payroll-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Payroll</h1>
          <p className="text-muted-foreground text-sm">Approve completed shifts, create payroll runs, and track payments.</p>
        </div>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl p-5 bg-muted/50 animate-pulse">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div
            className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-lg"
            data-testid="kpi-pending"
          >
            <div className="absolute top-3 right-3 opacity-20">
              <Clock className="w-12 h-12" />
            </div>
            <p className="text-sm font-medium text-white/80">Pending Approval</p>
            <p className="text-3xl font-bold mt-1">{summary.pendingCount}</p>
            <p className="text-xs text-white/70 mt-1">
              {summary.pendingHours}h &middot; {formatCurrency(summary.pendingValue)}
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-emerald-600 to-emerald-800 text-white shadow-lg"
            data-testid="kpi-approved"
          >
            <div className="absolute top-3 right-3 opacity-20">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <p className="text-sm font-medium text-white/80">Ready for Payroll</p>
            <p className="text-3xl font-bold mt-1">{summary.approvedCount}</p>
            <p className="text-xs text-white/70 mt-1">
              {summary.approvedHours}h &middot; {formatCurrency(summary.approvedValue)}
            </p>
          </div>
          <div
            className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg"
            data-testid="kpi-paid"
          >
            <div className="absolute top-3 right-3 opacity-20">
              <PoundSterling className="w-12 h-12" />
            </div>
            <p className="text-sm font-medium text-white/80">Total Paid</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(summary.totalPaid)}</p>
            <p className="text-xs text-white/70 mt-1">{summary.paidCount} shifts paid</p>
          </div>
          <div
            className={`relative overflow-hidden rounded-xl p-5 ${hasVariance ? "bg-gradient-to-br from-amber-600 to-amber-800" : "bg-gradient-to-br from-teal-600 to-teal-800"} text-white shadow-lg`}
            data-testid="kpi-variance"
          >
            <div className="absolute top-3 right-3 opacity-20">
              <TrendingUp className="w-12 h-12" />
            </div>
            <p className="text-sm font-medium text-white/80">Billed vs Paid</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(summary.variance)}</p>
            <p className="text-xs text-white/70 mt-1">{hasVariance ? "Variance detected" : "Balanced"}</p>
          </div>
        </div>
      ) : null}

      {hasVariance && summary && (
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-sm">Reconciliation Variance</p>
                <p className="text-xs text-muted-foreground">
                  Total Billed: {formatCurrency(summary.totalBilled)} | Payroll Approved: {formatCurrency(summary.totalPayrollApproved)} | Paid: {formatCurrency(summary.totalPaid)} | Variance: <span className="text-amber-600 font-medium">{formatCurrency(summary.variance)}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList data-testid="tabs-payroll">
          <TabsTrigger value="pending" data-testid="tab-pending">
            <Clock className="w-4 h-4 mr-1.5" />
            Pending Approval
            {summary && summary.pendingCount > 0 && (
              <Badge variant="secondary" className="ml-2">{summary.pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">
            <FileText className="w-4 h-4 mr-1.5" />
            Payroll Runs
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-history">
            <Banknote className="w-4 h-4 mr-1.5" />
            Pay History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setSelectedShifts(new Set()); }}
                className="w-auto"
                data-testid="input-date-from"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setSelectedShifts(new Set()); }}
                className="w-auto"
                data-testid="input-date-to"
              />
              <Select
                value={filterSiteId}
                onValueChange={(v) => { setFilterSiteId(v); setSelectedShifts(new Set()); }}
              >
                <SelectTrigger className="w-40" data-testid="select-filter-site">
                  <SelectValue placeholder="All Sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sites</SelectItem>
                  {uniqueSites.map((site) => (
                    <SelectItem key={site} value={site}>{site}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={filterEmployeeName}
                onValueChange={(v) => { setFilterEmployeeName(v); setSelectedShifts(new Set()); }}
              >
                <SelectTrigger className="w-44" data-testid="select-filter-employee">
                  <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Employees</SelectItem>
                  {uniqueEmployees.map((emp) => (
                    <SelectItem key={emp} value={emp}>{emp}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1" />
            {selectedShifts.size > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">
                  {selectedShifts.size} selected ({selectedHours.toFixed(1)}h, {formatCurrency(selectedTotal)})
                </span>
                <Button
                  size="sm"
                  onClick={() => setApproveDialogOpen(true)}
                  data-testid="button-bulk-approve"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setRejectDialogOpen(true)}
                  data-testid="button-bulk-reject"
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  Reject
                </Button>
              </div>
            )}
          </div>

          {pendingLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-4" />
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-20 flex-1" />
                      <Skeleton className="h-4 w-16" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : filteredShifts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold" data-testid="text-empty-pending">No shifts pending approval</h3>
                <p className="text-sm text-muted-foreground">
                  All completed shifts have been processed. New completed shifts will appear here automatically.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3">
                        <Checkbox
                          checked={selectedShifts.size === filteredShifts.length && filteredShifts.length > 0}
                          onCheckedChange={toggleAll}
                          data-testid="checkbox-select-all"
                        />
                      </th>
                      <th className="p-3 font-medium text-muted-foreground">Employee</th>
                      <th className="p-3 font-medium text-muted-foreground">Shift Date</th>
                      <th className="p-3 font-medium text-muted-foreground">Site</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Hours</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Rate</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Gross</th>
                      <th className="p-3 font-medium text-muted-foreground">Status</th>
                      <th className="p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredShifts.map((s) => (
                      <tr key={s.id} className="border-b last:border-0" data-testid={`row-shift-${s.id}`}>
                        <td className="p-3">
                          <Checkbox
                            checked={selectedShifts.has(s.id)}
                            onCheckedChange={() => toggleShift(s.id)}
                            data-testid={`checkbox-shift-${s.id}`}
                          />
                        </td>
                        <td className="p-3 font-medium" data-testid={`text-employee-${s.id}`}>{s.employeeName}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(s.date)}</td>
                        <td className="p-3 text-muted-foreground">{s.siteName}</td>
                        <td className="p-3 text-right">{s.hoursWorked.toFixed(1)}h</td>
                        <td className="p-3 text-right text-muted-foreground">{formatCurrency(s.hourlyRate)}</td>
                        <td className="p-3 text-right font-medium" data-testid={`text-gross-${s.id}`}>{formatCurrency(s.grossAmount)}</td>
                        <td className="p-3">
                          <Badge variant="secondary" data-testid={`badge-status-${s.id}`}>Pending</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedShifts(new Set([s.id]));
                                setApproveDialogOpen(true);
                              }}
                              data-testid={`button-approve-${s.id}`}
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedShifts(new Set([s.id]));
                                setRejectDialogOpen(true);
                              }}
                              data-testid={`button-reject-${s.id}`}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="runs" className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Payroll runs batch approved shifts for payment processing.
            </p>
            <Button onClick={() => setCreateRunDialogOpen(true)} data-testid="button-create-run">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Payroll Run
            </Button>
          </div>

          {runsLoading ? (
            <Card>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-32 flex-1" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold" data-testid="text-empty-runs">No payroll runs yet</h3>
                <p className="text-sm text-muted-foreground">
                  Approve shifts first, then create a payroll run to batch them for payment.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium text-muted-foreground">Run Code</th>
                      <th className="p-3 font-medium text-muted-foreground">Period</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Shifts</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Employees</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Hours</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Total Gross</th>
                      <th className="p-3 font-medium text-muted-foreground">Status</th>
                      <th className="p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => {
                      const statusConf = RUN_STATUS_CONFIG[run.status || "draft"] || RUN_STATUS_CONFIG.draft;
                      return (
                        <tr key={run.id} className="border-b last:border-0" data-testid={`row-run-${run.id}`}>
                          <td className="p-3 font-medium" data-testid={`text-run-code-${run.id}`}>{run.runCode || "N/A"}</td>
                          <td className="p-3 text-muted-foreground">
                            {formatDate(run.periodStart)} - {formatDate(run.periodEnd)}
                          </td>
                          <td className="p-3 text-right">{run.shiftCount ?? 0}</td>
                          <td className="p-3 text-right">{run.employeeCount ?? 0}</td>
                          <td className="p-3 text-right">{parseFloat(run.totalHours || "0").toFixed(1)}h</td>
                          <td className="p-3 text-right font-medium" data-testid={`text-run-total-${run.id}`}>
                            {formatCurrency(run.totalGross)}
                          </td>
                          <td className="p-3">
                            <Badge variant={statusConf.variant} data-testid={`badge-run-status-${run.id}`}>
                              {statusConf.label}
                            </Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setViewRunId(run.id)}
                                data-testid={`button-view-run-${run.id}`}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {(run.status === "finalised" || run.status === "paid") && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    window.open(`/api/payroll/runs/${run.id}/export-csv`, "_blank");
                                  }}
                                  title="Export BACS CSV"
                                  data-testid={`button-export-run-${run.id}`}
                                >
                                  <Download className="w-4 h-4" />
                                </Button>
                              )}
                              {run.status === "draft" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setFinaliseRunId(run.id)}
                                  data-testid={`button-finalise-run-${run.id}`}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                              )}
                              {run.status === "finalised" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setPayRunId(run.id)}
                                  data-testid={`button-pay-run-${run.id}`}
                                >
                                  <CreditCard className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-4">
          {runsLoading ? (
            <Card>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
                </div>
              </CardContent>
            </Card>
          ) : (
            (() => {
              const paidRuns = runs.filter((r) => r.status === "paid");
              if (paidRuns.length === 0) {
                return (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Banknote className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <h3 className="font-semibold" data-testid="text-empty-history">No payment history yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Paid payroll runs will appear here once they have been processed.
                      </p>
                    </CardContent>
                  </Card>
                );
              }
              return (
                <div className="space-y-4">
                  {paidRuns.map((run) => (
                    <Card key={run.id} data-testid={`card-paid-run-${run.id}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <CardTitle className="text-base flex items-center gap-2">
                            <Banknote className="w-4 h-4" />
                            {run.runCode || "N/A"}
                          </CardTitle>
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="default">Paid</Badge>
                            {run.paidAt && (
                              <span className="text-xs text-muted-foreground">
                                Paid {formatDate(run.paidAt)}
                              </span>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Period</p>
                            <p className="font-medium">{formatDate(run.periodStart)} - {formatDate(run.periodEnd)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Shifts</p>
                            <p className="font-medium">{run.shiftCount ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Employees</p>
                            <p className="font-medium">{run.employeeCount ?? 0}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total Paid</p>
                            <p className="font-medium">{formatCurrency(run.totalNet)}</p>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setViewRunId(run.id)}
                            data-testid={`button-view-paid-run-${run.id}`}
                          >
                            <Eye className="w-4 h-4 mr-1.5" />
                            View Details
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(`/api/payroll/runs/${run.id}/export-csv`, "_blank")}
                            data-testid={`button-export-paid-run-${run.id}`}
                          >
                            <Download className="w-4 h-4 mr-1.5" />
                            Export BACS CSV
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              );
            })()
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Shifts for Payroll</DialogTitle>
            <DialogDescription>
              Are you sure you want to approve the selected shifts? This will mark them as ready for payment processing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Shifts selected</span>
              <span className="font-medium">{selectedArray.length}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total hours</span>
              <span className="font-medium">{selectedHours.toFixed(1)}h</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Total gross amount</span>
              <span className="font-medium">{formatCurrency(selectedTotal)}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialogOpen(false)} data-testid="button-cancel-approve">
              Cancel
            </Button>
            <Button
              onClick={() => approveMutation.mutate(selectedArray)}
              disabled={approveMutation.isPending}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Approve {selectedArray.length} shift{selectedArray.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Shifts</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting these shifts. They will be sent back for operations review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Rejecting {selectedArray.length} shift{selectedArray.length !== 1 ? "s" : ""}
            </div>
            <div className="space-y-2">
              <Label htmlFor="rejectReason">Reason for rejection</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter the reason for rejection..."
                data-testid="input-reject-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectDialogOpen(false); setRejectReason(""); }} data-testid="button-cancel-reject">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ shiftIds: selectedArray, reason: rejectReason })}
              disabled={rejectMutation.isPending || !rejectReason.trim()}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createRunDialogOpen} onOpenChange={setCreateRunDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Payroll Run</DialogTitle>
            <DialogDescription>
              Select a date range to include all approved shifts in a new payroll batch.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createRunMutation.mutate({ periodStart: runPeriodStart, periodEnd: runPeriodEnd, notes: runNotes });
            }}
            className="space-y-4"
            data-testid="form-create-run"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="runPeriodStart">Period Start</Label>
                <Input
                  id="runPeriodStart"
                  type="date"
                  value={runPeriodStart}
                  onChange={(e) => setRunPeriodStart(e.target.value)}
                  required
                  data-testid="input-run-period-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="runPeriodEnd">Period End</Label>
                <Input
                  id="runPeriodEnd"
                  type="date"
                  value={runPeriodEnd}
                  onChange={(e) => setRunPeriodEnd(e.target.value)}
                  required
                  data-testid="input-run-period-end"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="runNotes">Notes (optional)</Label>
              <Textarea
                id="runNotes"
                value={runNotes}
                onChange={(e) => setRunNotes(e.target.value)}
                placeholder="Add any notes for this payroll run..."
                data-testid="input-run-notes"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateRunDialogOpen(false)} data-testid="button-cancel-create-run">
                Cancel
              </Button>
              <Button type="submit" disabled={createRunMutation.isPending} data-testid="button-submit-create-run">
                {createRunMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Run
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={viewRunId !== null} onOpenChange={(open) => { if (!open) setViewRunId(null); }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <DialogTitle>Payroll Run Details</DialogTitle>
              {runDetail && (runDetail.status === "finalised" || runDetail.status === "paid") && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.open(`/api/payroll/runs/${runDetail.id}/export-csv`, "_blank")}
                  data-testid="button-export-run-detail"
                >
                  <Download className="w-4 h-4 mr-1.5" />
                  Export BACS CSV
                </Button>
              )}
            </div>
          </DialogHeader>
          {runDetailLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : runDetail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Run Code</p>
                  <p className="font-medium" data-testid="text-detail-run-code">{runDetail.runCode || "N/A"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge variant={RUN_STATUS_CONFIG[runDetail.status || "draft"]?.variant || "secondary"} data-testid="badge-detail-status">
                    {RUN_STATUS_CONFIG[runDetail.status || "draft"]?.label || "Draft"}
                  </Badge>
                </div>
                <div>
                  <p className="text-muted-foreground">Period</p>
                  <p className="font-medium">{formatDate(runDetail.periodStart)} - {formatDate(runDetail.periodEnd)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium" data-testid="text-detail-total">{formatCurrency(runDetail.totalGross)}</p>
                </div>
              </div>

              {runDetail.items.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="p-2 font-medium text-muted-foreground">Employee</th>
                        <th className="p-2 font-medium text-muted-foreground">Shift Date</th>
                        <th className="p-2 font-medium text-muted-foreground">Site</th>
                        <th className="p-2 font-medium text-muted-foreground text-right">Hours</th>
                        <th className="p-2 font-medium text-muted-foreground text-right">Rate</th>
                        <th className="p-2 font-medium text-muted-foreground text-right">Gross</th>
                        <th className="p-2 font-medium text-muted-foreground text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runDetail.items.map((item) => (
                        <tr key={item.id} className="border-b last:border-0" data-testid={`row-item-${item.id}`}>
                          <td className="p-2 font-medium">{item.employeeName}</td>
                          <td className="p-2 text-muted-foreground">{formatDate(item.shiftDate)}</td>
                          <td className="p-2 text-muted-foreground">{item.siteName}</td>
                          <td className="p-2 text-right">{parseFloat(item.hours).toFixed(1)}h</td>
                          <td className="p-2 text-right text-muted-foreground">{formatCurrency(item.hourlyRate)}</td>
                          <td className="p-2 text-right">{formatCurrency(item.grossAmount)}</td>
                          <td className="p-2 text-right font-medium">{formatCurrency(item.netAmount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted-foreground">Run not found.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={finaliseRunId !== null} onOpenChange={(open) => { if (!open) setFinaliseRunId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Finalise Payroll Run</DialogTitle>
            <DialogDescription>
              Once finalised, no further changes can be made to this payroll run. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinaliseRunId(null)} data-testid="button-cancel-finalise">
              Cancel
            </Button>
            <Button
              onClick={() => finaliseRunId && finaliseMutation.mutate(finaliseRunId)}
              disabled={finaliseMutation.isPending}
              data-testid="button-confirm-finalise"
            >
              {finaliseMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Finalise Run
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payRunId !== null} onOpenChange={(open) => { if (!open) setPayRunId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
            <DialogDescription>
              This will mark all shifts in this run as paid. This action cannot be undone. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayRunId(null)} data-testid="button-cancel-pay">
              Cancel
            </Button>
            <Button
              onClick={() => payRunId && payMutation.mutate(payRunId)}
              disabled={payMutation.isPending}
              data-testid="button-confirm-pay"
            >
              {payMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}