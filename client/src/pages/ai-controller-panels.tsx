import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { queryClient } from "@/lib/queryClient";
import {
  Brain, Sparkles, Zap, Send, TrendingUp, TrendingDown, Bot,
  Lightbulb, AlertTriangle, Users, Clock, Shield, CheckCircle2,
  MapPin, ChevronRight, Activity, Loader2, RefreshCw, Eye,
  Phone, MessageSquare, PhoneCall, Wifi, WifiOff, Radio,
  ArrowUpRight, FileText, History, Plus,
} from "lucide-react";

interface AISituationalData {
  summary: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  riskScore: number;
  coverageGaps: { site: string; time: string; reason: string }[];
  keyMetrics: { label: string; value: string; trend: "up" | "down" | "stable" }[];
  recommendations: string[];
}

interface AISmartAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  category: string;
  suggestedAction: string;
  timestamp: string;
}

interface AIQuickAction {
  id: string;
  type: "quick_fill" | "auto_reassign" | "predict_prevent";
  title: string;
  description: string;
  impact: string;
  confidence: number;
}

function getRiskColor(level: string) {
  switch (level) {
    case "low": return "text-green-600 bg-green-50 border-green-200";
    case "medium": return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "high": return "text-orange-600 bg-orange-50 border-orange-200";
    case "critical": return "text-red-600 bg-red-50 border-red-200";
    default: return "";
  }
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical": return <AlertTriangle className="w-4 h-4 text-red-500" />;
    case "warning": return <Zap className="w-4 h-4 text-yellow-500" />;
    default: return <Lightbulb className="w-4 h-4 text-blue-500" />;
  }
}

