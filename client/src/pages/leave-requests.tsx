import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  type LucideIcon, CalendarOff, CheckCircle2, XCircle, Clock, AlertCircle,
  Loader2, Search, Calendar, User, CalendarDays, TrendingDown, RotateCcw, Settings2,
} from "lucide-react";

type EnrichedTimeOffRequest = {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
  employeeName: string;
  employeeNumber: string | null;
  employeeId: number;
  reviewerName: string | null;
};

type LeaveBalance = {
  entitlement: number;
  carriedForward: number;
  adjustments: number;
  used: number;
  remaining: number;
  year: number;
};

type AdjustDialogState = {
  request: EnrichedTimeOffRequest;
} | null;

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual_leave: "Annual Leave",
  sick_leave: "Sick Leave",
  personal: "Personal",
  training: "Training",
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400", icon: AlertCircle },
};

function BalancePill({ balance, loading }: { balance: LeaveBalance | undefined; loading: boolean }) {
  if (loading) return <span className="text-xs text-muted-foreground">Loading balance…</span>;
  if (!balance) return null;
  const rem = balance.remaining;
  const colorClass = rem > 10 ? "text-green-700 bg-green-50 border-green-200 dark:bg-green-900/20 dark:text-green-300"
    : rem > 5 ? "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300"
    : "text-red-700 bg-red-50 border-red-200 dark:bg-red-900/20 dark:text-red-300";
  return (
    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${colorClass}`} data-testid="badge-leave-balance">
      <CalendarDays className="w-3 h-3" />
      {rem} day{rem !== 1 ? "s" : ""} remaining
      <span className="text-muted-foreground font-normal">({balance.used} used / {balance.entitlement + balance.carriedForward + balance.adjustments} total)</span>
    </div>
  );
}

function EmployeeBalanceRow({ employeeId }: { employeeId: number }) {
  const year = new Date().getFullYear();
  const { data: balance, isLoading } = useQuery<LeaveBalance>({
    queryKey: ["/api/hr/leave-balance", employeeId, year],
    queryFn: async () => {
      const res = await fetch(`/api/hr/leave-balance/${employeeId}?year=${year}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });
  return <BalancePill balance={balance} loading={isLoading} />;
}

