import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Brain, Sparkles, Calendar, MapPin, Clock, User, Loader2,
  AlertCircle, CheckCircle2, Lightbulb, ThumbsUp, ThumbsDown,
  History, TrendingUp, MessageSquare, AlertTriangle, Shield,
  Zap, Activity, Radio, RefreshCw, Target, Gauge,
  Users, ArrowRight,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Site } from "@shared/schema";

type AISuggestion = {
  employeeId: number;
  employeeName: string;
  reason: string;
  shiftTime: string;
  priority: "high" | "medium" | "low";
  decisionId?: number;
  confidence?: number;
  urgency?: string;
  adaptationFactors?: string[];
};

type AIResponse = {
  suggestions: AISuggestion[];
  notes: string;
  coverage: string;
  learningApplied?: string;
  realtimeAdaptation?: string;
  riskAssessment?: string;
  batchId?: string;
  decisionsStored?: number;
  totalPastDecisions?: number;
  isQuickFill?: boolean;
  gapCount?: number;
  realtimeFactors?: {
    noShowsToday: number;
    cancelledToday: number;
    unassignedToday: number;
    availableOfficers: number;
    recentIncidents: number;
    timeOfDay: string;
  };
};

type RealtimeAlert = {
  type: string;
  severity: "critical" | "warning" | "info";
  message: string;
  siteId?: number;
  siteName?: string;
  count?: number;
};

type CoverageGap = {
  siteId: number;
  siteName: string;
  gap: string;
  scheduledCount: number;
  activeCount: number;
  noShowCount: number;
  unfilledCount: number;
};

