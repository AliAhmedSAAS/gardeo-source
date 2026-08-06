import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ShieldCheck, Search, Plus, Eye, CheckCircle, XCircle,
  Clock, AlertTriangle, UserCheck, Loader2, TrendingUp,
  Calendar, FileText,
} from "lucide-react";

type EnrichedVettingRecord = {
  id: number;
  employeeId: number | null;
  tenantId: number | null;
  checkType: string;
  status: string | null;
  referenceNumber: string | null;
  requestedDate: string | null;
  completedDate: string | null;
  expiryDate: string | null;
  result: string | null;
  notes: string | null;
  conductedBy: string | null;
  employeeName: string | null;
  employeeNumber: string | null;
};

type EmployeeOption = {
  id: number;
  firstName: string;
  lastName: string;
  employeeNumber: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Clock; dotColor: string; borderColor: string; bgColor: string }> = {
  not_started: {
    label: "Not Started",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-400",
    icon: Clock,
    dotColor: "bg-gray-300 dark:bg-gray-600",
    borderColor: "border-muted-foreground/20",
    bgColor: "bg-muted/20",
  },
  pending: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    icon: Clock,
    dotColor: "bg-amber-400",
    borderColor: "border-amber-200 dark:border-amber-800",
    bgColor: "bg-amber-50/50 dark:bg-amber-900/10",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    icon: Loader2,
    dotColor: "bg-blue-400",
    borderColor: "border-blue-200 dark:border-blue-800",
    bgColor: "bg-blue-50/50 dark:bg-blue-900/10",
  },
  passed: {
    label: "Passed",
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    icon: CheckCircle,
    dotColor: "bg-green-500",
    borderColor: "border-green-200 dark:border-green-800",
    bgColor: "bg-green-50/50 dark:bg-green-900/10",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: XCircle,
    dotColor: "bg-red-500",
    borderColor: "border-red-200 dark:border-red-800",
    bgColor: "bg-red-50/50 dark:bg-red-900/10",
  },
  expired: {
    label: "Expired",
    className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    icon: AlertTriangle,
    dotColor: "bg-orange-500",
    borderColor: "border-orange-200 dark:border-orange-800",
    bgColor: "bg-orange-50/50 dark:bg-orange-900/10",
  },
};

const CHECK_TYPES = [
  "DBS Check",
  "Right to Work",
  "Reference Check",
  "SIA License Verification",
  "Identity Check",
  "Credit Check",
];

