import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Brain, TrendingUp, Shield, AlertTriangle, Calendar, Users,
  MapPin, ThumbsUp, ThumbsDown, Clock, Sparkles, BarChart3,
  AlertCircle, CheckCircle2, Info, Zap, ChevronDown, ChevronUp, Search,
} from "lucide-react";

const SEVERITY_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  critical: { icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50 dark:bg-red-950/20 border-red-200" },
  warning: { icon: AlertCircle, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200" },
  info: { icon: Info, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200" },
};

const LONG_LIST_THRESHOLD = 5;

function AlertBanner({ alert, index }: { alert: any; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.info;
  const Icon = config.icon;
  const items: string[] = alert.items || [];
  const isLongList = items.length >= LONG_LIST_THRESHOLD;
  const filteredItems = items.filter(item => item.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`rounded-lg border ${config.bg}`} data-testid={`alert-${index}`}>
      <div className="flex items-start gap-3 p-4">
        <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${config.color}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{alert.title}</p>
          {isLongList ? (
            <p className="text-xs text-muted-foreground mt-0.5">
              {items.length} item{items.length !== 1 ? "s" : ""} — click to view details
            </p>
          ) : items.length > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">{items.join(", ")}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
          )}
        </div>
        {isLongList && (
          <button
            onClick={() => setExpanded(prev => !prev)}
            className={`flex items-center gap-1 text-xs font-medium flex-shrink-0 px-2 py-1 rounded transition-colors ${config.color} hover:bg-black/5 dark:hover:bg-white/10`}
            data-testid={`button-toggle-alert-${index}`}
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Hide details</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Show details</>
            )}
          </button>
        )}
      </div>
      {isLongList && expanded && (
        <div className="px-4 pb-4">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
              data-testid={`input-search-alert-${index}`}
            />
          </div>
          <div
            className="overflow-y-auto max-h-48 rounded border bg-white/60 dark:bg-black/20 p-2"
            data-testid={`list-alert-items-${index}`}
          >
            {filteredItems.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1">
                {filteredItems.map((item, j) => (
                  <span
                    key={j}
                    className="text-xs px-2 py-1 rounded bg-white dark:bg-black/30 border truncate"
                    title={item}
                    data-testid={`item-alert-${index}-${j}`}
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-2">No matches found</p>
            )}
          </div>
          {search && (
            <p className="text-xs text-muted-foreground mt-1">
              Showing {filteredItems.length} of {items.length} items
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const DAYS_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function AIAnalyticsPage() {
  const { data: predictions, isLoading } = useQuery<any>({
    queryKey: ["/api/analytics/predictions"],
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const compliance = predictions?.complianceForecast || {};
  const staffing = predictions?.staffingTrends || {};
  const ai = predictions?.aiLearning || {};
  const alerts = predictions?.alerts || [];
  const dayDist = staffing.dayDistribution || {};
  const maxDayShifts = Math.max(...Object.values(dayDist).map((v: any) => Number(v) || 0), 1);

  return (
    <div className="p-6 space-y-6" data-testid="ai-analytics-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1F3A5F, #FF8C42)" }}>
          <TrendingUp className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Predictive Analytics</h1>
          <p className="text-muted-foreground text-sm">AI-powered forecasting, trend analysis, and smart recommendations.</p>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2" data-testid="section-alerts">
          {alerts.map((alert: any, i: number) => (
            <AlertBanner key={i} alert={alert} index={i} />
          ))}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-ai-acceptance">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(145, 60%, 40%, 0.08)" }}>
                <Brain className="w-4 h-4" style={{ color: "hsl(145, 60%, 40%)" }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{ai.acceptanceRate || 0}%</p>
                <p className="text-xs text-muted-foreground">AI Acceptance Rate</p>
              </div>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3 text-green-600" />{ai.accepted || 0}</span>
              <span className="flex items-center gap-1"><ThumbsDown className="w-3 h-3 text-red-500" />{ai.rejected || 0}</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{ai.pending || 0} pending</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-suggestions">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(27, 100%, 55%, 0.08)" }}>
                <Sparkles className="w-4 h-4" style={{ color: "hsl(27, 100%, 55%)" }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{ai.totalSuggestions || 0}</p>
                <p className="text-xs text-muted-foreground">Total AI Suggestions</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {ai.totalSuggestions > 0 ? "AI learning from your feedback" : "Generate suggestions to start learning"}
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-compliance-forecast">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(0, 70%, 50%, 0.08)" }}>
                <Shield className="w-4 h-4" style={{ color: "hsl(0, 70%, 50%)" }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{(compliance.siaExpiring30 || 0) + (compliance.siaExpiring60 || 0)}</p>
                <p className="text-xs text-muted-foreground">Licences Expiring (60d)</p>
              </div>
            </div>
            <div className="flex gap-2 text-xs">
              {compliance.siaExpiring30 > 0 && <Badge variant="destructive" className="text-xs">{compliance.siaExpiring30} in 30d</Badge>}
              {compliance.siaExpiring60 > 0 && <Badge variant="secondary" className="text-xs">{compliance.siaExpiring60} in 60d</Badge>}
              {compliance.siaExpiring90 > 0 && <Badge variant="secondary" className="text-xs">{compliance.siaExpiring90} in 90d</Badge>}
              {!compliance.siaExpiring30 && !compliance.siaExpiring60 && <span className="text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-600" /> All clear</span>}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-workforce-overview">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(216, 52%, 25%, 0.08)" }}>
                <Users className="w-4 h-4" style={{ color: "hsl(216, 52%, 35%)" }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{staffing.totalEmployees || 0}</p>
                <p className="text-xs text-muted-foreground">Active Employees</p>
              </div>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{staffing.totalSites || 0} sites</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{staffing.totalShifts || 0} shifts</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-day-distribution">
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Shift Distribution by Day</h3>
                <p className="text-xs text-muted-foreground">Identify peak and quiet periods</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {Object.keys(dayDist).length > 0 ? (
              <div className="space-y-3">
                {DAYS_ORDER.map(day => {
                  const count = dayDist[day] || 0;
                  const pct = Math.round((count / maxDayShifts) * 100);
                  const isBusiest = day === staffing.busiestDay;
                  const isQuietest = day === staffing.quietestDay;
                  return (
                    <div key={day} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium w-24">{day}</span>
                        <div className="flex items-center gap-2">
                          {isBusiest && <Badge variant="default" className="text-xs">Busiest</Badge>}
                          {isQuietest && count > 0 && <Badge variant="secondary" className="text-xs">Quietest</Badge>}
                          <span className="text-muted-foreground text-xs w-12 text-right">{count} shifts</span>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: isBusiest ? "#FF8C42" : "#1F3A5F",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Zap className="w-3 h-3" style={{ color: "#FF8C42" }} />
                  Prediction: Busiest day is typically <strong>{staffing.busiestDay}</strong>
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No shift data available yet. Create shifts to see distribution patterns.</p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-site-staffing">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Site Staffing Levels</h3>
                <p className="text-xs text-muted-foreground">Shift coverage per site</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {staffing.siteStaffing && staffing.siteStaffing.length > 0 ? (
              <div className="space-y-3">
                {staffing.siteStaffing.map((site: any) => (
                  <div key={site.siteId} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="text-sm font-medium">{site.siteName}</p>
                      <p className="text-xs text-muted-foreground">{site.totalShifts} total shifts</p>
                    </div>
                    <Badge variant={site.totalShifts === 0 ? "destructive" : site.avgShiftsPerWeek < 2 ? "secondary" : "default"}>
                      {site.totalShifts === 0 ? "No coverage" : `${site.avgShiftsPerWeek}/wk avg`}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">No sites configured. Add sites to track staffing levels.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-preferred-employees">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">AI-Learned Preferences</h3>
                <p className="text-xs text-muted-foreground">Employees most frequently accepted by managers</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ai.topPreferredEmployees && ai.topPreferredEmployees.length > 0 ? (
              <div className="space-y-2">
                {ai.topPreferredEmployees.map((emp: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white"
                        style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
                        {i + 1}
                      </div>
                      <span className="text-sm font-medium">{emp.name}</span>
                    </div>
                    <Badge variant="default">{emp.timesAccepted}x accepted</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                Accept or reject AI suggestions to build preference patterns.
              </p>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-rejection-feedback">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ThumbsDown className="w-5 h-5 text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Rejection Feedback</h3>
                <p className="text-xs text-muted-foreground">Reasons managers rejected AI suggestions</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {ai.recentRejectionReasons && ai.recentRejectionReasons.length > 0 ? (
              <div className="space-y-2">
                {ai.recentRejectionReasons.map((reason: string, i: number) => (
                  <div key={i} className="p-3 rounded-lg border text-sm">
                    <p className="text-muted-foreground">"{reason}"</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">
                No rejection feedback yet. When you reject suggestions, provide feedback to improve AI accuracy.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {compliance.siaExpiringDetails && compliance.siaExpiringDetails.length > 0 && (
        <Card data-testid="card-expiring-licences">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="font-semibold">SIA Licences Expiring Within 30 Days</h3>
                <p className="text-xs text-muted-foreground">Immediate action required to maintain compliance</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {compliance.siaExpiringDetails.map((emp: any) => (
                <div key={emp.employeeId} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-950/10">
                  <div>
                    <p className="text-sm font-medium">Employee #{emp.employeeId}</p>
                    <p className="text-xs text-muted-foreground">{emp.licenseType || "SIA Licence"}</p>
                  </div>
                  <Badge variant="destructive">
                    Expires {new Date(emp.expiryDate).toLocaleDateString("en-GB")}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