type RealtimeContext = {
  alerts: RealtimeAlert[];
  coverageGaps: CoverageGap[];
  summary: {
    totalShiftsToday: number;
    activeShifts: number;
    scheduledShifts: number;
    noShows: number;
    cancelled: number;
    unassigned: number;
    availableOfficers: number;
    totalOfficers: number;
    activeIncidents: number;
    timeOfDay: string;
    currentTime: string;
  };
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  high: { label: "High", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  medium: { label: "Medium", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  low: { label: "Low", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/50 dark:text-gray-300" },
};

function ConfidenceMeter({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "#10B981" : pct >= 60 ? "#F59E0B" : "#EF4444";
  return (
    <div className="flex items-center gap-2" data-testid="confidence-meter">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-medium" style={{ color }}>{pct}%</span>
    </div>
  );
}

export default function AISchedulingPage() {
  const { toast } = useToast();
  const [siteId, setSiteId] = useState("");
  const [date, setDate] = useState("");
  const [requirements, setRequirements] = useState("");
  const [aiResponse, setAiResponse] = useState<AIResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<number, "accepted" | "rejected">>({});
  const [feedbackDialog, setFeedbackDialog] = useState<{ decisionId: number; action: "rejected" } | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [batchDecisions, setBatchDecisions] = useState<any[]>([]);
  const [siteSearch, setSiteSearch] = useState("");
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);

  const { data: sitesResponse, isLoading: sitesLoading } = useQuery<any>({
    queryKey: ["/api/sites", siteSearch],
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", limit: "50" });
      if (siteSearch.trim()) params.set("search", siteSearch.trim());
      const res = await fetch(`/api/sites?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load sites");
      return res.json();
    },
    enabled: true,
  });
  const sites: Site[] = Array.isArray(sitesResponse) ? sitesResponse : (sitesResponse?.sites || []);

  const { data: decisionHistory = [] } = useQuery<any[]>({
    queryKey: ["/api/ai/decisions"],
  });

  const { data: realtimeCtx, isLoading: realtimeLoading } = useQuery<RealtimeContext>({
    queryKey: ["/api/ai/realtime-context"],
    refetchInterval: 15000,
  });

  const suggestionMutation = useMutation({
    mutationFn: async (payload: { siteId: string; date: string; requirements: string }) => {
      const res = await apiRequest("POST", "/api/ai/scheduling-suggestions", payload);
      return res.json();
    },
    onSuccess: (data: AIResponse) => {
      setAiResponse(data);
      setDecisions({});
      if (data.batchId) fetchBatchDecisions(data.batchId);
    },
    onError: (err: Error) => {
      toast({ title: "AI Scheduling Error", description: err.message, variant: "destructive" });
    },
  });

  const quickFillMutation = useMutation({
    mutationFn: async (payload: { siteId: number }) => {
      const res = await apiRequest("POST", "/api/ai/quick-fill", payload);
      return res.json();
    },
    onSuccess: (data: AIResponse) => {
      setAiResponse(data);
      setDecisions({});
      if (data.batchId) fetchBatchDecisions(data.batchId);
      toast({ title: "Quick Fill Generated", description: `AI found ${data.suggestions?.length || 0} replacement suggestions` });
    },
    onError: (err: Error) => {
      toast({ title: "Quick Fill Error", description: err.message, variant: "destructive" });
    },
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ id, status, feedback }: { id: number; status: string; feedback?: string }) => {
      const res = await apiRequest("PATCH", `/api/ai/decisions/${id}`, { status, feedback });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/decisions"] });
    },
  });

  const fetchBatchDecisions = async (batchId: string) => {
    try {
      const res = await fetch(`/api/ai/decisions/batch/${batchId}`, { credentials: "include" });
      if (res.ok) setBatchDecisions(await res.json());
    } catch {}
  };

  const handleDecision = (suggestionIndex: number, action: "accepted" | "rejected") => {
    const suggestion = aiResponse?.suggestions?.[suggestionIndex];
    const decisionId = suggestion?.decisionId;
    if (!decisionId) return;

    if (action === "rejected") {
      setFeedbackDialog({ decisionId, action });
      return;
    }

    setDecisions(prev => ({ ...prev, [suggestionIndex]: action }));
    decisionMutation.mutate({ id: decisionId, status: action });
    toast({ title: "Accepted", description: "This suggestion has been accepted. The AI will learn from this." });
  };

  const handleFeedbackSubmit = () => {
    if (!feedbackDialog) return;
    const idx = aiResponse?.suggestions?.findIndex((s: AISuggestion) => s.decisionId === feedbackDialog.decisionId) ?? -1;
    if (idx >= 0) setDecisions(prev => ({ ...prev, [idx]: "rejected" }));
    decisionMutation.mutate({ id: feedbackDialog.decisionId, status: "rejected", feedback: feedbackText });
    setFeedbackDialog(null);
    setFeedbackText("");
    toast({ title: "Rejected", description: "Feedback recorded. The AI will avoid similar suggestions." });
  };

  const handleGenerate = () => {
    if (!siteId || !date || !requirements.trim()) {
      toast({ title: "Missing fields", description: "Please fill in all fields before generating suggestions.", variant: "destructive" });
      return;
    }
    suggestionMutation.mutate({ siteId, date, requirements });
  };

  const selectedSite = sites.find((s) => String(s.id) === siteId);
  const totalAccepted = decisionHistory.filter((d: any) => d.status === "accepted").length;
  const totalRejected = decisionHistory.filter((d: any) => d.status === "rejected").length;
  const totalDecisions = totalAccepted + totalRejected;

  const summary = realtimeCtx?.summary;
  const alerts = realtimeCtx?.alerts || [];
  const gaps = realtimeCtx?.coverageGaps || [];
  const criticalAlerts = alerts.filter(a => a.severity === "critical");
  const warningAlerts = alerts.filter(a => a.severity === "warning");

  return (
    <div className="p-6 space-y-6" data-testid="ai-scheduling-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
          <Brain className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Scheduling</h1>
          <p className="text-muted-foreground text-sm">
            Self-learning AI with real-time adaptation — improves with every decision
          </p>
        </div>
        {summary && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Radio className="w-3 h-3 text-green-500 animate-pulse" />
            <span>Live — {summary.currentTime}</span>
          </div>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="realtime-dashboard">
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-lg font-bold">{summary.totalShiftsToday}</p>
                  <p className="text-xs text-muted-foreground">Shifts Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-lg font-bold">{summary.activeShifts}</p>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: "#FF8C42" }} />
                <div>
                  <p className="text-lg font-bold">{summary.availableOfficers}</p>
                  <p className="text-xs text-muted-foreground">Available</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className={summary.noShows > 0 ? "border-red-200" : ""}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${summary.noShows > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                <div>
                  <p className="text-lg font-bold">{summary.noShows}</p>
                  <p className="text-xs text-muted-foreground">No-Shows</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <Gauge className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-lg font-bold capitalize">{summary.timeOfDay}</p>
                  <p className="text-xs text-muted-foreground">Shift Period</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {(criticalAlerts.length > 0 || gaps.length > 0) && (
        <Card className="border-red-200 bg-red-50/30 dark:bg-red-950/10" data-testid="card-live-alerts">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-md flex items-center justify-center bg-red-100">
                <Zap className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Live Alerts — Immediate Attention Required</h3>
                <p className="text-xs text-muted-foreground">{criticalAlerts.length} critical, {warningAlerts.length} warnings</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  alert.severity === "critical" ? "border-red-200 bg-red-50 dark:bg-red-950/20" : "border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20"
                }`}
                data-testid={`alert-${alert.type}-${i}`}
              >
                <div className="flex items-center gap-2">
                  {alert.severity === "critical" ? (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-sm font-medium">{alert.message}</span>
                </div>
                {alert.siteId && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-red-200 text-red-700 hover:bg-red-100"
                    onClick={() => quickFillMutation.mutate({ siteId: alert.siteId! })}
                    disabled={quickFillMutation.isPending}
                    data-testid={`button-quickfill-${alert.siteId}`}
                  >
                    {quickFillMutation.isPending ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Zap className="w-3 h-3 mr-1" />
                    )}
                    Quick Fill
                  </Button>
                )}
              </div>
            ))}

            {gaps.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Coverage Gaps</p>
                <div className="space-y-1.5">
                  {gaps.map(gap => (
                    <div key={gap.siteId} className="flex items-center justify-between p-2 rounded-lg border" data-testid={`gap-${gap.siteId}`}>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm">{gap.siteName}</span>
                        <Badge variant="outline" className="text-xs">
                          {gap.noShowCount > 0 && `${gap.noShowCount} no-show`}
                          {gap.unfilledCount > 0 && `${gap.unfilledCount} unfilled`}
                        </Badge>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs"
                        onClick={() => quickFillMutation.mutate({ siteId: gap.siteId })}
                        disabled={quickFillMutation.isPending}
                        data-testid={`button-fill-gap-${gap.siteId}`}
                      >
                        <Zap className="w-3 h-3 mr-1" /> Fill
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {totalDecisions > 0 && (
        <Card data-testid="card-learning-status">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(145, 60%, 40%, 0.08)" }}>
                <TrendingUp className="w-4 h-4" style={{ color: "hsl(145, 60%, 40%)" }} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold">AI Learning Progress</h3>
                <p className="text-xs text-muted-foreground">Based on {totalDecisions} past decisions</p>
              </div>
              {totalDecisions >= 5 && (
                <Badge variant="secondary" className="text-xs">
                  <Brain className="w-3 h-3 mr-1" /> Adaptive Mode
                </Badge>
              )}
            </div>
            <div className="flex gap-4 text-sm flex-wrap">
              <div className="flex items-center gap-1.5">
                <ThumbsUp className="w-3.5 h-3.5 text-green-600" />
                <span className="text-muted-foreground">{totalAccepted} accepted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ThumbsDown className="w-3.5 h-3.5 text-red-500" />
                <span className="text-muted-foreground">{totalRejected} rejected</span>
              </div>
              <div className="flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{decisionHistory.length} total</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" style={{ color: "#FF8C42" }} />
                <span className="text-muted-foreground">
                  {totalDecisions > 0 ? Math.round((totalAccepted / totalDecisions) * 100) : 0}% acceptance rate
                </span>
              </div>
            </div>
            {totalDecisions >= 3 && (
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-1">AI Accuracy</p>
                <ConfidenceMeter value={totalDecisions > 0 ? totalAccepted / totalDecisions : 0} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-ai-form">
        <CardHeader className="flex flex-row items-center gap-2 pb-4">
          <Sparkles className="w-5 h-5" style={{ color: "#FF8C42" }} />
          <div>
            <h2 className="text-lg font-semibold">Generate Scheduling Suggestions</h2>
            <p className="text-sm text-muted-foreground">AI uses live shift data, incident reports, and your past preferences</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="ai-site">
                <MapPin className="w-3.5 h-3.5 inline mr-1" />
                Site
              </Label>
              <div className="relative">
                <Input
                  id="ai-site"
                  data-testid="select-ai-site"
                  placeholder={sitesLoading ? "Loading sites..." : "Search sites..."}
                  value={siteSearch}
                  onChange={(e) => {
                    setSiteSearch(e.target.value);
                    setSiteDropdownOpen(true);
                    if (!e.target.value.trim()) setSiteId("");
                  }}
                  onFocus={() => setSiteDropdownOpen(true)}
                  onBlur={() => setTimeout(() => setSiteDropdownOpen(false), 200)}
                  autoComplete="off"
                />
                {siteId && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => { setSiteId(""); setSiteSearch(""); }}
                    data-testid="button-clear-site"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              {siteDropdownOpen && siteSearch.trim().length >= 1 && (
                <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[200px] overflow-y-auto" data-testid="site-search-results">
                  {sites
                    .filter((s) => s.name.toLowerCase().includes(siteSearch.toLowerCase()) || (s.postcode && s.postcode.toLowerCase().includes(siteSearch.toLowerCase())))
                    .slice(0, 50)
                    .map((site) => (
                      <button
                        key={site.id}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                        data-testid={`site-option-${site.id}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setSiteId(String(site.id));
                          setSiteSearch(site.name);
                          setSiteDropdownOpen(false);
                        }}
                      >
                        <span className="font-medium">{site.name}</span>
                        {site.postcode && <span className="text-xs text-muted-foreground ml-2">{site.postcode}</span>}
                      </button>
                    ))}
                  {sites.filter((s) => s.name.toLowerCase().includes(siteSearch.toLowerCase()) || (s.postcode && s.postcode.toLowerCase().includes(siteSearch.toLowerCase()))).length === 0 && (
                    <div className="px-3 py-2 text-sm text-muted-foreground">No sites found</div>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-date">
                <Calendar className="w-3.5 h-3.5 inline mr-1" />
                Date
              </Label>
              <Input
                id="ai-date"
                data-testid="input-ai-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-requirements">
              <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
              Requirements
            </Label>
            <Textarea
              id="ai-requirements"
              data-testid="input-ai-requirements"
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="e.g. Need 3 security officers with SIA Door Supervisor license, 1 with First Aid"
              className="resize-none"
              rows={3}
            />
          </div>
          <div className="flex items-center justify-end">
            <Button
              data-testid="button-generate-suggestions"
              onClick={handleGenerate}
              disabled={suggestionMutation.isPending || !siteId || !date || !requirements.trim()}
              style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}
              className="text-white border-0"
            >
              {suggestionMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Brain className="w-4 h-4 mr-2" />
              )}
              {suggestionMutation.isPending ? "Analysing live data..." : "Generate Suggestions"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {(suggestionMutation.isPending || quickFillMutation.isPending) && (
        <Card data-testid="card-ai-loading">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #1F3A5F, #FF8C42)" }}>
                <Loader2 className="w-7 h-7 text-white animate-spin" />
              </div>
              <div className="text-center">
                <p className="font-semibold" data-testid="text-ai-loading">
                  {quickFillMutation.isPending ? "Finding emergency replacements..." : "AI is analysing live data..."}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Checking real-time shift status, officer availability, reliability scores, and incident data
                </p>
                <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Radio className="w-3 h-3 text-green-500 animate-pulse" /> Live data</span>
                  <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> Learning from {totalDecisions} decisions</span>
                  <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Checking {summary?.availableOfficers || 0} available officers</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!suggestionMutation.isPending && !quickFillMutation.isPending && aiResponse && (
        <div className="space-y-4" data-testid="section-ai-results">
          <div className="flex items-center gap-2 flex-wrap">
            <CheckCircle2 className="w-5 h-5" style={{ color: "#FF8C42" }} />
            <h2 className="text-lg font-semibold">
              {aiResponse.isQuickFill ? "Quick Fill Suggestions" : "AI Suggestions"}
            </h2>
            {aiResponse.isQuickFill && (
              <Badge variant="destructive" className="text-xs">
                <Zap className="w-3 h-3 mr-1" /> Emergency Fill — {aiResponse.gapCount} gap(s)
              </Badge>
            )}
            {selectedSite && !aiResponse.isQuickFill && (
              <Badge variant="secondary" className="ml-1" data-testid="badge-selected-site">
                <MapPin className="w-3 h-3 mr-1" /> {selectedSite.name}
              </Badge>
            )}
            {aiResponse.totalPastDecisions !== undefined && aiResponse.totalPastDecisions > 0 && (
              <Badge variant="secondary" className="ml-1" data-testid="badge-learning-active">
                <Brain className="w-3 h-3 mr-1" /> Learning active ({aiResponse.totalPastDecisions} decisions)
              </Badge>
            )}
          </div>

          {aiResponse.realtimeFactors && (
            <Card className="border-dashed" data-testid="card-realtime-factors">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <Radio className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Real-Time Factors Applied</p>
                    <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                      <span>{aiResponse.realtimeFactors.availableOfficers} officers available</span>
                      <span>{aiResponse.realtimeFactors.noShowsToday} no-shows today</span>
                      <span>{aiResponse.realtimeFactors.cancelledToday} cancellations</span>
                      <span>{aiResponse.realtimeFactors.recentIncidents} recent incidents</span>
                      <span className="capitalize">{aiResponse.realtimeFactors.timeOfDay} period</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {aiResponse.realtimeAdaptation && (
            <Card className="border-dashed" data-testid="card-adaptation">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <RefreshCw className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#FF8C42" }} />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Real-Time Adaptation</p>
                    <p className="text-sm mt-0.5">{aiResponse.realtimeAdaptation}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {aiResponse.learningApplied && aiResponse.learningApplied !== "No prior data" && (
            <Card className="border-dashed" data-testid="card-learning-applied">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#FF8C42" }} />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Learning Applied</p>
                    <p className="text-sm mt-0.5">{aiResponse.learningApplied}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {aiResponse.riskAssessment && (
            <Card className="border-dashed border-yellow-200" data-testid="card-risk-assessment">
              <CardContent className="py-3 px-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Risk Assessment</p>
                    <p className="text-sm mt-0.5">{aiResponse.riskAssessment}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {aiResponse.suggestions.length === 0 ? (
            <Card data-testid="card-empty-suggestions">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No Suggestions Available</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  AI could not find matching employees. Try adjusting your criteria.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {aiResponse.suggestions.map((suggestion, index) => {
                const priorityConf = PRIORITY_CONFIG[suggestion.priority] || PRIORITY_CONFIG.low;
                const decision = decisions[index];
                return (
                  <Card
                    key={`${suggestion.employeeId}-${index}`}
                    className={decision === "accepted" ? "border-green-300 bg-green-50/30 dark:bg-green-950/10" : decision === "rejected" ? "border-red-200 bg-red-50/30 dark:bg-red-950/10 opacity-60" : ""}
                    data-testid={`card-suggestion-${index}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
                            <User className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-sm" data-testid={`text-suggestion-name-${index}`}>
                              {suggestion.employeeName}
                            </p>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span data-testid={`text-suggestion-time-${index}`}>{suggestion.shiftTime}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {suggestion.urgency && suggestion.urgency !== "next_shift" && (
                            <Badge variant="destructive" className="text-xs">
                              <Zap className="w-3 h-3 mr-0.5" />
                              {suggestion.urgency === "immediate" ? "Now" : "1hr"}
                            </Badge>
                          )}
                          <Badge variant="secondary" className={priorityConf.className} data-testid={`badge-priority-${index}`}>
                            {priorityConf.label}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground" data-testid={`text-suggestion-reason-${index}`}>
                        {suggestion.reason}
                      </p>

                      {suggestion.confidence !== undefined && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">AI Confidence</p>
                          <ConfidenceMeter value={suggestion.confidence} />
                        </div>
                      )}

                      {suggestion.adaptationFactors && suggestion.adaptationFactors.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {suggestion.adaptationFactors.slice(0, 4).map((factor, fi) => (
                            <Badge key={fi} variant="outline" className="text-xs py-0">
                              {factor}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {!decision && (
                        <div className="flex items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-700 border-green-200 hover:bg-green-50"
                            onClick={() => handleDecision(index, "accepted")}
                            disabled={decisionMutation.isPending}
                            data-testid={`button-accept-${index}`}
                          >
                            <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => handleDecision(index, "rejected")}
                            disabled={decisionMutation.isPending}
                            data-testid={`button-reject-${index}`}
                          >
                            <ThumbsDown className="w-3.5 h-3.5 mr-1.5" /> Reject
                          </Button>
                        </div>
                      )}
                      {decision && (
                        <div className="flex items-center gap-1.5 text-xs pt-1">
                          {decision === "accepted" ? (
                            <><CheckCircle2 className="w-3.5 h-3.5 text-green-600" /><span className="text-green-700 font-medium">Accepted — AI will favour this pattern</span></>
                          ) : (
                            <><ThumbsDown className="w-3.5 h-3.5 text-red-500" /><span className="text-red-600 font-medium">Rejected — AI will avoid this pattern</span></>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {aiResponse.notes && (
              <Card data-testid="card-ai-notes">
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <Lightbulb className="w-4 h-4" style={{ color: "#FF8C42" }} />
                  <h3 className="text-sm font-semibold">AI Notes</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground" data-testid="text-ai-notes">{aiResponse.notes}</p>
                </CardContent>
              </Card>
            )}
            {aiResponse.coverage && (
              <Card data-testid="card-ai-coverage">
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: "#1F3A5F" }} />
                  <h3 className="text-sm font-semibold">Coverage Summary</h3>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground" data-testid="text-ai-coverage">{aiResponse.coverage}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {decisionHistory.length > 0 && !aiResponse && (
        <Card data-testid="card-decision-history">
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Recent Decision History</h3>
                <p className="text-xs text-muted-foreground">Your past scheduling decisions that the AI learns from</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {decisionHistory.slice(0, 10).map((d: any) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div className="flex items-center gap-3">
                    {d.status === "accepted" && <ThumbsUp className="w-4 h-4 text-green-600" />}
                    {d.status === "rejected" && <ThumbsDown className="w-4 h-4 text-red-500" />}
                    {d.status === "suggested" && <Clock className="w-4 h-4 text-muted-foreground" />}
                    <div>
                      <span className="font-medium">{d.employeeName || "Unknown"}</span>
                      <span className="text-muted-foreground ml-2">{d.siteName || ""} — {d.shiftDate || ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={d.status === "accepted" ? "default" : d.status === "rejected" ? "destructive" : "secondary"}>
                      {d.status}
                    </Badge>
                    {d.feedback && (
                      <span className="text-xs text-muted-foreground max-w-32 truncate" title={d.feedback}>
                        <MessageSquare className="w-3 h-3 inline mr-1" />{d.feedback}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!feedbackDialog} onOpenChange={(open) => { if (!open) setFeedbackDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Why are you rejecting this suggestion?
            </DialogTitle>
            <DialogDescription>
              Your feedback helps the AI learn what you prefer and avoid similar suggestions in future.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="e.g. This employee doesn't work well at night shifts, prefer someone with more experience..."
            rows={3}
            data-testid="input-rejection-feedback"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFeedbackDialog(null); setFeedbackText(""); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleFeedbackSubmit} data-testid="button-submit-rejection">
              <ThumbsDown className="w-4 h-4 mr-2" /> Reject with Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