export function AISituationalAwareness({ shifts, incidents }: { shifts: any[]; incidents: any[] }) {
  const { data, isLoading, refetch } = useQuery<AISituationalData>({
    queryKey: ["/api/ai-controller/situational"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/ai-controller/situational", {
        shiftCount: shifts.length,
        incidentCount: incidents.length,
        activeShifts: shifts.filter(s => s.status === "in_progress").length,
        lateShifts: shifts.filter(s => s.isLate).length,
        noShows: shifts.filter(s => s.status === "no_show").length,
      });
      return res.json();
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="border-[#FF8C42]/20" data-testid="ai-situational-loading">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-[#FF8C42] mr-2" />
          <span className="text-sm text-muted-foreground">AI analyzing operational status...</span>
        </CardContent>
      </Card>
    );
  }

  const situational = data || {
    summary: "Operational status is being analyzed. The AI controller is reviewing current shift coverage, incidents, and workforce deployment to generate a real-time briefing.",
    riskLevel: "low" as const,
    riskScore: 25,
    coverageGaps: [],
    keyMetrics: [
      { label: "Coverage Rate", value: `${shifts.length > 0 ? Math.round((shifts.filter(s => s.status === "in_progress").length / shifts.length) * 100) : 0}%`, trend: "stable" as const },
      { label: "Active Incidents", value: String(incidents.filter(i => i.status !== "resolved" && i.status !== "closed").length), trend: "stable" as const },
      { label: "Late Officers", value: String(shifts.filter(s => s.isLate).length), trend: shifts.filter(s => s.isLate).length > 0 ? "up" as const : "stable" as const },
      { label: "No Shows", value: String(shifts.filter(s => s.status === "no_show").length), trend: "stable" as const },
    ],
    recommendations: ["Monitor active shifts for on-time check-ins", "Review pre-check completion rates"],
  };

  return (
    <Card className="border-[#FF8C42]/20 overflow-hidden" data-testid="ai-situational-panel">
      <CardHeader className="bg-gradient-to-r from-[#FF8C42]/5 to-transparent pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-[#FF8C42]" />
            <CardTitle className="text-base">AI Situational Awareness</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${getRiskColor(situational.riskLevel)} border`} data-testid="text-risk-level">
              Risk: {situational.riskLevel.toUpperCase()}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => refetch()} data-testid="button-refresh-ai">
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-3">
        <div className="bg-[#1F3A5F]/5 rounded-lg p-3" data-testid="ai-briefing">
          <div className="flex items-start gap-2">
            <Bot className="w-4 h-4 text-[#1F3A5F] mt-0.5 flex-shrink-0" />
            <p className="text-sm text-[#1F3A5F]">{situational.summary}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {situational.keyMetrics.map((metric, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-2.5 text-center" data-testid={`ai-metric-${idx}`}>
              <div className="flex items-center justify-center gap-1">
                <span className="text-lg font-bold text-[#1F3A5F]">{metric.value}</span>
                {metric.trend === "up" && <TrendingUp className="w-3 h-3 text-red-500" />}
                {metric.trend === "down" && <TrendingDown className="w-3 h-3 text-green-500" />}
              </div>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{metric.label}</span>
            </div>
          ))}
        </div>

        {situational.coverageGaps.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Coverage Gaps</h4>
            <div className="space-y-1.5">
              {situational.coverageGaps.slice(0, 3).map((gap, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-red-50 rounded p-2">
                  <MapPin className="w-3 h-3 text-red-500" />
                  <span className="font-medium">{gap.site}</span>
                  <span className="text-muted-foreground">{gap.time}</span>
                  <span className="text-red-600 text-xs ml-auto">{gap.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {situational.recommendations.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">AI Recommendations</h4>
            <div className="space-y-1">
              {situational.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <Lightbulb className="w-3 h-3 text-[#FF8C42] mt-0.5 flex-shrink-0" />
                  <span>{rec}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AISmartAlerts({ shifts, incidents }: { shifts: any[]; incidents: any[] }) {
  const { data: alerts, isLoading, refetch } = useQuery<AISmartAlert[]>({
    queryKey: ["/api/ai-controller/smart-alerts"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/ai-controller/smart-alerts", {
        lateShifts: shifts.filter(s => s.isLate).length,
        noShows: shifts.filter(s => s.status === "no_show").length,
        openIncidents: incidents.filter(i => i.status !== "resolved" && i.status !== "closed").length,
        totalShifts: shifts.length,
      });
      return res.json();
    },
    refetchInterval: 60000,
  });

  const smartAlerts = alerts || [];

  return (
    <Card className="border-[#FF8C42]/20" data-testid="ai-smart-alerts-panel">
      <CardHeader className="bg-gradient-to-r from-[#FF8C42]/5 to-transparent pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-[#FF8C42]" />
            <CardTitle className="text-base">Smart Alerts</CardTitle>
            {smartAlerts.length > 0 && (
              <Badge variant="destructive" className="text-xs">{smartAlerts.length}</Badge>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF8C42] mr-2" />
            <span className="text-sm text-muted-foreground">AI triaging alerts...</span>
          </div>
        ) : smartAlerts.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground" data-testid="no-alerts">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            No active alerts. All systems normal.
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {smartAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-3 rounded-lg border text-sm ${
                  alert.severity === "critical" ? "bg-red-50 border-red-200" :
                  alert.severity === "warning" ? "bg-yellow-50 border-yellow-200" :
                  "bg-blue-50 border-blue-200"
                }`}
                data-testid={`smart-alert-${alert.id}`}
              >
                <div className="flex items-start gap-2">
                  {getSeverityIcon(alert.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{alert.title}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="outline" className="text-[10px]">{alert.category}</Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Lightbulb className="w-2.5 h-2.5" />
                        {alert.suggestedAction}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AIQuickActions({ shifts, incidents }: { shifts: any[]; incidents: any[] }) {
  const { toast } = useToast();

  const { data: actions, isLoading, refetch } = useQuery<AIQuickAction[]>({
    queryKey: ["/api/ai-controller/quick-actions"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/ai-controller/quick-actions", {
        lateShifts: shifts.filter(s => s.isLate).map(s => ({ id: s.id, siteName: s.siteName, employeeName: s.employeeName })),
        noShows: shifts.filter(s => s.status === "no_show").map(s => ({ id: s.id, siteName: s.siteName })),
        uncoveredShifts: shifts.filter(s => s.status === "scheduled" && !s.employeeId).length,
      });
      return res.json();
    },
    refetchInterval: 60000,
  });

  const executeMutation = useMutation({
    mutationFn: async ({ actionId, type }: { actionId: string; type: string }) => {
      const res = await apiRequest("POST", "/api/ai-controller/execute-action", { actionId, type });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Action executed", description: data.message || "AI action completed successfully." });
    },
    onError: (err: any) => {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    },
  });

  const quickActions = actions || [];

  const getActionIcon = (type: string) => {
    switch (type) {
      case "quick_fill": return <Users className="w-4 h-4 text-blue-500" />;
      case "auto_reassign": return <RefreshCw className="w-4 h-4 text-green-500" />;
      case "predict_prevent": return <Eye className="w-4 h-4 text-purple-500" />;
      default: return <Sparkles className="w-4 h-4 text-[#FF8C42]" />;
    }
  };

  return (
    <Card className="border-[#FF8C42]/20" data-testid="ai-quick-actions-panel">
      <CardHeader className="bg-gradient-to-r from-[#FF8C42]/5 to-transparent pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#FF8C42]" />
            <CardTitle className="text-base">AI Quick Actions</CardTitle>
          </div>
          <Button size="sm" variant="ghost" onClick={() => refetch()}>
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-[#FF8C42] mr-2" />
            <span className="text-sm text-muted-foreground">AI generating actions...</span>
          </div>
        ) : quickActions.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground" data-testid="no-actions">
            <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
            No actions needed. Operations running smoothly.
          </div>
        ) : (
          <div className="space-y-2">
            {quickActions.map((action) => (
              <div key={action.id} className="p-3 rounded-lg border bg-white hover:bg-gray-50 transition-colors" data-testid={`quick-action-${action.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    {getActionIcon(action.type)}
                    <div>
                      <div className="font-medium text-sm">{action.title}</div>
                      <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-muted-foreground">{action.impact}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {Math.round(action.confidence * 100)}% confidence
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-[#FF8C42] hover:bg-[#e67a35] text-white text-xs flex-shrink-0"
                    onClick={() => executeMutation.mutate({ actionId: action.id, type: action.type })}
                    disabled={executeMutation.isPending}
                    data-testid={`button-execute-${action.id}`}
                  >
                    {executeMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Execute"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AIChatPanel({
  messages,
  setMessages,
  input,
  setInput,
  isLoading: chatLoading,
  setIsLoading,
  shifts,
  incidents,
}: {
  messages: { role: "user" | "assistant"; content: string }[];
  setMessages: (msgs: { role: "user" | "assistant"; content: string }[]) => void;
  input: string;
  setInput: (val: string) => void;
  isLoading: boolean;
  setIsLoading: (val: boolean) => void;
  shifts: any[];
  incidents: any[];
}) {
  const handleSend = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = input.trim();
    const updated = [...messages, { role: "user" as const, content: userMsg }];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    try {
      const res = await apiRequest("POST", "/api/ai-controller/chat", {
        message: userMsg,
        context: {
          totalShifts: shifts.length,
          activeShifts: shifts.filter(s => s.status === "in_progress").length,
          lateShifts: shifts.filter(s => s.isLate).length,
          noShows: shifts.filter(s => s.status === "no_show").length,
          openIncidents: incidents.filter(i => i.status !== "resolved" && i.status !== "closed").length,
        },
        history: updated.slice(-6),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.response }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "I'm sorry, I couldn't process that request. Please try again." }]);
    }
    setIsLoading(false);
  };

  return (
    <Card className="border-[#FF8C42]/20 flex flex-col h-[400px]" data-testid="ai-chat-panel">
      <CardHeader className="bg-gradient-to-r from-[#FF8C42]/5 to-transparent pb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-[#FF8C42]" />
          <CardTitle className="text-base">AI Controller Chat</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-3 pb-0 pt-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm text-muted-foreground">
            <Bot className="w-10 h-10 text-[#FF8C42]/30 mx-auto mb-3" />
            <p className="font-medium">AI Controller Assistant</p>
            <p className="text-xs mt-1">Ask about shift coverage, staffing levels, or request operational insights.</p>
            <div className="flex flex-wrap gap-1.5 justify-center mt-3">
              {["What's the current coverage?", "Any risk areas?", "Show late officers"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-[10px] px-2 py-1 rounded-full border hover:bg-gray-50 transition-colors"
                  data-testid={`ai-suggestion-${q.replace(/\s/g, "-").toLowerCase()}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-lg p-2.5 text-sm ${
              msg.role === "user"
                ? "bg-[#1F3A5F] text-white"
                : "bg-gray-100 text-gray-800"
            }`} data-testid={`chat-msg-${idx}`}>
              {msg.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-2.5 text-sm flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Thinking...
            </div>
          </div>
        )}
      </CardContent>
      <div className="p-3 border-t flex gap-2 flex-shrink-0">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about operations..."
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className="text-sm"
          data-testid="input-ai-chat"
        />
        <Button
          size="sm"
          onClick={handleSend}
          disabled={chatLoading || !input.trim()}
          className="bg-[#FF8C42] hover:bg-[#e67a35]"
          data-testid="button-send-chat"
        >
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}

export function AIUpgradeBanner() {
  return (
    <Card className="border-[#FF8C42]/30 bg-gradient-to-r from-[#FF8C42]/5 via-white to-[#1F3A5F]/5 overflow-hidden" data-testid="ai-upgrade-banner">
      <CardContent className="p-5">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#FF6B1A] flex items-center justify-center flex-shrink-0">
            <Brain className="h-7 w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#1F3A5F] flex items-center gap-2">
              Upgrade to AI Controller Mode
              <Badge className="bg-[#FF8C42] text-white hover:bg-[#FF8C42]">Premium</Badge>
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Get AI-powered situational awareness, smart alerts, one-click quick actions, and a conversational AI assistant.
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Brain className="w-3 h-3" /> Real-time AI briefings</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Zap className="w-3 h-3" /> Smart alert triage</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI quick actions</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Bot className="w-3 h-3" /> AI chat assistant</span>
            </div>
          </div>
          <Button
            className="bg-[#FF8C42] hover:bg-[#e67a35] text-white flex-shrink-0"
            onClick={() => window.location.href = "/addons"}
            data-testid="button-upgrade-ai"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            From £49/mo
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIKPIInsights({ shifts, incidents }: { shifts: any[]; incidents: any[] }) {
  const { data, isLoading } = useQuery<{ insights: string[] }>({
    queryKey: ["/api/ai-controller/kpi-insights"],
    queryFn: async () => {
      const res = await apiRequest("POST", "/api/ai-controller/kpi-insights", {
        totalShifts: shifts.length,
        activeShifts: shifts.filter(s => s.status === "in_progress").length,
        lateShifts: shifts.filter(s => s.isLate).length,
        noShows: shifts.filter(s => s.status === "no_show").length,
        openIncidents: incidents.filter(i => i.status !== "resolved" && i.status !== "closed").length,
        coverageRate: shifts.length > 0 ? Math.round((shifts.filter(s => s.status === "in_progress").length / shifts.length) * 100) : 0,
      });
      return res.json();
    },
    refetchInterval: 120000,
  });

  if (isLoading) return null;

  const insights = data?.insights || [];
  if (insights.length === 0) return null;

  return (
    <div className="flex items-start gap-2 p-3 bg-gradient-to-r from-[#FF8C42]/5 to-transparent rounded-lg border border-[#FF8C42]/10" data-testid="ai-kpi-insights">
      <Bot className="w-4 h-4 text-[#FF8C42] mt-0.5 flex-shrink-0" />
      <div className="space-y-1">
        {insights.map((insight, idx) => (
          <p key={idx} className="text-xs text-[#1F3A5F]">{insight}</p>
        ))}
      </div>
    </div>
  );
}

export function AIAutoContactPanel({ shifts }: { shifts: any[] }) {
  const { toast } = useToast();
  const [selectedChannel, setSelectedChannel] = useState<string>("in_app");
  const [customMessage, setCustomMessage] = useState("");
  const [triggerType, setTriggerType] = useState<string>("late_checkin");

  const { data: serviceStatus } = useQuery<{
    twilio: { configured: boolean; sms: boolean; voice: boolean };
    elevenLabs: { configured: boolean; aiVoice: boolean };
    inApp: { configured: boolean };
  }>({
    queryKey: ["/api/ai-contact/status"],
  });

  const lateShifts = shifts.filter(s => s.isLate || (s.status === "scheduled" && !s.checkinTime));
  const noShowShifts = shifts.filter(s => s.status === "no_show");
  const targetShifts = [...lateShifts, ...noShowShifts];

  const sendMutation = useMutation({
    mutationFn: async (params: any) => {
      const res = await apiRequest("POST", "/api/ai-contact/send", params);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Message sent", description: `${data.channel === "sms" ? "SMS" : "In-app message"} sent successfully.` });
      setCustomMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/ai-contact/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async (params: any) => {
      const res = await apiRequest("POST", "/api/ai-contact/escalate", params);
      return res.json();
    },
    onSuccess: (data: any) => {
      const channels = data.results?.map((r: any) => r.channel).join(", ") || "";
      toast({ title: "Escalation initiated", description: `Contacted ${data.employee} via: ${channels}` });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-contact/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Escalation failed", description: err.message, variant: "destructive" });
    },
  });

  const callMutation = useMutation({
    mutationFn: async (params: any) => {
      const res = await apiRequest("POST", "/api/ai-contact/call", params);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Call initiated", description: data.status === "sent" ? "AI voice call placed successfully." : "Call logged (mock mode)." });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-contact/logs"] });
    },
    onError: (err: any) => {
      toast({ title: "Call failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="border-[#FF8C42]/20" data-testid="ai-auto-contact-panel">
      <CardHeader className="bg-gradient-to-r from-[#FF8C42]/5 to-transparent pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#FF8C42]" />
            <CardTitle className="text-base">AI Auto-Contact</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {serviceStatus?.twilio?.configured ? (
              <Badge variant="outline" className="text-[10px] text-green-600 border-green-200 bg-green-50">
                <Wifi className="w-3 h-3 mr-1" /> Twilio Live
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-200">
                <WifiOff className="w-3 h-3 mr-1" /> Mock Mode
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-3 space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center" data-testid="contact-channel-status">
          <div className="p-2 rounded-lg bg-green-50 border border-green-200">
            <MessageSquare className="w-4 h-4 text-green-600 mx-auto" />
            <div className="text-[10px] font-medium mt-1">In-App</div>
            <div className="text-[10px] text-green-600">Active</div>
          </div>
          <div className={`p-2 rounded-lg ${serviceStatus?.twilio?.sms ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"} border`}>
            <Phone className={`w-4 h-4 ${serviceStatus?.twilio?.sms ? "text-green-600" : "text-gray-400"} mx-auto`} />
            <div className="text-[10px] font-medium mt-1">SMS</div>
            <div className={`text-[10px] ${serviceStatus?.twilio?.sms ? "text-green-600" : "text-gray-400"}`}>
              {serviceStatus?.twilio?.sms ? "Active" : "Configure"}
            </div>
          </div>
          <div className={`p-2 rounded-lg ${serviceStatus?.twilio?.voice ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"} border`}>
            <PhoneCall className={`w-4 h-4 ${serviceStatus?.twilio?.voice ? "text-green-600" : "text-gray-400"} mx-auto`} />
            <div className="text-[10px] font-medium mt-1">AI Voice</div>
            <div className={`text-[10px] ${serviceStatus?.twilio?.voice ? "text-green-600" : "text-gray-400"}`}>
              {serviceStatus?.twilio?.voice ? "Active" : "Configure"}
            </div>
          </div>
        </div>

        {targetShifts.length > 0 && (
          <div className="space-y-2" data-testid="escalation-targets">
            <div className="text-xs font-medium text-[#1F3A5F] flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-orange-500" />
              Officers Requiring Contact ({targetShifts.length})
            </div>
            {targetShifts.slice(0, 5).map((shift) => (
              <div key={shift.id} className="flex items-center justify-between p-2 rounded-lg border bg-white hover:bg-gray-50" data-testid={`escalation-target-${shift.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{shift.employeeName || "Unassigned"}</div>
                  <div className="text-[10px] text-muted-foreground">{shift.siteName} • {shift.startTime || shift.time}</div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => {
                      if (!shift.employeeId) return;
                      sendMutation.mutate({
                        employeeId: shift.employeeId,
                        channel: "in_app",
                        message: `Please check in for your shift at ${shift.siteName}. You are overdue.`,
                        triggerType: "late_checkin",
                        shiftId: shift.id,
                      });
                    }}
                    disabled={sendMutation.isPending || !shift.employeeId}
                    data-testid={`button-inapp-${shift.id}`}
                  >
                    <MessageSquare className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px]"
                    onClick={() => {
                      if (!shift.employeeId) return;
                      sendMutation.mutate({
                        employeeId: shift.employeeId,
                        channel: "sms",
                        message: `GARDEO: You haven't checked in for your ${shift.startTime || ""} shift at ${shift.siteName}. Please check in or call the control room.`,
                        triggerType: "late_checkin",
                        shiftId: shift.id,
                      });
                    }}
                    disabled={sendMutation.isPending || !shift.employeeId}
                    data-testid={`button-sms-${shift.id}`}
                  >
                    <Phone className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-[10px] text-orange-600"
                    onClick={() => {
                      if (!shift.employeeId) return;
                      escalateMutation.mutate({
                        employeeId: shift.employeeId,
                        triggerType: shift.status === "no_show" ? "no_show" : "late_checkin",
                        shiftId: shift.id,
                        siteName: shift.siteName,
                        shiftDate: shift.date,
                        shiftTime: shift.startTime || shift.time,
                      });
                    }}
                    disabled={escalateMutation.isPending || !shift.employeeId}
                    data-testid={`button-escalate-${shift.id}`}
                  >
                    <Radio className="w-3 h-3" />
                    <span className="ml-1">Escalate</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-2 p-3 rounded-lg border bg-gray-50" data-testid="manual-contact-form">
          <div className="text-xs font-medium text-[#1F3A5F]">Manual Contact</div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={triggerType} onValueChange={setTriggerType}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="late_checkin">Late Check-in</SelectItem>
                <SelectItem value="no_show">No Show</SelectItem>
                <SelectItem value="shift_cover">Shift Cover</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedChannel} onValueChange={setSelectedChannel}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="in_app">In-App Message</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="voice_call">AI Voice Call</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={customMessage}
            onChange={(e) => setCustomMessage(e.target.value)}
            placeholder="Type a custom message or leave blank for AI-generated..."
            className="text-xs min-h-[60px]"
            data-testid="input-custom-message"
          />
          <div className="flex gap-2">
            {targetShifts.length > 0 && targetShifts[0].employeeId && (
              <Button
                size="sm"
                className="bg-[#FF8C42] hover:bg-[#e67a35] text-white text-xs flex-1"
                onClick={() => {
                  const firstTarget = targetShifts[0];
                  if (selectedChannel === "voice_call") {
                    callMutation.mutate({
                      employeeId: firstTarget.employeeId,
                      triggerType,
                      shiftId: firstTarget.id,
                      siteName: firstTarget.siteName,
                      shiftTime: firstTarget.startTime || firstTarget.time,
                    });
                  } else {
                    const msg = customMessage || `Control room needs to reach you regarding your shift at ${firstTarget.siteName}.`;
                    sendMutation.mutate({
                      employeeId: firstTarget.employeeId,
                      channel: selectedChannel,
                      message: msg,
                      triggerType,
                      shiftId: firstTarget.id,
                    });
                  }
                }}
                disabled={sendMutation.isPending || callMutation.isPending}
                data-testid="button-send-contact"
              >
                {sendMutation.isPending || callMutation.isPending ? (
                  <Loader2 className="w-3 h-3 animate-spin mr-1" />
                ) : selectedChannel === "voice_call" ? (
                  <PhoneCall className="w-3 h-3 mr-1" />
                ) : (
                  <Send className="w-3 h-3 mr-1" />
                )}
                {selectedChannel === "voice_call" ? "Place AI Call" : "Send"}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIContactLogs() {
  const [channelFilter, setChannelFilter] = useState<string>("all");

  const { data: logs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/ai-contact/logs", channelFilter],
    queryFn: async () => {
      let url = "/api/ai-contact/logs?limit=30";
      if (channelFilter !== "all") url += `&channel=${channelFilter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 15000,
  });

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "in_app": return <MessageSquare className="w-3 h-3 text-blue-500" />;
      case "sms": return <Phone className="w-3 h-3 text-green-500" />;
      case "voice_call": return <PhoneCall className="w-3 h-3 text-purple-500" />;
      default: return <Radio className="w-3 h-3 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent": return <Badge className="text-[10px] bg-green-100 text-green-700 border-green-200">Sent</Badge>;
      case "failed": return <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">Failed</Badge>;
      case "pending": return <Badge className="text-[10px] bg-yellow-100 text-yellow-700 border-yellow-200">Pending</Badge>;
      default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) + " " + d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <Card className="border-[#1F3A5F]/10" data-testid="ai-contact-logs-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#1F3A5F]" />
            <CardTitle className="text-base">Contact Log</CardTitle>
          </div>
          <Select value={channelFilter} onValueChange={setChannelFilter}>
            <SelectTrigger className="w-28 h-7 text-xs" data-testid="select-channel-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="in_app">In-App</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="voice_call">Voice Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F3A5F] mr-2" />
            <span className="text-sm text-muted-foreground">Loading logs...</span>
          </div>
        ) : !logs || logs.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground" data-testid="no-contact-logs">
            <FileText className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            No contact logs yet. AI auto-contact actions will appear here.
          </div>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto" data-testid="contact-log-list">
            {logs.map((log: any) => (
              <div key={log.id} className="flex items-start gap-2 p-2 rounded border bg-white hover:bg-gray-50 transition-colors" data-testid={`contact-log-${log.id}`}>
                <div className="mt-0.5">{getChannelIcon(log.channel)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium truncate">{log.employee_name || "Unknown"}</span>
                    {getStatusBadge(log.status)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {log.trigger_type?.replace(/_/g, " ")} • {log.site_name || "No site"}
                  </div>
                  {log.message_body && (
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate">{log.message_body}</div>
                  )}
                  {log.employee_response && (
                    <div className="text-[10px] text-blue-600 mt-0.5">Response: {log.employee_response}</div>
                  )}
                  {log.error_message && (
                    <div className="text-[10px] text-red-500 mt-0.5 truncate">Error: {log.error_message}</div>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground flex-shrink-0">{formatTime(log.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface ScanResult {
  scanTime: string;
  batchId: string;
  summary: {
    totalShifts: number;
    activeShifts: number;
    noShows: number;
    lateShifts: number;
    uncoveredShifts: number;
    availableOfficers: number;
  };
  actions: {
    type: string;
    shiftId: number;
    shiftTitle: string;
    siteName: string;
    shiftTime: string;
    severity: string;
    aiRecommendation: string;
    originalEmployee?: number;
    candidates?: { id: number; name: string; siaLicense: string; siaExpiry: string }[];
    batchId: string;
  }[];
  decisions: any[];
}

interface AiDecisionRow {
  id: number;
  siteName: string | null;
  shiftDate: string | null;
  employeeName: string | null;
  suggestedShiftTime: string | null;
  reason: string | null;
  priority: string | null;
  status: string;
  createdAt: string;
  batchId: string | null;
}

export function AIAutonomousPanel({ shifts }: { shifts: any[] }) {
  const { toast } = useToast();
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [coverDialogOpen, setCoverDialogOpen] = useState(false);
  const [coverForm, setCoverForm] = useState({
    siteId: "", startDate: "", endDate: "", startTime: "08:00", endTime: "20:00",
    title: "", notes: "", repeatPattern: "none",
  });

  const scanMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai-controller/autonomous-scan", {});
      return res.json();
    },
    onSuccess: (data: ScanResult) => {
      setScanResult(data);
      if (data.actions.length > 0) {
        toast({ title: "Scan Complete", description: `Found ${data.actions.length} issue(s) requiring attention.` });
      } else {
        toast({ title: "All Clear", description: "No issues detected. All shifts are covered." });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ai-controller/decisions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Scan Failed", description: err.message, variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ shiftId, employeeId, decisionId }: { shiftId: number; employeeId: number; decisionId?: number }) => {
      const res = await apiRequest("POST", "/api/ai-controller/auto-assign", { shiftId, employeeId, decisionId });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Officer Assigned", description: data.message });
      scanMutation.mutate();
    },
    onError: (err: Error) => {
      toast({ title: "Assignment Failed", description: err.message, variant: "destructive" });
    },
  });

  const coverMutation = useMutation({
    mutationFn: async (payload: typeof coverForm) => {
      const res = await apiRequest("POST", "/api/ai-controller/client-cover-request", payload);
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: "Cover Request Processed", description: `${data.shiftsCreated} shifts created. ${data.aiSuggestion}` });
      setCoverDialogOpen(false);
      setCoverForm({ siteId: "", startDate: "", endDate: "", startTime: "08:00", endTime: "20:00", title: "", notes: "", repeatPattern: "none" });
      queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/ai-controller/decisions"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: decisions = [] } = useQuery<AiDecisionRow[]>({
    queryKey: ["/api/ai-controller/decisions"],
  });

  const { data: sites = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["/api/sites"],
  });

  const noShows = shifts.filter((s: any) => s.status === "no_show").length;
  const lateCount = shifts.filter((s: any) => s.isLate).length;
  const uncoveredCount = shifts.filter((s: any) => !s.employeeId && s.status === "scheduled").length;

  return (
    <div className="space-y-4" data-testid="ai-autonomous-panel">
      <Card className="border-[#FF8C42]/30 bg-gradient-to-r from-orange-50/50 to-amber-50/30 dark:from-orange-950/20 dark:to-amber-950/10">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#e67a35] flex items-center justify-center shadow-lg">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm" data-testid="text-autonomous-title">AI Autonomous Controller</h3>
                <p className="text-xs text-muted-foreground">Detects no-shows, finds replacements, handles cover requests</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCoverDialogOpen(true)}
                className="text-xs h-8 border-[#1F3A5F]/20"
                data-testid="btn-cover-request"
              >
                <Plus className="w-3 h-3 mr-1" />
                Cover Request
              </Button>
              <Button
                size="sm"
                onClick={() => scanMutation.mutate()}
                disabled={scanMutation.isPending}
                className="bg-[#FF8C42] hover:bg-[#e67a35] text-white text-xs h-8"
                data-testid="btn-autonomous-scan"
              >
                {scanMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                Run Scan
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border shadow-sm text-center">
              <div className={`text-xl font-bold ${noShows > 0 ? "text-red-600" : "text-green-600"}`} data-testid="value-no-shows">{noShows}</div>
              <div className="text-[10px] text-muted-foreground font-medium">No Shows</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border shadow-sm text-center">
              <div className={`text-xl font-bold ${lateCount > 0 ? "text-amber-600" : "text-green-600"}`} data-testid="value-late">{lateCount}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Late</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border shadow-sm text-center">
              <div className={`text-xl font-bold ${uncoveredCount > 0 ? "text-orange-600" : "text-green-600"}`} data-testid="value-uncovered">{uncoveredCount}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Uncovered</div>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-lg p-3 border shadow-sm text-center">
              <div className="text-xl font-bold text-[#1F3A5F]" data-testid="value-available">{scanResult?.summary?.availableOfficers ?? "—"}</div>
              <div className="text-[10px] text-muted-foreground font-medium">Available</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {scanResult && scanResult.actions.length > 0 && (
        <Card className="border-red-200 dark:border-red-900" data-testid="scan-actions-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <CardTitle className="text-sm">AI Actions Required ({scanResult.actions.length})</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {scanResult.actions.map((action, idx) => (
                <div key={idx} className={`p-3 rounded-lg border ${action.severity === "critical" ? "bg-red-50 dark:bg-red-950/20 border-red-200" : "bg-amber-50 dark:bg-amber-950/20 border-amber-200"}`} data-testid={`action-${idx}`}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={action.severity === "critical" ? "destructive" : "outline"} className="text-[10px] h-5">
                        {action.type === "no_show_detected" ? "NO SHOW" : "UNCOVERED"}
                      </Badge>
                      <span className="text-xs font-semibold">{action.siteName}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{action.shiftTime}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{action.shiftTitle}</p>
                  <p className="text-xs text-[#1F3A5F] dark:text-blue-300 font-medium mb-2">
                    <Lightbulb className="w-3 h-3 inline mr-1" />
                    {action.aiRecommendation}
                  </p>
                  {action.candidates && action.candidates.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {action.candidates.map((c) => (
                        <Button
                          key={c.id}
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 px-2 border-green-300 hover:bg-green-50 hover:border-green-500"
                          onClick={() => assignMutation.mutate({ shiftId: action.shiftId, employeeId: c.id })}
                          disabled={assignMutation.isPending}
                          data-testid={`btn-assign-${c.id}`}
                        >
                          <Users className="w-2.5 h-2.5 mr-1" />
                          {c.name}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {scanResult && scanResult.actions.length === 0 && (
        <Card className="border-green-200 dark:border-green-900" data-testid="scan-all-clear">
          <CardContent className="pt-5 pb-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-300">All Clear</p>
              <p className="text-xs text-muted-foreground">No issues detected. {scanResult.summary.totalShifts} shifts checked, {scanResult.summary.activeShifts} active.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {decisions.length > 0 && (
        <Card data-testid="ai-decisions-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#1F3A5F]" />
              <CardTitle className="text-sm">AI Decision Audit Trail</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1.5 max-h-[250px] overflow-y-auto">
              {decisions.slice(0, 20).map((d) => (
                <div key={d.id} className="flex items-start gap-2 p-2 rounded border bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors" data-testid={`decision-${d.id}`}>
                  <div className="mt-0.5">
                    {d.status === "accepted" ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> :
                     d.status === "rejected" ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> :
                     <Clock className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{d.siteName || "General"}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1.5">
                        {d.status}
                      </Badge>
                      {d.priority === "high" && <Badge variant="destructive" className="text-[9px] h-4 px-1.5">High</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{d.reason}</p>
                    {d.employeeName && <p className="text-[10px] text-blue-600 mt-0.5">Officer: {d.employeeName}</p>}
                  </div>
                  <div className="text-[10px] text-muted-foreground flex-shrink-0">
                    {new Date(d.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {coverDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setCoverDialogOpen(false)}>
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()} data-testid="cover-request-dialog">
            <div className="bg-gradient-to-r from-[#1F3A5F] to-[#2d5a8e] px-6 py-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Client Cover Request
              </h3>
              <p className="text-white/70 text-xs mt-1">AI will create shifts and suggest officer assignments</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Site *</label>
                <select
                  value={coverForm.siteId}
                  onChange={(e) => setCoverForm(f => ({ ...f, siteId: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background"
                  data-testid="select-cover-site"
                >
                  <option value="">Select site...</option>
                  {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Start Date *</label>
                  <Input type="date" value={coverForm.startDate} onChange={(e) => setCoverForm(f => ({ ...f, startDate: e.target.value }))} className="h-9 text-sm" data-testid="input-cover-start-date" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">End Date</label>
                  <Input type="date" value={coverForm.endDate} onChange={(e) => setCoverForm(f => ({ ...f, endDate: e.target.value }))} className="h-9 text-sm" data-testid="input-cover-end-date" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Start Time *</label>
                  <Input type="time" value={coverForm.startTime} onChange={(e) => setCoverForm(f => ({ ...f, startTime: e.target.value }))} className="h-9 text-sm" data-testid="input-cover-start-time" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">End Time *</label>
                  <Input type="time" value={coverForm.endTime} onChange={(e) => setCoverForm(f => ({ ...f, endTime: e.target.value }))} className="h-9 text-sm" data-testid="input-cover-end-time" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Repeat Pattern</label>
                <select
                  value={coverForm.repeatPattern}
                  onChange={(e) => setCoverForm(f => ({ ...f, repeatPattern: e.target.value }))}
                  className="w-full h-9 px-3 rounded-md border text-sm bg-background"
                  data-testid="select-cover-repeat"
                >
                  <option value="none">No repeat (single day or date range)</option>
                  <option value="week">Daily for 1 week (7 days)</option>
                  <option value="fortnight">Daily for 2 weeks (14 days)</option>
                  <option value="month">Daily for 1 month (28 days)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Notes</label>
                <Input value={coverForm.notes} onChange={(e) => setCoverForm(f => ({ ...f, notes: e.target.value }))} placeholder="e.g. Emergency cover needed, client request..." className="h-9 text-sm" data-testid="input-cover-notes" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => setCoverDialogOpen(false)} data-testid="btn-cover-cancel">Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => coverMutation.mutate(coverForm)}
                  disabled={!coverForm.siteId || !coverForm.startDate || coverMutation.isPending}
                  className="bg-[#1F3A5F] hover:bg-[#2a4d7a]"
                  data-testid="btn-cover-submit"
                >
                  {coverMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                  Create Shifts
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
