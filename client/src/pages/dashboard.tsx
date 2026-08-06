import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  ClipboardList, Users, ShieldCheck, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  FileText, FileX2, CalendarClock, XCircle, Check, Bell, Pencil, History, Send,
  Building2, Shield, MapPin, Briefcase, TrendingUp, Calendar, Eye, UserPlus,
  Activity, BarChart3, DollarSign, Truck, PoundSterling, Search, Radio,
  UserCheck, GraduationCap, Scale, Zap, Target, BookOpen, UserCog,
} from "lucide-react";
import type { OnboardingRecord } from "@shared/schema";
import type { Supplier } from "@shared/schema";
import { getRequiredSupplierDocumentTypes } from "@shared/supplierRequiredDocs";
import { getSupplierFieldLabel } from "@shared/supplierProfileFields";

type DocItem = {
  id: number;
  documentType: string;
  status?: "pending" | "approved" | "rejected";
  expiryDate?: string | null;
  createdAt?: string;
};
type FieldRequest = { id: number; fieldKey: string; message: string | null; requestedAt: string | null };
type PendingChange = { id: number; payload: Record<string, unknown>; status: string; createdAt: string; reviewedAt: string | null };
type NotificationItem = { id: number; type: string; title: string; body: string | null; readAt: string | null; createdAt: string };

type FinancialSummary = {
  totalInvoices: number;
  totalValue: string;
  totalPaid: string;
  totalOutstanding: string;
  pending: { count: number; amount: string };
  accepted: { count: number; amount: string };
  paid: { count: number; amount: string };
  overdue: { count: number; amount: string };
  recentPayments: Array<{ date: string; amount: number; bank_reference: string }>;
};

type DashboardStats = {
  employees: { active: number; total: number };
  sites: { active: number; total: number };
  clients: { total: number };
  suppliers: { active: number; pending: number; total: number };
  shifts: { todayTotal: number; scheduled: number; active: number; completed: number; noShow: number };
  incidents: { open: number; total: number };
  compliance: { siaExpiring: number; dbsExpiring: number; firstAidExpiring: number; totalAlerts: number; rate: number };
  onboarding: { pending: number; byStatus: { invited: number; inProgress: number; submitted: number; underReview: number; completed: number; rejected: number } };
  vetting: { inProgress: number; total: number };
  financial: { revenueThisMonth: string; outstanding: string; totalInvoices: number; paidInvoices: number };
  recruitment: { openJobs: number; newApplicants: number };
  recentActivity: Array<{ id: number; action: string; entityType: string | null; entityId: string | null; details: unknown; createdAt: string | null; userId: string | null }>;
  activeUsers: number;
};

type GradientKpiProps = {
  label: string;
  value: number | string;
  subtitle?: string;
  gradient: string;
  icon: React.ReactNode;
  href?: string;
  testId?: string;
};