const STATUS_OPTIONS = [
  "not_started", "pending", "in_progress", "passed", "failed", "expired",
];

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function VettingPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [checkTypeFilter, setCheckTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<EnrichedVettingRecord | null>(null);
  const { toast } = useToast();

  const [createForm, setCreateForm] = useState({
    employeeId: "",
    checkType: "",
    referenceNumber: "",
    requestedDate: "",
    notes: "",
  });

  const [updateForm, setUpdateForm] = useState({
    status: "",
    result: "",
    completedDate: "",
    expiryDate: "",
    notes: "",
  });

  const { data: vettingRecords = [], isLoading } = useQuery<EnrichedVettingRecord[]>({
    queryKey: ["/api/admin/vetting"],
  });

  const { data: employees = [] } = useQuery<EmployeeOption[]>({
    queryKey: ["/api/admin/employees"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof createForm) => {
      await apiRequest("POST", "/api/admin/vetting", {
        employeeId: parseInt(data.employeeId),
        checkType: data.checkType,
        referenceNumber: data.referenceNumber || null,
        requestedDate: data.requestedDate || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vetting"] });
      setCreateDialogOpen(false);
      setCreateForm({ employeeId: "", checkType: "", referenceNumber: "", requestedDate: "", notes: "" });
      toast({ title: "Check initiated", description: "The vetting check has been created successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof updateForm }) => {
      await apiRequest("PATCH", `/api/admin/vetting/${id}`, {
        status: data.status || undefined,
        result: data.result || null,
        completedDate: data.completedDate || null,
        expiryDate: data.expiryDate || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/vetting"] });
      setSelectedRecord(null);
      toast({ title: "Record updated", description: "The vetting record has been updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = vettingRecords.filter((r) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = !search || (r.employeeName || "").toLowerCase().includes(search);
    const matchesType = checkTypeFilter === "all" || r.checkType === checkTypeFilter;
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const stats = {
    total: vettingRecords.length,
    pending: vettingRecords.filter((r) => r.status === "pending").length,
    inProgress: vettingRecords.filter((r) => r.status === "in_progress").length,
    passed: vettingRecords.filter((r) => r.status === "passed").length,
    failedExpired: vettingRecords.filter((r) => r.status === "failed" || r.status === "expired").length,
  };

  const passRate = stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
  const attentionCount = stats.failedExpired + stats.pending;

  function openDetailDialog(record: EnrichedVettingRecord) {
    setSelectedRecord(record);
    setUpdateForm({
      status: record.status || "not_started",
      result: record.result || "",
      completedDate: record.completedDate || "",
      expiryDate: record.expiryDate || "",
      notes: record.notes || "",
    });
  }

  return (
    <div className="p-6 space-y-6" data-testid="vetting-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Automated Vetting System</h1>
          <p className="text-muted-foreground text-sm">Manage employee vetting checks, compliance verification, and status tracking.</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} data-testid="button-initiate-check">
          <Plus className="w-4 h-4 mr-2" />
          Initiate Check
        </Button>
      </div>

      {/* Organisation-wide progress summary */}
      {stats.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="sm:col-span-2 lg:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 flex-shrink-0">
                  <svg viewBox="0 0 48 48" className="w-12 h-12">
                    <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                    <circle
                      cx="24" cy="24" r="20" fill="none"
                      stroke={passRate >= 80 ? "#16a34a" : passRate >= 50 ? "#d97706" : "#dc2626"}
                      strokeWidth="4"
                      strokeDasharray={`${(passRate / 100) * 125.66} 125.66`}
                      strokeLinecap="round"
                      transform="rotate(-90 24 24)"
                    />
                    <text x="24" y="28" textAnchor="middle" fontSize="11" fontWeight="700" fill={passRate >= 80 ? "#16a34a" : passRate >= 50 ? "#d97706" : "#dc2626"}>{passRate}%</text>
                  </svg>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground font-medium">Pass Rate</div>
                  <div className="text-2xl font-bold">{stats.passed}<span className="text-sm font-normal text-muted-foreground">/{stats.total}</span></div>
                  <div className="text-[10px] text-muted-foreground">checks passed</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={attentionCount > 0 ? "border-amber-200 dark:border-amber-800" : ""}>
            <CardContent className="p-4 text-center">
              <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${attentionCount > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
              <div className={`text-2xl font-bold ${attentionCount > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{attentionCount}</div>
              <div className="text-xs text-muted-foreground">Needs Attention</div>
              {attentionCount > 0 && (
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  {stats.pending > 0 && (
                    <button className="text-[10px] text-amber-600 hover:underline" onClick={() => setStatusFilter("pending")}>
                      {stats.pending} pending
                    </button>
                  )}
                  {stats.failedExpired > 0 && (
                    <button className="text-[10px] text-red-600 hover:underline" onClick={() => { setSearchTerm(""); setCheckTypeFilter("all"); setStatusFilter("failed"); }}>
                      {stats.failedExpired} failed/expired
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 text-center">
              <Loader2 className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400" data-testid="text-in-progress-checks">{stats.inProgress}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </CardContent>
          </Card>

          <Card className={stats.failedExpired > 0 ? "border-red-200 dark:border-red-800" : ""}>
            <CardContent className="p-4 text-center">
              <XCircle className={`w-5 h-5 mx-auto mb-1 ${stats.failedExpired > 0 ? "text-red-500" : "text-muted-foreground"}`} />
              <div className={`text-2xl font-bold ${stats.failedExpired > 0 ? "text-red-600 dark:text-red-400" : ""}`} data-testid="text-failed-expired-checks">{stats.failedExpired}</div>
              <div className="text-xs text-muted-foreground">Failed / Expired</div>
            </CardContent>
          </Card>
        </div>
      )}

      {stats.total === 0 && !isLoading && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="text-2xl font-bold" data-testid="text-total-checks">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Checks</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-vetting"
            placeholder="Search by employee name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={checkTypeFilter} onValueChange={setCheckTypeFilter}>
          <SelectTrigger className="w-[200px]" data-testid="select-filter-check-type">
            <SelectValue placeholder="All Check Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Check Types</SelectItem>
            {CHECK_TYPES.map((ct) => (
              <SelectItem key={ct} value={ct}>{ct}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-56 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No vetting records found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || checkTypeFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Vetting records will appear here once checks have been initiated."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const conf = STATUS_CONFIG[record.status || "not_started"] || STATUS_CONFIG.not_started;
            const StatusIcon = conf.icon;
            return (
              <Card
                key={record.id}
                className={`cursor-pointer transition-all border hover:shadow-md ${conf.borderColor}`}
                onClick={() => openDetailDialog(record)}
                data-testid={`card-vetting-${record.id}`}
              >
                <CardContent className={`p-4 ${conf.bgColor} rounded-lg`}>
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${conf.dotColor}`}>
                      <StatusIcon className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm" data-testid={`text-employee-name-${record.id}`}>
                            {record.employeeName || "Unknown Employee"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {record.checkType}
                            {record.employeeNumber ? ` • #${record.employeeNumber}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {record.referenceNumber && (
                            <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">
                              Ref: {record.referenceNumber}
                            </span>
                          )}
                          <Badge
                            className={`no-default-hover-elevate no-default-active-elevate ${conf.className} text-[10px] h-5`}
                            data-testid={`badge-status-${record.id}`}
                          >
                            {conf.label}
                          </Badge>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDetailDialog(record);
                            }}
                            data-testid={`button-view-${record.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5" />
                          <span>Req: {formatDate(record.requestedDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-2.5 h-2.5" />
                          <span>Done: {formatDate(record.completedDate)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Exp: {formatDate(record.expiryDate)}</span>
                        </div>
                      </div>
                      {record.notes && (
                        <p className="text-[10px] text-muted-foreground mt-1.5 truncate border-t border-current/10 pt-1.5">{record.notes}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Initiate Vetting Check</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!createForm.employeeId || !createForm.checkType) {
                toast({ title: "Validation Error", description: "Please select an employee and check type.", variant: "destructive" });
                return;
              }
              createMutation.mutate(createForm);
            }}
            className="space-y-4 mt-2"
            data-testid="form-create-vetting"
          >
            <div className="space-y-2">
              <Label>Employee *</Label>
              <Select
                value={createForm.employeeId}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, employeeId: v }))}
              >
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select an employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={String(emp.id)}>
                      {emp.firstName} {emp.lastName}
                      {emp.employeeNumber ? ` (#${emp.employeeNumber})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Check Type *</Label>
              <Select
                value={createForm.checkType}
                onValueChange={(v) => setCreateForm((f) => ({ ...f, checkType: v }))}
              >
                <SelectTrigger data-testid="select-check-type">
                  <SelectValue placeholder="Select check type" />
                </SelectTrigger>
                <SelectContent>
                  {CHECK_TYPES.map((ct) => (
                    <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reference Number</Label>
              <Input
                data-testid="input-reference-number"
                placeholder="Enter reference number"
                value={createForm.referenceNumber}
                onChange={(e) => setCreateForm((f) => ({ ...f, referenceNumber: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Requested Date</Label>
              <Input
                data-testid="input-requested-date"
                type="date"
                value={createForm.requestedDate}
                onChange={(e) => setCreateForm((f) => ({ ...f, requestedDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input
                data-testid="input-create-notes"
                placeholder="Additional notes..."
                value={createForm.notes}
                onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createMutation.isPending}
              data-testid="button-submit-create"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-2" />
              )}
              Initiate Check
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRecord} onOpenChange={() => setSelectedRecord(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedRecord && (
            <>
              <DialogHeader>
                <div className="flex items-start gap-4">
                  {(() => {
                    const conf = STATUS_CONFIG[selectedRecord.status || "not_started"] || STATUS_CONFIG.not_started;
                    const StatusIcon = conf.icon;
                    return (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${conf.dotColor}`}>
                        <StatusIcon className="w-6 h-6 text-white" />
                      </div>
                    );
                  })()}
                  <div className="min-w-0 flex-1">
                    <DialogTitle data-testid="text-detail-employee-name">
                      {selectedRecord.employeeName || "Unknown Employee"}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{selectedRecord.checkType}</p>
                    {selectedRecord.referenceNumber && (
                      <p className="text-xs text-muted-foreground font-mono">Ref: {selectedRecord.referenceNumber}</p>
                    )}
                  </div>
                  <div className="ml-auto flex-shrink-0">
                    {(() => {
                      const conf = STATUS_CONFIG[selectedRecord.status || "not_started"] || STATUS_CONFIG.not_started;
                      return (
                        <Badge
                          className={`no-default-hover-elevate no-default-active-elevate ${conf.className}`}
                          data-testid="badge-detail-status"
                        >
                          {conf.label}
                        </Badge>
                      );
                    })()}
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm p-4 rounded-lg bg-muted/30 border">
                  <div>
                    <span className="text-muted-foreground text-xs font-medium">Reference Number</span>
                    <p className="font-medium mt-0.5" data-testid="text-detail-reference">{selectedRecord.referenceNumber || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-medium">Employee Number</span>
                    <p className="font-medium mt-0.5">{selectedRecord.employeeNumber || "N/A"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-medium">Requested Date</span>
                    <p className="font-medium mt-0.5">{formatDate(selectedRecord.requestedDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-medium">Completed Date</span>
                    <p className="font-medium mt-0.5">{formatDate(selectedRecord.completedDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-medium">Expiry Date</span>
                    <p className="font-medium mt-0.5">{formatDate(selectedRecord.expiryDate)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs font-medium">Result</span>
                    <p className="font-medium mt-0.5">{selectedRecord.result || "N/A"}</p>
                  </div>
                </div>

                {selectedRecord.notes && (
                  <div className="text-sm p-3 rounded-lg bg-muted/20 border">
                    <span className="text-muted-foreground text-xs font-medium">Notes</span>
                    <p className="font-medium mt-0.5">{selectedRecord.notes}</p>
                  </div>
                )}

                <div className="border-t pt-4">
                  <h4 className="text-sm font-semibold mb-3">Update Record</h4>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (selectedRecord) {
                        updateMutation.mutate({ id: selectedRecord.id, data: updateForm });
                      }
                    }}
                    className="space-y-4"
                    data-testid="form-update-vetting"
                  >
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={updateForm.status}
                        onValueChange={(v) => setUpdateForm((f) => ({ ...f, status: v }))}
                      >
                        <SelectTrigger data-testid="select-update-status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Result</Label>
                      <Input
                        data-testid="input-update-result"
                        placeholder="Enter result"
                        value={updateForm.result}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, result: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Completed Date</Label>
                        <Input
                          data-testid="input-update-completed-date"
                          type="date"
                          value={updateForm.completedDate}
                          onChange={(e) => setUpdateForm((f) => ({ ...f, completedDate: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Expiry Date</Label>
                        <Input
                          data-testid="input-update-expiry-date"
                          type="date"
                          value={updateForm.expiryDate}
                          onChange={(e) => setUpdateForm((f) => ({ ...f, expiryDate: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input
                        data-testid="input-update-notes"
                        placeholder="Additional notes..."
                        value={updateForm.notes}
                        onChange={(e) => setUpdateForm((f) => ({ ...f, notes: e.target.value }))}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={updateMutation.isPending}
                      data-testid="button-submit-update"
                    >
                      {updateMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 mr-2" />
                      )}
                      Update Record
                    </Button>
                  </form>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
