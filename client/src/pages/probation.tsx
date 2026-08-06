import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Calendar, CheckCircle2, XCircle, Clock, AlertTriangle,
  Plus, Users, RefreshCw, User, Loader2, ChevronRight,
} from "lucide-react";

type ProbationRecord = {
  id: number;
  employeeId: number;
  tenantId: number;
  startDate: string;
  reviewDate: string;
  extendedReviewDate: string | null;
  status: "active" | "passed" | "extended" | "failed";
  outcomeNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string | null;
  employee: {
    id: number;
    first_name: string;
    last_name: string;
    job_title: string | null;
    department: string | null;
  } | null;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: "Active", color: "bg-blue-100 text-blue-700 border-blue-200", icon: Clock },
  passed: { label: "Passed", color: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2 },
  extended: { label: "Extended", color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
  failed: { label: "Failed", color: "bg-red-100 text-red-700 border-red-200", icon: XCircle },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function getDaysUntil(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return diff;
}

function DaysChip({ days }: { days: number | null }) {
  if (days === null) return null;
  if (days < 0) return <span className="text-xs text-red-600 font-medium">{Math.abs(days)}d overdue</span>;
  if (days === 0) return <span className="text-xs text-red-600 font-semibold">Due today</span>;
  if (days <= 7) return <span className="text-xs text-red-500 font-medium">{days}d remaining</span>;
  if (days <= 28) return <span className="text-xs text-amber-600 font-medium">{days}d remaining</span>;
  return <span className="text-xs text-muted-foreground">{days}d remaining</span>;
}

export default function ProbationPage() {
  const { toast } = useToast();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showOutcomeDialog, setShowOutcomeDialog] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ProbationRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [createForm, setCreateForm] = useState({
    employeeId: "",
    startDate: "",
    reviewDate: "",
    outcomeNotes: "",
  });
  const [outcomeForm, setOutcomeForm] = useState({
    status: "passed",
    outcomeNotes: "",
    extendedReviewDate: "",
  });

  const { data: records = [], isLoading } = useQuery<ProbationRecord[]>({
    queryKey: ["/api/admin/probation-records"],
  });

  const { data: dueThisMonth = [] } = useQuery<ProbationRecord[]>({
    queryKey: ["/api/admin/probation-records/due-this-month"],
  });

  const { data: employees = [] } = useQuery<Array<{ id: number; firstName: string; lastName: string }>>({
    queryKey: ["/api/admin/employees"],
    queryFn: async () => {
      const res = await fetch("/api/admin/employees", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.data || []);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/probation-records", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Probation record created" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/probation-records"] });
      setShowCreateDialog(false);
      setCreateForm({ employeeId: "", startDate: "", reviewDate: "", outcomeNotes: "" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const outcomeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/probation-records/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Probation outcome recorded" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/probation-records"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/probation-records/due-this-month"] });
      setShowOutcomeDialog(false);
      setSelectedRecord(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = statusFilter === "all" ? records : records.filter(r => r.status === statusFilter);

  const stats = {
    total: records.length,
    active: records.filter(r => r.status === "active").length,
    passed: records.filter(r => r.status === "passed").length,
    extended: records.filter(r => r.status === "extended").length,
    failed: records.filter(r => r.status === "failed").length,
    dueThisMonth: dueThisMonth.length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F] flex items-center gap-2">
            <ClipboardList className="w-6 h-6" />
            Probation Tracking
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Manage new starter probation periods and outcomes</p>
        </div>
        <Button
          className="bg-[#FF8C42] hover:bg-[#e87d38] text-white"
          onClick={() => setShowCreateDialog(true)}
          data-testid="button-create-probation"
        >
          <Plus className="w-4 h-4 mr-2" /> New Probation Record
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: "Total", value: stats.total, icon: Users, color: "text-[#1F3A5F]" },
          { label: "Active", value: stats.active, icon: Clock, color: "text-blue-600" },
          { label: "Passed", value: stats.passed, icon: CheckCircle2, color: "text-green-600" },
          { label: "Extended", value: stats.extended, icon: AlertTriangle, color: "text-amber-600" },
          { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-600" },
          { label: "Due This Month", value: stats.dueThisMonth, icon: Calendar, color: "text-[#FF8C42]" },
        ].map(s => (
          <Card key={s.label} className="text-center">
            <CardContent className="pt-4 pb-3">
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Due This Month Panel */}
      {dueThisMonth.length > 0 && (
        <Card className="border-[#FF8C42]/30 bg-orange-50/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-[#FF8C42]">
              <Calendar className="w-4 h-4" />
              Probations Due This Month ({dueThisMonth.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {dueThisMonth.map(r => {
                const effectiveDate = r.extendedReviewDate || r.reviewDate;
                const days = getDaysUntil(effectiveDate);
                return (
                  <div key={r.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-orange-100" data-testid={`due-this-month-${r.id}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#1F3A5F]/10 flex items-center justify-center text-xs font-bold text-[#1F3A5F]">
                        {r.employee ? `${r.employee.first_name?.[0]}${r.employee.last_name?.[0]}` : "?"}
                      </div>
                      <div>
                        <div className="text-sm font-medium">
                          {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `Employee #${r.employeeId}`}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.employee?.job_title || "N/A"}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{r.extendedReviewDate ? "Extended Date" : "Review Date"}</div>
                        <div className="text-sm font-medium">{formatDate(effectiveDate)}</div>
                        <DaysChip days={days} />
                      </div>
                      <Button
                        size="sm"
                        className="bg-[#FF8C42] hover:bg-[#e87d38] text-white"
                        data-testid={`button-record-outcome-${r.id}`}
                        onClick={() => {
                          setSelectedRecord(r);
                          setOutcomeForm({ status: "passed", outcomeNotes: "", extendedReviewDate: "" });
                          setShowOutcomeDialog(true);
                        }}
                      >
                        Record Outcome
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter + List */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">All Probation Records</CardTitle>
            <Select value={statusFilter} onValueChange={setStatusFilter} data-testid="select-status-filter">
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="passed">Passed</SelectItem>
                <SelectItem value="extended">Extended</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No probation records found</p>
              <p className="text-xs mt-1">Click "New Probation Record" to add one</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Employee</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Start Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Review Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map(r => {
                    const cfg = STATUS_CONFIG[r.status] || STATUS_CONFIG.active;
                    const days = (r.status === "active" || r.status === "extended") ? getDaysUntil(r.extendedReviewDate || r.reviewDate) : null;
                    return (
                      <tr key={r.id} className="hover:bg-gray-50" data-testid={`row-probation-${r.id}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-[#1F3A5F]/10 flex items-center justify-center text-xs font-bold text-[#1F3A5F]">
                              {r.employee ? `${r.employee.first_name?.[0]}${r.employee.last_name?.[0]}` : "?"}
                            </div>
                            <div>
                              <div className="font-medium">
                                {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `Employee #${r.employeeId}`}
                              </div>
                              <div className="text-xs text-muted-foreground">{r.employee?.job_title || "—"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDate(r.startDate)}</td>
                        <td className="px-4 py-3">
                          <div>{formatDate(r.extendedReviewDate || r.reviewDate)}</div>
                          <DaysChip days={days} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                            <cfg.icon className="w-3 h-3" />
                            {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(r.status === "active" || r.status === "extended") && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              data-testid={`button-outcome-${r.id}`}
                              onClick={() => {
                                setSelectedRecord(r);
                                setOutcomeForm({ status: "passed", outcomeNotes: "", extendedReviewDate: "" });
                                setShowOutcomeDialog(true);
                              }}
                            >
                              Record Outcome <ChevronRight className="w-3 h-3 ml-1" />
                            </Button>
                          )}
                          {(r.status === "passed" || r.status === "failed") && r.outcomeNotes && (
                            <span className="text-xs text-muted-foreground italic truncate max-w-[180px] block text-right">{r.outcomeNotes}</span>
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

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Probation Record</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Employee *</Label>
              <Select
                value={createForm.employeeId}
                onValueChange={v => setCreateForm(f => ({ ...f, employeeId: v }))}
              >
                <SelectTrigger data-testid="select-employee">
                  <SelectValue placeholder="Select employee..." />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e: any) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.firstName} {e.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Date *</Label>
                <Input
                  type="date"
                  value={createForm.startDate}
                  onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Review Date *</Label>
                <Input
                  type="date"
                  value={createForm.reviewDate}
                  onChange={e => setCreateForm(f => ({ ...f, reviewDate: e.target.value }))}
                  data-testid="input-review-date"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea
                placeholder="Any initial notes..."
                value={createForm.outcomeNotes}
                onChange={e => setCreateForm(f => ({ ...f, outcomeNotes: e.target.value }))}
                rows={2}
                data-testid="textarea-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              className="bg-[#FF8C42] hover:bg-[#e87d38] text-white"
              disabled={!createForm.employeeId || !createForm.startDate || !createForm.reviewDate || createMutation.isPending}
              onClick={() => createMutation.mutate(createForm)}
              data-testid="button-confirm-create"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Outcome Dialog */}
      <Dialog open={showOutcomeDialog} onOpenChange={setShowOutcomeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Probation Outcome</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              <div className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="font-medium">
                  {selectedRecord.employee
                    ? `${selectedRecord.employee.first_name} ${selectedRecord.employee.last_name}`
                    : `Employee #${selectedRecord.employeeId}`}
                </div>
                <div className="text-muted-foreground text-xs mt-0.5">
                  Review Date: {formatDate(selectedRecord.extendedReviewDate || selectedRecord.reviewDate)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Outcome *</Label>
                <Select
                  value={outcomeForm.status}
                  onValueChange={v => setOutcomeForm(f => ({ ...f, status: v }))}
                >
                  <SelectTrigger data-testid="select-outcome">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passed">Pass — Probation completed successfully</SelectItem>
                    <SelectItem value="extended">Extend — Set new review date</SelectItem>
                    <SelectItem value="failed">Fail — Probation failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {outcomeForm.status === "extended" && (
                <div className="space-y-1">
                  <Label className="text-xs">New Review Date *</Label>
                  <Input
                    type="date"
                    value={outcomeForm.extendedReviewDate}
                    onChange={e => setOutcomeForm(f => ({ ...f, extendedReviewDate: e.target.value }))}
                    data-testid="input-extended-review-date"
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Outcome Notes</Label>
                <Textarea
                  placeholder="Notes on the outcome, performance, next steps..."
                  value={outcomeForm.outcomeNotes}
                  onChange={e => setOutcomeForm(f => ({ ...f, outcomeNotes: e.target.value }))}
                  rows={3}
                  data-testid="textarea-outcome-notes"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOutcomeDialog(false)}>Cancel</Button>
            <Button
              className={outcomeForm.status === "failed" ? "bg-red-600 hover:bg-red-700 text-white" : outcomeForm.status === "passed" ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#FF8C42] hover:bg-[#e87d38] text-white"}
              disabled={
                outcomeMutation.isPending ||
                (outcomeForm.status === "extended" && !outcomeForm.extendedReviewDate)
              }
              onClick={() => {
                if (!selectedRecord) return;
                outcomeMutation.mutate({
                  id: selectedRecord.id,
                  data: {
                    status: outcomeForm.status,
                    outcomeNotes: outcomeForm.outcomeNotes || undefined,
                    extendedReviewDate: outcomeForm.status === "extended" ? outcomeForm.extendedReviewDate : undefined,
                  },
                });
              }}
              data-testid="button-confirm-outcome"
            >
              {outcomeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {outcomeForm.status === "passed" ? "Pass Probation" : outcomeForm.status === "failed" ? "Fail Probation" : "Extend Probation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
