import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CalendarDays, Loader2, ChevronLeft, ChevronRight, List, CalendarRange } from "lucide-react";

interface SchedulerJob {
  id: number;
  job_number: string;
  title: string;
  job_type: string;
  service_line: string;
  priority: string;
  status: string;
  scheduled_date: string;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  sla_due_at: string | null;
  sla_overdue: boolean;
  estimated_hours: string | null;
  site_name: string | null;
  supplier_name: string | null;
  assignments: Array<{ id: number; workerId: number; workerName: string; status: string }>;
}

function fmtDate(d: Date) { return d.toISOString().split("T")[0]; }
function addDays(d: Date, days: number) { const x = new Date(d); x.setDate(x.getDate() + days); return x; }
function startOfWeek(d: Date) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - day); return x; }

const priorityColor: Record<string, string> = {
  critical: "bg-red-600", high: "bg-orange-500", medium: "bg-amber-500", normal: "bg-amber-500", low: "bg-slate-400",
};
const statusColor: Record<string, string> = {
  raised: "bg-slate-400", assigned: "bg-blue-500", in_progress: "bg-indigo-500", completed: "bg-emerald-600", signed_off: "bg-emerald-700", cancelled: "bg-gray-400", on_hold: "bg-yellow-500",
};

export default function FmSchedulerPage() {
  const [view, setView] = useState<"week" | "list">("week");
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const [serviceLine, setServiceLine] = useState<string>("all");

  const weekStart = useMemo(() => startOfWeek(anchorDate), [anchorDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const from = fmtDate(days[0]);
  const to = fmtDate(days[6]);

  const { data, isLoading } = useQuery<{ jobs: SchedulerJob[] }>({
    queryKey: ["/api/fm/scheduler", from, to, serviceLine],
    queryFn: async () => {
      const url = new URL("/api/fm/scheduler", window.location.origin);
      url.searchParams.set("from", from);
      url.searchParams.set("to", to);
      if (serviceLine !== "all") url.searchParams.set("serviceLine", serviceLine);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
  });

  const jobsByDate = useMemo(() => {
    const map = new Map<string, SchedulerJob[]>();
    (data?.jobs || []).forEach((j) => {
      const key = j.scheduled_date;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(j);
    });
    return map;
  }, [data]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-8 w-8 text-[#FF8C42]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-scheduler-title">FM Scheduler</h1>
            <p className="text-sm text-gray-500">Plan FM jobs across cleaning, maintenance and engineering teams</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <Button variant={view === "week" ? "default" : "outline"} size="sm" onClick={() => setView("week")} data-testid="button-view-week">
              <CalendarRange className="h-4 w-4 mr-1" /> Week
            </Button>
            <Button variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")} data-testid="button-view-list">
              <List className="h-4 w-4 mr-1" /> List
            </Button>
          </div>
          <Select value={serviceLine} onValueChange={setServiceLine}>
            <SelectTrigger className="w-44" data-testid="select-service-line"><SelectValue placeholder="Service line" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All service lines</SelectItem>
              <SelectItem value="cleaning">Cleaning</SelectItem>
              <SelectItem value="maintenance">Maintenance</SelectItem>
              <SelectItem value="engineering">Engineering</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setAnchorDate(addDays(anchorDate, -7))} data-testid="button-prev-week"><ChevronLeft className="h-4 w-4" /></Button>
        <div className="text-sm font-medium text-[#1F3A5F]" data-testid="text-week-range">{from} → {to}</div>
        <Button variant="outline" size="sm" onClick={() => setAnchorDate(addDays(anchorDate, 7))} data-testid="button-next-week"><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" size="sm" onClick={() => setAnchorDate(new Date())} data-testid="button-today">Today</Button>
        <div className="ml-auto flex items-center gap-2">
          <Label htmlFor="anchor" className="text-xs text-gray-500">Jump to</Label>
          <Input id="anchor" type="date" className="w-44" value={fmtDate(anchorDate)} onChange={(e) => e.target.value && setAnchorDate(new Date(e.target.value))} data-testid="input-anchor-date" />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" /></div>
      ) : view === "week" ? (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {days.map((d) => {
            const key = fmtDate(d);
            const list = jobsByDate.get(key) || [];
            const isToday = key === fmtDate(new Date());
            return (
              <Card key={key} className={isToday ? "border-[#FF8C42]" : ""} data-testid={`column-day-${key}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs uppercase tracking-wide text-gray-500">
                    {d.toLocaleDateString(undefined, { weekday: "short" })}
                    <span className="ml-1 text-[#1F3A5F]">{d.getDate()}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 p-2">
                  {list.length === 0 && <div className="text-xs text-gray-300 text-center py-2">—</div>}
                  {list.map((j) => (
                    <div key={j.id} className={`p-2 rounded border text-xs ${j.sla_overdue ? "border-red-400 bg-red-50" : "border-gray-200"}`} data-testid={`scheduler-job-${j.id}`}>
                      <div className="font-medium text-[#1F3A5F] truncate">{j.title}</div>
                      <div className="text-gray-500 truncate">{j.site_name || "—"}</div>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge className={`${priorityColor[j.priority] || "bg-gray-400"} text-white text-[10px] px-1 py-0`}>{j.priority}</Badge>
                        <Badge className={`${statusColor[j.status] || "bg-gray-400"} text-white text-[10px] px-1 py-0 capitalize`}>{j.status.replace(/_/g, " ")}</Badge>
                      </div>
                      {j.scheduled_start_time && <div className="text-[10px] text-gray-400 mt-1">{j.scheduled_start_time}{j.scheduled_end_time ? `–${j.scheduled_end_time}` : ""}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs uppercase text-gray-500">
                  <th className="p-3">Date</th><th className="p-3">Job</th><th className="p-3">Site</th>
                  <th className="p-3">Service</th><th className="p-3">Priority</th>
                  <th className="p-3">Status</th><th className="p-3">SLA Due</th><th className="p-3">Workers</th>
                </tr>
              </thead>
              <tbody>
                {(data?.jobs || []).length === 0 && <tr><td colSpan={8} className="p-6 text-center text-gray-400">No jobs scheduled in this period.</td></tr>}
                {(data?.jobs || []).map((j) => (
                  <tr key={j.id} className="border-t" data-testid={`row-job-${j.id}`}>
                    <td className="p-3 whitespace-nowrap">{j.scheduled_date}{j.scheduled_start_time ? ` ${j.scheduled_start_time}` : ""}</td>
                    <td className="p-3"><div className="font-medium text-[#1F3A5F]">{j.title}</div><div className="text-xs text-gray-400">{j.job_number}</div></td>
                    <td className="p-3">{j.site_name || "—"}</td>
                    <td className="p-3 capitalize">{j.service_line}</td>
                    <td className="p-3"><Badge className={`${priorityColor[j.priority] || "bg-gray-400"} text-white`}>{j.priority}</Badge></td>
                    <td className="p-3"><Badge className={`${statusColor[j.status] || "bg-gray-400"} text-white capitalize`}>{j.status.replace(/_/g, " ")}</Badge></td>
                    <td className="p-3 whitespace-nowrap text-xs">{j.sla_due_at ? <span className={j.sla_overdue ? "text-red-600 font-medium" : ""}>{new Date(j.sla_due_at).toLocaleString()}</span> : "—"}</td>
                    <td className="p-3 text-xs">{j.assignments.length ? j.assignments.map(a => a.workerName).join(", ") : <span className="text-gray-400">Unassigned</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
