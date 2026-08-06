import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, UserPlus, UserMinus, Briefcase, Building2,
  CalendarOff, Clock, CheckCircle2, XCircle, ShieldCheck,
  AlertTriangle, ClipboardList, GraduationCap,
  ChevronRight, Loader2, RefreshCw, BookOpen,
} from "lucide-react";

type HrDashboardData = {
  headcount: {
    totalActive: number;
    startersThisMonth: number;
    leaversThisMonth: number;
    contractors: number;
    inHouse: number;
  };
  leaveToday: Array<{
    id: number;
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    employee_name: string;
    employee_number: string | null;
  }>;
  pendingLeave: Array<{
    id: number;
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days: number;
    notes: string | null;
    created_at: string;
    employee_name: string;
    employee_number: string | null;
  }>;
  compliance: {
    sia: { expiring30: number; expiring60: number; expiring90: number };
    dbs: { expiring30: number; expiring60: number; expiring90: number };
    visa: { expiring30: number; expiring60: number; expiring90: number };
    brp: { expiring30: number; expiring60: number; expiring90: number };
    drillDown: Array<{
      employee_id: number;
      name: string;
      employee_number: string | null;
      sia_expiry_date: string | null;
      dbs_renewal_date: string | null;
      visa_expiry_date: string | null;
      brp_expiry: string | null;
    }>;
  };
  openCases: {
    vettingChecks: number;
    incidents: number;
    disciplinaries: number;
    grievances: number;
  };
  probationsDue: Array<{
    employee_id: number;
    name: string;
    employee_number: string | null;
    start_date: string;
    review_date: string;
    job_title: string | null;
    department: string | null;
  }>;
  trainingOverdue: Array<{
    employee_id: number;
    name: string;
    employee_number: string | null;
    has_first_aid: boolean;
    first_aid_expiry: string | null;
    reason: string;
  }>;
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual_leave: "Annual Leave",
  sick_leave: "Sick Leave",
  personal: "Personal",
  training: "Training",
};

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function expiryBadge(dateStr: string | null | undefined) {
  const days = daysUntil(dateStr);
  if (days === null) return null;
  if (days < 0) return <Badge className="bg-red-600 text-white text-xs">Expired</Badge>;
  if (days <= 30) return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">{days}d</Badge>;
  if (days <= 60) return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{days}d</Badge>;
  return <Badge className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">{days}d</Badge>;
}

function HeatCell({ count, label }: { count: number; label: string }) {
  const cls = count === 0
    ? "bg-gray-50 text-gray-400"
    : label === "30d"
      ? "bg-red-100 text-red-700 font-semibold"
      : label === "60d"
        ? "bg-amber-100 text-amber-700 font-semibold"
        : "bg-yellow-50 text-yellow-700 font-semibold";
  return (
    <div className={`rounded px-2 py-1 text-center text-sm min-w-[48px] ${cls}`}>
      <div className="text-lg leading-tight font-bold">{count}</div>
      <div className="text-xs opacity-70">{label}</div>
    </div>
  );
}