export default function LeaveRequestsPage() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [actionDialog, setActionDialog] = useState<{ request: EnrichedTimeOffRequest; action: "approve" | "reject" } | null>(null);
  const [actionNote, setActionNote] = useState<string>("");
  const [adjustDialog, setAdjustDialog] = useState<AdjustDialogState>(null);
  const [adjustForm, setAdjustForm] = useState<{ entitlementDays: string; adjustmentDays: string; adjustmentReason: string }>({ entitlementDays: "28", adjustmentDays: "0", adjustmentReason: "" });
  const [yearEndDialog, setYearEndDialog] = useState(false);
  const [yearEndForm, setYearEndForm] = useState<{ fromYear: string; capDays: string }>({ fromYear: String(new Date().getFullYear() - 1), capDays: "5" });

  const { data: requests = [], isLoading } = useQuery<EnrichedTimeOffRequest[]>({
    queryKey: ["/api/admin/time-off-requests", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/admin/time-off-requests?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load requests");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/time-off-requests/${id}/approve`, { note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/time-off-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balance"] });
      toast({ title: "Request approved", description: "The time-off request has been approved." });
      setActionDialog(null);
      setActionNote("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/time-off-requests/${id}/reject`, { note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/time-off-requests"] });
      toast({ title: "Request rejected", description: "The time-off request has been rejected." });
      setActionDialog(null);
      setActionNote("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const adjustMutation = useMutation({
    mutationFn: async (data: { employeeId: number; year: number; entitlementDays: number; adjustmentDays: number; adjustmentReason: string }) => {
      const res = await apiRequest("POST", "/api/hr/leave-entitlements", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balance"] });
      toast({ title: "Balance updated", description: "Leave entitlement has been updated." });
      setAdjustDialog(null);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const yearEndMutation = useMutation({
    mutationFn: async (data: { fromYear: number; capDays: number }) => {
      const res = await apiRequest("POST", "/api/hr/leave-entitlements/year-end", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/leave-balance"] });
      toast({ title: "Year-end complete", description: data.message });
      setYearEndDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.employeeName.toLowerCase().includes(q) ||
      (r.employeeNumber?.toLowerCase().includes(q) ?? false) ||
      LEAVE_TYPE_LABELS[r.leaveType]?.toLowerCase().includes(q)
    );
  });

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const handleAction = () => {
    if (!actionDialog) return;
    const { request, action } = actionDialog;
    if (action === "approve") {
      approveMutation.mutate({ id: request.id, note: actionNote || undefined });
    } else {
      rejectMutation.mutate({ id: request.id, note: actionNote || undefined });
    }
  };

  const openAdjustDialog = async (request: EnrichedTimeOffRequest) => {
    setAdjustDialog({ request });
    setAdjustForm({ entitlementDays: "28", adjustmentDays: "0", adjustmentReason: "" });
    try {
      const year = new Date().getFullYear();
      const res = await fetch(`/api/hr/leave-balance/${request.employeeId}?year=${year}`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setAdjustForm({
          entitlementDays: String(data.entitlement ?? 28),
          adjustmentDays: String(data.adjustments ?? 0),
          adjustmentReason: "",
        });
      }
    } catch { /* leave defaults */ }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="leave-requests-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Leave Requests</h1>
          <p className="text-muted-foreground text-sm">Review and manage employee time-off requests.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pendingCount > 0 && (
            <Badge variant="default" className="bg-amber-500 border-amber-500 text-white" data-testid="badge-pending-count">
              <Clock className="w-3 h-3 mr-1" />
              {pendingCount} pending
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => setYearEndDialog(true)} data-testid="button-year-end">
            <RotateCcw className="w-4 h-4 mr-1" /> Year-End Carry-Forward
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <CalendarOff className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold">No leave requests found</h3>
            <p className="text-sm text-muted-foreground">
              {requests.length > 0 ? "Try adjusting your filters." : "No time-off requests have been submitted yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredRequests.map((req) => {
            const statusConf = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusConf.icon;
            return (
              <Card key={req.id} data-testid={`card-leave-request-${req.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 text-sm font-medium" data-testid={`text-employee-name-${req.id}`}>
                          <User className="w-3.5 h-3.5 text-muted-foreground" />
                          {req.employeeName}
                          {req.employeeNumber && (
                            <span className="text-xs text-muted-foreground font-mono ml-1">({req.employeeNumber})</span>
                          )}
                        </div>
                        <Badge variant="outline" className={statusConf.className} data-testid={`badge-status-${req.id}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {statusConf.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                        <span className="font-medium" data-testid={`text-leave-type-${req.id}`}>
                          {LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span data-testid={`text-dates-${req.id}`}>
                            {new Date(req.startDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {req.startDate !== req.endDate && (
                              <> – {new Date(req.endDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                            )}
                          </span>
                        </span>
                        <span className="text-xs font-medium" data-testid={`text-days-${req.id}`}>
                          {req.totalDays} day{req.totalDays !== 1 ? "s" : ""}
                        </span>
                      </div>
                      {req.leaveType === "annual_leave" && (
                        <div data-testid={`balance-employee-${req.id}`}>
                          <EmployeeBalanceRow employeeId={req.employeeId} />
                        </div>
                      )}
                      {req.notes && (
                        <p className="text-xs text-muted-foreground" data-testid={`text-notes-${req.id}`}>{req.notes}</p>
                      )}
                      {req.reviewNote && (
                        <p className="text-xs text-muted-foreground italic" data-testid={`text-review-note-${req.id}`}>
                          Note: {req.reviewNote}
                          {req.reviewerName && ` — ${req.reviewerName}`}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground h-8 px-2"
                        onClick={() => openAdjustDialog(req)}
                        data-testid={`button-adjust-balance-${req.id}`}
                        title="Adjust leave balance"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      {req.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                            onClick={() => { setActionDialog({ request: req, action: "approve" }); setActionNote(""); }}
                            data-testid={`button-approve-${req.id}`}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30 hover:bg-destructive/10"
                            onClick={() => { setActionDialog({ request: req, action: "reject" }); setActionNote(""); }}
                            data-testid={`button-reject-${req.id}`}
                          >
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!actionDialog} onOpenChange={(open) => { if (!open) { setActionDialog(null); setActionNote(""); } }}>
        <DialogContent data-testid="dialog-action">
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === "approve" ? "Approve" : "Reject"} Time-Off Request
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.request && (
                <>
                  {LEAVE_TYPE_LABELS[actionDialog.request.leaveType]} for{" "}
                  <strong>{actionDialog.request.employeeName}</strong> —{" "}
                  {new Date(actionDialog.request.startDate + "T00:00:00").toLocaleDateString("en-GB")} to{" "}
                  {new Date(actionDialog.request.endDate + "T00:00:00").toLocaleDateString("en-GB")}{" "}
                  ({actionDialog.request.totalDays} day{actionDialog.request.totalDays !== 1 ? "s" : ""})
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {actionDialog?.request && actionDialog.request.leaveType === "annual_leave" && (
            <div className="rounded-lg border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Current Leave Balance</p>
              <EmployeeBalanceRow employeeId={actionDialog.request.employeeId} />
            </div>
          )}
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="action-note">Note (optional)</Label>
              <Textarea
                id="action-note"
                placeholder="Add an optional note for the employee..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                rows={3}
                className="resize-none"
                data-testid="textarea-action-note"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setActionNote(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={approveMutation.isPending || rejectMutation.isPending}
              className={actionDialog?.action === "approve" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
              data-testid="button-confirm-action"
            >
              {(approveMutation.isPending || rejectMutation.isPending) && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              {actionDialog?.action === "approve" ? "Approve Request" : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!adjustDialog} onOpenChange={(open) => { if (!open) setAdjustDialog(null); }}>
        <DialogContent data-testid="dialog-adjust-balance">
          <DialogHeader>
            <DialogTitle>Adjust Leave Balance</DialogTitle>
            <DialogDescription>
              {adjustDialog?.request && (
                <>Manually adjust leave entitlement for <strong>{adjustDialog.request.employeeName}</strong> for {new Date().getFullYear()}.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entitlement-days">Annual Entitlement (days)</Label>
                <Input
                  id="entitlement-days"
                  type="number"
                  min={0}
                  max={365}
                  value={adjustForm.entitlementDays}
                  onChange={(e) => setAdjustForm(f => ({ ...f, entitlementDays: e.target.value }))}
                  data-testid="input-entitlement-days"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjustment-days">Adjustment (days, +/-)</Label>
                <Input
                  id="adjustment-days"
                  type="number"
                  value={adjustForm.adjustmentDays}
                  onChange={(e) => setAdjustForm(f => ({ ...f, adjustmentDays: e.target.value }))}
                  data-testid="input-adjustment-days"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adjustment-reason">Reason for adjustment *</Label>
              <Textarea
                id="adjustment-reason"
                placeholder="e.g. Extra days awarded for service milestone"
                value={adjustForm.adjustmentReason}
                onChange={(e) => setAdjustForm(f => ({ ...f, adjustmentReason: e.target.value }))}
                rows={2}
                className="resize-none"
                data-testid="textarea-adjustment-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (!adjustDialog) return;
                adjustMutation.mutate({
                  employeeId: adjustDialog.request.employeeId,
                  year: new Date().getFullYear(),
                  entitlementDays: parseInt(adjustForm.entitlementDays) || 28,
                  adjustmentDays: parseInt(adjustForm.adjustmentDays) || 0,
                  adjustmentReason: adjustForm.adjustmentReason,
                });
              }}
              disabled={adjustMutation.isPending || !adjustForm.adjustmentReason.trim()}
              data-testid="button-confirm-adjust"
            >
              {adjustMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Save Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={yearEndDialog} onOpenChange={setYearEndDialog}>
        <DialogContent data-testid="dialog-year-end">
          <DialogHeader>
            <DialogTitle>Year-End Carry-Forward</DialogTitle>
            <DialogDescription>
              Roll unused annual leave days from one year into the next, up to the configured cap.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-year">From Year</Label>
                <Input
                  id="from-year"
                  type="number"
                  value={yearEndForm.fromYear}
                  onChange={(e) => setYearEndForm(f => ({ ...f, fromYear: e.target.value }))}
                  data-testid="input-from-year"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cap-days">Max carry-forward (days)</Label>
                <Input
                  id="cap-days"
                  type="number"
                  min={0}
                  value={yearEndForm.capDays}
                  onChange={(e) => setYearEndForm(f => ({ ...f, capDays: e.target.value }))}
                  data-testid="input-cap-days"
                />
              </div>
            </div>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-400">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                This will calculate unused leave for all employees in {yearEndForm.fromYear} and carry up to{" "}
                <strong>{yearEndForm.capDays} days</strong> into {parseInt(yearEndForm.fromYear) + 1}. Existing carry-forward amounts will be overwritten.
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setYearEndDialog(false)}>Cancel</Button>
            <Button
              onClick={() => yearEndMutation.mutate({ fromYear: parseInt(yearEndForm.fromYear), capDays: parseInt(yearEndForm.capDays) })}
              disabled={yearEndMutation.isPending}
              data-testid="button-confirm-year-end"
            >
              {yearEndMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Run Carry-Forward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
