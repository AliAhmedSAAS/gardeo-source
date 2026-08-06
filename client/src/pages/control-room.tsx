import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Virtuoso } from "react-virtuoso";
import {
  Activity,
  AlertTriangle,
  Radio,
  MessageSquare,
  Shield,
  Clock,
  MapPin,
  Users,
  Loader2,
  Plus,
  CheckCircle2,
  XCircle,
  Pencil,
  UserCog,
  Ban,
  StickyNote,
  Navigation,
  PhoneCall,
  Timer,
  Eye,
  RefreshCw,
  Brain,
  Sparkles,
  Zap,
  Send,
  Crown,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Bot,
  Lightbulb,
  Search,
  Filter,
  Building2,
  FileText,
  Settings,
  Play,
  Trash2,
  History,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import type { Shift, Incident, Site } from "@shared/schema";
import { AISituationalAwareness, AISmartAlerts, AIQuickActions, AIChatPanel, AIUpgradeBanner, AIKPIInsights, AIAutoContactPanel, AIContactLogs, AIAutonomousPanel } from "./ai-controller-panels";

type EnrichedShift = Shift & {
  siteName: string;
  siteAddress: string;
  sitePostcode: string;
  employeeName: string;
  employeePhone: string | null;
  siaLicenseNumber: string | null;
  siaExpiryDate: string | null;
  siaValid: boolean;
  dbsCertificateNumber: string | null;
  dbsValid: boolean;
  supplierName: string | null;
  isLate: boolean;
  precheckData: {
    siaValid?: boolean;
    dbsValid?: boolean;
    uniformConfirmed?: boolean;
    equipmentConfirmed?: boolean;
    welfareChecked?: boolean;
    checkedBy?: string;
    checkedAt?: string;
    passed?: boolean;
    failReason?: string;
  } | null;
  controllerNotes: string | null;
  lastCheckInLat: string | null;
  lastCheckInLng: string | null;
  lastCheckInAddress: string | null;
};

type EnrichedIncident = Incident & { siteName: string; reporterName: string };

type EmployeeRecord = {
  id: number;
  userId: string;
  firstName: string;
  lastName: string;
};

const tabs = [
  { id: "overview", label: "Live Overview", icon: Activity },
  { id: "ai_autonomous", label: "AI Autonomous", icon: Bot },
  { id: "shifts", label: "Live Shifts", icon: Clock },
  { id: "incidents", label: "Incidents", icon: AlertTriangle },
  { id: "communications", label: "Communications", icon: MessageSquare },
] as const;

type TabId = (typeof tabs)[number]["id"];

function getShiftCardColor(shift: EnrichedShift): string {
  if (shift.status === "cancelled") return "border-l-4 border-l-gray-400 bg-gray-50 dark:bg-gray-900/30";
  if (shift.status === "no_show") return "border-l-4 border-l-red-600 bg-red-50 dark:bg-red-900/20";
  if (shift.status === "completed") return "border-l-4 border-l-gray-400 bg-gray-50 dark:bg-gray-900/30";

  if (shift.precheckData && !shift.precheckData.passed) {
    return "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20";
  }

  if (shift.status === "in_progress") {
    return "border-l-4 border-l-green-500 bg-green-50 dark:bg-green-900/20";
  }

  if (shift.isLate) {
    return "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20";
  }

  if (shift.status === "scheduled") {
    return "border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/20";
  }

  return "";
}

function getShiftStatusLabel(shift: EnrichedShift): { label: string; color: string } {
  if (shift.status === "cancelled") return { label: "Cancelled", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };
  if (shift.status === "no_show") return { label: "No Show", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  if (shift.status === "completed") return { label: "Completed", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" };

  if (shift.precheckData && !shift.precheckData.passed) {
    return { label: "Pre-check Failed", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  }

  if (shift.status === "in_progress") {
    return { label: "Booked On", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" };
  }

  if (shift.isLate) {
    return { label: "Late", color: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" };
  }

  if (shift.status === "scheduled") {
    if (shift.precheckData?.passed) {
      return { label: "Pre-check Passed", color: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" };
    }
    return { label: "Awaiting Pre-check", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" };
  }

  return { label: shift.status || "Unknown", color: "" };
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "low": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "medium": return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
    case "high": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    case "critical": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    default: return "";
  }
}

function getIncidentStatusColor(status: string) {
  switch (status) {
    case "reported": return "bg-orange-100 text-orange-700";
    case "investigating": return "bg-yellow-100 text-yellow-700";
    case "resolved": return "bg-green-100 text-green-700";
    case "closed": return "bg-gray-100 text-gray-700";
    default: return "";
  }
}

export default function ControlRoomPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [precheckDialogOpen, setPrecheckDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<EnrichedShift | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [aiMode, setAiMode] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiChatInput, setAiChatInput] = useState("");
  const [aiChatLoading, setAiChatLoading] = useState(false);

  const { data: addonStatus } = useQuery<{ active: boolean }>({
    queryKey: ["/api/addons/check", "ai_controller"],
    queryFn: async () => {
      const res = await fetch("/api/addons/check/ai_controller");
      if (!res.ok) return { active: false };
      return res.json();
    },
  });

  const aiControllerActive = addonStatus?.active === true;

  const { data: geoSettings } = useQuery<{ checkinTimeWindowMinutes: number; geofenceRadiusMetres: number }>({
    queryKey: ["/api/tenant/geofence-settings"],
  });
  const geofenceRadius = geoSettings?.geofenceRadiusMetres ?? 200;

  const [newIncident, setNewIncident] = useState({
    title: "",
    description: "",
    severity: "medium" as string,
    siteId: "" as string,
  });

  const [precheckForm, setPrecheckForm] = useState({
    siaValid: false,
    dbsValid: false,
    uniformConfirmed: false,
    equipmentConfirmed: false,
    welfareChecked: false,
  });

  const [editForm, setEditForm] = useState({ startTime: "", endTime: "", breakMinutes: "" });
  const [reassignEmployeeId, setReassignEmployeeId] = useState("");
  const [controllerNotes, setControllerNotes] = useState("");
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [handoverForm, setHandoverForm] = useState({ note: "", openIssues: "", pendingActions: "", watchItems: "" });
  const [escalationOpen, setEscalationOpen] = useState(false);
  const [newRuleOpen, setNewRuleOpen] = useState(false);
  const [newRule, setNewRule] = useState({ name: "", triggerType: "late_checkin", delayMinutes: 15, actionType: "mark_late" });
  const [showPreviousHandovers, setShowPreviousHandovers] = useState(false);
  const [activityLogExpanded, setActivityLogExpanded] = useState(false);
  const [activityFilter, setActivityFilter] = useState("all");

  const { toast } = useToast();

  const { data: shifts = [], isLoading: shiftsLoading, refetch: refetchShifts } = useQuery<EnrichedShift[]>({
    queryKey: ["/api/shifts", "today"],
    queryFn: async () => {
      const res = await fetch("/api/shifts?todayOnly=true", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load shifts");
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: incidents = [], isLoading: incidentsLoading } = useQuery<EnrichedIncident[]>({
    queryKey: ["/api/incidents"],
    refetchInterval: 30000,
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: employees = [] } = useQuery<EmployeeRecord[]>({
    queryKey: ["/api/admin/employees"],
  });

  const { data: handoverNotes = [] } = useQuery<any[]>({
    queryKey: ["/api/control-room/handover-notes"],
    refetchInterval: 60000,
  });

  const { data: activityLog = [] } = useQuery<any[]>({
    queryKey: ["/api/control-room/activity-log"],
    refetchInterval: 30000,
  });

  const { data: siteCoverage = [] } = useQuery<any[]>({
    queryKey: ["/api/control-room/site-coverage"],
    refetchInterval: 30000,
  });

  const { data: escalationRules = [] } = useQuery<any[]>({
    queryKey: ["/api/control-room/escalation-rules"],
  });

  const handoverMutation = useMutation({
    mutationFn: async (data: { note: string; openIssues: string; pendingActions: string; watchItems: string }) => {
      const res = await apiRequest("POST", "/api/control-room/handover-notes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-room/handover-notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-room/activity-log"] });
      setHandoverOpen(false);
      setHandoverForm({ note: "", openIssues: "", pendingActions: "", watchItems: "" });
      toast({ title: "Handover submitted", description: "Your handover note has been saved." });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const createRuleMutation = useMutation({
    mutationFn: async (data: typeof newRule) => {
      const res = await apiRequest("POST", "/api/control-room/escalation-rules", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-room/escalation-rules"] });
      setNewRuleOpen(false);
      setNewRule({ name: "", triggerType: "late_checkin", delayMinutes: 15, actionType: "mark_late" });
      toast({ title: "Rule created" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/control-room/escalation-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-room/escalation-rules"] });
      toast({ title: "Rule deleted" });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/control-room/escalation-rules/${id}`, { enabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/control-room/escalation-rules"] });
    },
  });

  const runEscalationMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/control-room/run-escalation", {});
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-room/activity-log"] });
      toast({ title: "Escalation complete", description: `${data.escalated} shift${data.escalated !== 1 ? "s" : ""} escalated.` });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateIncidentMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/incidents/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/control-room/activity-log"] });
      toast({ title: "Incident updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(new Date());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const createIncidentMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; severity: string; siteId: number }) => {
      const res = await apiRequest("POST", "/api/incidents", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/incidents"] });
      setDialogOpen(false);
      setNewIncident({ title: "", description: "", severity: "medium", siteId: "" });
      toast({ title: "Incident reported", description: "The incident has been logged." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const precheckMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof precheckForm }) => {
      const res = await apiRequest("POST", `/api/shifts/${id}/precheck`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setPrecheckDialogOpen(false);
      toast({ title: "Pre-check completed", description: "Book-on pre-checks have been recorded." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const updateShiftMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/shifts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setEditDialogOpen(false);
      setReassignDialogOpen(false);
      setNotesDialogOpen(false);
      toast({ title: "Shift updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const checkinMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("POST", `/api/shifts/${id}/checkin`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      toast({ title: "Check-in recorded", description: "Employee has been booked on." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const today = new Date().toISOString().split("T")[0];
  const todayShifts = shifts.filter((s) => s.date === today);
  const activeShiftsToday = todayShifts.filter((s) => s.status === "in_progress" || s.status === "scheduled");
  const bookedOn = todayShifts.filter((s) => s.status === "in_progress");
  const lateShifts = todayShifts.filter((s) => s.isLate);
  const noShows = todayShifts.filter((s) => s.status === "no_show");
  const precheckPending = todayShifts.filter((s) => s.status === "scheduled" && !s.precheckData);
  const precheckFailed = todayShifts.filter((s) => s.precheckData && !s.precheckData.passed);
  const openIncidents = incidents.filter((i) => i.status !== "closed");
  const activeSites = new Set(activeShiftsToday.map((s) => s.siteName)).size;

  const coverageSummary = useMemo(() => {
    const fully = siteCoverage.filter((s: any) => s.coverage_status === "fully_staffed").length;
    const under = siteCoverage.filter((s: any) => s.coverage_status === "understaffed").length;
    const unmanned = siteCoverage.filter((s: any) => s.coverage_status === "unmanned").length;
    return { fully, under, unmanned, total: siteCoverage.length };
  }, [siteCoverage]);

  const recentHandover = handoverNotes.length > 0 ? handoverNotes[0] : null;
  const recentHandoverHours = recentHandover ? (Date.now() - new Date(recentHandover.created_at).getTime()) / 3600000 : Infinity;

  const filteredActivityLog = activityFilter === "all"
    ? activityLog
    : activityLog.filter((a: any) => a.action_type === activityFilter);

  const actionIcons: Record<string, { icon: any; label: string }> = {
    checkin: { icon: Play, label: "Check-in" },
    book_on: { icon: CheckCircle2, label: "Book On" },
    bulk_complete: { icon: CheckCircle2, label: "Completed" },
    handover_written: { icon: FileText, label: "Handover" },
    incident_investigating: { icon: Eye, label: "Acknowledged" },
    incident_resolved: { icon: Shield, label: "Resolved" },
    incident_closed: { icon: CheckCircle2, label: "Closed" },
    incident_update: { icon: Pencil, label: "Updated" },
    escalation_mark_late: { icon: Timer, label: "Escalated (Late)" },
    escalation_mark_no_show: { icon: Ban, label: "Escalated (No Show)" },
    escalation_notify_controller: { icon: AlertTriangle, label: "Controller Notified" },
  };

  const isLoading = shiftsLoading || incidentsLoading;

  function openPrecheck(shift: EnrichedShift) {
    setSelectedShift(shift);
    setPrecheckForm({
      siaValid: shift.siaValid,
      dbsValid: shift.dbsValid,
      uniformConfirmed: false,
      equipmentConfirmed: false,
      welfareChecked: false,
    });
    setPrecheckDialogOpen(true);
  }

  function openEdit(shift: EnrichedShift) {
    setSelectedShift(shift);
    setEditForm({
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: String(shift.breakMinutes || 0),
    });
    setEditDialogOpen(true);
  }

  function openReassign(shift: EnrichedShift) {
    setSelectedShift(shift);
    setReassignEmployeeId(shift.employeeId ? String(shift.employeeId) : "");
    setReassignDialogOpen(true);
  }

  function openNotes(shift: EnrichedShift) {
    setSelectedShift(shift);
    setControllerNotes(shift.controllerNotes || "");
    setNotesDialogOpen(true);
  }

  function openDetail(shift: EnrichedShift) {
    setSelectedShift(shift);
    setDetailDialogOpen(true);
  }

  function handleSubmitIncident() {
    if (!newIncident.title || !newIncident.description || !newIncident.siteId) {
      toast({ title: "Missing fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    createIncidentMutation.mutate({
      title: newIncident.title,
      description: newIncident.description,
      severity: newIncident.severity,
      siteId: parseInt(newIncident.siteId),
    });
  }

  function handleBookOn(shift: EnrichedShift) {
    checkinMutation.mutate({ id: shift.id, data: {} });
  }

  function handleMarkNoShow(shift: EnrichedShift) {
    updateShiftMutation.mutate({ id: shift.id, data: { status: "no_show" } });
  }

  function handleCompleteShift(shift: EnrichedShift) {
    updateShiftMutation.mutate({ id: shift.id, data: { status: "completed", checkOutTime: new Date().toISOString() } });
  }

  function ShiftCard({ shift }: { shift: EnrichedShift }) {
    const cardColor = getShiftCardColor(shift);
    const statusInfo = getShiftStatusLabel(shift);
    const isSelectable = shift.status === "scheduled" || shift.status === "in_progress";
    const isSelected = selectedShiftIds.has(shift.id);

    return (
      <Card className={`${cardColor} transition-all shadow-sm hover:shadow-md`} data-testid={`shift-card-${shift.id}`}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              {isSelectable && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleShiftSelection(shift.id)}
                  className="mt-2.5 flex-shrink-0"
                  data-testid={`checkbox-shift-${shift.id}`}
                />
              )}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                shift.status === "in_progress" ? "bg-emerald-100 dark:bg-emerald-900/30" :
                shift.isLate || shift.status === "no_show" ? "bg-red-100 dark:bg-red-900/30" :
                shift.status === "completed" ? "bg-gray-100 dark:bg-gray-800" :
                "bg-amber-50 dark:bg-amber-900/20"
              }`}>
                <Users className={`w-5 h-5 ${
                  shift.status === "in_progress" ? "text-emerald-600" :
                  shift.isLate || shift.status === "no_show" ? "text-red-600" :
                  shift.status === "completed" ? "text-gray-400" :
                  "text-amber-600"
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-semibold" data-testid={`shift-employee-${shift.id}`}>
                    {shift.employeeName}
                  </p>
                  <Badge variant="outline" className={statusInfo.color} data-testid={`shift-status-badge-${shift.id}`}>
                    {statusInfo.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {shift.siteName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {shift.startTime} – {shift.endTime}
                  </span>
                  {shift.supplierName && (
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3" />
                      {shift.supplierName}
                    </span>
                  )}
                </div>

                {shift.lastCheckInAddress && (
                  <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 mt-1">
                    <Navigation className="w-3 h-3" />
                    Last check-in: {shift.lastCheckInAddress}
                    {shift.checkInTime && (
                      <span className="ml-1 text-muted-foreground">
                        at {new Date(shift.checkInTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </div>
                )}

                {shift.checkInTime && !shift.lastCheckInAddress && (
                  <div className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 mt-1">
                    <CheckCircle2 className="w-3 h-3" />
                    Checked in at {new Date(shift.checkInTime).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}

                {shift.precheckData && !shift.precheckData.passed && shift.precheckData.failReason && (
                  <div className="flex items-center gap-1 text-xs text-red-700 dark:text-red-400 mt-1">
                    <XCircle className="w-3 h-3" />
                    {shift.precheckData.failReason}
                  </div>
                )}

                {shift.controllerNotes && (
                  <div className="flex items-center gap-1 text-xs text-blue-700 dark:text-blue-400 mt-1">
                    <StickyNote className="w-3 h-3" />
                    {shift.controllerNotes}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <Button size="icon" variant="ghost" onClick={() => openDetail(shift)} data-testid={`btn-detail-${shift.id}`}>
                <Eye className="w-4 h-4" />
              </Button>

              {shift.status === "scheduled" && !shift.precheckData && (
                <Button size="sm" variant="outline" onClick={() => openPrecheck(shift)} data-testid={`btn-precheck-${shift.id}`}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Pre-check
                </Button>
              )}

              {shift.status === "scheduled" && shift.precheckData?.passed && (
                <Button size="sm" className="bg-green-600 text-white" onClick={() => handleBookOn(shift)} data-testid={`btn-bookon-${shift.id}`}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Book On
                </Button>
              )}

              {shift.status === "in_progress" && (
                <Button size="sm" variant="outline" onClick={() => handleCompleteShift(shift)} data-testid={`btn-complete-${shift.id}`}>
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Complete
                </Button>
              )}

              {(shift.status === "scheduled" || shift.status === "in_progress") && (
                <>
                  <Button size="icon" variant="ghost" onClick={() => openEdit(shift)} data-testid={`btn-edit-${shift.id}`}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openReassign(shift)} data-testid={`btn-reassign-${shift.id}`}>
                    <UserCog className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => openNotes(shift)} data-testid={`btn-notes-${shift.id}`}>
                    <StickyNote className="w-4 h-4" />
                  </Button>
                </>
              )}

              {shift.status === "scheduled" && (
                <Button size="icon" variant="ghost" onClick={() => handleMarkNoShow(shift)} data-testid={`btn-noshow-${shift.id}`}>
                  <Ban className="w-4 h-4 text-red-500" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<number>>(new Set());
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);

  const toggleShiftSelection = useCallback((id: number) => {
    setSelectedShiftIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const bulkCompleteMutation = useMutation({
    mutationFn: async (shiftIds: number[]) => {
      const res = await apiRequest("POST", "/api/shifts/bulk-complete", { shiftIds });
      return res.json();
    },
    onSuccess: (data: { completed: number[]; skipped: number[]; errors: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      setSelectedShiftIds(new Set());
      setBulkConfirmOpen(false);
      const msg = data.completed.length > 0
        ? `${data.completed.length} shift${data.completed.length !== 1 ? "s" : ""} completed successfully.`
        : "No shifts were completed.";
      const extra = data.skipped.length > 0 ? ` ${data.skipped.length} skipped.` : "";
      toast({ title: "Bulk Complete", description: msg + extra });
    },
    onError: (error: Error) => {
      toast({ title: "Bulk Complete Failed", description: error.message, variant: "destructive" });
    },
  });

  const [shiftSearch, setShiftSearch] = useState("");
  const [shiftStatusFilter, setShiftStatusFilter] = useState<string>("all");
  const [collapsedSites, setCollapsedSites] = useState<Set<string>>(new Set());

  const toggleSiteCollapse = useCallback((siteName: string) => {
    setCollapsedSites(prev => {
      const next = new Set(prev);
      if (next.has(siteName)) next.delete(siteName);
      else next.add(siteName);
      return next;
    });
  }, []);

  const filteredShifts = useMemo(() => {
    let filtered = todayShifts;
    if (shiftSearch.trim()) {
      const q = shiftSearch.toLowerCase();
      filtered = filtered.filter(s =>
        s.employeeName.toLowerCase().includes(q) ||
        s.siteName.toLowerCase().includes(q) ||
        (s.supplierName && s.supplierName.toLowerCase().includes(q))
      );
    }
    if (shiftStatusFilter !== "all") {
      switch (shiftStatusFilter) {
        case "late": filtered = filtered.filter(s => s.isLate); break;
        case "booked_on": filtered = filtered.filter(s => s.status === "in_progress"); break;
        case "precheck_pending": filtered = filtered.filter(s => s.status === "scheduled" && !s.precheckData); break;
        case "prechecked": filtered = filtered.filter(s => s.status === "scheduled" && s.precheckData?.passed); break;
        case "no_show": filtered = filtered.filter(s => s.status === "no_show"); break;
        case "completed": filtered = filtered.filter(s => s.status === "completed"); break;
        case "scheduled": filtered = filtered.filter(s => s.status === "scheduled" && !s.precheckData?.passed); break;
        case "in_progress": filtered = filtered.filter(s => s.status === "in_progress"); break;
      }
    }
    return filtered.sort((a, b) => {
      const order: Record<string, number> = { in_progress: 0, scheduled: 1, no_show: 2, completed: 3, cancelled: 4 };
      const aOrder = a.isLate ? -1 : (order[a.status || ""] ?? 5);
      const bOrder = b.isLate ? -1 : (order[b.status || ""] ?? 5);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [todayShifts, shiftSearch, shiftStatusFilter]);

  const groupedShifts = useMemo(() => {
    const groups: Record<string, EnrichedShift[]> = {};
    filteredShifts.forEach(s => {
      if (!groups[s.siteName]) groups[s.siteName] = [];
      groups[s.siteName].push(s);
    });
    return Object.entries(groups).sort((a, b) => {
      const aUrgent = a[1].some(s => s.isLate || s.status === "no_show");
      const bUrgent = b[1].some(s => s.isLate || s.status === "no_show");
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return b[1].length - a[1].length;
    });
  }, [filteredShifts]);

  const flatVirtualItems = useMemo(() => {
    const items: Array<{ type: "header"; siteName: string; shifts: EnrichedShift[] } | { type: "shift"; shift: EnrichedShift }> = [];
    groupedShifts.forEach(([siteName, siteShifts]) => {
      items.push({ type: "header", siteName, shifts: siteShifts });
      if (!collapsedSites.has(siteName)) {
        siteShifts.forEach(shift => items.push({ type: "shift", shift }));
      }
    });
    return items;
  }, [groupedShifts, collapsedSites]);

  const statusFilterCounts = useMemo(() => ({
    all: todayShifts.length,
    late: todayShifts.filter(s => s.isLate).length,
    booked_on: todayShifts.filter(s => s.status === "in_progress").length,
    precheck_pending: todayShifts.filter(s => s.status === "scheduled" && !s.precheckData).length,
    no_show: todayShifts.filter(s => s.status === "no_show").length,
    scheduled: todayShifts.filter(s => s.status === "scheduled").length,
    completed: todayShifts.filter(s => s.status === "completed").length,
  }), [todayShifts]);

  return (
    <div className="p-6 space-y-6" data-testid="control-room-page">
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-[#1F3A5F] via-[#2a4a73] to-[#1F3A5F] p-6 text-white shadow-lg">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMSIgZmlsbD0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center ring-2 ring-white/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3" data-testid="text-page-title">
                Control Room
                <span className="flex items-center gap-1.5 text-xs font-medium bg-green-500/20 text-green-300 px-2.5 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
              </h1>
              <p className="text-sm text-white/70 mt-0.5">
                Live workforce monitoring &amp; shift management
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {aiControllerActive && (
              <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-1.5 ring-1 ring-white/20" data-testid="ai-mode-toggle-container">
                <Brain className={`w-4 h-4 ${aiMode ? "text-[#FF8C42]" : "text-white/50"}`} />
                <span className="text-xs font-medium text-white/90">{aiMode ? "AI Mode" : "Manual"}</span>
                <button
                  onClick={() => setAiMode(!aiMode)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${aiMode ? "bg-[#FF8C42]" : "bg-white/30"}`}
                  data-testid="button-toggle-ai-mode"
                >
                  <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${aiMode ? "translate-x-4.5" : "translate-x-0.5"}`} />
                </button>
              </div>
            )}
            {aiControllerActive && aiMode && (
              <Button size="sm" variant={aiChatOpen ? "default" : "outline"} onClick={() => setAiChatOpen(!aiChatOpen)} className={aiChatOpen ? "bg-[#FF8C42] hover:bg-[#e67a35] border-0" : "bg-white/10 border-white/20 text-white hover:bg-white/20"} data-testid="button-ai-chat">
                <Bot className="w-3 h-3 mr-1" />
                AI Chat
              </Button>
            )}
            <span className="text-xs text-white/60" data-testid="text-last-refresh">
              {lastRefresh.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
            <Button size="sm" onClick={() => { refetchShifts(); setLastRefresh(new Date()); }} className="bg-white/10 border-white/20 text-white hover:bg-white/20 border" data-testid="btn-refresh">
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium" data-testid="legend-precheck">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          Awaiting Pre-check
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium" data-testid="legend-bookedon">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          Booked On
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-medium" data-testid="legend-late">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          Late / Failed
        </div>
        <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200 font-medium" data-testid="legend-completed">
          <div className="w-2.5 h-2.5 rounded-full bg-gray-400" />
          Completed
        </div>
      </div>

      <div className="flex gap-1.5 bg-gray-100/80 dark:bg-gray-800/50 p-1.5 rounded-xl" data-testid="tabs-container">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              data-testid={`tab-${tab.id}`}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all ${
                isActive
                  ? "bg-white dark:bg-gray-700 text-[#1F3A5F] dark:text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50 dark:hover:bg-gray-700/50"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-[#FF8C42]" : ""}`} />
              {tab.label}
              {tab.id === "shifts" && todayShifts.length > 0 && (
                <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold ${isActive ? "bg-[#1F3A5F]/10 text-[#1F3A5F]" : "bg-gray-200 text-gray-600"}`}>{todayShifts.length}</span>
              )}
              {tab.id === "incidents" && openIncidents.length > 0 && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-700">{openIncidents.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {activeTab === "overview" && (
            <div className="space-y-6" data-testid="tab-content-overview">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]" data-testid="kpi-total-shifts">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-[#1F3A5F] to-[#2d5a8e] p-4 text-center text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mx-auto mb-2">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div className="text-3xl font-bold" data-testid="value-total-shifts">{todayShifts.length}</div>
                      <p className="text-xs text-white/70 mt-1 font-medium">Total Shifts</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]" data-testid="kpi-booked-on">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-center text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mx-auto mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="text-3xl font-bold" data-testid="value-booked-on">{bookedOn.length}</div>
                      <p className="text-xs text-white/70 mt-1 font-medium">Booked On</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]" data-testid="kpi-precheck-pending">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-amber-400 to-amber-600 p-4 text-center text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mx-auto mb-2">
                        <Eye className="w-4 h-4" />
                      </div>
                      <div className="text-3xl font-bold" data-testid="value-precheck-pending">{precheckPending.length}</div>
                      <p className="text-xs text-white/70 mt-1 font-medium">Pre-check Pending</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]" data-testid="kpi-late">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-rose-500 to-rose-700 p-4 text-center text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mx-auto mb-2">
                        <Timer className="w-4 h-4" />
                      </div>
                      <div className="text-3xl font-bold" data-testid="value-late">{lateShifts.length}</div>
                      <p className="text-xs text-white/70 mt-1 font-medium">Late</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]" data-testid="kpi-no-shows">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-red-600 to-red-800 p-4 text-center text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mx-auto mb-2">
                        <Ban className="w-4 h-4" />
                      </div>
                      <div className="text-3xl font-bold" data-testid="value-no-shows">{noShows.length}</div>
                      <p className="text-xs text-white/70 mt-1 font-medium">No Shows</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="overflow-hidden border-0 shadow-md hover:shadow-lg transition-all hover:scale-[1.02]" data-testid="kpi-sites-active">
                  <CardContent className="p-0">
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-4 text-center text-white">
                      <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center mx-auto mb-2">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="text-3xl font-bold" data-testid="value-sites-active">{activeSites}</div>
                      <p className="text-xs text-white/70 mt-1 font-medium">Active Sites</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Handover Notes */}
              {recentHandoverHours < 12 && recentHandover && (
                <Card className="border-0 shadow-md border-l-4 border-l-blue-500" data-testid="handover-alert">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-sm font-semibold">Shift Handover</h3>
                            <span className="text-xs text-muted-foreground">by {recentHandover.author_name} — {new Date(recentHandover.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <p className="text-sm" data-testid="handover-note-text">{recentHandover.note}</p>
                          {recentHandover.open_issues && (
                            <div className="mt-2">
                              <span className="text-xs font-semibold text-red-600">Open Issues:</span>
                              <p className="text-xs text-muted-foreground">{recentHandover.open_issues}</p>
                            </div>
                          )}
                          {recentHandover.pending_actions && (
                            <div className="mt-1">
                              <span className="text-xs font-semibold text-amber-600">Pending Actions:</span>
                              <p className="text-xs text-muted-foreground">{recentHandover.pending_actions}</p>
                            </div>
                          )}
                          {recentHandover.watch_items && (
                            <div className="mt-1">
                              <span className="text-xs font-semibold text-blue-600">Watch:</span>
                              <p className="text-xs text-muted-foreground">{recentHandover.watch_items}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Dialog open={handoverOpen} onOpenChange={setHandoverOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="button-write-handover">
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Write Handover
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Shift Handover Notes</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div className="space-y-1.5">
                        <Label>Summary</Label>
                        <Textarea data-testid="input-handover-note" placeholder="Overview of the shift..." value={handoverForm.note} onChange={(e) => setHandoverForm(p => ({ ...p, note: e.target.value }))} rows={3} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Open Issues</Label>
                        <Textarea data-testid="input-handover-issues" placeholder="Any unresolved issues..." value={handoverForm.openIssues} onChange={(e) => setHandoverForm(p => ({ ...p, openIssues: e.target.value }))} rows={2} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Pending Actions</Label>
                        <Textarea data-testid="input-handover-actions" placeholder="Actions the next controller should take..." value={handoverForm.pendingActions} onChange={(e) => setHandoverForm(p => ({ ...p, pendingActions: e.target.value }))} rows={2} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Things to Watch</Label>
                        <Textarea data-testid="input-handover-watch" placeholder="Sites or situations to monitor..." value={handoverForm.watchItems} onChange={(e) => setHandoverForm(p => ({ ...p, watchItems: e.target.value }))} rows={2} />
                      </div>
                      <Button className="w-full" data-testid="button-submit-handover" onClick={() => handoverMutation.mutate(handoverForm)} disabled={handoverMutation.isPending || !handoverForm.note.trim()}>
                        {handoverMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        Submit Handover
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button variant="outline" size="sm" onClick={() => setEscalationOpen(!escalationOpen)} data-testid="button-escalation-settings">
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  Escalation Rules
                </Button>

                {showPreviousHandovers ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowPreviousHandovers(false)} data-testid="button-hide-handovers">
                    Hide Handovers
                  </Button>
                ) : handoverNotes.length > 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setShowPreviousHandovers(true)} data-testid="button-show-handovers">
                    <History className="w-3.5 h-3.5 mr-1.5" />
                    Previous Handovers ({handoverNotes.length - (recentHandoverHours < 12 ? 1 : 0)})
                  </Button>
                )}
              </div>

              {showPreviousHandovers && (
                <div className="space-y-2">
                  {handoverNotes.slice(recentHandoverHours < 12 ? 1 : 0).map((h: any) => (
                    <Card key={h.id} className="shadow-sm" data-testid={`handover-card-${h.id}`}>
                      <CardContent className="p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium">{h.author_name}</span>
                          <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString("en-GB")} {new Date(h.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-sm">{h.note}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Escalation Rules Panel */}
              {escalationOpen && (
                <Card className="border-0 shadow-md" data-testid="escalation-rules-panel">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        Auto-Escalation Rules
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => runEscalationMutation.mutate()} disabled={runEscalationMutation.isPending} data-testid="button-run-escalation">
                          {runEscalationMutation.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Zap className="w-3.5 h-3.5 mr-1" />}
                          Run Now
                        </Button>
                        <Dialog open={newRuleOpen} onOpenChange={setNewRuleOpen}>
                          <DialogTrigger asChild>
                            <Button size="sm" data-testid="button-add-rule"><Plus className="w-3.5 h-3.5 mr-1" />Add Rule</Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>New Escalation Rule</DialogTitle></DialogHeader>
                            <div className="space-y-3 pt-2">
                              <div className="space-y-1.5">
                                <Label>Rule Name</Label>
                                <Input data-testid="input-rule-name" value={newRule.name} onChange={(e) => setNewRule(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Late after 10 minutes" />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Trigger</Label>
                                <Select value={newRule.triggerType} onValueChange={(v) => setNewRule(p => ({ ...p, triggerType: v }))}>
                                  <SelectTrigger data-testid="select-rule-trigger"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="late_checkin">Late Check-in</SelectItem>
                                    <SelectItem value="no_show">No Show</SelectItem>
                                    <SelectItem value="precheck_fail">Pre-check Fail</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Delay (minutes after shift start)</Label>
                                <Input data-testid="input-rule-delay" type="number" min={1} value={newRule.delayMinutes} onChange={(e) => setNewRule(p => ({ ...p, delayMinutes: parseInt(e.target.value) || 0 }))} />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Action</Label>
                                <Select value={newRule.actionType} onValueChange={(v) => setNewRule(p => ({ ...p, actionType: v }))}>
                                  <SelectTrigger data-testid="select-rule-action"><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="mark_late">Mark Late</SelectItem>
                                    <SelectItem value="mark_no_show">Mark No Show</SelectItem>
                                    <SelectItem value="notify_controller">Notify Controller</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <Button className="w-full" data-testid="button-save-rule" onClick={() => createRuleMutation.mutate(newRule)} disabled={createRuleMutation.isPending || !newRule.name.trim()}>
                                {createRuleMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                                Save Rule
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {escalationRules.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No escalation rules configured. Add one to automate responses to late arrivals and no-shows.</p>
                    ) : (
                      <div className="space-y-2">
                        {escalationRules.map((rule: any) => (
                          <div key={rule.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border" data-testid={`rule-card-${rule.id}`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <Switch checked={rule.enabled} onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, enabled: checked })} data-testid={`rule-toggle-${rule.id}`} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{rule.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {rule.trigger_type === "late_checkin" ? "Late Check-in" : rule.trigger_type === "no_show" ? "No Show" : "Pre-check Fail"} → {rule.delay_minutes}min → {rule.action_type.replace(/_/g, " ")}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => deleteRuleMutation.mutate(rule.id)} data-testid={`button-delete-rule-${rule.id}`}>
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Site Coverage Dashboard */}
              {siteCoverage.length > 0 && (
                <Card className="border-0 shadow-md" data-testid="site-coverage-panel">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-[#1F3A5F]" />
                      Site Coverage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20" data-testid="coverage-fully-staffed">
                        <div className="text-xl font-bold text-emerald-600">{coverageSummary.fully}</div>
                        <div className="text-[10px] font-medium text-emerald-700 dark:text-emerald-400">Fully Staffed</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20" data-testid="coverage-understaffed">
                        <div className="text-xl font-bold text-amber-600">{coverageSummary.under}</div>
                        <div className="text-[10px] font-medium text-amber-700 dark:text-amber-400">Understaffed</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20" data-testid="coverage-unmanned">
                        <div className="text-xl font-bold text-red-600">{coverageSummary.unmanned}</div>
                        <div className="text-[10px] font-medium text-red-700 dark:text-red-400">Unmanned</div>
                      </div>
                    </div>
                    {(coverageSummary.unmanned > 0 || coverageSummary.under > 0) && (
                      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                        {siteCoverage
                          .filter((s: any) => s.coverage_status === "unmanned" || s.coverage_status === "understaffed")
                          .sort((a: any, b: any) => (a.coverage_status === "unmanned" ? -1 : 1))
                          .map((site: any) => (
                            <div key={site.site_id} className="flex items-center justify-between gap-2 p-2 rounded-lg border text-sm" data-testid={`coverage-site-${site.site_id}`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${site.coverage_status === "unmanned" ? "bg-red-500" : "bg-amber-500"}`} />
                                <div className="min-w-0">
                                  <p className="font-medium truncate text-xs">{site.site_name}</p>
                                  <p className="text-[10px] text-muted-foreground">{site.site_postcode} — {site.booked_on}/{site.total_shifts} checked in</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${site.coverage_status === "unmanned" ? "bg-red-500" : "bg-amber-500"}`} style={{ width: `${site.total_shifts > 0 ? (site.booked_on / site.total_shifts) * 100 : 0}%` }} />
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Controller Activity Log */}
              <Card className="border-0 shadow-md" data-testid="controller-activity-log">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 cursor-pointer" onClick={() => setActivityLogExpanded(!activityLogExpanded)}>
                      <History className="w-4 h-4 text-[#1F3A5F]" />
                      Controller Activity Log
                      {activityLogExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </CardTitle>
                    {activityLogExpanded && (
                      <Select value={activityFilter} onValueChange={setActivityFilter}>
                        <SelectTrigger className="w-[140px] h-7 text-xs" data-testid="select-activity-filter"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Actions</SelectItem>
                          <SelectItem value="checkin">Check-ins</SelectItem>
                          <SelectItem value="book_on">Book Ons</SelectItem>
                          <SelectItem value="bulk_complete">Completions</SelectItem>
                          <SelectItem value="handover_written">Handovers</SelectItem>
                          <SelectItem value="incident_investigating">Incidents</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </CardHeader>
                {activityLogExpanded && (
                  <CardContent className="pt-0">
                    {filteredActivityLog.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No activity recorded yet.</p>
                    ) : (
                      <div className="space-y-1 max-h-[300px] overflow-y-auto">
                        {filteredActivityLog.slice(0, 50).map((entry: any) => {
                          const ai = actionIcons[entry.action_type] || { icon: Activity, label: entry.action_type };
                          const Icon = ai.icon;
                          return (
                            <div key={entry.id} className="flex items-start gap-2.5 py-1.5 border-b last:border-0" data-testid={`activity-entry-${entry.id}`}>
                              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-xs font-medium">{entry.controller_name || "System"}</span>
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ai.label}</Badge>
                                  {entry.details && <span className="text-xs text-muted-foreground truncate">{entry.details}</span>}
                                </div>
                                <span className="text-[10px] text-muted-foreground">{new Date(entry.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>

              {aiControllerActive && aiMode && (
                <AIKPIInsights shifts={shifts} incidents={incidents} />
              )}

              {!aiControllerActive && (
                <AIUpgradeBanner />
              )}

              {aiControllerActive && aiMode && (
                <>
                  <div className={`grid gap-4 ${aiChatOpen ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
                    <AISituationalAwareness shifts={shifts} incidents={incidents} />
                    <div className="space-y-4">
                      <AISmartAlerts shifts={shifts} incidents={incidents} />
                      <AIQuickActions shifts={shifts} incidents={incidents} />
                    </div>
                    {aiChatOpen && (
                      <AIChatPanel
                        messages={aiChatMessages}
                        setMessages={setAiChatMessages}
                        input={aiChatInput}
                        setInput={setAiChatInput}
                        isLoading={aiChatLoading}
                        setIsLoading={setAiChatLoading}
                        shifts={shifts}
                        incidents={incidents}
                      />
                    )}
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <AIAutoContactPanel shifts={shifts} />
                    <AIContactLogs />
                  </div>
                </>
              )}

              {precheckFailed.length > 0 && (
                <Card className="overflow-hidden border-0 shadow-md">
                  <div className="bg-gradient-to-r from-red-500 to-red-600 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <XCircle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Pre-check Failures</h3>
                      <p className="text-xs text-white/70">{precheckFailed.length} shift{precheckFailed.length !== 1 ? "s" : ""} require attention</p>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    {precheckFailed.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                            <Users className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{shift.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{shift.siteName} — {shift.startTime}–{shift.endTime}</p>
                            {shift.precheckData?.failReason && (
                              <p className="text-xs text-red-600 mt-0.5">{shift.precheckData.failReason}</p>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => openReassign(shift)}>
                          <UserCog className="w-3 h-3 mr-1" />
                          Reassign
                        </Button>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {lateShifts.length > 0 && (
                <Card className="overflow-hidden border-0 shadow-md">
                  <div className="bg-gradient-to-r from-rose-500 to-orange-500 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <Timer className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Late Arrivals</h3>
                      <p className="text-xs text-white/70">{lateShifts.length} officer{lateShifts.length !== 1 ? "s" : ""} overdue</p>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    {lateShifts.map((shift) => (
                      <div key={shift.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/30 flex items-center justify-center flex-shrink-0">
                            <Clock className="w-4 h-4 text-rose-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{shift.employeeName}</p>
                            <p className="text-xs text-muted-foreground">{shift.siteName} — Should have started at {shift.startTime}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {shift.employeePhone && (
                            <Button size="sm" variant="outline">
                              <PhoneCall className="w-3 h-3 mr-1" />
                              Call
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => handleMarkNoShow(shift)}>
                            <Ban className="w-3 h-3 mr-1" />
                            No Show
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {openIncidents.length > 0 && (
                <Card className="overflow-hidden border-0 shadow-md">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Open Incidents</h3>
                      <p className="text-xs text-white/70">{openIncidents.length} incident{openIncidents.length !== 1 ? "s" : ""} active</p>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    {openIncidents.slice(0, 5).map((incident) => (
                      <div key={incident.id} className="flex items-center justify-between gap-3 px-4 py-3 border-b last:border-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              {(incident as any).incidentRef && <span className="text-xs text-muted-foreground font-mono">{(incident as any).incidentRef}</span>}
                              <p className="text-sm font-medium">{incident.title}</p>
                            </div>
                            <p className="text-xs text-muted-foreground">{incident.siteName}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={getSeverityColor(incident.severity || "medium")}>
                          {incident.severity}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "ai_autonomous" && (
            <div className="space-y-6" data-testid="tab-content-ai-autonomous">
              {aiControllerActive ? (
                <AIAutonomousPanel shifts={todayShifts} />
              ) : (
                <AIUpgradeBanner />
              )}
            </div>
          )}

          {activeTab === "shifts" && (
            <div className="space-y-4" data-testid="tab-content-shifts">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold" data-testid="text-shifts-date">
                    Today&apos;s Shifts &mdash;{" "}
                    {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </h2>
                  {filteredShifts.length !== todayShifts.length && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Showing {filteredShifts.length} of {todayShifts.length} shifts
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">{groupedShifts.length} site{groupedShifts.length !== 1 ? "s" : ""}</span>
                  <Badge variant="outline" className="bg-[#1F3A5F]/5 border-[#1F3A5F]/20 text-[#1F3A5F] font-semibold">{filteredShifts.length} shift{filteredShifts.length !== 1 ? "s" : ""}</Badge>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search employee, site, supplier..."
                    value={shiftSearch}
                    onChange={(e) => setShiftSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                    data-testid="input-shift-search"
                  />
                </div>
                {(() => {
                  const selectableShifts = filteredShifts.filter(s => s.status === "scheduled" || s.status === "in_progress");
                  const allSelected = selectableShifts.length > 0 && selectableShifts.every(s => selectedShiftIds.has(s.id));
                  const someSelected = selectableShifts.some(s => selectedShiftIds.has(s.id));
                  if (selectableShifts.length === 0) return null;
                  return (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={allSelected ? true : someSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedShiftIds(new Set(selectableShifts.map(s => s.id)));
                          } else {
                            setSelectedShiftIds(new Set());
                          }
                        }}
                        data-testid="checkbox-select-all"
                      />
                      <Label className="text-xs text-muted-foreground cursor-pointer" onClick={() => {
                        const allSel = selectableShifts.every(s => selectedShiftIds.has(s.id));
                        if (allSel) setSelectedShiftIds(new Set());
                        else setSelectedShiftIds(new Set(selectableShifts.map(s => s.id)));
                      }}>Select All</Label>
                    </div>
                  );
                })()}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { key: "all", label: "All", color: "bg-gray-100 text-gray-700 hover:bg-gray-200" },
                    { key: "late", label: "Late", color: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200" },
                    { key: "booked_on", label: "Booked On", color: "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200" },
                    { key: "precheck_pending", label: "Pre-check", color: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200" },
                    { key: "no_show", label: "No Show", color: "bg-red-50 text-red-700 hover:bg-red-100 border-red-200" },
                    { key: "scheduled", label: "Scheduled", color: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200" },
                    { key: "completed", label: "Done", color: "bg-gray-50 text-gray-600 hover:bg-gray-100 border-gray-200" },
                  ] as const).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setShiftStatusFilter(f.key)}
                      data-testid={`filter-${f.key}`}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        shiftStatusFilter === f.key
                          ? f.key === "all" ? "bg-[#1F3A5F] text-white border-[#1F3A5F]" : f.color + " ring-2 ring-offset-1 ring-current/20"
                          : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {f.label}
                      {statusFilterCounts[f.key as keyof typeof statusFilterCounts] > 0 && (
                        <span className="ml-1.5 opacity-70">{statusFilterCounts[f.key as keyof typeof statusFilterCounts]}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {filteredShifts.length === 0 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                      <Clock className="w-7 h-7 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">
                      {todayShifts.length === 0 ? "No shifts scheduled for today." : "No shifts match your filters."}
                    </p>
                    {todayShifts.length > 0 && shiftSearch && (
                      <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => { setShiftSearch(""); setShiftStatusFilter("all"); }}>
                        Clear filters
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-lg border bg-card shadow-sm" style={{ height: Math.min(flatVirtualItems.length * 85, 700) }}>
                  <Virtuoso
                    data={flatVirtualItems}
                    style={{ height: "100%" }}
                    itemContent={(index, item) => {
                      if (item.type === "header") {
                        const siteShifts = item.shifts;
                        const isCollapsed = collapsedSites.has(item.siteName);
                        const lateCount = siteShifts.filter(s => s.isLate).length;
                        const bookedCount = siteShifts.filter(s => s.status === "in_progress").length;
                        const noShowCount = siteShifts.filter(s => s.status === "no_show").length;
                        const hasUrgent = lateCount > 0 || noShowCount > 0;
                        return (
                          <div
                            className={`flex items-center justify-between gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                              hasUrgent
                                ? "bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-b border-red-200/50"
                                : "bg-gradient-to-r from-gray-50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/10 border-b"
                            }`}
                            onClick={() => toggleSiteCollapse(item.siteName)}
                            data-testid={`site-group-${item.siteName}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${hasUrgent ? "bg-red-100 dark:bg-red-900/30" : "bg-[#1F3A5F]/10"}`}>
                                <Building2 className={`w-4 h-4 ${hasUrgent ? "text-red-600" : "text-[#1F3A5F]"}`} />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{item.siteName}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-muted-foreground">{siteShifts.length} shift{siteShifts.length !== 1 ? "s" : ""}</span>
                                  {bookedCount > 0 && <span className="text-xs text-emerald-600 font-medium">{bookedCount} on</span>}
                                  {lateCount > 0 && <span className="text-xs text-red-600 font-medium animate-pulse">{lateCount} late</span>}
                                  {noShowCount > 0 && <span className="text-xs text-red-700 font-medium">{noShowCount} no-show</span>}
                                </div>
                              </div>
                            </div>
                            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                          </div>
                        );
                      }
                      return (
                        <div className="px-2 py-1">
                          <ShiftCard shift={item.shift} />
                        </div>
                      );
                    }}
                  />
                </div>
              )}

              {selectedShiftIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" data-testid="bulk-complete-bar">
                  <Button
                    onClick={() => setBulkConfirmOpen(true)}
                    className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg rounded-full px-6"
                    data-testid="button-bulk-complete"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Bulk Complete ({selectedShiftIds.size})
                  </Button>
                </div>
              )}
            </div>
          )}

          {activeTab === "incidents" && (
            <div className="space-y-4" data-testid="tab-content-incidents">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Incident Log</h2>
                    <p className="text-xs text-muted-foreground">{incidents.length} total, {openIncidents.length} open</p>
                  </div>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-[#FF8C42] to-[#e67a35] hover:from-[#e67a35] hover:to-[#d06a25] text-white shadow-md" data-testid="button-report-incident">
                      <Plus className="w-4 h-4 mr-1" />
                      Report Incident
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Report New Incident</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label htmlFor="incident-title">Title</Label>
                        <Input id="incident-title" data-testid="input-incident-title" placeholder="Brief description" value={newIncident.title} onChange={(e) => setNewIncident((prev) => ({ ...prev, title: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="incident-description">Description</Label>
                        <Input id="incident-description" data-testid="input-incident-description" placeholder="Details" value={newIncident.description} onChange={(e) => setNewIncident((prev) => ({ ...prev, description: e.target.value }))} />
                      </div>
                      <div className="space-y-2">
                        <Label>Severity</Label>
                        <Select value={newIncident.severity} onValueChange={(val) => setNewIncident((prev) => ({ ...prev, severity: val }))}>
                          <SelectTrigger data-testid="select-incident-severity"><SelectValue placeholder="Select severity" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">Low</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="critical">Critical</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Site</Label>
                        <Select value={newIncident.siteId} onValueChange={(val) => setNewIncident((prev) => ({ ...prev, siteId: val }))}>
                          <SelectTrigger data-testid="select-incident-site"><SelectValue placeholder="Select site" /></SelectTrigger>
                          <SelectContent>
                            {sites.map((site) => (
                              <SelectItem key={site.id} value={String(site.id)}>{site.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={handleSubmitIncident} disabled={createIncidentMutation.isPending} className="w-full" data-testid="button-submit-incident">
                        {createIncidentMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                        Submit Report
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Incident Summary Stats */}
              {incidents.length > 0 && (
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border-0 shadow-sm" data-testid="stat-open-incidents">
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-amber-600">{openIncidents.length}</div>
                      <div className="text-[10px] font-medium text-muted-foreground">Open</div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm" data-testid="stat-critical-incidents">
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-red-600">{incidents.filter(i => i.severity === "critical" && i.status !== "closed").length}</div>
                      <div className="text-[10px] font-medium text-muted-foreground">Critical</div>
                    </CardContent>
                  </Card>
                  <Card className="border-0 shadow-sm" data-testid="stat-avg-response">
                    <CardContent className="p-3 text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {(() => {
                          const withAck = incidents.filter((i: any) => i.acknowledgedAt);
                          if (withAck.length === 0) return "—";
                          const avg = withAck.reduce((sum: number, i: any) => {
                            const created = new Date(i.incidentDate || i.createdAt || 0).getTime();
                            const ack = new Date(i.acknowledgedAt).getTime();
                            return sum + (ack - created) / 60000;
                          }, 0) / withAck.length;
                          return avg < 60 ? `${Math.round(avg)}m` : `${Math.round(avg / 60)}h`;
                        })()}
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground">Avg Response</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {incidents.length === 0 ? (
                <Card className="border-0 shadow-md">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-3">
                      <Shield className="w-7 h-7 text-emerald-500" />
                    </div>
                    <p className="text-muted-foreground font-medium">No incidents recorded.</p>
                    <p className="text-xs text-muted-foreground mt-1">All clear — no incidents to report.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {incidents.map((incident) => {
                    const severityBorder = {
                      low: "border-l-4 border-l-blue-400",
                      medium: "border-l-4 border-l-amber-400",
                      high: "border-l-4 border-l-orange-500",
                      critical: "border-l-4 border-l-red-500",
                    }[incident.severity || "medium"] || "border-l-4 border-l-gray-300";

                    const workflowStages = ["reported", "investigating", "resolved", "closed"];
                    const currentStageIdx = workflowStages.indexOf(incident.status || "reported");

                    const responseTime = (() => {
                      const inc = incident as any;
                      if (!inc.acknowledgedAt) return null;
                      const created = new Date(incident.incidentDate || inc.createdAt || 0).getTime();
                      const ack = new Date(inc.acknowledgedAt).getTime();
                      const mins = Math.round((ack - created) / 60000);
                      if (mins < 60) return `${mins}m`;
                      return `${Math.floor(mins / 60)}h ${mins % 60}m`;
                    })();

                    return (
                      <Card key={incident.id} className={`${severityBorder} shadow-sm hover:shadow-md transition-shadow`} data-testid={`incident-card-${incident.id}`}>
                        <CardContent className="p-4 space-y-2">
                          {/* Workflow Progress Bar */}
                          <div className="flex items-center gap-1 mb-2" data-testid={`incident-workflow-${incident.id}`}>
                            {workflowStages.map((stage, idx) => (
                              <div key={stage} className="flex items-center flex-1">
                                <div className={`flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold flex-shrink-0 ${
                                  idx <= currentStageIdx
                                    ? "bg-emerald-500 text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                                }`}>
                                  {idx < currentStageIdx ? "✓" : idx + 1}
                                </div>
                                <span className={`text-[9px] ml-1 hidden sm:inline ${idx <= currentStageIdx ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                                  {stage.charAt(0).toUpperCase() + stage.slice(1)}
                                </span>
                                {idx < workflowStages.length - 1 && (
                                  <div className={`flex-1 h-0.5 mx-1 rounded ${idx < currentStageIdx ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700"}`} />
                                )}
                              </div>
                            ))}
                          </div>

                          <div className="flex items-start justify-between gap-4 flex-wrap">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                incident.severity === "critical" ? "bg-red-100 dark:bg-red-900/30" :
                                incident.severity === "high" ? "bg-orange-100 dark:bg-orange-900/30" :
                                incident.severity === "medium" ? "bg-amber-100 dark:bg-amber-900/30" :
                                "bg-blue-100 dark:bg-blue-900/30"
                              }`}>
                                <AlertTriangle className={`w-4 h-4 ${
                                  incident.severity === "critical" ? "text-red-600" :
                                  incident.severity === "high" ? "text-orange-600" :
                                  incident.severity === "medium" ? "text-amber-600" :
                                  "text-blue-600"
                                }`} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  {(incident as any).incidentRef && <span className="text-xs text-muted-foreground font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded" data-testid={`incident-ref-${incident.id}`}>{(incident as any).incidentRef}</span>}
                                  <p className="font-medium" data-testid={`incident-title-${incident.id}`}>{incident.title}</p>
                                </div>
                                <p className="text-sm text-muted-foreground mt-0.5">{incident.description}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                              <Badge variant="outline" className={getSeverityColor(incident.severity || "medium")} data-testid={`incident-severity-${incident.id}`}>
                                {incident.severity}
                              </Badge>
                              <Badge variant="outline" className={getIncidentStatusColor(incident.status || "reported")} data-testid={`incident-status-${incident.id}`}>
                                {(incident.status || "reported").replace("_", " ")}
                              </Badge>
                              {responseTime && (
                                <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/20" data-testid={`incident-response-time-${incident.id}`}>
                                  <Timer className="w-3 h-3 mr-1" />
                                  {responseTime}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap pl-12">
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{incident.siteName}</span>
                            <span className="flex items-center gap-1"><Users className="w-3 h-3" />{incident.reporterName}</span>
                            {incident.incidentDate && (
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{new Date(incident.incidentDate).toLocaleDateString("en-GB")}</span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          {incident.status !== "closed" && (
                            <div className="flex items-center gap-2 pl-12 pt-1">
                              {(incident.status === "reported") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  data-testid={`button-acknowledge-${incident.id}`}
                                  onClick={() => updateIncidentMutation.mutate({ id: incident.id, data: { status: "investigating" } })}
                                  disabled={updateIncidentMutation.isPending}
                                >
                                  <Eye className="w-3 h-3 mr-1" />
                                  Acknowledge
                                </Button>
                              )}
                              {(incident.status === "investigating") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs text-emerald-600 border-emerald-200"
                                  data-testid={`button-resolve-${incident.id}`}
                                  onClick={() => updateIncidentMutation.mutate({ id: incident.id, data: { status: "resolved" } })}
                                  disabled={updateIncidentMutation.isPending}
                                >
                                  <Shield className="w-3 h-3 mr-1" />
                                  Mark Resolved
                                </Button>
                              )}
                              {(incident.status === "resolved") && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs"
                                  data-testid={`button-close-${incident.id}`}
                                  onClick={() => updateIncidentMutation.mutate({ id: incident.id, data: { status: "closed" } })}
                                  disabled={updateIncidentMutation.isPending}
                                >
                                  <CheckCircle2 className="w-3 h-3 mr-1" />
                                  Close
                                </Button>
                              )}
                            </div>
                          )}

                          {incident.resolution && (
                            <div className="ml-12 text-sm text-muted-foreground border-t pt-2 mt-2 flex items-start gap-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span>{incident.resolution}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === "communications" && (
            <div className="flex flex-col items-center justify-center py-20 text-center" data-testid="tab-content-communications">
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#1F3A5F] to-blue-600 flex items-center justify-center mb-4 shadow-lg">
                <Radio className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Communications Module</h2>
              <p className="text-muted-foreground max-w-md text-sm">
                Communications module coming soon. You&apos;ll be able to send broadcast messages, manage team channels, and coordinate with on-site personnel in real time.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <div className="w-2 h-2 rounded-full bg-[#FF8C42] animate-pulse" />
                <span className="text-xs text-muted-foreground font-medium">In Development</span>
              </div>
            </div>
          )}
        </>
      )}

      <Dialog open={precheckDialogOpen} onOpenChange={setPrecheckDialogOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#FF8C42] to-[#e67a35] px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <CheckCircle2 className="w-5 h-5" />
                Book-On Pre-Checks
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6">
          {selectedShift && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium">{selectedShift.employeeName}</p>
                <p className="text-xs text-muted-foreground">{selectedShift.siteName} — {selectedShift.startTime}–{selectedShift.endTime}</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox id="sia-check" checked={precheckForm.siaValid} onCheckedChange={(v) => setPrecheckForm((p) => ({ ...p, siaValid: !!v }))} data-testid="check-sia" />
                    <Label htmlFor="sia-check" className="text-sm cursor-pointer">SIA Licence Valid</Label>
                  </div>
                  {selectedShift.siaLicenseNumber ? (
                    <span className="text-xs text-muted-foreground">
                      {selectedShift.siaLicenseNumber}
                      {selectedShift.siaExpiryDate && (
                        <span className={`ml-1 ${selectedShift.siaValid ? "text-green-600" : "text-red-600"}`}>
                          (Exp: {selectedShift.siaExpiryDate})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-xs text-red-500">No SIA on file</span>
                  )}
                </div>

                <div className="flex items-center justify-between py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Checkbox id="dbs-check" checked={precheckForm.dbsValid} onCheckedChange={(v) => setPrecheckForm((p) => ({ ...p, dbsValid: !!v }))} data-testid="check-dbs" />
                    <Label htmlFor="dbs-check" className="text-sm cursor-pointer">DBS Check Current</Label>
                  </div>
                  {selectedShift.dbsCertificateNumber ? (
                    <span className={`text-xs ${selectedShift.dbsValid ? "text-green-600" : "text-red-600"}`}>
                      {selectedShift.dbsCertificateNumber}
                    </span>
                  ) : (
                    <span className="text-xs text-red-500">No DBS on file</span>
                  )}
                </div>

                <div className="flex items-center gap-2 py-2 border-b">
                  <Checkbox id="uniform-check" checked={precheckForm.uniformConfirmed} onCheckedChange={(v) => setPrecheckForm((p) => ({ ...p, uniformConfirmed: !!v }))} data-testid="check-uniform" />
                  <Label htmlFor="uniform-check" className="text-sm cursor-pointer">Uniform Confirmed</Label>
                </div>

                <div className="flex items-center gap-2 py-2 border-b">
                  <Checkbox id="equipment-check" checked={precheckForm.equipmentConfirmed} onCheckedChange={(v) => setPrecheckForm((p) => ({ ...p, equipmentConfirmed: !!v }))} data-testid="check-equipment" />
                  <Label htmlFor="equipment-check" className="text-sm cursor-pointer">Equipment Confirmed</Label>
                </div>

                <div className="flex items-center gap-2 py-2">
                  <Checkbox id="welfare-check" checked={precheckForm.welfareChecked} onCheckedChange={(v) => setPrecheckForm((p) => ({ ...p, welfareChecked: !!v }))} data-testid="check-welfare" />
                  <Label htmlFor="welfare-check" className="text-sm cursor-pointer">Welfare Check Completed</Label>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setPrecheckDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (selectedShift) {
                      precheckMutation.mutate({ id: selectedShift.id, data: precheckForm });
                    }
                  }}
                  disabled={precheckMutation.isPending}
                  data-testid="btn-submit-precheck"
                >
                  {precheckMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Submit Pre-Check
                </Button>
              </DialogFooter>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#1F3A5F] to-[#2d5a8e] px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2"><Pencil className="w-4 h-4" /> Edit Shift Times</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 pt-4">
          {selectedShift && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium">{selectedShift.employeeName}</p>
                <p className="text-xs text-muted-foreground">{selectedShift.siteName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start Time</Label>
                  <Input type="time" value={editForm.startTime} onChange={(e) => setEditForm((p) => ({ ...p, startTime: e.target.value }))} data-testid="input-edit-start" />
                </div>
                <div className="space-y-2">
                  <Label>End Time</Label>
                  <Input type="time" value={editForm.endTime} onChange={(e) => setEditForm((p) => ({ ...p, endTime: e.target.value }))} data-testid="input-edit-end" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Break (minutes)</Label>
                <Input type="number" value={editForm.breakMinutes} onChange={(e) => setEditForm((p) => ({ ...p, breakMinutes: e.target.value }))} data-testid="input-edit-break" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (selectedShift) {
                      updateShiftMutation.mutate({
                        id: selectedShift.id,
                        data: {
                          startTime: editForm.startTime,
                          endTime: editForm.endTime,
                          breakMinutes: parseInt(editForm.breakMinutes) || 0,
                        },
                      });
                    }
                  }}
                  disabled={updateShiftMutation.isPending}
                  data-testid="btn-save-edit"
                >
                  {updateShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Save Changes
                </Button>
              </DialogFooter>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2"><UserCog className="w-4 h-4" /> Reassign Employee</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 pt-4">
          {selectedShift && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium">Current: {selectedShift.employeeName}</p>
                <p className="text-xs text-muted-foreground">{selectedShift.siteName} — {selectedShift.startTime}–{selectedShift.endTime}</p>
              </div>
              <div className="space-y-2">
                <Label>New Employee</Label>
                <Select value={reassignEmployeeId} onValueChange={setReassignEmployeeId}>
                  <SelectTrigger data-testid="select-reassign-employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>
                        {emp.firstName} {emp.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (selectedShift && reassignEmployeeId) {
                      updateShiftMutation.mutate({
                        id: selectedShift.id,
                        data: {
                          employeeId: parseInt(reassignEmployeeId),
                          precheckData: null,
                          status: "scheduled",
                        },
                      });
                    }
                  }}
                  disabled={updateShiftMutation.isPending || !reassignEmployeeId}
                  data-testid="btn-save-reassign"
                >
                  {updateShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Reassign
                </Button>
              </DialogFooter>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={notesDialogOpen} onOpenChange={setNotesDialogOpen}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2"><StickyNote className="w-4 h-4" /> Controller Notes</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 pt-4">
          {selectedShift && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm font-medium">{selectedShift.employeeName}</p>
                <p className="text-xs text-muted-foreground">{selectedShift.siteName}</p>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={controllerNotes} onChange={(e) => setControllerNotes(e.target.value)} placeholder="Add controller notes..." rows={4} data-testid="input-controller-notes" />
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setNotesDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (selectedShift) {
                      updateShiftMutation.mutate({
                        id: selectedShift.id,
                        data: { controllerNotes },
                      });
                    }
                  }}
                  disabled={updateShiftMutation.isPending}
                  data-testid="btn-save-notes"
                >
                  {updateShiftMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Save Notes
                </Button>
              </DialogFooter>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden">
          <div className="bg-gradient-to-r from-[#1F3A5F] to-[#2d5a8e] px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2"><Eye className="w-4 h-4" /> Shift Details</DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 pt-4">
          {selectedShift && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Employee</p>
                  <p className="text-sm font-semibold mt-0.5">{selectedShift.employeeName}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Site</p>
                  <p className="text-sm font-semibold mt-0.5">{selectedShift.siteName}</p>
                  {selectedShift.siteAddress && (
                    <p className="text-xs text-muted-foreground">{selectedShift.siteAddress} {selectedShift.sitePostcode}</p>
                  )}
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Shift Time</p>
                  <p className="text-sm font-semibold mt-0.5">{selectedShift.startTime} – {selectedShift.endTime}</p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">Status</p>
                  <div className="mt-1">
                    <Badge variant="outline" className={getShiftStatusLabel(selectedShift).color}>
                      {getShiftStatusLabel(selectedShift).label}
                    </Badge>
                  </div>
                </div>
                {selectedShift.supplierName && (
                  <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground font-medium">Supplier</p>
                    <p className="text-sm font-semibold mt-0.5">{selectedShift.supplierName}</p>
                  </div>
                )}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">SIA Licence</p>
                  <p className="text-sm mt-0.5">
                    {selectedShift.siaLicenseNumber || "Not on file"}
                    {selectedShift.siaExpiryDate && (
                      <span className={`ml-1 text-xs ${selectedShift.siaValid ? "text-green-600" : "text-red-600"}`}>
                        (Exp: {selectedShift.siaExpiryDate})
                      </span>
                    )}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium">DBS Certificate</p>
                  <p className="text-sm mt-0.5">
                    {selectedShift.dbsCertificateNumber || "Not on file"}
                    <span className={`ml-1 text-xs ${selectedShift.dbsValid ? "text-green-600" : "text-red-600"}`}>
                      ({selectedShift.dbsValid ? "Valid" : "Expired/Missing"})
                    </span>
                  </p>
                </div>
              </div>

              {selectedShift.precheckData && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2">Pre-Check Results</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      {selectedShift.precheckData.siaValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                      SIA Licence
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedShift.precheckData.dbsValid ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                      DBS Check
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedShift.precheckData.uniformConfirmed ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                      Uniform
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedShift.precheckData.equipmentConfirmed ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                      Equipment
                    </div>
                    <div className="flex items-center gap-1">
                      {selectedShift.precheckData.welfareChecked ? <CheckCircle2 className="w-3 h-3 text-green-600" /> : <XCircle className="w-3 h-3 text-red-600" />}
                      Welfare
                    </div>
                    {selectedShift.precheckData.checkedAt && (
                      <div className="text-muted-foreground">
                        Checked: {new Date(selectedShift.precheckData.checkedAt).toLocaleString("en-GB")}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(selectedShift.checkInTime || selectedShift.checkOutTime) && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-2 flex items-center gap-1"><Navigation className="w-4 h-4" /> Check-in / Check-out</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {selectedShift.checkInTime && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3">
                        <p className="text-xs font-medium text-green-800 dark:text-green-300 mb-1">Check-in</p>
                        <p className="text-sm font-semibold" data-testid="text-checkin-time">
                          {new Date(selectedShift.checkInTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {selectedShift.lastCheckInAddress && (
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-checkin-address">{selectedShift.lastCheckInAddress}</p>
                        )}
                        {selectedShift.lastCheckInLat && selectedShift.lastCheckInLng && (
                          <p className="text-xs text-muted-foreground" data-testid="text-checkin-coords">
                            {Number(selectedShift.lastCheckInLat).toFixed(5)}, {Number(selectedShift.lastCheckInLng).toFixed(5)}
                          </p>
                        )}
                        {selectedShift.checkInDistanceMetres != null && (
                          <Badge className={`mt-1 no-default-hover-elevate no-default-active-elevate text-xs ${Number(selectedShift.checkInDistanceMetres) <= geofenceRadius ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`} data-testid="text-checkin-distance">
                            {Number(selectedShift.checkInDistanceMetres)}m from site
                          </Badge>
                        )}
                      </div>
                    )}
                    {selectedShift.checkOutTime && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                        <p className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Check-out</p>
                        <p className="text-sm font-semibold" data-testid="text-checkout-time">
                          {new Date(selectedShift.checkOutTime).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {selectedShift.lastCheckOutAddress && (
                          <p className="text-xs text-muted-foreground mt-1" data-testid="text-checkout-address">{selectedShift.lastCheckOutAddress}</p>
                        )}
                        {selectedShift.lastCheckOutLat && selectedShift.lastCheckOutLng && (
                          <p className="text-xs text-muted-foreground" data-testid="text-checkout-coords">
                            {Number(selectedShift.lastCheckOutLat).toFixed(5)}, {Number(selectedShift.lastCheckOutLng).toFixed(5)}
                          </p>
                        )}
                        {selectedShift.checkOutDistanceMetres != null && (
                          <Badge className={`mt-1 no-default-hover-elevate no-default-active-elevate text-xs ${Number(selectedShift.checkOutDistanceMetres) <= geofenceRadius ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"}`} data-testid="text-checkout-distance">
                            {Number(selectedShift.checkOutDistanceMetres)}m from site
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedShift.controllerNotes && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-1">Controller Notes</p>
                  <p className="text-xs text-muted-foreground">{selectedShift.controllerNotes}</p>
                </div>
              )}

              {selectedShift.notes && (
                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-1">Shift Notes</p>
                  <p className="text-xs text-muted-foreground">{selectedShift.notes}</p>
                </div>
              )}
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
        <DialogContent className="max-w-sm p-0 overflow-visible">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-4">
            <DialogHeader>
              <DialogTitle className="text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Confirm Bulk Complete
              </DialogTitle>
            </DialogHeader>
          </div>
          <div className="px-6 pb-6 pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              You are about to mark <span className="font-semibold text-foreground">{selectedShiftIds.size} shift{selectedShiftIds.size !== 1 ? "s" : ""}</span> as completed. This action cannot be undone.
            </p>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setBulkConfirmOpen(false)} data-testid="button-bulk-cancel">
                Cancel
              </Button>
              <Button
                onClick={() => bulkCompleteMutation.mutate(Array.from(selectedShiftIds))}
                disabled={bulkCompleteMutation.isPending}
                className="bg-emerald-600 text-white"
                data-testid="button-bulk-confirm"
              >
                {bulkCompleteMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Complete {selectedShiftIds.size} Shift{selectedShiftIds.size !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
