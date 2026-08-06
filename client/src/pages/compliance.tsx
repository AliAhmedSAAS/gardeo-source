import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  ShieldCheck, Users, AlertTriangle, XCircle, Search,
  CheckCircle2, Clock, ShieldAlert, FileWarning, Bell, Send, Loader2,
  ArrowRight,
} from "lucide-react";

type ComplianceEmployee = {
  id: number;
  name: string;
  siaLicenseNumber: string | null;
  siaExpiryDate: string | null;
  siaStatus: "valid" | "expiring" | "expired" | "missing";
  dbsCertificateNumber: string | null;
  hasFirstAid: boolean;
  firstAidExpiry: string | null;
  overallStatus: "compliant" | "expiring" | "non_compliant";
};

type ComplianceSummary = {
  totalEmployees: number;
  fullyCompliant: number;
  siaExpiring: number;
  siaExpired: number;
  missingDbs: number;
};

type ComplianceData = {
  employees: ComplianceEmployee[];
  summary: ComplianceSummary;
};

type AlertLogEntry = {
  id: number;
  tenant_id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  alert_type: string;
  days_before: number;
  recipient_email: string;
  sent_at: string;
};

type RunAlertsResult = {
  alertsSent: number;
  breakdown: Record<string, number>;
  details: Array<{
    entityType: string;
    entityId: number;
    entityName: string;
    alertType: string;
    daysBefore: number;
    recipientEmail: string;
  }>;
};

function getSiaStatusBadge(status: string) {
  switch (status) {
    case "valid":
      return <Badge variant="default" className="bg-green-600 border-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Valid</Badge>;
    case "expiring":
      return <Badge variant="default" className="bg-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" /> Expiring</Badge>;
    case "expired":
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Expired</Badge>;
    default:
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Missing</Badge>;
  }
}

function getOverallStatusBadge(status: string) {
  switch (status) {
    case "compliant":
      return <Badge variant="default" className="bg-green-600 border-green-600"><ShieldCheck className="w-3 h-3 mr-1" /> Compliant</Badge>;
    case "expiring":
      return <Badge variant="default" className="bg-yellow-500 border-yellow-500"><AlertTriangle className="w-3 h-3 mr-1" /> Expiring</Badge>;
    default:
      return <Badge variant="destructive"><ShieldAlert className="w-3 h-3 mr-1" /> Non-Compliant</Badge>;
  }
}

function formatAlertType(alertType: string): string {
  const map: Record<string, string> = {
    sia_expiry: "SIA Expiry",
    dbs_review: "DBS Review",
    first_aid_expiry: "First Aid Expiry",
    el_insurance_expiry: "EL Insurance Expiry",
    pl_insurance_expiry: "PL Insurance Expiry",
    sba_expiry: "SBA Expiry",
  };
  return map[alertType] || alertType;
}

function getAlertTypeBadge(alertType: string) {
  const label = formatAlertType(alertType);
  if (alertType.includes("sia") || alertType.includes("dbs") || alertType.includes("first_aid")) {
    return <Badge variant="secondary">{label}</Badge>;
  }
  if (alertType.includes("insurance")) {
    return <Badge variant="outline">{label}</Badge>;
  }
  return <Badge variant="default">{label}</Badge>;
}

