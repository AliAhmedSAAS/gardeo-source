import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard, ClipboardList, Users, ShieldCheck, FileText,
  LogOut, UserPlus, Shield, CalendarDays, Radio, Clock, User, MapPin, PoundSterling,
  Truck, Briefcase, Settings, BarChart3, UserCheck, Brain, ScrollText, DatabaseBackup, Building2, Lock, TrendingUp, MessageSquare,
  AlertTriangle, Receipt, ClipboardCheck, Sparkles, ChevronDown, Building, MapPinned, Banknote, RotateCcw, FileStack, Download, History, X, Calculator, RefreshCw, FileSpreadsheet, FolderOpen, CalendarOff, Mail, LayoutGrid, Scale, GraduationCap, Wrench, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type NavItem = { title: string; url: string; icon: any; permKey: string };

type NavGroup = {
  label: string;
  icon: any;
  items: NavItem[];
};

const navGroups: NavGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, permKey: "screen:dashboard" },
    ],
  },
  {
    label: "People",
    icon: Users,
    items: [
      { title: "HR Dashboard", url: "/hr-dashboard", icon: LayoutGrid, permKey: "screen:employees" },
      { title: "Employees", url: "/admin/employees", icon: Users, permKey: "screen:employees" },
      { title: "Onboarding Mgmt", url: "/admin/onboarding", icon: UserPlus, permKey: "screen:admin-onboarding" },
      { title: "Recruitment", url: "/recruitment", icon: Briefcase, permKey: "screen:recruitment" },
      { title: "Training Matrix", url: "/training-matrix", icon: GraduationCap, permKey: "screen:training-matrix" },
      { title: "Leave Requests", url: "/admin/leave-requests", icon: CalendarOff, permKey: "screen:leave-requests" },
      { title: "Probation Tracking", url: "/probation", icon: ClipboardCheck, permKey: "screen:employees" },
      { title: "HR Cases", url: "/admin/hr-cases", icon: Scale, permKey: "screen:employees" },
      { title: "Absence Management", url: "/admin/absences", icon: CalendarOff, permKey: "screen:absences" },
    ],
  },
  {
    label: "Clients & Sites",
    icon: Building,
    items: [
      { title: "Clients", url: "/clients", icon: Building, permKey: "screen:clients" },
      { title: "Sites / Locations", url: "/sites", icon: MapPinned, permKey: "screen:sites" },
    ],
  },
  {
    label: "Operations",
    icon: Radio,
    items: [
      { title: "Scheduling", url: "/scheduling", icon: CalendarDays, permKey: "screen:scheduling" },
      { title: "AI Scheduling", url: "/ai-scheduling", icon: Brain, permKey: "screen:ai-scheduling" },
      { title: "Email Command Centre", url: "/email-command-centre", icon: Mail, permKey: "screen:email-command-centre" },
      { title: "Control Room", url: "/control-room", icon: Radio, permKey: "screen:control-room" },
      { title: "Timesheets", url: "/timesheets", icon: ClipboardList, permKey: "screen:timesheets" },
      { title: "Deployment Map", url: "/deployment-map", icon: MapPin, permKey: "screen:deployment-map" },
      { title: "Communications", url: "/communications", icon: MessageSquare, permKey: "screen:communications" },
    ],
  },
  {
    label: "Compliance & Vetting",
    icon: ShieldCheck,
    items: [
      { title: "Compliance", url: "/compliance", icon: ShieldCheck, permKey: "screen:compliance" },
      { title: "Vetting", url: "/vetting", icon: UserCheck, permKey: "screen:vetting" },
      { title: "Predictive Analytics", url: "/ai-analytics", icon: TrendingUp, permKey: "screen:ai-analytics" },
    ],
  },
  {
    label: "Suppliers",
    icon: Truck,
    items: [
      { title: "Suppliers", url: "/suppliers", icon: Truck, permKey: "screen:suppliers" },
      { title: "Supplier Timesheets", url: "/admin/supplier-timesheets", icon: ClipboardCheck, permKey: "screen:supplier-timesheets" },
      { title: "Disputes", url: "/disputes", icon: AlertTriangle, permKey: "screen:disputes" },
    ],
  },
  {
    label: "Finance & Billing",
    icon: PoundSterling,
    items: [
      { title: "Finance", url: "/finance", icon: PoundSterling, permKey: "screen:finance" },
      { title: "Shift Approval", url: "/finance-approval", icon: ClipboardCheck, permKey: "screen:finance" },
      { title: "Payroll", url: "/payroll", icon: Banknote, permKey: "screen:payroll" },
      { title: "Self-Billing", url: "/self-billing", icon: Receipt, permKey: "screen:self-billing" },
      { title: "Audit Pack", url: "/self-billing-audit", icon: Shield, permKey: "screen:self-billing-audit" },
      { title: "HMRC Audit Trail", url: "/supplier-hmrc-audit", icon: ScrollText, permKey: "screen:supplier-hmrc-audit" },
      { title: "Accounting", url: "/accounting", icon: Calculator, permKey: "screen:finance" },
      { title: "Remittance Summary", url: "/remittance-summary", icon: FileSpreadsheet, permKey: "screen:finance" },
      { title: "Financial Documents", url: "/financial-documents", icon: FolderOpen, permKey: "screen:finance" },
      { title: "Pre-Audit Check", url: "/pre-audit-check", icon: ShieldCheck, permKey: "screen:finance" },
      { title: "Purchase Ledger", url: "/purchase-ledger", icon: BookOpen, permKey: "screen:finance" },
      { title: "Wages Ledger", url: "/wages-ledger", icon: Banknote, permKey: "screen:finance" },
    ],
  },
  {
    label: "Reports & Data",
    icon: BarChart3,
    items: [
      { title: "Reports", url: "/reports", icon: BarChart3, permKey: "screen:reports" },
      { title: "Audit Trail", url: "/audit-trail", icon: ScrollText, permKey: "screen:audit-trail" },
      { title: "Invoice Number Audit", url: "/invoice-number-audit", icon: ScrollText, permKey: "screen:audit-trail" },
      { title: "Data Import", url: "/data-import", icon: DatabaseBackup, permKey: "screen:data-import" },
      { title: "Data Sync", url: "/data-sync", icon: RefreshCw, permKey: "screen:data-import" },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { title: "Company Profile", url: "/company-profile", icon: Building2, permKey: "screen:company-profile" },
      { title: "Privacy & Data", url: "/privacy-settings", icon: Shield, permKey: "screen:privacy-settings" },
      { title: "Compliance & Security", url: "/compliance-settings", icon: Lock, permKey: "screen:compliance-settings" },
      { title: "Add-Ons", url: "/addons", icon: Sparkles, permKey: "screen:addons" },
      { title: "Settings", url: "/settings", icon: Settings, permKey: "screen:settings" },
      { title: "Re-Audit", url: "/re-audit", icon: RotateCcw, permKey: "screen:settings" },
      { title: "Batch Invoices", url: "/batch-invoices", icon: FileStack, permKey: "screen:settings" },
      { title: "Download Audit Pack", url: "/download-audit-pack", icon: Download, permKey: "screen:settings" },
      { title: "Tenant Management", url: "/admin/tenants", icon: Building2, permKey: "screen:tenant-management" },
      { title: "Role Management", url: "/admin/roles", icon: Shield, permKey: "screen:role-management" },
    ],
  },
];

