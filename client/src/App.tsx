import { Switch, Route, Redirect } from "wouter";
import { lazy, Suspense, type ComponentType } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";

const NotFound = lazy(() => import("@/pages/not-found"));
const LoginPage = lazy(() => import("@/pages/login"));
const RegisterPage = lazy(() => import("@/pages/register"));
const DashboardPage = lazy(() => import("@/pages/dashboard"));
const OnboardingPage = lazy(() => import("@/pages/onboarding"));
const AdminOnboardingPage = lazy(() => import("@/pages/admin-onboarding"));
const EmployeesPage = lazy(() => import("@/pages/employees"));
const SchedulingPage = lazy(() => import("@/pages/scheduling"));
const ControlRoomPage = lazy(() => import("@/pages/control-room"));
const CompliancePage = lazy(() => import("@/pages/compliance"));
const MyShiftsPage = lazy(() => import("@/pages/my-shifts"));
const MyDocumentsPage = lazy(() => import("@/pages/my-documents"));
const MyProfilePage = lazy(() => import("@/pages/my-profile"));
const DeploymentMapPage = lazy(() => import("@/pages/deployment-map"));
const SuppliersPage = lazy(() => import("@/pages/suppliers"));
const SupplierDetailPage = lazy(() => import("@/pages/supplier-detail"));
const SupplierPortalPage = lazy(() => import("@/pages/supplier-portal"));
const SupplierDocumentsPage = lazy(() => import("@/pages/supplier-documents"));
const SupplierPoliciesPage = lazy(() => import("@/pages/supplier-policies"));
const SupplierTimesheetsPage = lazy(() => import("@/pages/supplier-timesheets"));
const SelfBillingAgreementPage = lazy(() => import("@/pages/self-billing-agreement"));
const SelfBillingAuditPage = lazy(() => import("@/pages/self-billing-audit"));
const AcceptInvitePage = lazy(() => import("@/pages/accept-invite"));
const ResetPasswordPage = lazy(() => import("@/pages/reset-password"));
const FinancePage = lazy(() => import("@/pages/finance"));
const FinanceApprovalPage = lazy(() => import("@/pages/finance-approval"));
const RecruitmentPage = lazy(() => import("@/pages/recruitment"));
const AuditTrailPage = lazy(() => import("@/pages/audit-trail"));
const InvoiceNumberAuditPage = lazy(() => import("@/pages/invoice-number-audit"));
const ReportsPage = lazy(() => import("@/pages/reports"));
const SettingsPage = lazy(() => import("@/pages/settings"));
const VettingPage = lazy(() => import("@/pages/vetting"));
const AISchedulingPage = lazy(() => import("@/pages/ai-scheduling"));
const EmailCommandCentrePage = lazy(() => import("@/pages/email-command-centre"));
const DataImportPage = lazy(() => import("@/pages/data-import"));
const AddOnsPage = lazy(() => import("@/pages/addons"));
const TenantManagementPage = lazy(() => import("@/pages/tenant-management"));
const RoleManagementPage = lazy(() => import("@/pages/role-management"));
const CompanyProfilePage = lazy(() => import("@/pages/company-profile"));
const LandingPage = lazy(() => import("@/pages/landing"));
const TenantOnboardingPage = lazy(() => import("@/pages/tenant-onboarding"));
const PrivacySettingsPage = lazy(() => import("@/pages/privacy-settings"));
const TimesheetsPage = lazy(() => import("@/pages/timesheets"));
const ComplianceSettingsPage = lazy(() => import("@/pages/compliance-settings"));
const AIAnalyticsPage = lazy(() => import("@/pages/ai-analytics"));
const CommunicationsPage = lazy(() => import("@/pages/communications"));
const AdminSupplierTimesheetsPage = lazy(() => import("@/pages/admin-supplier-timesheets"));
const DisputeManagementPage = lazy(() => import("@/pages/dispute-management"));
const SelfBillingPage = lazy(() => import("@/pages/self-billing"));
const SupplierInvoicesPage = lazy(() => import("@/pages/supplier-invoices"));
const MyOfficersPage = lazy(() => import("@/pages/my-officers"));
const MyPayPage = lazy(() => import("@/pages/my-pay"));
const SupplierHmrcAuditPage = lazy(() => import("@/pages/supplier-hmrc-audit"));
const SupplierAuditPortalPage = lazy(() => import("@/pages/supplier-audit-portal"));
const ClientsPage = lazy(() => import("@/pages/clients"));
const SitesPage = lazy(() => import("@/pages/sites"));
const SiteDetailPage = lazy(() => import("@/pages/site-detail"));
const PayrollPage = lazy(() => import("@/pages/payroll"));
const ReAuditPage = lazy(() => import("@/pages/re-audit"));
const BatchInvoicesPage = lazy(() => import("@/pages/batch-invoices"));
const DownloadAuditPackPage = lazy(() => import("@/pages/download-audit-pack"));
const AccountingPage = lazy(() => import("@/pages/accounting"));
const DataSyncPage = lazy(() => import("@/pages/data-sync"));
const RemittanceSummaryPage = lazy(() => import("@/pages/remittance-summary"));
const FinancialDocumentsPage = lazy(() => import("@/pages/financial-documents"));
const PreAuditCheckPage = lazy(() => import("@/pages/pre-audit-check"));
const PurchaseLedgerPage = lazy(() => import("@/pages/purchase-ledger"));
const OfficerHomePage = lazy(() => import("@/pages/officer-home"));
const OfficerIdPage = lazy(() => import("@/pages/officer-id"));
const MyCompliancePage = lazy(() => import("@/pages/my-compliance"));
const MyEmploymentHistoryPage = lazy(() => import("@/pages/my-employment-history"));
const TimeOffRequestPage = lazy(() => import("@/pages/time-off-request"));
const LeaveRequestsPage = lazy(() => import("@/pages/leave-requests"));
const HrDashboardPage = lazy(() => import("@/pages/hr-dashboard"));
const ProbationPage = lazy(() => import("@/pages/probation"));
const HrCasesPage = lazy(() => import("@/pages/hr-cases"));
const AbsencesPage = lazy(() => import("@/pages/absences"));
const TrainingMatrixPage = lazy(() => import("@/pages/training-matrix"));
const OfferResponsePage = lazy(() => import("@/pages/offer-response"));
const EmploymentVerifyPage = lazy(() => import("@/pages/employment-verify"));
const StaffFeedbackPage = lazy(() => import("@/pages/staff-feedback"));
const PersonalReferenceVerifyPage = lazy(() => import("@/pages/personal-reference-verify"));
const PublicVettingFormPage = lazy(() => import("@/pages/public-vetting-form"));
const FmDashboardPage = lazy(() => import("@/pages/fm-dashboard"));
const FmWorkersPage = lazy(() => import("@/pages/fm-workers"));
const FmJobsPage = lazy(() => import("@/pages/fm-jobs"));
const FmSuppliersPage = lazy(() => import("@/pages/fm-suppliers"));
const FmPpmPage = lazy(() => import("@/pages/fm-ppm"));
const FmSchedulerPage = lazy(() => import("@/pages/fm-scheduler"));
const FmReportsPage = lazy(() => import("@/pages/fm-reports"));
const FmSettingsPage = lazy(() => import("@/pages/fm-settings"));
const FmBillingPage = lazy(() => import("@/pages/fm-billing"));
const FmWorkerPortalPage = lazy(() => import("@/pages/fm-worker-portal"));
const FmWorkerJobPage = lazy(() => import("@/pages/fm-worker-job"));
const WagesLedgerPage = lazy(() => import("@/pages/wages-ledger"));

