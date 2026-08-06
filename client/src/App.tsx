import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import OnboardingPage from "@/pages/onboarding";
import AdminOnboardingPage from "@/pages/admin-onboarding";
import EmployeesPage from "@/pages/employees";
import SchedulingPage from "@/pages/scheduling";
import ControlRoomPage from "@/pages/control-room";
import CompliancePage from "@/pages/compliance";
import MyShiftsPage from "@/pages/my-shifts";
import MyDocumentsPage from "@/pages/my-documents";
import MyProfilePage from "@/pages/my-profile";
import DeploymentMapPage from "@/pages/deployment-map";
import SuppliersPage from "@/pages/suppliers";
import SupplierDetailPage from "@/pages/supplier-detail";
import SupplierPortalPage from "@/pages/supplier-portal";
import SupplierDocumentsPage from "@/pages/supplier-documents";
import SupplierPoliciesPage from "@/pages/supplier-policies";
import SupplierTimesheetsPage from "@/pages/supplier-timesheets";
import SelfBillingAgreementPage from "@/pages/self-billing-agreement";
import SelfBillingAuditPage from "@/pages/self-billing-audit";
import AcceptInvitePage from "@/pages/accept-invite";
import ResetPasswordPage from "@/pages/reset-password";
import FinancePage from "@/pages/finance";
import FinanceApprovalPage from "@/pages/finance-approval";
import RecruitmentPage from "@/pages/recruitment";
import AuditTrailPage from "@/pages/audit-trail";
import InvoiceNumberAuditPage from "@/pages/invoice-number-audit";
import ReportsPage from "@/pages/reports";
import SettingsPage from "@/pages/settings";
import VettingPage from "@/pages/vetting";
import AISchedulingPage from "@/pages/ai-scheduling";
import EmailCommandCentrePage from "@/pages/email-command-centre";
import DataImportPage from "@/pages/data-import";
import AddOnsPage from "@/pages/addons";
import TenantManagementPage from "@/pages/tenant-management";
import RoleManagementPage from "@/pages/role-management";
import CompanyProfilePage from "@/pages/company-profile";
import LandingPage from "@/pages/landing";
import TenantOnboardingPage from "@/pages/tenant-onboarding";
import PrivacySettingsPage from "@/pages/privacy-settings";
import TimesheetsPage from "@/pages/timesheets";
import ComplianceSettingsPage from "@/pages/compliance-settings";
import AIAnalyticsPage from "@/pages/ai-analytics";
import CommunicationsPage from "@/pages/communications";
import AdminSupplierTimesheetsPage from "@/pages/admin-supplier-timesheets";
import DisputeManagementPage from "@/pages/dispute-management";
import SelfBillingPage from "@/pages/self-billing";
import SupplierInvoicesPage from "@/pages/supplier-invoices";
import MyOfficersPage from "@/pages/my-officers";
import MyPayPage from "@/pages/my-pay";
import SupplierHmrcAuditPage from "@/pages/supplier-hmrc-audit";
import SupplierAuditPortalPage from "@/pages/supplier-audit-portal";
import ClientsPage from "@/pages/clients";
import SitesPage from "@/pages/sites";
import PayrollPage from "@/pages/payroll";
import ReAuditPage from "@/pages/re-audit";
import BatchInvoicesPage from "@/pages/batch-invoices";
import DownloadAuditPackPage from "@/pages/download-audit-pack";
import AccountingPage from "@/pages/accounting";
import DataSyncPage from "@/pages/data-sync";
import RemittanceSummaryPage from "@/pages/remittance-summary";
import FinancialDocumentsPage from "@/pages/financial-documents";
import PreAuditCheckPage from "@/pages/pre-audit-check";
import PurchaseLedgerPage from "@/pages/purchase-ledger";
import OfficerHomePage from "@/pages/officer-home";
import OfficerIdPage from "@/pages/officer-id";
import MyCompliancePage from "@/pages/my-compliance";
import MyEmploymentHistoryPage from "@/pages/my-employment-history";
import TimeOffRequestPage from "@/pages/time-off-request";
import LeaveRequestsPage from "@/pages/leave-requests";
import HrDashboardPage from "@/pages/hr-dashboard";
import ProbationPage from "@/pages/probation";
import HrCasesPage from "@/pages/hr-cases";
import AbsencesPage from "@/pages/absences";
import TrainingMatrixPage from "@/pages/training-matrix";
import OfferResponsePage from "@/pages/offer-response";
import EmploymentVerifyPage from "@/pages/employment-verify";
import PersonalReferenceVerifyPage from "@/pages/personal-reference-verify";
import PublicVettingFormPage from "@/pages/public-vetting-form";
import FmDashboardPage from "@/pages/fm-dashboard";
import FmWorkersPage from "@/pages/fm-workers";
import FmJobsPage from "@/pages/fm-jobs";
import FmSuppliersPage from "@/pages/fm-suppliers";
import FmPpmPage from "@/pages/fm-ppm";
import FmSchedulerPage from "@/pages/fm-scheduler";
import FmReportsPage from "@/pages/fm-reports";
import FmSettingsPage from "@/pages/fm-settings";
import FmBillingPage from "@/pages/fm-billing";
import FmWorkerPortalPage from "@/pages/fm-worker-portal";
import FmWorkerJobPage from "@/pages/fm-worker-job";
import WagesLedgerPage from "@/pages/wages-ledger";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center gap-2 p-3 border-b bg-background sticky top-0 z-50">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex-1" />
            <NotificationsDropdown />
          </header>
          <main className="flex-1 overflow-auto pb-16 md:pb-0">
            {children}
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <PwaInstallPrompt />
    </SidebarProvider>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/landing" />;
  }

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function FmGatedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { data, isLoading: addonLoading } = useQuery<{ active: boolean }>({
    queryKey: ["/api/addons/check/fm_services"],
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || (isAuthenticated && addonLoading)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAuthenticated) return <Redirect to="/landing" />;
  if (!data?.active) return <Redirect to="/addons" />;

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function EmployeeRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/landing" />;
  }

  if (user?.role !== "employee") {
    return <Redirect to="/dashboard" />;
  }

  return (
    <AuthenticatedLayout>
      <Component />
    </AuthenticatedLayout>
  );
}

function PublicRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isAuthenticated) {
    if (user?.role === "employee") {
      return <Redirect to="/officer" />;
    }
    return <Redirect to="/dashboard" />;
  }

  return <Component />;
}

function RoleBasedHome() {
  const { user, isLoading } = useAuth();
  const { data: fmAddon } = useQuery<{ active: boolean }>({
    queryKey: ["/api/addons/check/fm_services"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const { data: fmWorker, isLoading: fmMeLoading } = useQuery<any>({
    queryKey: ["/api/fm/me"],
    enabled: !!user && fmAddon?.active === true,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  if (isLoading || (fmAddon?.active && fmMeLoading)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (fmWorker && fmWorker.id) {
    return <Redirect to="/fm-worker" />;
  }

  if (user?.role === "employee") {
    return <OfficerHomePage />;
  }

  return <DashboardPage />;
}

function Router() {
  return (
    <Switch>
      <Route path="/landing" component={() => <PublicRoute component={LandingPage} />} />
      <Route path="/get-started" component={() => <PublicRoute component={TenantOnboardingPage} />} />
      <Route path="/login" component={() => <PublicRoute component={LoginPage} />} />
      <Route path="/register" component={() => <PublicRoute component={RegisterPage} />} />
      <Route path="/accept-invite" component={AcceptInvitePage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/" component={() => <ProtectedRoute component={RoleBasedHome} />} />
      <Route path="/dashboard" component={() => <ProtectedRoute component={RoleBasedHome} />} />
      <Route path="/onboarding" component={() => <ProtectedRoute component={OnboardingPage} />} />
      <Route path="/admin/onboarding" component={() => <ProtectedRoute component={AdminOnboardingPage} />} />
      <Route path="/admin/employees" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/admin/employees/:id" component={() => <ProtectedRoute component={EmployeesPage} />} />
      <Route path="/scheduling" component={() => <ProtectedRoute component={SchedulingPage} />} />
      <Route path="/control-room" component={() => <ProtectedRoute component={ControlRoomPage} />} />
      <Route path="/compliance" component={() => <ProtectedRoute component={CompliancePage} />} />
      <Route path="/my-shifts" component={() => <ProtectedRoute component={MyShiftsPage} />} />
      <Route path="/my-documents" component={() => <ProtectedRoute component={MyDocumentsPage} />} />
      <Route path="/my-pay" component={() => <ProtectedRoute component={MyPayPage} />} />
      <Route path="/my-profile" component={() => <ProtectedRoute component={MyProfilePage} />} />
      <Route path="/deployment-map" component={() => <ProtectedRoute component={DeploymentMapPage} />} />
      <Route path="/supplier-portal" component={() => <ProtectedRoute component={SupplierPortalPage} />} />
      <Route path="/my-officers" component={() => <ProtectedRoute component={MyOfficersPage} />} />
      <Route path="/supplier-documents" component={() => <ProtectedRoute component={SupplierDocumentsPage} />} />
      <Route path="/supplier-policies" component={() => <ProtectedRoute component={SupplierPoliciesPage} />} />
      <Route path="/supplier-timesheets" component={() => <ProtectedRoute component={SupplierTimesheetsPage} />} />
      <Route path="/self-billing-agreement" component={() => <ProtectedRoute component={SelfBillingAgreementPage} />} />
      <Route path="/suppliers/:id" component={() => <ProtectedRoute component={SupplierDetailPage} />} />
      <Route path="/suppliers" component={() => <ProtectedRoute component={SuppliersPage} />} />
      <Route path="/finance" component={() => <ProtectedRoute component={FinancePage} />} />
      <Route path="/finance-approval" component={() => <ProtectedRoute component={FinanceApprovalPage} />} />
      <Route path="/recruitment" component={() => <ProtectedRoute component={RecruitmentPage} />} />
      <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
      <Route path="/audit-trail" component={() => <ProtectedRoute component={AuditTrailPage} />} />
      <Route path="/invoice-number-audit" component={() => <ProtectedRoute component={InvoiceNumberAuditPage} />} />
      <Route path="/vetting" component={() => <ProtectedRoute component={VettingPage} />} />
      <Route path="/ai-scheduling" component={() => <ProtectedRoute component={AISchedulingPage} />} />
      <Route path="/email-command-centre" component={() => <ProtectedRoute component={EmailCommandCentrePage} />} />
      <Route path="/data-import" component={() => <ProtectedRoute component={DataImportPage} />} />
      <Route path="/data-sync" component={() => <ProtectedRoute component={DataSyncPage} />} />
      <Route path="/addons" component={() => <ProtectedRoute component={AddOnsPage} />} />
      <Route path="/admin/tenants" component={() => <ProtectedRoute component={TenantManagementPage} />} />
      <Route path="/admin/roles" component={() => <ProtectedRoute component={RoleManagementPage} />} />
      <Route path="/company-profile" component={() => <ProtectedRoute component={CompanyProfilePage} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
      <Route path="/privacy-settings" component={() => <ProtectedRoute component={PrivacySettingsPage} />} />
      <Route path="/compliance-settings" component={() => <ProtectedRoute component={ComplianceSettingsPage} />} />
      <Route path="/re-audit" component={() => <ProtectedRoute component={ReAuditPage} />} />
      <Route path="/batch-invoices" component={() => <ProtectedRoute component={BatchInvoicesPage} />} />
      <Route path="/download-audit-pack" component={() => <ProtectedRoute component={DownloadAuditPackPage} />} />
      <Route path="/ai-analytics" component={() => <ProtectedRoute component={AIAnalyticsPage} />} />
      <Route path="/communications" component={() => <ProtectedRoute component={CommunicationsPage} />} />
      <Route path="/admin/supplier-timesheets" component={() => <ProtectedRoute component={AdminSupplierTimesheetsPage} />} />
      <Route path="/disputes" component={() => <ProtectedRoute component={DisputeManagementPage} />} />
      <Route path="/self-billing" component={() => <ProtectedRoute component={SelfBillingPage} />} />
      <Route path="/self-billing-audit" component={() => <ProtectedRoute component={SelfBillingAuditPage} />} />
      <Route path="/supplier-hmrc-audit" component={() => <ProtectedRoute component={SupplierHmrcAuditPage} />} />
      <Route path="/supplier-audit-portal" component={() => <ProtectedRoute component={SupplierAuditPortalPage} />} />
      <Route path="/supplier-invoices" component={() => <ProtectedRoute component={SupplierInvoicesPage} />} />
      <Route path="/clients" component={() => <ProtectedRoute component={ClientsPage} />} />
      <Route path="/sites" component={() => <ProtectedRoute component={SitesPage} />} />
      <Route path="/payroll" component={() => <ProtectedRoute component={PayrollPage} />} />
      <Route path="/accounting" component={() => <ProtectedRoute component={AccountingPage} />} />
      <Route path="/remittance-summary" component={() => <ProtectedRoute component={RemittanceSummaryPage} />} />
      <Route path="/financial-documents" component={() => <ProtectedRoute component={FinancialDocumentsPage} />} />
      <Route path="/pre-audit-check" component={() => <ProtectedRoute component={PreAuditCheckPage} />} />
      <Route path="/purchase-ledger" component={() => <ProtectedRoute component={PurchaseLedgerPage} />} />
      <Route path="/timesheets" component={() => <ProtectedRoute component={TimesheetsPage} />} />
      <Route path="/officer" component={() => <EmployeeRoute component={OfficerHomePage} />} />
      <Route path="/officer/id" component={() => <EmployeeRoute component={OfficerIdPage} />} />
      <Route path="/my-compliance" component={() => <EmployeeRoute component={MyCompliancePage} />} />
      <Route path="/my-employment-history" component={() => <EmployeeRoute component={MyEmploymentHistoryPage} />} />
      <Route path="/time-off-request" component={() => <ProtectedRoute component={TimeOffRequestPage} />} />
      <Route path="/admin/leave-requests" component={() => <ProtectedRoute component={LeaveRequestsPage} />} />
      <Route path="/hr-dashboard" component={() => <ProtectedRoute component={HrDashboardPage} />} />
      <Route path="/probation" component={() => <ProtectedRoute component={ProbationPage} />} />
      <Route path="/admin/hr-cases" component={() => <ProtectedRoute component={HrCasesPage} />} />
      <Route path="/admin/absences" component={() => <ProtectedRoute component={AbsencesPage} />} />
      <Route path="/training-matrix" component={() => <ProtectedRoute component={TrainingMatrixPage} />} />
      <Route path="/offer-response/:token" component={OfferResponsePage} />
      <Route path="/verify/employment/:token" component={EmploymentVerifyPage} />
      <Route path="/verify/personal/:token" component={PersonalReferenceVerifyPage} />
      <Route path="/vetting-form/:token" component={PublicVettingFormPage} />
      <Route path="/fm-dashboard" component={() => <FmGatedRoute component={FmDashboardPage} />} />
      <Route path="/fm-workers" component={() => <FmGatedRoute component={FmWorkersPage} />} />
      <Route path="/fm-jobs" component={() => <FmGatedRoute component={FmJobsPage} />} />
      <Route path="/fm-scheduler" component={() => <FmGatedRoute component={FmSchedulerPage} />} />
      <Route path="/fm-reports" component={() => <FmGatedRoute component={FmReportsPage} />} />
      <Route path="/fm-suppliers" component={() => <FmGatedRoute component={FmSuppliersPage} />} />
      <Route path="/fm-ppm" component={() => <FmGatedRoute component={FmPpmPage} />} />
      <Route path="/fm-settings" component={() => <FmGatedRoute component={FmSettingsPage} />} />
      <Route path="/fm-billing" component={() => <FmGatedRoute component={FmBillingPage} />} />
      <Route path="/fm-worker" component={() => <ProtectedRoute component={FmWorkerPortalPage} />} />
      <Route path="/fm-worker/jobs/:id" component={() => <ProtectedRoute component={FmWorkerJobPage} />} />
      <Route path="/wages-ledger" component={() => <ProtectedRoute component={WagesLedgerPage} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