const supplierPortalItems: NavItem[] = [
  { title: "My Profile", url: "/supplier-portal", icon: Truck, permKey: "screen:supplier-portal" },
  { title: "My Officers", url: "/my-officers", icon: Users, permKey: "screen:my-officers" },
  { title: "Timesheets", url: "/supplier-timesheets", icon: Clock, permKey: "screen:supplier-timesheets-portal" },
  { title: "My Invoices", url: "/supplier-invoices", icon: Receipt, permKey: "screen:supplier-invoices" },
  { title: "Documents", url: "/supplier-documents", icon: FileText, permKey: "screen:supplier-documents" },
  { title: "Policies", url: "/supplier-policies", icon: Shield, permKey: "screen:supplier-policies" },
  { title: "Self-Billing Agreement", url: "/self-billing-agreement", icon: FileText, permKey: "screen:self-billing-agreement" },
  { title: "My Audit Trail", url: "/supplier-audit-portal", icon: ScrollText, permKey: "screen:supplier-audit-portal" },
  { title: "Disputes", url: "/disputes", icon: AlertTriangle, permKey: "screen:disputes" },
];

const employeePortalItems: NavItem[] = [
  { title: "Officer Home", url: "/officer", icon: Shield, permKey: "screen:my-shifts" },
  { title: "Onboarding", url: "/onboarding", icon: ClipboardList, permKey: "screen:onboarding" },
  { title: "My Shifts", url: "/my-shifts", icon: Clock, permKey: "screen:my-shifts" },
  { title: "Time Off", url: "/time-off-request", icon: CalendarOff, permKey: "screen:my-shifts" },
  { title: "My Documents", url: "/my-documents", icon: FileText, permKey: "screen:my-documents" },
  { title: "My Profile", url: "/my-profile", icon: User, permKey: "screen:my-profile" },
  { title: "My Pay", url: "/my-pay", icon: Banknote, permKey: "screen:my-pay" },
  { title: "Communications", url: "/communications", icon: MessageSquare, permKey: "screen:communications" },
];

