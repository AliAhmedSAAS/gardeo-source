import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wrench, Users, Truck, ClipboardList, CalendarDays, AlertTriangle, ArrowRight, Loader2, Activity, CheckCircle2, TimerReset } from "lucide-react";

interface DashboardStats {
  workers: { total: number; active: number };
  jobs: { total: number; completed: number; open: number; overdue: number };
  suppliers: { total: number };
  ppm: { total: number; due_now: number };
  kpis: {
    slaBreachCount: number;
    ppmCompliancePct: number;
    ppmCompliance: { total: number; completed: number };
    workerUtilisationPct: number;
    workerUtilisation: { active: number; busy: number };
    jobsCompletedThisMonth: number;
  };
  topOverdue: Array<{ id: number; job_number: string; title: string; priority: string; status: string; scheduled_date: string | null; sla_due_at: string | null; site_name: string | null }>;
  statusBreakdown: { status: string; count: number }[];
  serviceBreakdown: { service_line: string; count: number }[];
  upcomingJobs: any[];
}

export default function FmDashboardPage() {
  const [, navigate] = useLocation();
  const { data, isLoading, error } = useQuery<DashboardStats>({ queryKey: ["/api/fm/dashboard"] });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" /></div>;
  if (error) return <div className="p-6 text-red-600" data-testid="text-fm-dashboard-error">Failed to load FM dashboard. Make sure the FM Services add-on is activated.</div>;

  const stats = data!;
  const kpis = stats.kpis;
  const kpiCards = [
    { label: "SLA Breaches", value: kpis.slaBreachCount, hint: "Open jobs past SLA", icon: AlertTriangle, color: "bg-red-500", url: "/fm-jobs", testid: "kpi-sla-breach" },
    { label: "PPM Compliance", value: `${kpis.ppmCompliancePct}%`, hint: `${kpis.ppmCompliance.completed}/${kpis.ppmCompliance.total} last 30 days`, icon: CheckCircle2, color: "bg-emerald-600", url: "/fm-ppm", testid: "kpi-ppm-compliance" },
    { label: "Worker Utilisation", value: `${kpis.workerUtilisationPct}%`, hint: `${kpis.workerUtilisation.busy}/${kpis.workerUtilisation.active} active workers busy`, icon: Activity, color: "bg-blue-500", url: "/fm-workers", testid: "kpi-worker-utilisation" },
    { label: "Completed This Month", value: kpis.jobsCompletedThisMonth, hint: "Jobs marked completed/signed-off", icon: TimerReset, color: "bg-[#FF8C42]", url: "/fm-reports", testid: "kpi-completed-month" },
  ];
  const secondary = [
    { label: "Active Workers", value: stats.workers.active, total: stats.workers.total, icon: Users, color: "bg-blue-500", url: "/fm-workers" },
    { label: "Open Jobs", value: stats.jobs.open, total: stats.jobs.total, icon: ClipboardList, color: "bg-[#FF8C42]", url: "/fm-jobs" },
    { label: "PPM Due", value: stats.ppm.due_now, total: stats.ppm.total, icon: CalendarDays, color: "bg-purple-500", url: "/fm-ppm" },
    { label: "FM Suppliers", value: stats.suppliers.total, total: stats.suppliers.total, icon: Truck, color: "bg-green-600", url: "/fm-suppliers" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Wrench className="h-8 w-8 text-[#FF8C42]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-dashboard-title">FM Services Dashboard</h1>
            <p className="text-sm text-gray-500">Cleaning, maintenance and engineering operations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/fm-scheduler")} data-testid="button-open-scheduler">Scheduler</Button>
          <Button variant="outline" onClick={() => navigate("/fm-reports")} data-testid="button-open-reports">Reports</Button>
          <Button onClick={() => navigate("/fm-jobs")} className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-new-job">
            New Job <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {kpiCards.map((c) => (
          <Card key={c.label} className="cursor-pointer hover-elevate" onClick={() => navigate(c.url)} data-testid={`card-${c.testid}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
                  <p className="text-3xl font-bold text-[#1F3A5F] mt-1">{c.value}</p>
                  <p className="text-xs text-gray-400 mt-1">{c.hint}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg ${c.color} flex items-center justify-center`}>
                  <c.icon className="h-5 w-5 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {secondary.map((c) => (
          <Card key={c.label} className="cursor-pointer hover-elevate" onClick={() => navigate(c.url)} data-testid={`card-stat-${c.label.toLowerCase().replace(/\s+/g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{c.label}</p>
                  <p className="text-2xl font-bold text-[#1F3A5F] mt-1">{c.value}</p>
                  <p className="text-xs text-gray-400 mt-1">of {c.total}</p>
                </div>
                <div className={`h-9 w-9 rounded-lg ${c.color} flex items-center justify-center`}>
                  <c.icon className="h-4 w-4 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1F3A5F] text-lg flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" /> Top 5 Overdue
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.topOverdue.length === 0 ? (
            <p className="text-sm text-gray-400" data-testid="text-no-overdue">No overdue jobs — well done.</p>
          ) : (
            <div className="space-y-2">
              {stats.topOverdue.map((j) => (
                <div key={j.id} className="flex items-center justify-between p-3 border rounded-md hover-elevate cursor-pointer" onClick={() => navigate("/fm-jobs")} data-testid={`row-overdue-${j.id}`}>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{j.job_number || `#${j.id}`} — {j.title}</p>
                    <p className="text-xs text-gray-500">{j.site_name || "—"} · Due {j.sla_due_at ? new Date(j.sla_due_at).toLocaleString() : (j.scheduled_date || "—")}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="capitalize">{j.priority}</Badge>
                    <Badge className="bg-red-500 capitalize">{j.status.replace(/_/g, " ")}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-[#1F3A5F] text-lg">Jobs by Status</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.statusBreakdown.length === 0 && <p className="text-sm text-gray-400">No jobs yet</p>}
              {stats.statusBreakdown.map((s) => (
                <div key={s.status} className="flex items-center justify-between" data-testid={`row-status-${s.status}`}>
                  <span className="capitalize text-sm">{s.status.replace(/_/g, " ")}</span>
                  <Badge variant="outline">{s.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-[#1F3A5F] text-lg">Jobs by Service Line</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.serviceBreakdown.length === 0 && <p className="text-sm text-gray-400">No jobs yet</p>}
              {stats.serviceBreakdown.map((s) => (
                <div key={s.service_line} className="flex items-center justify-between" data-testid={`row-service-${s.service_line}`}>
                  <span className="capitalize text-sm">{s.service_line}</span>
                  <Badge className="bg-[#FF8C42]">{s.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[#1F3A5F] text-lg">Upcoming Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.upcomingJobs.length === 0 ? (
            <p className="text-sm text-gray-400">No upcoming jobs.</p>
          ) : (
            <div className="space-y-2">
              {stats.upcomingJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between p-3 border rounded-md hover-elevate cursor-pointer" onClick={() => navigate("/fm-jobs")} data-testid={`row-upcoming-${j.id}`}>
                  <div>
                    <p className="font-medium text-sm">{j.title}</p>
                    <p className="text-xs text-gray-500">{j.site_name || "—"} · {j.scheduled_date || "Unscheduled"} {j.scheduled_start_time && `@ ${j.scheduled_start_time}`}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">{j.service_line}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
