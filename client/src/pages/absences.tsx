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
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Plus, Search, AlertTriangle, CheckCircle2, Clock,
  User, Filter, ChevronLeft, ChevronRight, FileText, Loader2,
  TrendingUp, Users, XCircle,
} from "lucide-react";

type AbsenceRecord = {
  id: number;
  employeeId: number;
  tenantId: number;
  absenceType: string;
  startDate: string;
  endDate: string | null;
  totalDays: number | null;
  reason: string | null;
  selfCertified: boolean | null;
  fitNoteUrl: string | null;
  returnToWorkConducted: boolean | null;
  returnToWorkDate: string | null;
  returnToWorkNotes: string | null;
  reviewedBy: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  employeeName: string;
  reviewedByName: string | null;
};

const ABSENCE_TYPES: Record<string, { label: string; color: string }> = {
  sickness: { label: "Sickness", color: "bg-red-100 text-red-700 border-red-200" },
  unauthorised: { label: "Unauthorised", color: "bg-orange-100 text-orange-700 border-orange-200" },
  compassionate: { label: "Compassionate", color: "bg-blue-100 text-blue-700 border-blue-200" },
  paternity: { label: "Paternity", color: "bg-purple-100 text-purple-700 border-purple-200" },
  maternity: { label: "Maternity", color: "bg-pink-100 text-pink-700 border-pink-200" },
  jury_duty: { label: "Jury Duty", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  other: { label: "Other", color: "bg-gray-100 text-gray-700 border-gray-200" },
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function AbsenceTypeBadge({ type }: { type: string }) {
  const cfg = ABSENCE_TYPES[type] || ABSENCE_TYPES.other;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "closed") {
    return <Badge variant="secondary" className="text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Closed</Badge>;
  }
  return <Badge variant="outline" className="text-xs border-amber-300 text-amber-700 bg-amber-50"><Clock className="w-3 h-3 mr-1" />Open</Badge>;
}

type CalendarDay = {
  date: Date;
  absences: AbsenceRecord[];
  isCurrentMonth: boolean;
};

function AbsenceCalendar({ absences }: { absences: AbsenceRecord[] }) {
  const [viewDate, setViewDate] = useState(() => new Date());

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDow = (firstDay.getDay() + 6) % 7;
  const days: CalendarDay[] = [];

  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -startDow + i + 1);
    days.push({ date: d, absences: [], isCurrentMonth: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    const d = new Date(year, month, i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const dayAbsences = absences.filter(a => {
      const start = a.startDate;
      const end = a.endDate || a.startDate;
      return ds >= start && ds <= end;
    });
    days.push({ date: d, absences: dayAbsences, isCurrentMonth: true });
  }
  while (days.length % 7 !== 0) {
    const last = days[days.length - 1].date;
    const d = new Date(last);
    d.setDate(d.getDate() + 1);
    days.push({ date: d, absences: [], isCurrentMonth: false });
  }

  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={prevMonth} data-testid="button-calendar-prev">
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="font-semibold text-sm">
          {viewDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <Button variant="outline" size="sm" onClick={nextMonth} data-testid="button-calendar-next">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px text-center">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {days.map((day, idx) => {
          const typeColors: Record<string, string> = {
            sickness: "bg-red-400",
            unauthorised: "bg-orange-400",
            compassionate: "bg-blue-400",
            paternity: "bg-purple-400",
            maternity: "bg-pink-400",
            jury_duty: "bg-yellow-400",
            other: "bg-gray-400",
          };
          return (
            <div
              key={idx}
              className={`min-h-[52px] p-1 rounded text-xs border ${
                day.isCurrentMonth ? "bg-background border-border" : "bg-muted/30 border-transparent"
              } ${day.absences.length > 0 ? "ring-1 ring-inset ring-red-200" : ""}`}
            >
              <div className={`text-right text-xs mb-1 ${!day.isCurrentMonth ? "text-muted-foreground" : ""}`}>
                {day.date.getDate()}
              </div>
              <div className="flex flex-wrap gap-0.5">
                {day.absences.slice(0, 3).map(a => (
                  <div
                    key={a.id}
                    title={`${a.employeeName} — ${ABSENCE_TYPES[a.absenceType]?.label || a.absenceType}`}
                    className={`w-2 h-2 rounded-full ${typeColors[a.absenceType] || "bg-gray-400"}`}
                  />
                ))}
                {day.absences.length > 3 && (
                  <span className="text-muted-foreground text-[10px]">+{day.absences.length - 3}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3 pt-1">
        {Object.entries(ABSENCE_TYPES).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1 text-xs text-muted-foreground">
            <span className={`w-2 h-2 rounded-full ${
              k === "sickness" ? "bg-red-400" :
              k === "unauthorised" ? "bg-orange-400" :
              k === "compassionate" ? "bg-blue-400" :
              k === "paternity" ? "bg-purple-400" :
              k === "maternity" ? "bg-pink-400" :
              k === "jury_duty" ? "bg-yellow-400" : "bg-gray-400"
            }`} />
            {v.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AbsencesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [showLogDialog, setShowLogDialog] = useState(false);
  const [showRtwDialog, setShowRtwDialog] = useState(false);
  const [selectedAbsence, setSelectedAbsence] = useState<AbsenceRecord | null>(null);

  const [logForm, setLogForm] = useState({
    employeeId: "",
    absenceType: "sickness",
    startDate: "",
    endDate: "",
    totalDays: "",
    reason: "",
    selfCertified: false,
    fitNoteUrl: "",
    status: "open",
  });

  const [rtwForm, setRtwForm] = useState({
    returnToWorkDate: "",
    returnToWorkNotes: "",
    returnToWorkConducted: true,
    status: "closed",
  });

  const { data: absences = [], isLoading } = useQuery<AbsenceRecord[]>({
    queryKey: ["/api/admin/absences", statusFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (typeFilter !== "all") params.set("absenceType", typeFilter);
      const res = await fetch(`/api/admin/absences?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch absences");
      return res.json();
    },
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
      const res = await apiRequest("POST", "/api/admin/absences", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Absence logged successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/absences"] });
      setShowLogDialog(false);
      setLogForm({
        employeeId: "", absenceType: "sickness", startDate: "", endDate: "",
        totalDays: "", reason: "", selfCertified: false, fitNoteUrl: "", status: "open",
      });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/absences/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Absence updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/absences"] });
      setShowRtwDialog(false);
      setSelectedAbsence(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = absences.filter(a => {
    if (!search) return true;
    const s = search.toLowerCase();
    return a.employeeName.toLowerCase().includes(s) || (a.reason || "").toLowerCase().includes(s);
  });

  const openCount = absences.filter(a => a.status === "open").length;
  const sicknessCount = absences.filter(a => a.absenceType === "sickness").length;
  const currentAbsent = absences.filter(a => a.status === "open").length;
  const rtwRequired = absences.filter(a => a.absenceType === "sickness" && (a.totalDays ?? 0) > 3 && !a.returnToWorkConducted && a.status === "closed").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]">Absence Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track sickness and non-annual-leave absences with Bradford Factor scoring</p>
        </div>
        <Button
          className="bg-[#1F3A5F] hover:bg-[#152d4a] text-white"
          onClick={() => setShowLogDialog(true)}
          data-testid="button-log-absence"
        >
          <Plus className="w-4 h-4 mr-2" /> Log Absence
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Currently Absent</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-currently-absent">{currentAbsent}</p>
              </div>
              <Users className="w-8 h-8 text-red-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Open Absences</p>
                <p className="text-2xl font-bold text-amber-600" data-testid="stat-open-absences">{openCount}</p>
              </div>
              <Clock className="w-8 h-8 text-amber-300" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Sickness Absences</p>
                <p className="text-2xl font-bold text-[#1F3A5F]" data-testid="stat-sickness-absences">{sicknessCount}</p>
              </div>
              <FileText className="w-8 h-8 text-blue-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">RTW Required</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-rtw-required">{rtwRequired}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-orange-300" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by employee or reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
            data-testid="input-search-absences"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40" data-testid="select-type-filter">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(ABSENCE_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex border rounded-md overflow-hidden">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            className="rounded-none"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            List
          </Button>
          <Button
            variant={viewMode === "calendar" ? "default" : "ghost"}
            size="sm"
            className="rounded-none"
            onClick={() => setViewMode("calendar")}
            data-testid="button-view-calendar"
          >
            <Calendar className="w-4 h-4 mr-1" /> Calendar
          </Button>
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Team Absence Calendar</CardTitle>
          </CardHeader>
          <CardContent>
            <AbsenceCalendar absences={absences} />
          </CardContent>
        </Card>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No absences recorded</p>
                <p className="text-xs mt-1">Click "Log Absence" to record a new absence</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Start Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">End Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Days</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">RTW</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filtered.map(a => {
                      const needsRtw = a.absenceType === "sickness" && (a.totalDays ?? 0) > 3 && !a.returnToWorkConducted && a.status === "closed";
                      return (
                        <tr key={a.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-absence-${a.id}`}>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full bg-[#1F3A5F]/10 flex items-center justify-center text-xs font-semibold text-[#1F3A5F]">
                                {a.employeeName.split(" ").map(n => n[0]).join("").slice(0, 2)}
                              </div>
                              <span className="font-medium" data-testid={`text-employee-name-${a.id}`}>{a.employeeName}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4"><AbsenceTypeBadge type={a.absenceType} /></td>
                          <td className="py-3 px-4 text-muted-foreground">{formatDate(a.startDate)}</td>
                          <td className="py-3 px-4 text-muted-foreground">{formatDate(a.endDate)}</td>
                          <td className="py-3 px-4">
                            <span className="font-medium">{a.totalDays ?? "—"}</span>
                          </td>
                          <td className="py-3 px-4">
                            {needsRtw ? (
                              <span className="flex items-center gap-1 text-orange-600 text-xs"><AlertTriangle className="w-3 h-3" /> Required</span>
                            ) : a.returnToWorkConducted ? (
                              <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="w-3 h-3" /> Done</span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="py-3 px-4"><StatusBadge status={a.status} /></td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              {a.status === "open" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  data-testid={`button-close-absence-${a.id}`}
                                  onClick={() => updateMutation.mutate({ id: a.id, data: { status: "closed" } })}
                                  disabled={updateMutation.isPending}
                                >
                                  Close
                                </Button>
                              )}
                              {(a.absenceType === "sickness" || a.returnToWorkConducted === false) && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs h-7"
                                  data-testid={`button-rtw-${a.id}`}
                                  onClick={() => {
                                    setSelectedAbsence(a);
                                    setRtwForm({
                                      returnToWorkDate: "",
                                      returnToWorkNotes: a.returnToWorkNotes || "",
                                      returnToWorkConducted: true,
                                      status: "closed",
                                    });
                                    setShowRtwDialog(true);
                                  }}
                                >
                                  RTW
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
            )}
          </CardContent>
        </Card>
      )}

      {/* Log Absence Dialog */}
      <Dialog open={showLogDialog} onOpenChange={setShowLogDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Log Absence
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Employee *</Label>
              <Select value={logForm.employeeId} onValueChange={v => setLogForm(f => ({ ...f, employeeId: v }))}>
                <SelectTrigger data-testid="select-absence-employee">
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
            <div className="space-y-1.5">
              <Label className="text-xs">Absence Type *</Label>
              <Select value={logForm.absenceType} onValueChange={v => setLogForm(f => ({ ...f, absenceType: v }))}>
                <SelectTrigger data-testid="select-absence-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ABSENCE_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Start Date *</Label>
                <Input
                  type="date"
                  value={logForm.startDate}
                  onChange={e => setLogForm(f => ({ ...f, startDate: e.target.value }))}
                  data-testid="input-absence-start-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">End Date</Label>
                <Input
                  type="date"
                  value={logForm.endDate}
                  onChange={e => setLogForm(f => ({ ...f, endDate: e.target.value }))}
                  data-testid="input-absence-end-date"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Total Days</Label>
              <Input
                type="number"
                min="1"
                value={logForm.totalDays}
                onChange={e => setLogForm(f => ({ ...f, totalDays: e.target.value }))}
                placeholder="Auto-calculated if blank"
                data-testid="input-absence-total-days"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Reason</Label>
              <Textarea
                value={logForm.reason}
                onChange={e => setLogForm(f => ({ ...f, reason: e.target.value }))}
                rows={2}
                data-testid="input-absence-reason"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="self-certified"
                checked={logForm.selfCertified}
                onCheckedChange={v => setLogForm(f => ({ ...f, selfCertified: !!v }))}
                data-testid="checkbox-self-certified"
              />
              <Label htmlFor="self-certified" className="text-xs cursor-pointer">Self-certified absence</Label>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status</Label>
              <Select value={logForm.status} onValueChange={v => setLogForm(f => ({ ...f, status: v }))}>
                <SelectTrigger data-testid="select-absence-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLogDialog(false)}>Cancel</Button>
            <Button
              className="bg-[#1F3A5F] hover:bg-[#152d4a] text-white"
              onClick={() => {
                if (!logForm.employeeId || !logForm.absenceType || !logForm.startDate) {
                  toast({ title: "Please fill required fields", variant: "destructive" });
                  return;
                }
                const days = (!logForm.totalDays && logForm.startDate && logForm.endDate)
                  ? Math.ceil((new Date(logForm.endDate).getTime() - new Date(logForm.startDate).getTime()) / 86400000) + 1
                  : logForm.totalDays ? parseInt(logForm.totalDays) : null;
                createMutation.mutate({ ...logForm, totalDays: days });
              }}
              disabled={createMutation.isPending}
              data-testid="button-save-absence"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Log Absence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Return to Work Dialog */}
      <Dialog open={showRtwDialog} onOpenChange={setShowRtwDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Return to Work Interview
            </DialogTitle>
          </DialogHeader>
          {selectedAbsence && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
                <p className="font-semibold">{selectedAbsence.employeeName}</p>
                <p>Absence: {formatDate(selectedAbsence.startDate)} — {formatDate(selectedAbsence.endDate)}</p>
                <p>Type: {ABSENCE_TYPES[selectedAbsence.absenceType]?.label}</p>
                {(selectedAbsence.totalDays ?? 0) > 3 && (
                  <p className="text-orange-700 font-medium mt-1">⚠ Sickness &gt;3 days — RTW interview required</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">RTW Date</Label>
                <Input
                  type="date"
                  value={rtwForm.returnToWorkDate}
                  onChange={e => setRtwForm(f => ({ ...f, returnToWorkDate: e.target.value }))}
                  data-testid="input-rtw-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">RTW Notes</Label>
                <Textarea
                  value={rtwForm.returnToWorkNotes}
                  onChange={e => setRtwForm(f => ({ ...f, returnToWorkNotes: e.target.value }))}
                  rows={3}
                  placeholder="Notes from the return-to-work interview..."
                  data-testid="input-rtw-notes"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rtw-conducted"
                  checked={rtwForm.returnToWorkConducted}
                  onCheckedChange={v => setRtwForm(f => ({ ...f, returnToWorkConducted: !!v }))}
                  data-testid="checkbox-rtw-conducted"
                />
                <Label htmlFor="rtw-conducted" className="text-xs cursor-pointer">RTW interview conducted</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRtwDialog(false)}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                if (!selectedAbsence) return;
                updateMutation.mutate({
                  id: selectedAbsence.id,
                  data: {
                    returnToWorkDate: rtwForm.returnToWorkDate || null,
                    returnToWorkNotes: rtwForm.returnToWorkNotes || null,
                    returnToWorkConducted: rtwForm.returnToWorkConducted,
                    status: rtwForm.status,
                  },
                });
              }}
              disabled={updateMutation.isPending}
              data-testid="button-save-rtw"
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save RTW Interview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
