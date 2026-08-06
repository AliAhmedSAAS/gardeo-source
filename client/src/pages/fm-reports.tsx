import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Loader2, Download } from "lucide-react";

interface Report {
  from: string; to: string;
  byStatus: { status: string; count: number }[];
  byServiceLine: { service_line: string; count: number; completed: number }[];
  byPriority: { priority: string; count: number }[];
  byType: { job_type: string; count: number }[];
  slaPerformance: { total_with_sla: number; met_sla: number; breached_sla: number; slaMetPct: number };
  workerLoad: { id: number; worker_name: string; trade: string | null; assigned_jobs: number; completed_jobs: number }[];
  supplierLoad: { id: number; company_name: string; jobs: number; completed: number }[];
  sitesLoad: { id: number; site_name: string; jobs: number }[];
}

function defaultRange() {
  const to = new Date();
  const from = new Date(to.getTime() - 30 * 86400000);
  return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
}

export default function FmReportsPage() {
  const init = defaultRange();
  const [from, setFrom] = useState(init.from);
  const [to, setTo] = useState(init.to);

  const { data, isLoading, refetch } = useQuery<Report>({
    queryKey: ["/api/fm/reports", from, to],
    queryFn: async () => {
      const url = new URL("/api/fm/reports", window.location.origin);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  function exportCsv() {
    if (!data) return;
    const rows: string[] = [];
    rows.push(`FM Services Report,${from},to,${to}`);
    rows.push("");
    rows.push("Jobs by Status,Count");
    data.byStatus.forEach(r => rows.push(`${r.status},${r.count}`));
    rows.push("");
    rows.push("Jobs by Service Line,Count,Completed");
    data.byServiceLine.forEach(r => rows.push(`${r.service_line},${r.count},${r.completed}`));
    rows.push("");
    rows.push("Jobs by Priority,Count");
    data.byPriority.forEach(r => rows.push(`${r.priority},${r.count}`));
    rows.push("");
    rows.push("Jobs by Type,Count");
    data.byType.forEach(r => rows.push(`${r.job_type},${r.count}`));
    rows.push("");
    rows.push(`SLA Performance,Total with SLA,${data.slaPerformance.total_with_sla},Met,${data.slaPerformance.met_sla},Breached,${data.slaPerformance.breached_sla},Met %,${data.slaPerformance.slaMetPct}`);
    rows.push("");
    rows.push("Worker Load,Assigned,Completed");
    data.workerLoad.forEach(r => rows.push(`${r.worker_name},${r.assigned_jobs},${r.completed_jobs}`));
    rows.push("");
    rows.push("Supplier Load,Jobs,Completed");
    data.supplierLoad.forEach(r => rows.push(`${r.company_name},${r.jobs},${r.completed}`));
    rows.push("");
    rows.push("Sites Load,Jobs");
    data.sitesLoad.forEach(r => rows.push(`${r.site_name},${r.jobs}`));
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `fm-report-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-[#FF8C42]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-reports-title">FM Reports</h1>
            <p className="text-sm text-gray-500">Operational reporting for FM Services</p>
          </div>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!data} data-testid="button-export-csv"><Download className="h-4 w-4 mr-1" /> Export CSV</Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-44" data-testid="input-from" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-44" data-testid="input-to" />
          </div>
          <Button onClick={() => refetch()} className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-apply"><BarChart3 className="h-4 w-4 mr-1" /> Apply</Button>
        </CardContent>
      </Card>

      {isLoading || !data ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" /></div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-[#1F3A5F] text-base">SLA Performance</CardTitle></CardHeader>
              <CardContent>
                <p className="text-4xl font-bold text-[#1F3A5F]" data-testid="text-sla-met-pct">{data.slaPerformance.slaMetPct}%</p>
                <p className="text-xs text-gray-500 mt-1">{data.slaPerformance.met_sla} of {data.slaPerformance.total_with_sla} jobs met SLA</p>
                <p className="text-xs text-red-600 mt-1">{data.slaPerformance.breached_sla} breached</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-[#1F3A5F] text-base">Jobs by Status</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.byStatus.length === 0 && <p className="text-sm text-gray-400">No data</p>}
                {data.byStatus.map(r => (
                  <div key={r.status} className="flex items-center justify-between text-sm" data-testid={`report-status-${r.status}`}>
                    <span className="capitalize">{r.status.replace(/_/g, " ")}</span>
                    <Badge variant="outline">{r.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-[#1F3A5F] text-base">Jobs by Priority</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.byPriority.length === 0 && <p className="text-sm text-gray-400">No data</p>}
                {data.byPriority.map(r => (
                  <div key={r.priority} className="flex items-center justify-between text-sm" data-testid={`report-priority-${r.priority}`}>
                    <span className="capitalize">{r.priority}</span>
                    <Badge variant="outline">{r.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-[#1F3A5F] text-base">Jobs by Service Line</CardTitle></CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500"><th className="py-1">Service line</th><th>Total</th><th>Completed</th></tr></thead>
                  <tbody>
                    {data.byServiceLine.map(r => (
                      <tr key={r.service_line} className="border-t" data-testid={`report-service-${r.service_line}`}>
                        <td className="py-1 capitalize">{r.service_line}</td><td>{r.count}</td><td>{r.completed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-[#1F3A5F] text-base">Jobs by Type</CardTitle></CardHeader>
              <CardContent className="space-y-1">
                {data.byType.length === 0 && <p className="text-sm text-gray-400">No data</p>}
                {data.byType.map(r => (
                  <div key={r.job_type} className="flex items-center justify-between text-sm" data-testid={`report-type-${r.job_type}`}>
                    <span className="capitalize">{r.job_type.replace(/_/g, " ")}</span>
                    <Badge variant="outline">{r.count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="text-[#1F3A5F] text-base">Worker Workload</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500 bg-gray-50"><th className="p-2">Worker</th><th className="p-2">Trade</th><th className="p-2">Assigned</th><th className="p-2">Completed</th></tr></thead>
                <tbody>
                  {data.workerLoad.length === 0 && <tr><td colSpan={4} className="p-3 text-center text-gray-400">No data</td></tr>}
                  {data.workerLoad.map(r => (
                    <tr key={r.id} className="border-t" data-testid={`report-worker-${r.id}`}>
                      <td className="p-2">{r.worker_name}</td><td className="p-2">{r.trade || "—"}</td><td className="p-2">{r.assigned_jobs}</td><td className="p-2">{r.completed_jobs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-[#1F3A5F] text-base">Supplier Load</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 bg-gray-50"><th className="p-2">Supplier</th><th className="p-2">Jobs</th><th className="p-2">Completed</th></tr></thead>
                  <tbody>
                    {data.supplierLoad.length === 0 && <tr><td colSpan={3} className="p-3 text-center text-gray-400">No data</td></tr>}
                    {data.supplierLoad.map(r => (
                      <tr key={r.id} className="border-t" data-testid={`report-supplier-${r.id}`}><td className="p-2">{r.company_name}</td><td className="p-2">{r.jobs}</td><td className="p-2">{r.completed}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-[#1F3A5F] text-base">Sites Load</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-gray-500 bg-gray-50"><th className="p-2">Site</th><th className="p-2">Jobs</th></tr></thead>
                  <tbody>
                    {data.sitesLoad.length === 0 && <tr><td colSpan={2} className="p-3 text-center text-gray-400">No data</td></tr>}
                    {data.sitesLoad.map(r => (
                      <tr key={r.id} className="border-t" data-testid={`report-site-${r.id}`}><td className="p-2">{r.site_name}</td><td className="p-2">{r.jobs}</td></tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