function PageSpinner() {
  return (
    <div className="flex items-center justify-center h-full min-h-[40vh]">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

function FullScreenSpinner() {
  return (
    <div className="flex items-center justify-center h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}

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
            <Suspense fallback={<PageSpinner />}>{children}</Suspense>
          </main>
        </div>
      </div>
      <MobileBottomNav />
      <PwaInstallPrompt />
    </SidebarProvider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullScreenSpinner />;
  if (!isAuthenticated) return <Redirect to="/landing" />;
  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}

function RequireEmployee({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user?.role !== "employee") return <Redirect to="/dashboard" />;
  return <>{children}</>;
}

function RequireFm({ children }: { children: React.ReactNode }) {
  const { data, isLoading } = useQuery<{ active: boolean }>({
    queryKey: ["/api/addons/check/fm_services"],
    staleTime: 1000 * 60 * 5,
  });
  if (isLoading) return <PageSpinner />;
  if (!data?.active) return <Redirect to="/addons" />;
  return <>{children}</>;
}

function PublicOnly({ component: Component }: { component: ComponentType }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return <FullScreenSpinner />;
  if (isAuthenticated) {
    if (user?.role === "employee") return <Redirect to="/officer" />;
    return <Redirect to="/dashboard" />;
  }
  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Component />
    </Suspense>
  );
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
    return <PageSpinner />;
  }

  if (fmWorker && fmWorker.id) {
    return <Redirect to="/fm-worker" />;
  }

  if (user?.role === "employee") {
    return <OfficerHomePage />;
  }

  return <DashboardPage />;
}

function AuthenticatedRoutes() {
  return (
    <RequireAuth>
      <Switch>
        <Route path="/" component={RoleBasedHome} />
        <Route path="/dashboard" component={RoleBasedHome} />
        <Route path="/onboarding" component={OnboardingPage} />
        <Route path="/admin/onboarding" component={AdminOnboardingPage} />
        <Route path="/admin/employees" component={EmployeesPage} />
        <Route path="/admin/employees/:id" component={EmployeesPage} />
        <Route path="/scheduling" component={SchedulingPage} />
        <Route path="/control-room" component={ControlRoomPage} />
        <Route path="/compliance" component={CompliancePage} />
        <Route path="/my-shifts" component={MyShiftsPage} />
        <Route path="/my-documents" component={MyDocumentsPage} />
        <Route path="/my-pay" component={MyPayPage} />
        <Route path="/my-profile" component={MyProfilePage} />
        <Route path="/deployment-map" component={DeploymentMapPage} />
        <Route path="/supplier-portal" component={SupplierPortalPage} />
        <Route path="/my-officers" component={MyOfficersPage} />
        <Route path="/supplier-documents" component={SupplierDocumentsPage} />
        <Route path="/supplier-policies" component={SupplierPoliciesPage} />
        <Route path="/supplier-timesheets" component={SupplierTimesheetsPage} />
        <Route path="/self-billing-agreement" component={SelfBillingAgreementPage} />
        <Route path="/suppliers/:id" component={SupplierDetailPage} />
        <Route path="/suppliers" component={SuppliersPage} />
        <Route path="/finance" component={FinancePage} />
        <Route path="/finance-approval" component={FinanceApprovalPage} />
        <Route path="/recruitment" component={RecruitmentPage} />
        <Route path="/reports" component={ReportsPage} />
        <Route path="/audit-trail" component={AuditTrailPage} />
        <Route path="/invoice-number-audit" component={InvoiceNumberAuditPage} />
        <Route path="/vetting" component={VettingPage} />
        <Route path="/ai-scheduling" component={AISchedulingPage} />
        <Route path="/email-command-centre" component={EmailCommandCentrePage} />
        <Route path="/data-import" component={DataImportPage} />
        <Route path="/data-sync" component={DataSyncPage} />
        <Route path="/addons" component={AddOnsPage} />
        <Route path="/admin/tenants" component={TenantManagementPage} />
        <Route path="/admin/roles" component={RoleManagementPage} />
        <Route path="/company-profile" component={CompanyProfilePage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/privacy-settings" component={PrivacySettingsPage} />
        <Route path="/compliance-settings" component={ComplianceSettingsPage} />
        <Route path="/re-audit" component={ReAuditPage} />
        <Route path="/batch-invoices" component={BatchInvoicesPage} />
        <Route path="/download-audit-pack" component={DownloadAuditPackPage} />
        <Route path="/ai-analytics" component={AIAnalyticsPage} />
        <Route path="/communications" component={CommunicationsPage} />
        <Route path="/admin/supplier-timesheets" component={AdminSupplierTimesheetsPage} />
        <Route path="/disputes" component={DisputeManagementPage} />
        <Route path="/self-billing" component={SelfBillingPage} />
        <Route path="/self-billing-audit" component={SelfBillingAuditPage} />
        <Route path="/supplier-hmrc-audit" component={SupplierHmrcAuditPage} />
        <Route path="/supplier-audit-portal" component={SupplierAuditPortalPage} />
        <Route path="/supplier-invoices" component={SupplierInvoicesPage} />
        <Route path="/clients" component={ClientsPage} />
        <Route path="/sites/:id" component={SiteDetailPage} />
        <Route path="/sites" component={SitesPage} />
        <Route path="/payroll" component={PayrollPage} />
        <Route path="/accounting" component={AccountingPage} />
        <Route path="/remittance-summary" component={RemittanceSummaryPage} />
        <Route path="/financial-documents" component={FinancialDocumentsPage} />
        <Route path="/pre-audit-check" component={PreAuditCheckPage} />
        <Route path="/purchase-ledger" component={PurchaseLedgerPage} />
        <Route path="/timesheets" component={TimesheetsPage} />
        <Route path="/officer" component={() => <RequireEmployee><OfficerHomePage /></RequireEmployee>} />
        <Route path="/officer/id" component={() => <RequireEmployee><OfficerIdPage /></RequireEmployee>} />
        <Route path="/my-compliance" component={() => <RequireEmployee><MyCompliancePage /></RequireEmployee>} />
        <Route path="/my-employment-history" component={() => <RequireEmployee><MyEmploymentHistoryPage /></RequireEmployee>} />
        <Route path="/time-off-request" component={TimeOffRequestPage} />
        <Route path="/admin/leave-requests" component={LeaveRequestsPage} />
        <Route path="/hr-dashboard" component={HrDashboardPage} />
        <Route path="/probation" component={ProbationPage} />
        <Route path="/admin/hr-cases" component={HrCasesPage} />
        <Route path="/admin/absences" component={AbsencesPage} />
        <Route path="/training-matrix" component={TrainingMatrixPage} />
        <Route path="/fm-dashboard" component={() => <RequireFm><FmDashboardPage /></RequireFm>} />
        <Route path="/fm-workers" component={() => <RequireFm><FmWorkersPage /></RequireFm>} />
        <Route path="/fm-jobs" component={() => <RequireFm><FmJobsPage /></RequireFm>} />
        <Route path="/fm-scheduler" component={() => <RequireFm><FmSchedulerPage /></RequireFm>} />
        <Route path="/fm-reports" component={() => <RequireFm><FmReportsPage /></RequireFm>} />
        <Route path="/fm-suppliers" component={() => <RequireFm><FmSuppliersPage /></RequireFm>} />
        <Route path="/fm-ppm" component={() => <RequireFm><FmPpmPage /></RequireFm>} />
        <Route path="/fm-settings" component={() => <RequireFm><FmSettingsPage /></RequireFm>} />
        <Route path="/fm-billing" component={() => <RequireFm><FmBillingPage /></RequireFm>} />
        <Route path="/fm-worker" component={FmWorkerPortalPage} />
        <Route path="/fm-worker/jobs/:id" component={FmWorkerJobPage} />
        <Route path="/wages-ledger" component={WagesLedgerPage} />
        <Route component={NotFound} />
      </Switch>
    </RequireAuth>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/landing" component={() => <PublicOnly component={LandingPage} />} />
      <Route path="/get-started" component={() => <PublicOnly component={TenantOnboardingPage} />} />
      <Route path="/login" component={() => <PublicOnly component={LoginPage} />} />
      <Route path="/register" component={() => <PublicOnly component={RegisterPage} />} />
      <Route path="/accept-invite">
        <Suspense fallback={<FullScreenSpinner />}><AcceptInvitePage /></Suspense>
      </Route>
      <Route path="/reset-password">
        <Suspense fallback={<FullScreenSpinner />}><ResetPasswordPage /></Suspense>
      </Route>
      <Route path="/offer-response/:token">
        <Suspense fallback={<FullScreenSpinner />}><OfferResponsePage /></Suspense>
      </Route>
      <Route path="/verify/employment/:token">
        <Suspense fallback={<FullScreenSpinner />}><EmploymentVerifyPage /></Suspense>
      </Route>
      <Route path="/feedback/:token">
        <Suspense fallback={<FullScreenSpinner />}><StaffFeedbackPage /></Suspense>
      </Route>
      <Route path="/verify/personal/:token">
        <Suspense fallback={<FullScreenSpinner />}><PersonalReferenceVerifyPage /></Suspense>
      </Route>
      <Route path="/vetting-form/:token">
        <Suspense fallback={<FullScreenSpinner />}><PublicVettingFormPage /></Suspense>
      </Route>
      <Route component={AuthenticatedRoutes} />
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
