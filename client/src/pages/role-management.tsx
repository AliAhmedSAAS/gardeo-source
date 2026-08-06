import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Shield, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { RolePermission } from "@shared/schema";

const ALL_ROLES = [
  "tenant_admin", "ceo", "operations_manager", "regional_manager", "admin",
  "controller", "scheduler", "hr_manager", "compliance_manager",
  "accountant", "payroll_manager", "training_manager", "supplier", "employee"
] as const;

const ROLE_LABELS: Record<string, string> = {
  tenant_admin: "Tenant Admin",
  ceo: "CEO",
  operations_manager: "Operations Mgr",
  regional_manager: "Regional Mgr",
  admin: "Admin",
  controller: "Controller",
  scheduler: "Scheduler",
  hr_manager: "HR Manager",
  compliance_manager: "Compliance Mgr",
  accountant: "Accountant",
  payroll_manager: "Payroll Mgr",
  training_manager: "Training Mgr",
  supplier: "Supplier",
  employee: "Employee",
};

const PERMISSION_GROUPS: { group: string; permissions: { key: string; label: string }[] }[] = [
  {
    group: "Core",
    permissions: [
      { key: "screen:dashboard", label: "Dashboard" },
      { key: "screen:communications", label: "Communications" },
      { key: "screen:privacy-settings", label: "Privacy & Data" },
    ],
  },
  {
    group: "HR & People",
    permissions: [
      { key: "screen:onboarding", label: "Onboarding (Employee)" },
      { key: "screen:admin-onboarding", label: "Onboarding Management" },
      { key: "screen:employees", label: "Employees" },
      { key: "screen:recruitment", label: "Recruitment" },
      { key: "screen:vetting", label: "Vetting" },
      { key: "screen:compliance", label: "Compliance" },
    ],
  },
  {
    group: "Operations",
    permissions: [
      { key: "screen:scheduling", label: "Scheduling" },
      { key: "screen:control-room", label: "Control Room" },
      { key: "screen:deployment-map", label: "Deployment Map" },
      { key: "screen:ai-scheduling", label: "AI Scheduling" },
      { key: "screen:email-command-centre", label: "Email Command Centre" },
      { key: "screen:ai-analytics", label: "Predictive Analytics" },
    ],
  },
  {
    group: "Suppliers",
    permissions: [
      { key: "screen:suppliers", label: "Suppliers" },
      { key: "screen:supplier-timesheets", label: "Supplier Timesheets" },
      { key: "screen:disputes", label: "Disputes" },
      { key: "screen:supplier-portal", label: "Supplier Portal" },
      { key: "screen:supplier-timesheets-portal", label: "Supplier Timesheets (Portal)" },
      { key: "screen:supplier-invoices", label: "Supplier Invoices" },
      { key: "screen:supplier-documents", label: "Supplier Documents" },
      { key: "screen:supplier-policies", label: "Supplier Policies" },
      { key: "screen:self-billing-agreement", label: "Self-Billing Agreement" },
      { key: "screen:supplier-audit-portal", label: "My Audit Trail (Supplier)" },
    ],
  },
  {
    group: "Finance",
    permissions: [
      { key: "screen:finance", label: "Finance" },
      { key: "screen:self-billing", label: "Self-Billing" },
      { key: "screen:self-billing-audit", label: "Audit Pack (HMRC)" },
      { key: "screen:supplier-hmrc-audit", label: "HMRC Audit Trail" },
    ],
  },
  {
    group: "Employee Portal",
    permissions: [
      { key: "screen:my-shifts", label: "My Shifts" },
      { key: "screen:my-documents", label: "My Documents" },
      { key: "screen:my-profile", label: "My Profile" },
    ],
  },
  {
    group: "Admin & System",
    permissions: [
      { key: "screen:reports", label: "Reports" },
      { key: "screen:audit-trail", label: "Audit Trail" },
      { key: "screen:data-import", label: "Data Import" },
      { key: "screen:company-profile", label: "Company Profile" },
      { key: "screen:compliance-settings", label: "Compliance & Security" },
      { key: "screen:settings", label: "Settings" },
      { key: "screen:addons", label: "Add-Ons" },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.permissions);

const DEFAULT_PERMISSIONS: Record<string, string[]> = {
  tenant_admin: ALL_PERMISSIONS.map(p => p.key).filter(k => k !== "screen:onboarding" && k !== "screen:my-shifts" && k !== "screen:my-documents" && k !== "screen:my-profile" && k !== "screen:supplier-portal" && k !== "screen:supplier-timesheets-portal" && k !== "screen:supplier-invoices" && k !== "screen:supplier-documents" && k !== "screen:supplier-policies" && k !== "screen:self-billing-agreement"),
  ceo: ALL_PERMISSIONS.map(p => p.key).filter(k => k !== "screen:onboarding" && k !== "screen:my-shifts" && k !== "screen:my-documents" && k !== "screen:my-profile" && k !== "screen:supplier-portal" && k !== "screen:supplier-timesheets-portal" && k !== "screen:supplier-invoices" && k !== "screen:supplier-documents" && k !== "screen:supplier-policies" && k !== "screen:self-billing-agreement" && k !== "screen:settings"),
  operations_manager: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:employees", "screen:scheduling", "screen:control-room", "screen:deployment-map", "screen:ai-scheduling", "screen:email-command-centre", "screen:ai-analytics", "screen:suppliers", "screen:supplier-timesheets", "screen:disputes", "screen:finance", "screen:self-billing", "screen:self-billing-audit", "screen:supplier-hmrc-audit", "screen:reports", "screen:company-profile", "screen:compliance-settings"],
  regional_manager: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:employees", "screen:scheduling", "screen:control-room", "screen:deployment-map", "screen:ai-scheduling", "screen:email-command-centre", "screen:ai-analytics", "screen:suppliers", "screen:supplier-timesheets", "screen:disputes", "screen:finance", "screen:self-billing", "screen:self-billing-audit", "screen:reports", "screen:company-profile"],
  admin: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:admin-onboarding", "screen:employees", "screen:recruitment", "screen:vetting", "screen:compliance", "screen:scheduling", "screen:control-room", "screen:deployment-map", "screen:ai-scheduling", "screen:email-command-centre", "screen:ai-analytics", "screen:suppliers", "screen:supplier-timesheets", "screen:disputes", "screen:finance", "screen:self-billing", "screen:self-billing-audit", "screen:supplier-hmrc-audit", "screen:reports", "screen:audit-trail", "screen:data-import", "screen:company-profile", "screen:compliance-settings", "screen:settings"],
  controller: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:employees", "screen:scheduling", "screen:control-room", "screen:deployment-map", "screen:ai-scheduling", "screen:email-command-centre", "screen:ai-analytics"],
  scheduler: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:employees", "screen:scheduling", "screen:deployment-map", "screen:ai-scheduling", "screen:email-command-centre", "screen:ai-analytics"],
  hr_manager: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:admin-onboarding", "screen:employees", "screen:recruitment", "screen:vetting", "screen:compliance", "screen:scheduling", "screen:control-room", "screen:deployment-map", "screen:ai-scheduling", "screen:ai-analytics", "screen:suppliers", "screen:supplier-timesheets", "screen:disputes", "screen:finance", "screen:self-billing", "screen:self-billing-audit", "screen:reports", "screen:data-import", "screen:compliance-settings"],
  compliance_manager: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:admin-onboarding", "screen:employees", "screen:vetting", "screen:compliance", "screen:reports", "screen:compliance-settings"],
  accountant: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:suppliers", "screen:supplier-timesheets", "screen:disputes", "screen:finance", "screen:self-billing", "screen:self-billing-audit", "screen:supplier-hmrc-audit", "screen:reports"],
  payroll_manager: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:employees", "screen:supplier-timesheets", "screen:finance", "screen:self-billing", "screen:self-billing-audit", "screen:reports"],
  training_manager: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:admin-onboarding", "screen:employees", "screen:compliance"],
  supplier: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:disputes", "screen:supplier-portal", "screen:supplier-timesheets-portal", "screen:supplier-invoices", "screen:supplier-documents", "screen:supplier-policies", "screen:self-billing-agreement", "screen:supplier-audit-portal"],
  employee: ["screen:dashboard", "screen:communications", "screen:privacy-settings", "screen:onboarding", "screen:my-shifts", "screen:my-documents", "screen:my-profile"],
};

export default function RoleManagement() {
  const { toast } = useToast();
  const [searchFilter, setSearchFilter] = useState("");
  const [permState, setPermState] = useState<Record<string, Record<string, boolean>>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: existingPerms = [], isLoading } = useQuery<RolePermission[]>({
    queryKey: ["/api/role-permissions"],
  });

  useEffect(() => {
    const state: Record<string, Record<string, boolean>> = {};
    for (const role of ALL_ROLES) {
      state[role] = {};
      for (const perm of ALL_PERMISSIONS) {
        const existing = existingPerms.find(p => p.role === role && p.permissionKey === perm.key);
        if (existing) {
          state[role][perm.key] = existing.enabled;
        } else {
          state[role][perm.key] = DEFAULT_PERMISSIONS[role]?.includes(perm.key) ?? false;
        }
      }
    }
    setPermState(state);
    setHasChanges(false);
  }, [existingPerms]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const permissions: { role: string; permissionKey: string; enabled: boolean }[] = [];
      for (const role of ALL_ROLES) {
        for (const perm of ALL_PERMISSIONS) {
          permissions.push({ role, permissionKey: perm.key, enabled: permState[role]?.[perm.key] ?? false });
        }
      }
      await apiRequest("PUT", "/api/role-permissions", { permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/role-permissions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-permissions"] });
      toast({ title: "Permissions saved", description: "Role permissions have been updated successfully." });
      setHasChanges(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const togglePerm = (role: string, key: string) => {
    setPermState(prev => ({
      ...prev,
      [role]: { ...prev[role], [key]: !prev[role]?.[key] },
    }));
    setHasChanges(true);
  };

  const toggleAllForRole = (role: string, enable: boolean) => {
    setPermState(prev => {
      const updated = { ...prev[role] };
      for (const perm of ALL_PERMISSIONS) {
        updated[perm.key] = enable;
      }
      return { ...prev, [role]: updated };
    });
    setHasChanges(true);
  };

  const toggleAllForPermission = (key: string, enable: boolean) => {
    setPermState(prev => {
      const newState = { ...prev };
      for (const role of ALL_ROLES) {
        newState[role] = { ...newState[role], [key]: enable };
      }
      return newState;
    });
    setHasChanges(true);
  };

  const resetToDefaults = () => {
    const state: Record<string, Record<string, boolean>> = {};
    for (const role of ALL_ROLES) {
      state[role] = {};
      for (const perm of ALL_PERMISSIONS) {
        state[role][perm.key] = DEFAULT_PERMISSIONS[role]?.includes(perm.key) ?? false;
      }
    }
    setPermState(state);
    setHasChanges(true);
  };

  const filteredGroups = useMemo(() => {
    if (!searchFilter) return PERMISSION_GROUPS;
    const lf = searchFilter.toLowerCase();
    return PERMISSION_GROUPS.map(g => ({
      ...g,
      permissions: g.permissions.filter(p => p.label.toLowerCase().includes(lf) || g.group.toLowerCase().includes(lf)),
    })).filter(g => g.permissions.length > 0);
  }, [searchFilter]);

  const permCount = (role: string) => {
    if (!permState[role]) return 0;
    return Object.values(permState[role]).filter(Boolean).length;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="role-management-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2" data-testid="text-page-title">
            <Shield className="w-6 h-6 text-accent" />
            Role & Permission Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure which screens and functions each role can access. Super Admin always has full access.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetToDefaults} data-testid="button-reset-defaults">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!hasChanges || saveMutation.isPending} data-testid="button-save-permissions">
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-2 text-sm text-amber-800 dark:text-amber-200" data-testid="unsaved-changes-banner">
          You have unsaved changes. Click "Save Changes" to apply them.
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search screens..."
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="pl-9 max-w-sm"
          data-testid="input-search-permissions"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="permissions-table">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/50 min-w-[200px] z-10">
                    Screen / Function
                  </th>
                  {ALL_ROLES.map(role => (
                    <th key={role} className="p-2 text-center min-w-[90px]">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xs font-medium text-foreground leading-tight">{ROLE_LABELS[role]}</span>
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {permCount(role)}/{ALL_PERMISSIONS.length}
                        </Badge>
                        <div className="flex gap-1 mt-0.5">
                          <button
                            onClick={() => toggleAllForRole(role, true)}
                            className="text-[10px] text-blue-600 hover:underline"
                            data-testid={`button-select-all-${role}`}
                          >
                            All
                          </button>
                          <span className="text-muted-foreground text-[10px]">|</span>
                          <button
                            onClick={() => toggleAllForRole(role, false)}
                            className="text-[10px] text-red-600 hover:underline"
                            data-testid={`button-clear-all-${role}`}
                          >
                            None
                          </button>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map(group => (
                  <>
                    <tr key={`group-${group.group}`} className="bg-muted/30">
                      <td colSpan={ALL_ROLES.length + 1} className="p-2 pl-3 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                        {group.group}
                      </td>
                    </tr>
                    {group.permissions.map(perm => (
                      <tr key={perm.key} className="border-b border-border/50 hover:bg-muted/20">
                        <td className="p-3 font-medium text-foreground sticky left-0 bg-background z-10">
                          <div className="flex items-center justify-between">
                            <span>{perm.label}</span>
                            <div className="flex gap-1 mr-2">
                              <button
                                onClick={() => toggleAllForPermission(perm.key, true)}
                                className="text-[10px] text-blue-600 hover:underline"
                              >
                                All
                              </button>
                              <span className="text-muted-foreground text-[10px]">|</span>
                              <button
                                onClick={() => toggleAllForPermission(perm.key, false)}
                                className="text-[10px] text-red-600 hover:underline"
                              >
                                None
                              </button>
                            </div>
                          </div>
                        </td>
                        {ALL_ROLES.map(role => (
                          <td key={`${role}-${perm.key}`} className="p-2 text-center">
                            <Checkbox
                              checked={permState[role]?.[perm.key] ?? false}
                              onCheckedChange={() => togglePerm(role, perm.key)}
                              data-testid={`checkbox-${role}-${perm.key}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