function GradientKpiCard({ label, value, subtitle, gradient, icon, href, testId }: GradientKpiProps) {
  const content = (
    <div
      className={`relative overflow-hidden rounded-xl p-5 ${gradient} text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] cursor-pointer group`}
      data-testid={testId}
    >
      <div className="absolute top-3 right-3 opacity-20 group-hover:opacity-30 transition-opacity">
        <div className="w-12 h-12">{icon}</div>
      </div>
      <p className="text-sm font-medium text-white/80">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs text-white/70 mt-1">{subtitle}</p>}
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function KpiSkeleton() {
  return (
    <div className="rounded-xl p-5 bg-muted/50 animate-pulse">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-16 mb-1" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
      <div className={`h-2.5 rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function getDashboardView(role: string): "executive" | "operations" | "hr" | "compliance" | "finance" | "employee" | "supplier" {
  if (["super_admin", "tenant_admin", "ceo"].includes(role)) return "executive";
  if (["operations_manager", "regional_manager", "controller", "scheduler"].includes(role)) return "operations";
  if (["admin", "hr_manager", "training_manager"].includes(role)) return "hr";
  if (["compliance_manager"].includes(role)) return "compliance";
  if (["accountant", "payroll_manager"].includes(role)) return "finance";
  if (role === "supplier") return "supplier";
  return "employee";
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    tenant_admin: "Tenant Admin",
    ceo: "CEO",
    operations_manager: "Operations Manager",
    regional_manager: "Regional Manager",
    admin: "Admin",
    controller: "Controller",
    scheduler: "Scheduler",
    hr_manager: "HR Manager",
    compliance_manager: "Compliance Manager",
    accountant: "Accountant",
    payroll_manager: "Payroll Manager",
    training_manager: "Training Manager",
    supplier: "Supplier",
    employee: "Employee",
  };
  return labels[role] || role;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = user?.role || "employee";
  const view = getDashboardView(role);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    enabled: view !== "supplier" && view !== "employee",
  });

  const { data: onboarding } = useQuery<OnboardingRecord | null>({
    queryKey: ["/api/onboarding"],
    enabled: role === "employee",
  });

  const { data: supplier } = useQuery<Supplier>({
    queryKey: ["/api/supplier-portal/me"],
    enabled: role === "supplier",
  });

  const { data: documents = [] } = useQuery<DocItem[]>({
    queryKey: ["/api/supplier-portal/documents"],
    enabled: role === "supplier" && !!supplier?.id,
  });

  const { data: fieldRequests = [] } = useQuery<FieldRequest[]>({
    queryKey: ["/api/supplier-portal/field-requests"],
    enabled: role === "supplier" && !!supplier?.id,
  });

  const { data: pendingChanges = [] } = useQuery<PendingChange[]>({
    queryKey: ["/api/supplier-portal/pending-changes"],
    enabled: role === "supplier" && !!supplier?.id,
  });

  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ["/api/notifications"],
    enabled: role === "supplier",
  });

  const { data: financialSummary, isLoading: financialLoading } = useQuery<FinancialSummary>({
    queryKey: ["/api/supplier-portal/financial-summary"],
    enabled: role === "supplier" && !!supplier?.id,
  });

  const { data: probationsDue = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/probation-records/due-this-month"],
    enabled: view === "hr",
  });

  const isEmployee = role === "employee";
  const isSupplier = role === "supplier";
  const isAdmin = view !== "employee" && view !== "supplier";

  const requiredDocTypes = supplier ? getRequiredSupplierDocumentTypes(supplier) : [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in30Days = new Date(today);
  in30Days.setDate(in30Days.getDate() + 30);
  const missingCount = isSupplier
    ? requiredDocTypes.filter((type) => {
        const docsOfType = documents.filter((d) => d.documentType === type);
        const latest = [...docsOfType].sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime())[0];
        return !latest || latest.status !== "approved";
      }).length
    : 0;
  const expiringCount = isSupplier
    ? documents.filter((d) => d.status === "approved" && d.expiryDate && new Date(d.expiryDate).setHours(0, 0, 0, 0) <= in30Days.getTime()).length
    : 0;
  const rejectedCount = isSupplier ? documents.filter((d) => d.status === "rejected").length : 0;
  const supplierDocAlerts = missingCount > 0 || expiringCount > 0 || rejectedCount > 0;

  const expiringDocs = isSupplier
    ? documents
        .filter((d) => d.status === "approved" && d.expiryDate)
        .map((d) => {
          const exp = new Date(d.expiryDate!);
          exp.setHours(0, 0, 0, 0);
          return { ...d, isExpired: exp < today, isExpiring: exp >= today && exp <= in30Days };
        })
        .filter((d) => d.isExpired || d.isExpiring)
        .sort((a, b) => new Date(a.expiryDate!).getTime() - new Date(b.expiryDate!).getTime())
    : [];

  const pendingReview = pendingChanges.filter((c) => c.status === "pending");
  const recentRejected = pendingChanges.filter((c) => c.status === "rejected").slice(0, 3);
  const recentApproved = pendingChanges.filter((c) => c.status === "approved").slice(0, 3);
  const unreadNotifications = notifications.filter((n) => !n.readAt);
  const actionCount = fieldRequests.length + pendingReview.length + recentRejected.length + (supplierDocAlerts ? 1 : 0);

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="dashboard-page">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold truncate" data-testid="text-welcome">
            {getGreeting()}, {user?.firstName}
          </h1>
          <p className="text-muted-foreground text-sm">
            {isSupplier
              ? "Here's a summary of your supplier account and any actions required."
              : isEmployee
                ? "Here's an overview of your activity."
                : `${getRoleLabel(role)} Dashboard — here's your operational overview.`}
          </p>
        </div>
        <Badge variant="outline" className="text-xs hidden sm:inline-flex">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </Badge>
      </div>

      {isEmployee && onboarding && onboarding.status !== "completed" && (
        <Card className="border-[#FF8C42]/30 bg-gradient-to-r from-[#FF8C42]/5 to-transparent">
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 p-4 sm:p-5">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#FF8C42] to-[#e67a30] flex items-center justify-center flex-shrink-0 shadow-md">
                <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-sm sm:text-base">Complete Your Onboarding</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  You're on step {onboarding.currentStep} of {onboarding.totalSteps}.
                  {onboarding.status === "submitted" && " Your application is under review."}
                  {onboarding.status === "rejected" && " Please review the feedback and resubmit."}
                </p>
              </div>
            </div>
            <Link href="/onboarding" className="w-full sm:w-auto">
              <Button className="w-full sm:w-auto bg-gradient-to-r from-[#FF8C42] to-[#e67a30] hover:from-[#e67a30] hover:to-[#d06a20] text-white" data-testid="button-continue-onboarding">
                {onboarding.status === "submitted" ? "View Status" : "Continue"}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* ── Supplier dashboard (unchanged) ── */}
      {isSupplier && (
        <>
          {actionCount > 0 && (
            <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/20 dark:border-amber-800/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="font-semibold">
                    {actionCount} action{actionCount > 1 ? "s" : ""} required
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  You have items that need your attention. See details below.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card>
              <CardContent className="pt-4 pb-3 sm:pt-5 sm:pb-4 text-center">
                <div className={`text-2xl sm:text-3xl font-bold ${fieldRequests.length > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                  {fieldRequests.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Info requests</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 sm:pt-5 sm:pb-4 text-center">
                <div className={`text-2xl sm:text-3xl font-bold ${pendingReview.length > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                  {pendingReview.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Pending review</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 sm:pt-5 sm:pb-4 text-center">
                <div className={`text-2xl sm:text-3xl font-bold ${missingCount > 0 ? "text-amber-600" : "text-green-600"}`}>
                  {missingCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Missing docs</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3 sm:pt-5 sm:pb-4 text-center">
                <div className={`text-2xl sm:text-3xl font-bold ${unreadNotifications.length > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {unreadNotifications.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Unread alerts</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              {fieldRequests.length > 0 && (
                <Card className="border-amber-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Send className="w-4 h-4 text-amber-600" />
                      Information requested by admin
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {fieldRequests.map((req) => (
                        <li key={req.id} className="flex items-center justify-between gap-2 rounded border border-amber-200 p-3 text-sm">
                          <div>
                            <span className="font-medium">{getSupplierFieldLabel(req.fieldKey)}</span>
                            {req.message && <p className="text-xs text-muted-foreground mt-0.5">{req.message}</p>}
                          </div>
                          <Link href="/supplier-portal">
                            <Button size="sm" variant="outline">
                              <Pencil className="w-3 h-3 mr-1" /> Provide
                            </Button>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {recentRejected.length > 0 && (
                <Card className="border-destructive/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <XCircle className="w-4 h-4 text-destructive" />
                      Changes rejected
                    </CardTitle>
                    <CardDescription>These change requests were not approved. You may re-submit with corrections.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recentRejected.map((c) => {
                        const keys = Object.keys(c.payload).filter((k) => !["changeType", "evidenceDocumentIds", "bankProofDocumentId"].includes(k));
                        return (
                          <li key={c.id} className="rounded border border-destructive/30 p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="destructive">Rejected</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(c.reviewedAt ?? c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-1">Fields: {keys.map((k) => getSupplierFieldLabel(k)).join(", ")}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {pendingReview.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Changes awaiting admin review
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {pendingReview.map((c) => {
                        const keys = Object.keys(c.payload).filter((k) => !["changeType", "evidenceDocumentIds", "bankProofDocumentId"].includes(k));
                        return (
                          <li key={c.id} className="rounded border p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">Pending review</Badge>
                              <span className="text-xs text-muted-foreground">
                                Submitted {new Date(c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-1">Fields: {keys.map((k) => getSupplierFieldLabel(k)).join(", ")}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {recentApproved.length > 0 && (
                <Card className="border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      Recently approved
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recentApproved.map((c) => {
                        const keys = Object.keys(c.payload).filter((k) => !["changeType", "evidenceDocumentIds", "bankProofDocumentId"].includes(k));
                        return (
                          <li key={c.id} className="rounded border border-green-200 p-3 text-sm">
                            <div className="flex items-center gap-2">
                              <Badge>Approved</Badge>
                              <span className="text-xs text-muted-foreground">
                                {new Date(c.reviewedAt ?? c.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                              </span>
                            </div>
                            <p className="text-muted-foreground mt-1">Fields: {keys.map((k) => getSupplierFieldLabel(k)).join(", ")}</p>
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card className={supplierDocAlerts ? "border-amber-200" : "border-green-200"}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Document status
                    </CardTitle>
                    <Link href="/supplier-documents">
                      <Button size="sm" variant="outline">
                        Manage documents <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {supplierDocAlerts ? (
                      <>
                        {missingCount > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <FileX2 className="w-4 h-4 text-amber-600" />
                            <span>Missing / not approved:</span>
                            <Badge variant="secondary">{missingCount}</Badge>
                          </div>
                        )}
                        {expiringCount > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <CalendarClock className="w-4 h-4 text-amber-600" />
                            <span>Expiring soon:</span>
                            <Badge variant="secondary">{expiringCount}</Badge>
                          </div>
                        )}
                        {rejectedCount > 0 && (
                          <div className="flex items-center gap-2 text-sm">
                            <XCircle className="w-4 h-4 text-destructive" />
                            <span>Rejected:</span>
                            <Badge variant="destructive">{rejectedCount}</Badge>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                        <Check className="w-4 h-4" />
                        All documents in order
                      </div>
                    )}
                  </div>
                  {expiringDocs.length > 0 && (
                    <div className="mt-3 pt-3 border-t space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Expiring / expired</p>
                      {expiringDocs.map((d) => {
                        const expDate = new Date(d.expiryDate!).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                        return (
                          <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              {d.isExpired
                                ? <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                                : <CalendarClock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                              <span className="truncate">{d.documentType}</span>
                            </div>
                            <Badge variant={d.isExpired ? "destructive" : "secondary"} className="shrink-0 text-xs">
                              {d.isExpired ? "Expired" : "Expires"} {expDate}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {actionCount === 0 && (
                <Card className="border-green-200 bg-green-50/30 dark:bg-green-950/20">
                  <CardContent className="p-5 flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 shrink-0" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">All clear</p>
                      <p className="text-sm text-muted-foreground">No actions required right now. You are up to date.</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Quick links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Link href="/supplier-portal">
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Building2 className="w-4 h-4 mr-2" /> My Profile
                    </Button>
                  </Link>
                  <Link href="/supplier-documents">
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <FileText className="w-4 h-4 mr-2" /> Documents
                    </Button>
                  </Link>
                  <Link href="/supplier-policies">
                    <Button variant="outline" className="w-full justify-start" size="sm">
                      <Shield className="w-4 h-4 mr-2" /> Policies
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              {supplier && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Account</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Company</span>
                      <span className="font-medium">{supplier.companyName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={supplier.status === "approved" || supplier.status === "active" ? "default" : "secondary"}>
                        {supplier.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type</span>
                      <span className="font-medium capitalize">{supplier.supplierType}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {unreadNotifications.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Bell className="w-4 h-4" /> Recent alerts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {unreadNotifications.slice(0, 5).map((n) => (
                        <li key={n.id} className="rounded border border-primary/20 p-2 text-sm">
                          <p className="font-medium">{n.title}</p>
                          {n.body && <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="text-base flex items-center gap-2">
                  <PoundSterling className="w-4 h-4" />
                  Financial Overview
                </CardTitle>
                <Link href="/supplier-invoices">
                  <Button size="sm" variant="outline" data-testid="link-view-all-invoices">
                    View All Invoices <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {financialLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border p-3 animate-pulse">
                      <Skeleton className="h-3 w-20 mb-2" />
                      <Skeleton className="h-7 w-16 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  ))}
                </div>
              ) : financialSummary ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-lg border p-3 text-center" data-testid="kpi-total-earned">
                      <p className="text-xs text-muted-foreground mb-1">Total Earned</p>
                      <p className="text-xl sm:text-2xl font-bold text-green-600">
                        {"\u00A3"}{parseFloat(financialSummary.totalPaid).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{financialSummary.paid.count} invoice{financialSummary.paid.count !== 1 ? "s" : ""} paid</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" data-testid="kpi-pending-review">
                      <p className="text-xs text-muted-foreground mb-1">Pending Review</p>
                      <p className={`text-xl sm:text-2xl font-bold ${financialSummary.pending.count > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {"\u00A3"}{parseFloat(financialSummary.pending.amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{financialSummary.pending.count} invoice{financialSummary.pending.count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" data-testid="kpi-paid">
                      <p className="text-xs text-muted-foreground mb-1">Accepted</p>
                      <p className={`text-xl sm:text-2xl font-bold ${financialSummary.accepted.count > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                        {"\u00A3"}{parseFloat(financialSummary.accepted.amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{financialSummary.accepted.count} invoice{financialSummary.accepted.count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="rounded-lg border p-3 text-center" data-testid="kpi-outstanding">
                      <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                      <p className={`text-xl sm:text-2xl font-bold ${parseFloat(financialSummary.totalOutstanding) > 0 ? "text-rose-600" : "text-muted-foreground"}`}>
                        {"\u00A3"}{parseFloat(financialSummary.totalOutstanding).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{financialSummary.totalInvoices - financialSummary.paid.count} unpaid</p>
                    </div>
                  </div>

                  {financialSummary.recentPayments.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Recent Payments</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm" data-testid="table-recent-payments">
                          <thead>
                            <tr className="border-b text-muted-foreground text-xs">
                              <th className="text-left py-2 pr-4 font-medium">Date</th>
                              <th className="text-right py-2 px-4 font-medium">Amount</th>
                              <th className="text-left py-2 pl-4 font-medium">Bank Reference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {financialSummary.recentPayments.map((p, i) => (
                              <tr key={i} className="border-b last:border-0" data-testid={`row-payment-${i}`}>
                                <td className="py-2 pr-4 whitespace-nowrap">
                                  {new Date(p.date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                                </td>
                                <td className="py-2 px-4 text-right font-medium whitespace-nowrap">
                                  {"\u00A3"}{Number(p.amount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-2 pl-4 text-muted-foreground truncate max-w-[200px]">
                                  {p.bank_reference || "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {financialSummary.recentPayments.length === 0 && financialSummary.totalInvoices === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">No invoices or payments recorded yet.</p>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>
        </>
      )}

      {/* ── Employee dashboard ── */}
      {isEmployee && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-br from-[#1F3A5F] to-[#2a4d7a] text-white shadow-lg">
              <div className="absolute top-3 right-3 opacity-20">
                <ClipboardList className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-white/80">Onboarding Status</p>
              <div className="mt-1.5 sm:mt-2">
                <Badge className={`${onboarding?.status === "completed" ? "bg-green-500" : "bg-white/20"} text-white border-0`}>
                  {onboarding?.status?.replace("_", " ") || "Not Started"}
                </Badge>
              </div>
              <p className="text-xs text-white/60 mt-1.5 sm:mt-2">
                Step {onboarding?.currentStep || 0} of {onboarding?.totalSteps || 10}
              </p>
            </div>
            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg">
              <div className="absolute top-3 right-3 opacity-20">
                <FileText className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-white/80">My Documents</p>
              <p className="text-2xl sm:text-3xl font-bold mt-1">0</p>
              <p className="text-xs text-white/60 mt-1">Uploaded documents</p>
            </div>
            <div className="relative overflow-hidden rounded-xl p-4 sm:p-5 bg-gradient-to-br from-violet-500 to-violet-600 text-white shadow-lg">
              <div className="absolute top-3 right-3 opacity-20">
                <ShieldCheck className="w-10 h-10 sm:w-12 sm:h-12" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-white/80">Compliance</p>
              <div className="mt-1.5 sm:mt-2">
                <Badge className="bg-white/20 text-white border-0">
                  <Clock className="w-3 h-3 mr-1" /> Pending
                </Badge>
              </div>
              <p className="text-xs text-white/60 mt-1.5 sm:mt-2">Vetting checks status</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                  <CardTitle className="text-base">Quick Actions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/my-shifts">
                  <Button variant="outline" className="w-full justify-start" size="sm" data-testid="link-my-shifts">
                    <Calendar className="w-4 h-4 mr-2 text-[#1F3A5F]" /> My Shifts
                  </Button>
                </Link>
                <Link href="/my-documents">
                  <Button variant="outline" className="w-full justify-start" size="sm" data-testid="link-my-documents">
                    <FileText className="w-4 h-4 mr-2 text-[#1F3A5F]" /> My Documents
                  </Button>
                </Link>
                <Link href="/my-profile">
                  <Button variant="outline" className="w-full justify-start" size="sm" data-testid="link-my-profile">
                    <Users className="w-4 h-4 mr-2 text-[#1F3A5F]" /> My Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ── Admin dashboards (role-grouped) ── */}
      {isAdmin && (
        <>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <KpiSkeleton key={i} />)}
            </div>
          ) : stats ? (
            <>
              {/* ── Executive View ── */}
              {view === "executive" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <GradientKpiCard
                      label="Active Employees"
                      value={stats.employees.active}
                      subtitle={`${stats.employees.total} total`}
                      gradient="bg-gradient-to-br from-[#1F3A5F] to-[#2a5a8f]"
                      icon={<Users className="w-12 h-12" />}
                      href="/employees"
                      testId="kpi-employees"
                    />
                    <GradientKpiCard
                      label="Active Sites"
                      value={stats.sites.active}
                      subtitle={`${stats.sites.total} total`}
                      gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
                      icon={<MapPin className="w-12 h-12" />}
                      href="/sites"
                      testId="kpi-sites"
                    />
                    <GradientKpiCard
                      label="Clients"
                      value={stats.clients.total}
                      subtitle="Total clients"
                      gradient="bg-gradient-to-br from-blue-500 to-blue-700"
                      icon={<Building2 className="w-12 h-12" />}
                      href="/clients"
                      testId="kpi-clients"
                    />
                    <GradientKpiCard
                      label="Active Suppliers"
                      value={stats.suppliers.active}
                      subtitle={`${stats.suppliers.pending} pending`}
                      gradient="bg-gradient-to-br from-violet-500 to-violet-700"
                      icon={<Truck className="w-12 h-12" />}
                      href="/suppliers"
                      testId="kpi-suppliers"
                    />
                    <GradientKpiCard
                      label="Today's Shifts"
                      value={stats.shifts.todayTotal}
                      subtitle={`${stats.shifts.active} active now`}
                      gradient="bg-gradient-to-br from-[#FF8C42] to-[#e06820]"
                      icon={<Calendar className="w-12 h-12" />}
                      href="/scheduling"
                      testId="kpi-shifts"
                    />
                    <GradientKpiCard
                      label="Open Incidents"
                      value={stats.incidents.open}
                      subtitle={`${stats.incidents.total} total`}
                      gradient={stats.incidents.open > 0 ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-gray-400 to-gray-600"}
                      icon={<AlertTriangle className="w-12 h-12" />}
                      href="/control-room"
                      testId="kpi-incidents"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                            <CardTitle className="text-base">Today's Operations</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-blue-600">{stats.shifts.scheduled}</div>
                              <p className="text-xs text-muted-foreground">Scheduled</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center border-green-200 bg-green-50/50">
                              <div className="text-2xl font-bold text-green-600">{stats.shifts.active}</div>
                              <p className="text-xs text-muted-foreground">In Progress</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-gray-600">{stats.shifts.completed}</div>
                              <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                            <div className={`rounded-lg border p-3 text-center ${stats.shifts.noShow > 0 ? "border-rose-200 bg-rose-50/50" : ""}`}>
                              <div className={`text-2xl font-bold ${stats.shifts.noShow > 0 ? "text-rose-600" : "text-gray-400"}`}>{stats.shifts.noShow}</div>
                              <p className="text-xs text-muted-foreground">No-Shows</p>
                            </div>
                          </div>

                          {stats.shifts.todayTotal > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Shift completion</p>
                              <ProgressBar value={stats.shifts.completed} max={stats.shifts.todayTotal} color="bg-gradient-to-r from-green-400 to-emerald-500" />
                              <p className="text-xs text-muted-foreground mt-1">{Math.round((stats.shifts.completed / stats.shifts.todayTotal) * 100)}% complete</p>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 pt-2">
                            <Link href="/control-room">
                              <Button size="sm" className="bg-gradient-to-r from-[#1F3A5F] to-[#2a5a8f] text-white hover:from-[#2a4d7a] hover:to-[#1F3A5F]" data-testid="button-control-room">
                                <Radio className="w-4 h-4 mr-1" /> Control Room
                              </Button>
                            </Link>
                            <Link href="/scheduling">
                              <Button size="sm" variant="outline" data-testid="button-scheduling">
                                <Calendar className="w-4 h-4 mr-1" /> Scheduling
                              </Button>
                            </Link>
                            <Link href="/deployment-map">
                              <Button size="sm" variant="outline" data-testid="button-map">
                                <MapPin className="w-4 h-4 mr-1" /> Map
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                            <CardTitle className="text-base">Compliance Overview</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Overall Compliance Rate</span>
                            <span className={`text-2xl font-bold ${stats.compliance.rate >= 80 ? "text-green-600" : stats.compliance.rate >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                              {stats.compliance.rate}%
                            </span>
                          </div>
                          <ProgressBar
                            value={stats.compliance.rate}
                            max={100}
                            color={stats.compliance.rate >= 80 ? "bg-gradient-to-r from-green-400 to-emerald-500" : stats.compliance.rate >= 50 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-rose-400 to-red-500"}
                          />
                          <div className="grid grid-cols-3 gap-3">
                            <div className={`rounded-lg border p-3 text-center ${stats.compliance.siaExpiring > 0 ? "border-amber-200 bg-amber-50/50" : ""}`}>
                              <Shield className={`w-5 h-5 mx-auto mb-1 ${stats.compliance.siaExpiring > 0 ? "text-amber-600" : "text-green-600"}`} />
                              <div className={`text-xl font-bold ${stats.compliance.siaExpiring > 0 ? "text-amber-600" : "text-green-600"}`}>{stats.compliance.siaExpiring}</div>
                              <p className="text-xs text-muted-foreground">SIA Expiring</p>
                            </div>
                            <div className={`rounded-lg border p-3 text-center ${stats.compliance.dbsExpiring > 0 ? "border-amber-200 bg-amber-50/50" : ""}`}>
                              <Search className={`w-5 h-5 mx-auto mb-1 ${stats.compliance.dbsExpiring > 0 ? "text-amber-600" : "text-green-600"}`} />
                              <div className={`text-xl font-bold ${stats.compliance.dbsExpiring > 0 ? "text-amber-600" : "text-green-600"}`}>{stats.compliance.dbsExpiring}</div>
                              <p className="text-xs text-muted-foreground">DBS Expiring</p>
                            </div>
                            <div className={`rounded-lg border p-3 text-center ${stats.compliance.firstAidExpiring > 0 ? "border-amber-200 bg-amber-50/50" : ""}`}>
                              <ShieldCheck className={`w-5 h-5 mx-auto mb-1 ${stats.compliance.firstAidExpiring > 0 ? "text-amber-600" : "text-green-600"}`} />
                              <div className={`text-xl font-bold ${stats.compliance.firstAidExpiring > 0 ? "text-amber-600" : "text-green-600"}`}>{stats.compliance.firstAidExpiring}</div>
                              <p className="text-xs text-muted-foreground">First Aid Expiring</p>
                            </div>
                          </div>
                          <Link href="/compliance">
                            <Button size="sm" variant="outline" className="w-full" data-testid="link-compliance">
                              View Full Compliance Dashboard <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-400 to-blue-600" />
                            <CardTitle className="text-base">Financial Snapshot</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg border p-3">
                              <PoundSterling className="w-4 h-4 text-green-600 mb-1" />
                              <div className="text-lg font-bold text-green-600">{"\u00A3"}{parseFloat(stats.financial.revenueThisMonth).toLocaleString()}</div>
                              <p className="text-xs text-muted-foreground">Revenue This Month</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <Clock className="w-4 h-4 text-amber-600 mb-1" />
                              <div className="text-lg font-bold text-amber-600">{"\u00A3"}{parseFloat(stats.financial.outstanding).toLocaleString()}</div>
                              <p className="text-xs text-muted-foreground">Outstanding</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <FileText className="w-4 h-4 text-blue-600 mb-1" />
                              <div className="text-lg font-bold">{stats.financial.totalInvoices}</div>
                              <p className="text-xs text-muted-foreground">Total Invoices</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <CheckCircle2 className="w-4 h-4 text-green-600 mb-1" />
                              <div className="text-lg font-bold">{stats.financial.paidInvoices}</div>
                              <p className="text-xs text-muted-foreground">Paid Invoices</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
                            <CardTitle className="text-base">Onboarding Pipeline</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {[
                            { label: "Invited", count: stats.onboarding.byStatus.invited, color: "bg-blue-400" },
                            { label: "In Progress", count: stats.onboarding.byStatus.inProgress, color: "bg-amber-400" },
                            { label: "Submitted", count: stats.onboarding.byStatus.submitted, color: "bg-violet-400" },
                            { label: "Under Review", count: stats.onboarding.byStatus.underReview, color: "bg-orange-400" },
                            { label: "Completed", count: stats.onboarding.byStatus.completed, color: "bg-green-500" },
                            { label: "Rejected", count: stats.onboarding.byStatus.rejected, color: "bg-rose-500" },
                          ].map((stage) => (
                            <div key={stage.label} className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                              <span className="text-sm flex-1">{stage.label}</span>
                              <span className="text-sm font-semibold">{stage.count}</span>
                            </div>
                          ))}
                          <Link href="/admin-onboarding">
                            <Button size="sm" variant="outline" className="w-full mt-2" data-testid="link-onboarding">
                              Manage Onboarding <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-rose-400 to-rose-600" />
                            <CardTitle className="text-base">Recruitment</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-2">
                              <Briefcase className="w-4 h-4 text-blue-600" />
                              <span className="text-sm">Open Positions</span>
                            </div>
                            <span className="text-lg font-bold text-blue-600">{stats.recruitment.openJobs}</span>
                          </div>
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div className="flex items-center gap-2">
                              <UserPlus className="w-4 h-4 text-violet-600" />
                              <span className="text-sm">New Applicants</span>
                            </div>
                            <span className="text-lg font-bold text-violet-600">{stats.recruitment.newApplicants}</span>
                          </div>
                          <Link href="/recruitment">
                            <Button size="sm" variant="outline" className="w-full" data-testid="link-recruitment">
                              View Recruitment <ArrowRight className="w-4 h-4 ml-1" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-gray-400 to-gray-600" />
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Link href="/employees">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm" data-testid="link-employees">
                              <Users className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Manage Employees
                            </Button>
                          </Link>
                          <Link href="/reports">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm" data-testid="link-reports">
                              <BarChart3 className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Reports & Analytics
                            </Button>
                          </Link>
                          <Link href="/self-billing">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm" data-testid="link-finance">
                              <PoundSterling className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Self-Billing
                            </Button>
                          </Link>
                          <Link href="/audit-trail">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm" data-testid="link-audit">
                              <History className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Audit Trail
                            </Button>
                          </Link>
                          <Link href="/settings">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm" data-testid="link-settings">
                              <Zap className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Settings
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {stats.recentActivity.length > 0 ? (
                            <ul className="space-y-3">
                              {stats.recentActivity.slice(0, 5).map((log) => (
                                <li key={log.id} className="flex items-start gap-3 text-sm">
                                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                    log.action?.includes("create") ? "bg-green-500" :
                                    log.action?.includes("delete") ? "bg-rose-500" :
                                    log.action?.includes("update") ? "bg-blue-500" :
                                    "bg-gray-400"
                                  }`} />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate capitalize">{log.action?.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {log.entityType && <span className="capitalize">{log.entityType}</span>}
                                      {log.entityId && <span> #{log.entityId}</span>}
                                      {log.createdAt && (
                                        <span> · {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                      )}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              )}

              {/* ── Operations View ── */}
              {view === "operations" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <GradientKpiCard
                      label="Today's Shifts"
                      value={stats.shifts.todayTotal}
                      subtitle={`${stats.shifts.scheduled} upcoming`}
                      gradient="bg-gradient-to-br from-[#1F3A5F] to-[#2a5a8f]"
                      icon={<Calendar className="w-12 h-12" />}
                      href="/scheduling"
                      testId="kpi-shifts"
                    />
                    <GradientKpiCard
                      label="Active Now"
                      value={stats.shifts.active}
                      subtitle="In progress"
                      gradient="bg-gradient-to-br from-green-500 to-green-700"
                      icon={<Activity className="w-12 h-12" />}
                      href="/control-room"
                      testId="kpi-active"
                    />
                    <GradientKpiCard
                      label="No-Shows"
                      value={stats.shifts.noShow}
                      subtitle="Today"
                      gradient={stats.shifts.noShow > 0 ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-gray-400 to-gray-600"}
                      icon={<XCircle className="w-12 h-12" />}
                      href="/control-room"
                      testId="kpi-noshow"
                    />
                    <GradientKpiCard
                      label="Open Incidents"
                      value={stats.incidents.open}
                      subtitle={`${stats.incidents.total} total`}
                      gradient={stats.incidents.open > 0 ? "bg-gradient-to-br from-amber-500 to-amber-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}
                      icon={<AlertTriangle className="w-12 h-12" />}
                      href="/control-room"
                      testId="kpi-incidents"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                            <CardTitle className="text-base">Shift Status Breakdown</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-blue-600">{stats.shifts.scheduled}</div>
                              <p className="text-xs text-muted-foreground">Scheduled</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center border-green-200 bg-green-50/50">
                              <div className="text-2xl font-bold text-green-600">{stats.shifts.active}</div>
                              <p className="text-xs text-muted-foreground">In Progress</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-gray-600">{stats.shifts.completed}</div>
                              <p className="text-xs text-muted-foreground">Completed</p>
                            </div>
                            <div className={`rounded-lg border p-3 text-center ${stats.shifts.noShow > 0 ? "border-rose-200 bg-rose-50/50" : ""}`}>
                              <div className={`text-2xl font-bold ${stats.shifts.noShow > 0 ? "text-rose-600" : "text-gray-400"}`}>{stats.shifts.noShow}</div>
                              <p className="text-xs text-muted-foreground">No-Shows</p>
                            </div>
                          </div>

                          {stats.shifts.todayTotal > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-2">Shift completion</p>
                              <ProgressBar value={stats.shifts.completed} max={stats.shifts.todayTotal} color="bg-gradient-to-r from-green-400 to-emerald-500" />
                              <p className="text-xs text-muted-foreground mt-1">{Math.round((stats.shifts.completed / stats.shifts.todayTotal) * 100)}% complete</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                            <CardTitle className="text-base">Operational Stats</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <div className="rounded-lg border p-3">
                              <MapPin className="w-4 h-4 text-emerald-600 mb-1" />
                              <div className="text-lg font-bold">{stats.sites.active}</div>
                              <p className="text-xs text-muted-foreground">Active Sites</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <Users className="w-4 h-4 text-blue-600 mb-1" />
                              <div className="text-lg font-bold">{stats.employees.active}</div>
                              <p className="text-xs text-muted-foreground">Active Officers</p>
                            </div>
                            <div className="rounded-lg border p-3">
                              <Truck className="w-4 h-4 text-violet-600 mb-1" />
                              <div className="text-lg font-bold">{stats.suppliers.active}</div>
                              <p className="text-xs text-muted-foreground">Active Suppliers</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#1F3A5F] to-[#2a5a8f]" />
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Link href="/control-room">
                            <Button size="sm" className="w-full justify-start bg-gradient-to-r from-[#1F3A5F] to-[#2a5a8f] text-white hover:from-[#2a4d7a] hover:to-[#1F3A5F]" data-testid="button-control-room">
                              <Radio className="w-4 h-4 mr-2" /> Control Room
                            </Button>
                          </Link>
                          <Link href="/scheduling">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Calendar className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Scheduling
                            </Button>
                          </Link>
                          <Link href="/deployment-map">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <MapPin className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Deployment Map
                            </Button>
                          </Link>
                          <Link href="/ai-scheduling">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Zap className="w-4 h-4 mr-2 text-[#FF8C42]" /> AI Scheduling
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {stats.recentActivity.length > 0 ? (
                            <ul className="space-y-3">
                              {stats.recentActivity.slice(0, 5).map((log) => (
                                <li key={log.id} className="flex items-start gap-3 text-sm">
                                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                    log.action?.includes("create") ? "bg-green-500" :
                                    log.action?.includes("delete") ? "bg-rose-500" :
                                    "bg-blue-500"
                                  }`} />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate capitalize">{log.action?.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {log.entityType && <span className="capitalize">{log.entityType}</span>}
                                      {log.createdAt && <span> · {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              )}

              {/* ── HR / Admin View ── */}
              {view === "hr" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <GradientKpiCard
                      label="Active Employees"
                      value={stats.employees.active}
                      subtitle={`${stats.employees.total} total`}
                      gradient="bg-gradient-to-br from-[#1F3A5F] to-[#2a5a8f]"
                      icon={<Users className="w-12 h-12" />}
                      href="/employees"
                      testId="kpi-employees"
                    />
                    <GradientKpiCard
                      label="Pending Onboarding"
                      value={stats.onboarding.pending}
                      subtitle="Awaiting completion"
                      gradient="bg-gradient-to-br from-[#FF8C42] to-[#e06820]"
                      icon={<ClipboardList className="w-12 h-12" />}
                      href="/admin-onboarding"
                      testId="kpi-onboarding"
                    />
                    <GradientKpiCard
                      label="Vetting In Progress"
                      value={stats.vetting.inProgress}
                      subtitle={`${stats.vetting.total} total checks`}
                      gradient="bg-gradient-to-br from-violet-500 to-violet-700"
                      icon={<Search className="w-12 h-12" />}
                      href="/vetting"
                      testId="kpi-vetting"
                    />
                    <GradientKpiCard
                      label="Compliance Alerts"
                      value={stats.compliance.totalAlerts}
                      subtitle="Expiring in 30 days"
                      gradient={stats.compliance.totalAlerts > 0 ? "bg-gradient-to-br from-amber-500 to-amber-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}
                      icon={<AlertTriangle className="w-12 h-12" />}
                      href="/compliance"
                      testId="kpi-compliance"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
                            <CardTitle className="text-base">Onboarding Pipeline</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {[
                            { label: "Invited", count: stats.onboarding.byStatus.invited, color: "bg-blue-500", bgColor: "bg-blue-100" },
                            { label: "In Progress", count: stats.onboarding.byStatus.inProgress, color: "bg-amber-500", bgColor: "bg-amber-100" },
                            { label: "Submitted", count: stats.onboarding.byStatus.submitted, color: "bg-violet-500", bgColor: "bg-violet-100" },
                            { label: "Under Review", count: stats.onboarding.byStatus.underReview, color: "bg-orange-500", bgColor: "bg-orange-100" },
                            { label: "Completed", count: stats.onboarding.byStatus.completed, color: "bg-green-500", bgColor: "bg-green-100" },
                            { label: "Rejected", count: stats.onboarding.byStatus.rejected, color: "bg-rose-500", bgColor: "bg-rose-100" },
                          ].map((stage) => {
                            const total = Object.values(stats.onboarding.byStatus).reduce((a, b) => a + b, 0);
                            return (
                              <div key={stage.label}>
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2.5 h-2.5 rounded-full ${stage.color}`} />
                                    <span className="text-sm">{stage.label}</span>
                                  </div>
                                  <span className="text-sm font-semibold">{stage.count}</span>
                                </div>
                                <ProgressBar value={stage.count} max={Math.max(total, 1)} color={stage.color} />
                              </div>
                            );
                          })}
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                            <CardTitle className="text-base">Compliance Overview</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Compliance Rate</span>
                            <span className={`text-2xl font-bold ${stats.compliance.rate >= 80 ? "text-green-600" : stats.compliance.rate >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                              {stats.compliance.rate}%
                            </span>
                          </div>
                          <ProgressBar
                            value={stats.compliance.rate}
                            max={100}
                            color={stats.compliance.rate >= 80 ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-amber-400 to-orange-500"}
                          />
                          <div className="grid grid-cols-3 gap-3">
                            <div className="rounded-lg border p-3 text-center">
                              <div className={`text-xl font-bold ${stats.compliance.siaExpiring > 0 ? "text-amber-600" : "text-green-600"}`}>{stats.compliance.siaExpiring}</div>
                              <p className="text-xs text-muted-foreground">SIA Expiring</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <div className={`text-xl font-bold ${stats.compliance.dbsExpiring > 0 ? "text-amber-600" : "text-green-600"}`}>{stats.compliance.dbsExpiring}</div>
                              <p className="text-xs text-muted-foreground">DBS Expiring</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <div className={`text-xl font-bold ${stats.compliance.firstAidExpiring > 0 ? "text-amber-600" : "text-green-600"}`}>{stats.compliance.firstAidExpiring}</div>
                              <p className="text-xs text-muted-foreground">First Aid Expiring</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm border-[#FF8C42]/20" data-testid="card-probations-due-this-month">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e06820]" />
                              <CardTitle className="text-base">Probations Due This Month</CardTitle>
                            </div>
                            <Badge variant="outline" className={`text-xs ${probationsDue.length > 0 ? "border-[#FF8C42] text-[#FF8C42]" : "border-green-500 text-green-600"}`}>
                              {probationsDue.length}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {probationsDue.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-2">No reviews due this month</p>
                          ) : (
                            <div className="space-y-2">
                              {probationsDue.slice(0, 5).map((r: any) => {
                                const effectiveDate = r.extendedReviewDate || r.reviewDate;
                                const days = effectiveDate ? Math.ceil((new Date(effectiveDate).getTime() - Date.now()) / 86400000) : null;
                                return (
                                  <div key={r.id} className="flex items-center justify-between py-1.5 border-b last:border-0" data-testid={`probation-due-row-${r.id}`}>
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">
                                        {r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : `Employee #${r.employeeId}`}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {effectiveDate ? new Date(effectiveDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—"}
                                        {r.status === "extended" && <span className="ml-1 text-amber-600">(extended)</span>}
                                      </p>
                                    </div>
                                    <Badge className={`text-xs shrink-0 ml-2 ${days !== null && days <= 7 ? "bg-rose-100 text-rose-700 border-rose-200" : "bg-amber-100 text-amber-700 border-amber-200"}`} variant="outline">
                                      {days !== null ? (days <= 0 ? "Overdue" : `${days}d`) : "—"}
                                    </Badge>
                                  </div>
                                );
                              })}
                              {probationsDue.length > 5 && (
                                <p className="text-xs text-muted-foreground text-center pt-1">+{probationsDue.length - 5} more</p>
                              )}
                            </div>
                          )}
                          <Link href="/probation">
                            <Button variant="ghost" size="sm" className="w-full mt-3 text-[#1F3A5F] hover:bg-[#1F3A5F]/5" data-testid="button-view-all-probations">
                              <UserCog className="w-4 h-4 mr-2" /> View All Probations <ArrowRight className="w-3 h-3 ml-auto" />
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#1F3A5F] to-[#2a5a8f]" />
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Link href="/employees">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Users className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Manage Employees
                            </Button>
                          </Link>
                          <Link href="/admin-onboarding">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <ClipboardList className="w-4 h-4 mr-2 text-[#FF8C42]" /> Onboarding
                            </Button>
                          </Link>
                          <Link href="/probation">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <UserCog className="w-4 h-4 mr-2 text-[#FF8C42]" /> Probation Tracking
                            </Button>
                          </Link>
                          <Link href="/vetting">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Search className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Vetting
                            </Button>
                          </Link>
                          <Link href="/compliance">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <ShieldCheck className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Compliance
                            </Button>
                          </Link>
                          <Link href="/data-import">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Target className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Data Import
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {stats.recentActivity.length > 0 ? (
                            <ul className="space-y-3">
                              {stats.recentActivity.slice(0, 5).map((log) => (
                                <li key={log.id} className="flex items-start gap-3 text-sm">
                                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                    log.action?.includes("create") ? "bg-green-500" :
                                    log.action?.includes("delete") ? "bg-rose-500" :
                                    "bg-blue-500"
                                  }`} />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate capitalize">{log.action?.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {log.entityType && <span className="capitalize">{log.entityType}</span>}
                                      {log.createdAt && <span> · {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              )}

              {/* ── Compliance View ── */}
              {view === "compliance" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <GradientKpiCard
                      label="SIA Expiring"
                      value={stats.compliance.siaExpiring}
                      subtitle="Within 30 days"
                      gradient={stats.compliance.siaExpiring > 0 ? "bg-gradient-to-br from-amber-500 to-amber-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}
                      icon={<Shield className="w-12 h-12" />}
                      href="/compliance"
                      testId="kpi-sia"
                    />
                    <GradientKpiCard
                      label="DBS Expiring"
                      value={stats.compliance.dbsExpiring}
                      subtitle="Within 30 days"
                      gradient={stats.compliance.dbsExpiring > 0 ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}
                      icon={<Search className="w-12 h-12" />}
                      href="/compliance"
                      testId="kpi-dbs"
                    />
                    <GradientKpiCard
                      label="First Aid Expiring"
                      value={stats.compliance.firstAidExpiring}
                      subtitle="Within 30 days"
                      gradient={stats.compliance.firstAidExpiring > 0 ? "bg-gradient-to-br from-orange-500 to-orange-700" : "bg-gradient-to-br from-emerald-500 to-emerald-700"}
                      icon={<ShieldCheck className="w-12 h-12" />}
                      href="/compliance"
                      testId="kpi-firstaid"
                    />
                    <GradientKpiCard
                      label="Compliance Rate"
                      value={`${stats.compliance.rate}%`}
                      subtitle="Overall score"
                      gradient={stats.compliance.rate >= 80 ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-amber-500 to-amber-700"}
                      icon={<Target className="w-12 h-12" />}
                      href="/compliance"
                      testId="kpi-rate"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                            <CardTitle className="text-base">Compliance Health</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Overall Compliance</span>
                            <span className={`text-3xl font-bold ${stats.compliance.rate >= 80 ? "text-green-600" : stats.compliance.rate >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                              {stats.compliance.rate}%
                            </span>
                          </div>
                          <ProgressBar
                            value={stats.compliance.rate}
                            max={100}
                            color={stats.compliance.rate >= 80 ? "bg-gradient-to-r from-green-400 to-emerald-500" : stats.compliance.rate >= 50 ? "bg-gradient-to-r from-amber-400 to-orange-500" : "bg-gradient-to-r from-rose-400 to-red-500"}
                          />

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                            {[
                              { label: "SIA Licence", expiring: stats.compliance.siaExpiring, icon: <Shield className="w-5 h-5" />, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
                              { label: "DBS Check", expiring: stats.compliance.dbsExpiring, icon: <Search className="w-5 h-5" />, color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
                              { label: "First Aid", expiring: stats.compliance.firstAidExpiring, icon: <ShieldCheck className="w-5 h-5" />, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
                            ].map((item) => (
                              <div key={item.label} className={`rounded-lg border p-4 ${item.bg}`}>
                                <div className={`flex items-center gap-2 ${item.color} mb-2`}>
                                  {item.icon}
                                  <span className="font-medium text-sm">{item.label}</span>
                                </div>
                                <div className={`text-2xl font-bold ${item.expiring > 0 ? "text-amber-600" : "text-green-600"}`}>
                                  {item.expiring}
                                </div>
                                <p className="text-xs text-muted-foreground">{item.expiring > 0 ? "Expiring soon" : "All valid"}</p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-violet-400 to-violet-600" />
                            <CardTitle className="text-base">Vetting Status</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold text-amber-600">{stats.vetting.inProgress}</div>
                              <p className="text-xs text-muted-foreground">In Progress</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <div className="text-2xl font-bold">{stats.vetting.total}</div>
                              <p className="text-xs text-muted-foreground">Total Checks</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#1F3A5F] to-[#2a5a8f]" />
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Link href="/compliance">
                            <Button size="sm" className="w-full justify-start bg-gradient-to-r from-[#1F3A5F] to-[#2a5a8f] text-white hover:from-[#2a4d7a] hover:to-[#1F3A5F]">
                              <ShieldCheck className="w-4 h-4 mr-2" /> Compliance Dashboard
                            </Button>
                          </Link>
                          <Link href="/vetting">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Search className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Vetting
                            </Button>
                          </Link>
                          <Link href="/employees">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Users className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Employees
                            </Button>
                          </Link>
                          <Link href="/audit-trail">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <History className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Audit Trail
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {stats.recentActivity.length > 0 ? (
                            <ul className="space-y-3">
                              {stats.recentActivity.slice(0, 5).map((log) => (
                                <li key={log.id} className="flex items-start gap-3 text-sm">
                                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                    log.action?.includes("create") ? "bg-green-500" :
                                    log.action?.includes("delete") ? "bg-rose-500" :
                                    "bg-blue-500"
                                  }`} />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate capitalize">{log.action?.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {log.entityType && <span className="capitalize">{log.entityType}</span>}
                                      {log.createdAt && <span> · {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              )}

              {/* ── Finance View ── */}
              {view === "finance" && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <GradientKpiCard
                      label="Revenue This Month"
                      value={`\u00A3${parseFloat(stats.financial.revenueThisMonth).toLocaleString()}`}
                      subtitle="Paid invoices"
                      gradient="bg-gradient-to-br from-emerald-500 to-emerald-700"
                      icon={<TrendingUp className="w-12 h-12" />}
                      href="/self-billing"
                      testId="kpi-revenue"
                    />
                    <GradientKpiCard
                      label="Outstanding"
                      value={`\u00A3${parseFloat(stats.financial.outstanding).toLocaleString()}`}
                      subtitle="Pending/approved"
                      gradient="bg-gradient-to-br from-amber-500 to-amber-700"
                      icon={<Clock className="w-12 h-12" />}
                      href="/self-billing"
                      testId="kpi-outstanding"
                    />
                    <GradientKpiCard
                      label="Total Invoices"
                      value={stats.financial.totalInvoices}
                      subtitle={`${stats.financial.paidInvoices} paid`}
                      gradient="bg-gradient-to-br from-[#1F3A5F] to-[#2a5a8f]"
                      icon={<FileText className="w-12 h-12" />}
                      href="/self-billing"
                      testId="kpi-invoices"
                    />
                    <GradientKpiCard
                      label="Active Suppliers"
                      value={stats.suppliers.active}
                      subtitle={`${stats.suppliers.total} total`}
                      gradient="bg-gradient-to-br from-violet-500 to-violet-700"
                      icon={<Truck className="w-12 h-12" />}
                      href="/suppliers"
                      testId="kpi-suppliers"
                    />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-emerald-600" />
                            <CardTitle className="text-base">Invoice Summary</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="rounded-lg border p-3 text-center">
                              <PoundSterling className="w-4 h-4 text-green-600 mx-auto mb-1" />
                              <div className="text-xl font-bold text-green-600">{"\u00A3"}{parseFloat(stats.financial.revenueThisMonth).toLocaleString()}</div>
                              <p className="text-xs text-muted-foreground">Revenue</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <Clock className="w-4 h-4 text-amber-600 mx-auto mb-1" />
                              <div className="text-xl font-bold text-amber-600">{"\u00A3"}{parseFloat(stats.financial.outstanding).toLocaleString()}</div>
                              <p className="text-xs text-muted-foreground">Outstanding</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <FileText className="w-4 h-4 text-blue-600 mx-auto mb-1" />
                              <div className="text-xl font-bold">{stats.financial.totalInvoices}</div>
                              <p className="text-xs text-muted-foreground">Total Invoices</p>
                            </div>
                            <div className="rounded-lg border p-3 text-center">
                              <CheckCircle2 className="w-4 h-4 text-green-600 mx-auto mb-1" />
                              <div className="text-xl font-bold text-green-600">{stats.financial.paidInvoices}</div>
                              <p className="text-xs text-muted-foreground">Paid</p>
                            </div>
                          </div>

                          {stats.financial.totalInvoices > 0 && (
                            <div className="mt-4">
                              <p className="text-xs text-muted-foreground mb-2">Payment rate</p>
                              <ProgressBar value={stats.financial.paidInvoices} max={stats.financial.totalInvoices} color="bg-gradient-to-r from-green-400 to-emerald-500" />
                              <p className="text-xs text-muted-foreground mt-1">{Math.round((stats.financial.paidInvoices / stats.financial.totalInvoices) * 100)}% paid</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>

                    <div className="space-y-6">
                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#1F3A5F] to-[#2a5a8f]" />
                            <CardTitle className="text-base">Quick Actions</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Link href="/self-billing">
                            <Button size="sm" className="w-full justify-start bg-gradient-to-r from-[#1F3A5F] to-[#2a5a8f] text-white hover:from-[#2a4d7a] hover:to-[#1F3A5F]">
                              <PoundSterling className="w-4 h-4 mr-2" /> Self-Billing
                            </Button>
                          </Link>
                          <Link href="/suppliers">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Truck className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Suppliers
                            </Button>
                          </Link>
                          <Link href="/reports">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <BarChart3 className="w-4 h-4 mr-2 text-[#1F3A5F]" /> Reports
                            </Button>
                          </Link>
                          <Link href="/self-billing-audit">
                            <Button variant="outline" className="w-full justify-start hover:bg-[#1F3A5F]/5" size="sm">
                              <Scale className="w-4 h-4 mr-2 text-[#1F3A5F]" /> HMRC Audit
                            </Button>
                          </Link>
                        </CardContent>
                      </Card>

                      <Card className="shadow-sm">
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-5 rounded-full bg-gradient-to-b from-[#FF8C42] to-[#e67a30]" />
                            <CardTitle className="text-base">Recent Activity</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {stats.recentActivity.length > 0 ? (
                            <ul className="space-y-3">
                              {stats.recentActivity.slice(0, 5).map((log) => (
                                <li key={log.id} className="flex items-start gap-3 text-sm">
                                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                    log.action?.includes("create") ? "bg-green-500" :
                                    log.action?.includes("delete") ? "bg-rose-500" :
                                    "bg-blue-500"
                                  }`} />
                                  <div className="min-w-0">
                                    <p className="font-medium truncate capitalize">{log.action?.replace(/_/g, " ")}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {log.entityType && <span className="capitalize">{log.entityType}</span>}
                                      {log.createdAt && <span> · {new Date(log.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</span>}
                                    </p>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No recent activity</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                </>
              )}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}