function ComplianceRing({ value, max, size = 64, color }: { value: number; max: number; size?: number; color: string }) {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0;
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percentage / 100) * circumference;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={4} className="text-muted/30" />
      <circle
        cx={size / 2} cy={size / 2} r={radius} fill="none"
        stroke={color} strokeWidth={4}
        strokeDasharray={`${filled} ${circumference}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 - 4} textAnchor="middle" fontSize="14" fontWeight="700" fill={color}>
        {value}
      </text>
      <text x={size / 2} y={size / 2 + 10} textAnchor="middle" fontSize="9" fill="currentColor" className="fill-muted-foreground">
        of {max}
      </text>
    </svg>
  );
}

export default function CompliancePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [needsAttentionFilter, setNeedsAttentionFilter] = useState<string | null>(null);
  const [lastRunResult, setLastRunResult] = useState<RunAlertsResult | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<ComplianceData>({
    queryKey: ["/api/admin/compliance"],
  });

  const { data: alertLog, isLoading: alertLogLoading } = useQuery<AlertLogEntry[]>({
    queryKey: ["/api/admin/compliance/alert-log"],
  });

  const runAlertsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/compliance/run-alerts");
      return await res.json() as RunAlertsResult;
    },
    onSuccess: (result) => {
      setLastRunResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compliance/alert-log"] });
      toast({
        title: "Compliance Check Complete",
        description: result.alertsSent > 0
          ? `${result.alertsSent} alert(s) sent successfully.`
          : "No new alerts to send. All items are either up to date or already notified.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const employees = data?.employees || [];
  const summary = data?.summary || {
    totalEmployees: 0,
    fullyCompliant: 0,
    siaExpiring: 0,
    siaExpired: 0,
    missingDbs: 0,
  };

  const filtered = employees.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (needsAttentionFilter === "expiring") return e.siaStatus === "expiring";
    if (needsAttentionFilter === "expired") return e.siaStatus === "expired" || e.siaStatus === "missing";
    if (needsAttentionFilter === "missing_dbs") return !e.dbsCertificateNumber;
    return true;
  });

  const logEntries = alertLog || [];

  const complianceRate = summary.totalEmployees > 0
    ? Math.round((summary.fullyCompliant / summary.totalEmployees) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6" data-testid="compliance-page">
      <div>
        <h1 className="text-2xl font-bold">Compliance Dashboard</h1>
        <p className="text-muted-foreground text-sm">Monitor employee compliance, SIA licenses, DBS certificates, and automated alerts.</p>
      </div>

      <Tabs defaultValue="overview" data-testid="tabs-compliance">
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">
            <ShieldCheck className="w-4 h-4 mr-1" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="alerts" data-testid="tab-alerts">
            <Bell className="w-4 h-4 mr-1" />
            Compliance Alerts
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Total / Compliance Rate */}
            <Card className="lg:col-span-1">
              <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-2">
                <ComplianceRing
                  value={summary.fullyCompliant}
                  max={summary.totalEmployees}
                  size={72}
                  color="#16a34a"
                />
                <div>
                  <div className="text-xs font-medium">Overall Compliant</div>
                  <div className="text-[10px] text-muted-foreground">{complianceRate}% compliance rate</div>
                </div>
              </CardContent>
            </Card>

            {/* Total Employees */}
            <Card>
              <CardContent className="p-4 text-center flex flex-col items-center justify-center gap-2">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div className={`text-2xl font-bold`} data-testid="text-total-employees">{summary.totalEmployees}</div>
                <div className="text-xs text-muted-foreground">Total Employees</div>
              </CardContent>
            </Card>

            {/* SIA Expiring */}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${needsAttentionFilter === "expiring" ? "ring-2 ring-amber-400" : ""}`}
              onClick={() => setNeedsAttentionFilter(needsAttentionFilter === "expiring" ? null : "expiring")}
            >
              <CardContent className="p-4 text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-amber-500" />
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-sia-expiring">{summary.siaExpiring}</div>
                <div className="text-xs text-muted-foreground">SIA Expiring (30d)</div>
                {summary.siaExpiring > 0 && (
                  <button className="flex items-center justify-center gap-1 text-[10px] text-amber-600 mt-1 hover:underline mx-auto" onClick={(e) => { e.stopPropagation(); setNeedsAttentionFilter(needsAttentionFilter === "expiring" ? null : "expiring"); }}>
                    <ArrowRight className="w-2.5 h-2.5" /> View affected
                  </button>
                )}
              </CardContent>
            </Card>

            {/* SIA Expired */}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${needsAttentionFilter === "expired" ? "ring-2 ring-red-400" : ""}`}
              onClick={() => setNeedsAttentionFilter(needsAttentionFilter === "expired" ? null : "expired")}
            >
              <CardContent className="p-4 text-center">
                <XCircle className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-sia-expired">{summary.siaExpired}</div>
                <div className="text-xs text-muted-foreground">SIA Expired</div>
                {summary.siaExpired > 0 && (
                  <button className="flex items-center justify-center gap-1 text-[10px] text-red-600 mt-1 hover:underline mx-auto">
                    <ArrowRight className="w-2.5 h-2.5" /> Fix now
                  </button>
                )}
              </CardContent>
            </Card>

            {/* Missing DBS */}
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${needsAttentionFilter === "missing_dbs" ? "ring-2 ring-red-400" : ""}`}
              onClick={() => setNeedsAttentionFilter(needsAttentionFilter === "missing_dbs" ? null : "missing_dbs")}
            >
              <CardContent className="p-4 text-center">
                <FileWarning className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-missing-dbs">{summary.missingDbs}</div>
                <div className="text-xs text-muted-foreground">Missing DBS</div>
                {summary.missingDbs > 0 && (
                  <button className="flex items-center justify-center gap-1 text-[10px] text-red-600 mt-1 hover:underline mx-auto">
                    <ArrowRight className="w-2.5 h-2.5" /> Fix now
                  </button>
                )}
              </CardContent>
            </Card>
          </div>

          {needsAttentionFilter && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <span className="text-sm text-amber-800 dark:text-amber-300 font-medium">
                Filtered: {needsAttentionFilter === "expiring" ? "SIA licenses expiring within 30 days" : needsAttentionFilter === "expired" ? "Expired or missing SIA licenses" : "Missing DBS certificates"} ({filtered.length} employee{filtered.length !== 1 ? "s" : ""})
              </span>
              <Button size="sm" variant="ghost" className="ml-auto h-6 text-xs text-amber-700" onClick={() => setNeedsAttentionFilter(null)}>
                Clear filter
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-search-compliance"
                placeholder="Search employees by name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <ShieldCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No employees found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || needsAttentionFilter ? "Try adjusting your search or filter." : "Employee compliance data will appear here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-compliance">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Name</th>
                        <th className="text-left p-3 font-medium">SIA License</th>
                        <th className="text-left p-3 font-medium">SIA Expiry</th>
                        <th className="text-left p-3 font-medium">SIA Status</th>
                        <th className="text-left p-3 font-medium">DBS Certificate</th>
                        <th className="text-left p-3 font-medium">First Aid</th>
                        <th className="text-left p-3 font-medium">Overall Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((emp) => (
                        <tr
                          key={emp.id}
                          className={`border-b last:border-0 transition-colors ${
                            emp.overallStatus === "non_compliant" ? "bg-red-50/30 dark:bg-red-900/5 hover:bg-red-50 dark:hover:bg-red-900/10" :
                            emp.overallStatus === "expiring" ? "bg-amber-50/30 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10" :
                            "hover:bg-muted/30"
                          }`}
                          data-testid={`row-employee-${emp.id}`}
                        >
                          <td className="p-3 font-medium" data-testid={`text-employee-name-${emp.id}`}>
                            <div className="flex items-center gap-2">
                              {emp.overallStatus === "non_compliant" && <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                              {emp.overallStatus === "expiring" && <AlertTriangle className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                              {emp.overallStatus === "compliant" && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                              {emp.name}
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{emp.siaLicenseNumber || "N/A"}</td>
                          <td className="p-3 text-muted-foreground">
                            {emp.siaExpiryDate ? new Date(emp.siaExpiryDate).toLocaleDateString() : "N/A"}
                          </td>
                          <td className="p-3" data-testid={`badge-sia-status-${emp.id}`}>
                            {getSiaStatusBadge(emp.siaStatus)}
                          </td>
                          <td className="p-3 text-muted-foreground">{emp.dbsCertificateNumber || "N/A"}</td>
                          <td className="p-3">
                            {emp.hasFirstAid ? (
                              <Badge variant="default" className="bg-green-600 border-green-600">Yes</Badge>
                            ) : (
                              <Badge variant="destructive">No</Badge>
                            )}
                          </td>
                          <td className="p-3" data-testid={`badge-overall-status-${emp.id}`}>
                            {getOverallStatusBadge(emp.overallStatus)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <div>
                <h2 className="text-lg font-semibold">Run Compliance Check</h2>
                <p className="text-sm text-muted-foreground">
                  Scan for expiring SIA licenses, DBS certificates, insurance documents, and self-billing agreements. Alerts are sent via email.
                </p>
              </div>
              <Button
                data-testid="button-run-compliance-check"
                onClick={() => runAlertsMutation.mutate()}
                disabled={runAlertsMutation.isPending}
              >
                {runAlertsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                {runAlertsMutation.isPending ? "Scanning..." : "Run Compliance Check"}
              </Button>
            </CardHeader>
            {lastRunResult && (
              <CardContent className="pt-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  <div className="text-center p-3 rounded-md bg-muted/50">
                    <div className="text-2xl font-bold" data-testid="text-alerts-sent">{lastRunResult.alertsSent}</div>
                    <div className="text-xs text-muted-foreground">Total Alerts Sent</div>
                  </div>
                  {Object.entries(lastRunResult.breakdown).map(([type, count]) => (
                    <div key={type} className="text-center p-3 rounded-md bg-muted/50">
                      <div className="text-2xl font-bold" data-testid={`text-alert-count-${type}`}>{count}</div>
                      <div className="text-xs text-muted-foreground">{formatAlertType(type)}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <h2 className="text-lg font-semibold">Alert History</h2>
              <p className="text-sm text-muted-foreground">Log of compliance alerts that have been sent.</p>
            </CardHeader>
            <CardContent className="p-0">
              {alertLogLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : logEntries.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold">No alerts sent yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Run a compliance check to scan for expiring items and send notifications.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-alert-log">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Entity</th>
                        <th className="text-left p-3 font-medium">Type</th>
                        <th className="text-left p-3 font-medium">Alert Type</th>
                        <th className="text-left p-3 font-medium">Days Before</th>
                        <th className="text-left p-3 font-medium">Recipient</th>
                        <th className="text-left p-3 font-medium">Sent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logEntries.map((entry) => (
                        <tr key={entry.id} className="border-b last:border-0" data-testid={`row-alert-${entry.id}`}>
                          <td className="p-3 font-medium" data-testid={`text-alert-entity-${entry.id}`}>
                            {entry.entity_name}
                          </td>
                          <td className="p-3">
                            <Badge variant="outline" className="capitalize">
                              {entry.entity_type}
                            </Badge>
                          </td>
                          <td className="p-3" data-testid={`badge-alert-type-${entry.id}`}>
                            {getAlertTypeBadge(entry.alert_type)}
                          </td>
                          <td className="p-3">
                            <Badge variant={entry.days_before <= 7 ? "destructive" : entry.days_before <= 14 ? "default" : "secondary"}>
                              {entry.days_before} days
                            </Badge>
                          </td>
                          <td className="p-3 text-muted-foreground" data-testid={`text-alert-recipient-${entry.id}`}>
                            {entry.recipient_email}
                          </td>
                          <td className="p-3 text-muted-foreground" data-testid={`text-alert-sent-${entry.id}`}>
                            {entry.sent_at ? new Date(entry.sent_at).toLocaleString() : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