const SUPER_ADMIN_ONLY = ["screen:tenant-management", "screen:role-management"];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const userRole = user?.role || "employee";
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const { data: permData, isLoading: permLoading } = useQuery<{ role: string; permissions: string[]; tenant?: { companyName?: string; logoUrl?: string } }>({
    queryKey: ["/api/my-permissions"],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const { data: fmAddon } = useQuery<{ active: boolean }>({
    queryKey: ["/api/addons/check/fm_services"],
    enabled: !!user && user.role !== "supplier" && user.role !== "employee",
    staleTime: 1000 * 60 * 5,
  });
  const fmEnabled = !!fmAddon?.active;

  const fmNavGroup: NavGroup = {
    label: "FM Services",
    icon: Wrench,
    items: [
      { title: "FM Dashboard", url: "/fm-dashboard", icon: LayoutDashboard, permKey: "screen:dashboard" },
      { title: "FM Workers", url: "/fm-workers", icon: Users, permKey: "screen:dashboard" },
      { title: "FM Jobs", url: "/fm-jobs", icon: ClipboardList, permKey: "screen:dashboard" },
      { title: "FM Scheduler", url: "/fm-scheduler", icon: CalendarDays, permKey: "screen:dashboard" },
      { title: "PPM Schedules", url: "/fm-ppm", icon: CalendarDays, permKey: "screen:dashboard" },
      { title: "FM Suppliers", url: "/fm-suppliers", icon: Truck, permKey: "screen:dashboard" },
      { title: "FM Billing", url: "/fm-billing", icon: BarChart3, permKey: "screen:dashboard" },
      { title: "FM Reports", url: "/fm-reports", icon: BarChart3, permKey: "screen:dashboard" },
      { title: "FM Settings", url: "/fm-settings", icon: Settings, permKey: "screen:dashboard" },
    ],
  };

  const effectiveNavGroups = fmEnabled
    ? [...navGroups.slice(0, 5), fmNavGroup, ...navGroups.slice(5)]
    : navGroups;

  const permsReady = !!permData;

  const hasPermission = (permKey: string) => {
    if (SUPER_ADMIN_ONLY.includes(permKey)) return userRole === "super_admin";
    if (userRole === "super_admin") return true;
    if (!permData) return false;
    if (permData.permissions.includes("*")) return true;
    return permData.permissions.includes(permKey);
  };

  const isSupplier = userRole === "supplier";
  const isEmployee = userRole === "employee";

  const QUICK_ACCESS_KEY = "gardeo_quick_access";
  const MAX_QUICK_ACCESS = 8;

  type QuickAccessEntry = { url: string; visitCount: number; lastVisited: number };

  const allNavItems = useMemo(() => {
    const items: NavItem[] = [];
    for (const g of effectiveNavGroups) {
      for (const item of g.items) items.push(item);
    }
    return items;
  }, [effectiveNavGroups]);

  const getQuickAccessData = useCallback((): QuickAccessEntry[] => {
    try {
      const raw = localStorage.getItem(QUICK_ACCESS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }, []);

  const [quickAccessData, setQuickAccessData] = useState<QuickAccessEntry[]>(getQuickAccessData);

  useEffect(() => {
    if (isSupplier || isEmployee || location === "/") return;
    const matchedItem = allNavItems.find(item => location === item.url || (item.url !== "/" && location.startsWith(item.url)));
    if (!matchedItem) return;

    setQuickAccessData(prev => {
      const existing = prev.find(e => e.url === matchedItem.url);
      let updated: QuickAccessEntry[];
      if (existing) {
        updated = prev.map(e => e.url === matchedItem.url ? { ...e, visitCount: e.visitCount + 1, lastVisited: Date.now() } : e);
      } else {
        updated = [...prev, { url: matchedItem.url, visitCount: 1, lastVisited: Date.now() }];
      }
      localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, [location, isSupplier, isEmployee, allNavItems]);

  const quickAccessItems = useMemo(() => {
    const items = quickAccessData
      .map(entry => {
        const navItem = allNavItems.find(n => n.url === entry.url);
        if (!navItem || !hasPermission(navItem.permKey)) return null;
        return { ...navItem, lastVisited: entry.lastVisited, visitCount: entry.visitCount };
      })
      .filter((x): x is NavItem & { lastVisited: number; visitCount: number } => x !== null);

    items.sort((a, b) => b.lastVisited - a.lastVisited);
    return items.slice(0, MAX_QUICK_ACCESS);
  }, [quickAccessData, allNavItems]);

  const removeQuickAccessItem = useCallback((url: string) => {
    setQuickAccessData(prev => {
      const updated = prev.filter(e => e.url !== url);
      localStorage.setItem(QUICK_ACCESS_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const toggleGroup = (label: string) => {
    setExpandedGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const isGroupExpanded = (group: NavGroup, visibleItems: NavItem[]) => {
    return expandedGroups[group.label] === true;
  };

  const initials = user ? `${user.firstName?.[0] || ""}${user.lastName?.[0] || ""}`.toUpperCase() : "U";

  const renderNavItem = (item: NavItem) => {
    const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
    return (
      <SidebarMenuItem key={item.title + item.url}>
        <SidebarMenuButton asChild data-active={isActive} data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
          <Link href={item.url}>
            <item.icon className="w-4 h-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  const renderFlatPortal = (items: NavItem[], label: string) => {
    const visibleItems = items.filter(item => hasPermission(item.permKey));
    if (visibleItems.length === 0) return null;
    return (
      <SidebarGroup>
        <SidebarGroupLabel className="text-sidebar-foreground/50">{label}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {visibleItems.map(renderNavItem)}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  };

  const renderQuickAccess = () => {
    if (quickAccessItems.length === 0) return null;
    return (
      <SidebarGroup>
        <button
          onClick={() => toggleGroup("Recently Viewed")}
          className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors cursor-pointer text-accent bg-accent/10`}
          data-testid="group-recently-viewed"
        >
          <History className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Recently Viewed</span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expandedGroups["Recently Viewed"] !== false ? "rotate-0" : "-rotate-90"}`} />
        </button>
        {expandedGroups["Recently Viewed"] !== false && (
          <SidebarGroupContent className="mt-1">
            <SidebarMenu>
              {quickAccessItems.map(item => {
                const isActive = location === item.url || (item.url !== "/" && location.startsWith(item.url));
                return (
                  <SidebarMenuItem key={"qa-" + item.url}>
                    <div className="flex items-center group/qa">
                      <SidebarMenuButton asChild data-active={isActive} className="flex-1" data-testid={`nav-recent-${item.title.toLowerCase().replace(/\s+/g, "-")}`}>
                        <Link href={item.url}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeQuickAccessItem(item.url); }}
                        className="opacity-0 group-hover/qa:opacity-100 p-1 rounded hover:bg-sidebar-accent/50 transition-opacity mr-1"
                        title="Remove from Recently Viewed"
                        data-testid={`button-remove-rv-${item.title.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <X className="w-3 h-3 text-sidebar-foreground/40" />
                      </button>
                    </div>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        )}
      </SidebarGroup>
    );
  };

  const renderGroupedNav = () => {
    return effectiveNavGroups.map((group, groupIndex) => {
      const visibleItems = group.items.filter(item => hasPermission(item.permKey));
      if (visibleItems.length === 0) return null;

      if (group.label === "Dashboard") {
        return (
          <SidebarGroup key={group.label}>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
            {groupIndex === 0 && renderQuickAccess()}
          </SidebarGroup>
        );
      }

      const expanded = isGroupExpanded(group, visibleItems);
      const GroupIcon = group.icon;
      const hasActiveChild = visibleItems.some(item => location === item.url || (item.url !== "/" && location.startsWith(item.url)));

      return (
        <SidebarGroup key={group.label}>
          <button
            onClick={() => toggleGroup(group.label)}
            className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
              hasActiveChild
                ? "text-accent bg-accent/10"
                : "text-sidebar-foreground/50 hover:text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
            }`}
            data-testid={`group-${group.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <GroupIcon className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">{group.label}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${expanded ? "rotate-0" : "-rotate-90"}`} />
          </button>
          {expanded && (
            <SidebarGroupContent className="mt-1">
              <SidebarMenu>
                {visibleItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          )}
        </SidebarGroup>
      );
    });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-3" data-testid="link-logo">
          {permData?.tenant?.logoUrl ? (
            <img
              src={permData.tenant.logoUrl}
              alt={permData.tenant.companyName || "Company"}
              className="w-9 h-9 rounded-md object-cover flex-shrink-0"
              data-testid="img-tenant-logo"
            />
          ) : (
            <div className="w-9 h-9 rounded-md bg-accent flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5 text-accent-foreground" />
            </div>
          )}
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm text-sidebar-foreground truncate" data-testid="text-sidebar-company-name">
              {permData?.tenant?.companyName || "Gardeo"}
            </span>
            <span className="text-xs text-sidebar-foreground/60 truncate">Management Platform</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {!permsReady && permLoading ? (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="space-y-1 p-2" data-testid="nav-loading-skeleton">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 flex-1 rounded" />
                  </div>
                ))}
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : isSupplier ? (
          renderFlatPortal(supplierPortalItems, "Supplier Portal")
        ) : isEmployee ? (
          renderFlatPortal(employeePortalItems, "Employee Portal")
        ) : (
          renderGroupedNav()
        )}
      </SidebarContent>
      <SidebarFooter className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8 flex-shrink-0">
            <AvatarFallback className="bg-accent text-accent-foreground text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium text-sidebar-foreground truncate">{user?.firstName} {user?.lastName}</span>
            <span className="text-xs text-sidebar-foreground/60 truncate capitalize">{userRole.replace("_", " ")}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => logout()}
            className="flex-shrink-0 text-sidebar-foreground/60 no-default-hover-elevate no-default-active-elevate"
            data-testid="button-logout"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