export default function HrDashboardPage() {
  const { toast } = useToast();
  const [drillDownOpen, setDrillDownOpen] = useState(false);
  const [approveDialog, setApproveDialog] = useState<{ id: number; name: string } | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ id: number; name: string } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const { data, isLoading, isError, error, refetch, isRefetching } = useQuery<HrDashboardData>({
    queryKey: ["/api/hr/dashboard"],
    retry: 1,
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note?: string }) => {
      const res = await apiRequest("POST", `/api/admin/time-off-requests/${id}/approve`, { note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/time-off-requests"] });
      toast({ title: "Approved", description: "Leave request approved." });
      setApproveDialog(null);
      setReviewNote("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, note }: { id: number; note: string }) => {
      const res = await apiRequest("POST", `/api/admin/time-off-requests/${id}/reject`, { note });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/hr/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/time-off-requests"] });
      toast({ title: "Rejected", description: "Leave request rejected." });
      setRejectDialog(null);
      setReviewNote("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (isError) {
    const errMsg = (error as Error)?.message || "Failed to load HR dashboard";
    const isForbidden = errMsg.toLowerCase().includes("forbidden") || errMsg.includes("403");
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mb-4" />
        <h2 className="text-xl font-semibold mb-2">
          {isForbidden ? "Access Restricted" : "Could Not Load Dashboard"}
        </h2>
        <p className="text-muted-foreground max-w-md mb-6">
          {isForbidden
            ? "You don't have permission to view the HR Dashboard. Contact your administrator if you believe this is an error."
            : errMsg}
        </p>
        {!isForbidden && (
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" /> Try Again
          </Button>
        )}
      </div>
    );
  }

  const d = data!;
  const totalComplianceExpiring30 =
    d.compliance.sia.expiring30 + d.compliance.dbs.expiring30 +
    d.compliance.visa.expiring30 + d.compliance.brp.expiring30;
  const totalOpenCases =
    d.openCases.vettingChecks + d.openCases.incidents +
    d.openCases.disciplinaries + d.openCases.grievances;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">HR Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Workforce overview at a glance</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isRefetching}
          data-testid="button-refresh-hr-dashboard"
        >
          {isRefetching ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {/* Headcount Summary */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Headcount</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <Card className="border-l-4 border-l-[#1F3A5F]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#1F3A5F]/10 rounded-lg">
                  <Users className="w-5 h-5 text-[#1F3A5F]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1F3A5F]" data-testid="stat-total-active">{d.headcount.totalActive}</p>
                  <p className="text-xs text-muted-foreground">Active Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-50 rounded-lg">
                  <UserPlus className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600" data-testid="stat-starters">{d.headcount.startersThisMonth}</p>
                  <p className="text-xs text-muted-foreground">Starters (Month)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-red-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-50 rounded-lg">
                  <UserMinus className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-500" data-testid="stat-leavers">{d.headcount.leaversThisMonth}</p>
                  <p className="text-xs text-muted-foreground">Leavers (Month)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-[#FF8C42]">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#FF8C42]/10 rounded-lg">
                  <Briefcase className="w-5 h-5 text-[#FF8C42]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#FF8C42]" data-testid="stat-contractors">{d.headcount.contractors}</p>
                  <p className="text-xs text-muted-foreground">Contractors</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-400">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <Building2 className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-500" data-testid="stat-in-house">{d.headcount.inHouse}</p>
                  <p className="text-xs text-muted-foreground">In-House</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Leave Today + Pending Leave */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Off Today */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-[#1F3A5F]" />
                Off Today
                {d.leaveToday.length > 0 && (
                  <Badge className="bg-[#1F3A5F] text-white ml-1">{d.leaveToday.length}</Badge>
                )}
              </CardTitle>
              <Link href="/admin/leave-requests">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" data-testid="link-leave-requests">
                  View all <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {d.leaveToday.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                No one is off today
              </div>
            ) : (
              <div className="space-y-0 max-h-60 overflow-y-auto">
                {d.leaveToday.map((r) => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b last:border-b-0" data-testid={`row-leave-today-${r.id}`}>
                    <div>
                      <p className="text-sm font-medium">{r.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type} · {formatDate(r.start_date)} – {formatDate(r.end_date)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">{r.total_days}d</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Leave */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending Leave Requests
                {d.pendingLeave.length > 0 && (
                  <Badge className="bg-amber-500 text-white ml-1">{d.pendingLeave.length}</Badge>
                )}
              </CardTitle>
              <Link href="/admin/leave-requests">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" data-testid="link-pending-leave">
                  View all <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {d.pendingLeave.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                No pending requests
              </div>
            ) : (
              <div className="space-y-0 max-h-60 overflow-y-auto">
                {d.pendingLeave.map((r) => (
                  <div key={r.id} className="flex items-start justify-between py-2 border-b last:border-b-0" data-testid={`row-pending-leave-${r.id}`}>
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="text-sm font-medium truncate">{r.employee_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {LEAVE_TYPE_LABELS[r.leave_type] ?? r.leave_type} · {formatDate(r.start_date)} – {formatDate(r.end_date)} ({r.total_days}d)
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        className="h-7 px-2 bg-green-600 hover:bg-green-700 text-white text-xs"
                        onClick={() => { setApproveDialog({ id: r.id, name: r.employee_name }); setReviewNote(""); }}
                        data-testid={`button-approve-leave-${r.id}`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50 text-xs"
                        onClick={() => { setRejectDialog({ id: r.id, name: r.employee_name }); setReviewNote(""); }}
                        data-testid={`button-reject-leave-${r.id}`}
                      >
                        <XCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Heat Map */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#1F3A5F]" />
              Compliance Expiry Heat Map
              {totalComplianceExpiring30 > 0 && (
                <Badge className="bg-red-500 text-white ml-1">{totalComplianceExpiring30} critical</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={() => setDrillDownOpen(true)}
                data-testid="button-compliance-drilldown"
              >
                Drill down <ChevronRight className="w-3 h-3 ml-1" />
              </Button>
              <Link href="/compliance">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" data-testid="link-compliance">
                  Full view <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b">
                  <th className="text-left py-2 pr-4 font-medium">Type</th>
                  <th className="text-center py-2 px-2 font-medium">≤30 days</th>
                  <th className="text-center py-2 px-2 font-medium">31–60 days</th>
                  <th className="text-center py-2 px-2 font-medium">61–90 days</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "SIA Licence", data: d.compliance.sia },
                  { label: "DBS Renewal", data: d.compliance.dbs, note: "3-yr cycle" },
                  { label: "Visa", data: d.compliance.visa },
                  { label: "BRP", data: d.compliance.brp },
                ].map(({ label, data: cd, note }) => (
                  <tr key={label} className="border-b last:border-b-0" data-testid={`row-compliance-${label.replace(/[\s/]/g, "-").toLowerCase()}`}>
                    <td className="py-2 pr-4">
                      <span className="font-medium">{label}</span>
                      {note && <span className="text-xs text-muted-foreground ml-1.5">({note})</span>}
                    </td>
                    <td className="py-2 px-2 text-center"><HeatCell count={cd.expiring30} label="30d" /></td>
                    <td className="py-2 px-2 text-center"><HeatCell count={cd.expiring60} label="60d" /></td>
                    <td className="py-2 px-2 text-center"><HeatCell count={cd.expiring90} label="90d" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Bottom row: Open Cases, Probations Due, Training Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Open Cases */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#FF8C42]" />
              Open Cases
              {totalOpenCases > 0 && (
                <Badge className="bg-[#FF8C42] text-white ml-1">{totalOpenCases}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-0">
            {[
              { label: "Vetting Checks", count: d.openCases.vettingChecks, link: "/vetting", icon: ShieldCheck },
              { label: "Incidents", count: d.openCases.incidents, link: "/control-room", icon: AlertTriangle },
              { label: "Disciplinaries", count: d.openCases.disciplinaries, link: null, icon: ClipboardList },
              { label: "Grievances", count: d.openCases.grievances, link: null, icon: ClipboardList },
            ].map(({ label, count, link, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b last:border-b-0" data-testid={`row-case-${label.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm">{label}</span>
                </div>
                {link ? (
                  <Link href={link}>
                    <Badge className={`cursor-pointer ${count > 0 ? "bg-[#FF8C42] text-white" : "bg-gray-100 text-gray-500"}`}>
                      {count}
                    </Badge>
                  </Link>
                ) : (
                  <Badge className="bg-gray-100 text-gray-400">{count}</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Probations Due */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#1F3A5F]" />
                Probations Due
                {d.probationsDue.length > 0 && (
                  <Badge className="bg-[#1F3A5F] text-white ml-1">{d.probationsDue.length}</Badge>
                )}
              </CardTitle>
              <Link href="/admin/employees">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" data-testid="link-probations">
                  View all <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {d.probationsDue.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">No probation reviews due in the next 30 days</p>
              </div>
            ) : (
              <div className="space-y-0 max-h-52 overflow-y-auto">
                {d.probationsDue.map((emp) => (
                  <div key={emp.employee_id} className="py-2 border-b last:border-b-0" data-testid={`row-probation-${emp.employee_id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.job_title ?? "No title"}{emp.department ? ` · ${emp.department}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Review due</p>
                        <p className="text-xs font-medium text-amber-600">{formatDate(emp.review_date)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Training Overdue */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-[#1F3A5F]" />
                First Aid Status
                {d.trainingOverdue.length > 0 && (
                  <Badge className="bg-red-500 text-white ml-1">{d.trainingOverdue.length}</Badge>
                )}
              </CardTitle>
              <Link href="/compliance">
                <Button variant="ghost" size="sm" className="text-xs h-7 px-2" data-testid="link-training">
                  View all <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {d.trainingOverdue.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <BookOpen className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-sm">All active employees have valid first aid</p>
              </div>
            ) : (
              <div className="space-y-0 max-h-52 overflow-y-auto">
                {d.trainingOverdue.map((emp) => (
                  <div key={emp.employee_id} className="py-2 border-b last:border-b-0" data-testid={`row-training-${emp.employee_id}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{emp.reason}</p>
                      </div>
                      {emp.first_aid_expiry && (
                        <div className="shrink-0">
                          {expiryBadge(emp.first_aid_expiry)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Compliance Drill-Down Dialog */}
      <Dialog open={drillDownOpen} onOpenChange={setDrillDownOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compliance Expiry — Employees Due Within 90 Days</DialogTitle>
            <DialogDescription>
              Employees with at least one compliance item expiring in the next 90 days.
              DBS renewal dates are estimated at 3 years from issue date.
            </DialogDescription>
          </DialogHeader>
          {d.compliance.drillDown.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-green-400" />
              <p>No compliance items expiring within 90 days.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs">
                    <th className="text-left py-2 pr-3 font-medium">Employee</th>
                    <th className="text-center py-2 px-2 font-medium">SIA</th>
                    <th className="text-center py-2 px-2 font-medium">DBS Renewal</th>
                    <th className="text-center py-2 px-2 font-medium">Visa</th>
                    <th className="text-center py-2 px-2 font-medium">BRP</th>
                  </tr>
                </thead>
                <tbody>
                  {d.compliance.drillDown.map((emp) => (
                    <tr key={emp.employee_id} className="border-b last:border-b-0" data-testid={`row-drill-${emp.employee_id}`}>
                      <td className="py-2 pr-3">
                        <Link href="/admin/employees">
                          <span className="font-medium hover:text-[#1F3A5F] cursor-pointer">{emp.name}</span>
                        </Link>
                        {emp.employee_number && (
                          <span className="text-xs text-muted-foreground ml-1">({emp.employee_number})</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {emp.sia_expiry_date ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground">{formatDate(emp.sia_expiry_date)}</span>
                            {expiryBadge(emp.sia_expiry_date)}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {emp.dbs_renewal_date ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground">{formatDate(emp.dbs_renewal_date)}</span>
                            {expiryBadge(emp.dbs_renewal_date)}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {emp.visa_expiry_date ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground">{formatDate(emp.visa_expiry_date)}</span>
                            {expiryBadge(emp.visa_expiry_date)}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-2 text-center">
                        {emp.brp_expiry ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs text-muted-foreground">{formatDate(emp.brp_expiry)}</span>
                            {expiryBadge(emp.brp_expiry)}
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Approve Dialog */}
      <Dialog open={!!approveDialog} onOpenChange={(o) => { if (!o) setApproveDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Leave Request</DialogTitle>
            <DialogDescription>
              Approving leave request for <strong>{approveDialog?.name}</strong>. Optionally add a note.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional note..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            data-testid="input-approve-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(null)}>Cancel</Button>
            <Button
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={approveMutation.isPending}
              onClick={() => approveDialog && approveMutation.mutate({ id: approveDialog.id, note: reviewNote || undefined })}
              data-testid="button-confirm-approve"
            >
              {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialog} onOpenChange={(o) => { if (!o) setRejectDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
            <DialogDescription>
              Rejecting leave request for <strong>{rejectDialog?.name}</strong>. A reason is required.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            data-testid="input-reject-note"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={rejectMutation.isPending || !reviewNote.trim()}
              onClick={() => rejectDialog && rejectMutation.mutate({ id: rejectDialog.id, note: reviewNote })}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
