import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Textarea } from "@/components/ui/textarea";
import type { User, Tenant, TenantInvitation, DocumentTemplate } from "@shared/schema";
import {
  Settings, Users, Building2, Shield, Search, Edit, Key, UserCog,
  Loader2, Clock, FileText, CreditCard, CheckCircle2, Mail, Plus,
  Trash2, Send, UserPlus, XCircle, Upload, Camera, Save, Image,
  Copy, Star, Eye, ChevronUp, ChevronDown, GripVertical, MapPin,
  Link2, Link2Off, RefreshCw, AlertCircle, Plug,
} from "lucide-react";
import { TenantEmailSettingsCard } from "@/components/settings/TenantEmailSettingsCard";
import { TenantOfficerTypesSettingsCard } from "@/components/settings/TenantOfficerTypesSettingsCard";

type SafeUser = Omit<User, "password">;

const ROLES = [
  "super_admin", "tenant_admin", "ceo", "operations_manager",
  "regional_manager", "admin", "controller", "scheduler",
  "hr_manager", "compliance_manager", "accountant", "payroll_manager",
  "training_manager", "supplier", "employee",
] as const;

const INVITE_ROLES = [
  "tenant_admin", "ceo", "operations_manager", "regional_manager",
  "admin", "controller", "scheduler", "hr_manager",
  "compliance_manager", "accountant", "payroll_manager",
  "training_manager", "employee",
] as const;

const ROLE_CONFIG: Record<string, { label: string; className: string; description?: string }> = {
  super_admin: { label: "Super Admin", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", description: "Platform-wide administration" },
  tenant_admin: { label: "Tenant Admin", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", description: "Full tenant access & billing" },
  ceo: { label: "CEO", className: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400", description: "Executive overview & reports" },
  operations_manager: { label: "Operations Manager", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400", description: "Operations, scheduling & sites" },
  regional_manager: { label: "Regional Manager", className: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400", description: "Regional sites & employees" },
  admin: { label: "Admin", className: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-400", description: "Settings, users & configuration" },
  controller: { label: "Controller", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", description: "Control room & live shifts" },
  scheduler: { label: "Scheduler", className: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400", description: "Shift scheduling & rotas" },
  hr_manager: { label: "HR Manager", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", description: "Employees, onboarding & recruitment" },
  compliance_manager: { label: "Compliance Manager", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400", description: "SIA, DBS & compliance tracking" },
  accountant: { label: "Accountant", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", description: "Finance & invoicing" },
  payroll_manager: { label: "Payroll Manager", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", description: "Payroll & timesheets" },
  training_manager: { label: "Training Manager", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400", description: "Training records & compliance" },
  supplier: { label: "Supplier", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", description: "Supplier portal access" },
  employee: { label: "Employee", className: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400", description: "Security officer portal" },
};

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  revoked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  expired: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function LeaveEntitlementSettingsCard() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { data: leaveSettings } = useQuery<{ defaultLeaveEntitlementDays: number; leaveCarryForwardCapDays: number }>({
    queryKey: ["/api/tenant/leave-settings"],
  });
  const [entitlementDays, setEntitlementDays] = useState(28);
  const [carryForwardCap, setCarryForwardCap] = useState(5);

  useEffect(() => {
    if (leaveSettings) {
      setEntitlementDays(leaveSettings.defaultLeaveEntitlementDays);
      setCarryForwardCap(leaveSettings.leaveCarryForwardCapDays);
    }
  }, [leaveSettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { defaultLeaveEntitlementDays: number; leaveCarryForwardCapDays: number }) => {
      const res = await apiRequest("PATCH", "/api/tenant/leave-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/leave-settings"] });
      toast({ title: "Leave settings updated", description: "Default annual leave entitlement settings have been saved." });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update leave settings.", variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-sm">Annual Leave Entitlement</h3>
            <p className="text-xs text-muted-foreground">Default leave entitlement and carry-forward cap for all employees.</p>
          </div>
          {!isEditing && (
            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-leave-settings">
              <Edit className="w-3.5 h-3.5 mr-1" /> Edit
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="entitlementDays" className="text-xs">Default Annual Entitlement (days)</Label>
                <Input
                  id="entitlementDays"
                  type="number"
                  min={0}
                  max={365}
                  value={entitlementDays}
                  onChange={(e) => setEntitlementDays(parseInt(e.target.value) || 28)}
                  data-testid="input-leave-entitlement-days"
                />
                <p className="text-xs text-muted-foreground">UK statutory minimum is 28 days (incl. bank holidays)</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="carryForwardCap" className="text-xs">Max Carry-Forward Cap (days)</Label>
                <Input
                  id="carryForwardCap"
                  type="number"
                  min={0}
                  max={365}
                  value={carryForwardCap}
                  onChange={(e) => setCarryForwardCap(parseInt(e.target.value) || 5)}
                  data-testid="input-leave-carry-forward-cap"
                />
                <p className="text-xs text-muted-foreground">Max unused days rolled into the next year</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate({ defaultLeaveEntitlementDays: entitlementDays, leaveCarryForwardCapDays: carryForwardCap })}
                disabled={updateMutation.isPending}
                data-testid="button-save-leave-settings"
              >
                {updateMutation.isPending && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />}
                <Save className="w-3.5 h-3.5 mr-1" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); if (leaveSettings) { setEntitlementDays(leaveSettings.defaultLeaveEntitlementDays); setCarryForwardCap(leaveSettings.leaveCarryForwardCapDays); } }} data-testid="button-cancel-leave-settings">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Default Entitlement</p>
              <p className="text-sm font-medium" data-testid="text-leave-entitlement-days">{leaveSettings?.defaultLeaveEntitlementDays ?? 28} days</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Max Carry-Forward</p>
              <p className="text-sm font-medium" data-testid="text-leave-carry-forward-cap">{leaveSettings?.leaveCarryForwardCapDays ?? 5} days</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function GeofenceSettingsCard() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { data: geoSettings } = useQuery<{ checkinTimeWindowMinutes: number; geofenceRadiusMetres: number }>({
    queryKey: ["/api/tenant/geofence-settings"],
  });
  const [timeWindow, setTimeWindow] = useState(10);
  const [geofenceRadius, setGeofenceRadius] = useState(200);

  useEffect(() => {
    if (geoSettings) {
      setTimeWindow(geoSettings.checkinTimeWindowMinutes);
      setGeofenceRadius(geoSettings.geofenceRadiusMetres);
    }
  }, [geoSettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { checkinTimeWindowMinutes: number; geofenceRadiusMetres: number }) => {
      const res = await apiRequest("PATCH", "/api/tenant/geofence-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/geofence-settings"] });
      setIsEditing(false);
      toast({ title: "Settings updated", description: "Check-in/check-out settings have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <MapPin className="w-5 h-5 text-muted-foreground" />
            <h3 className="font-semibold">Check-in / Check-out Settings</h3>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-geofence">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="timeWindow">Time Window (minutes)</Label>
                <Input
                  id="timeWindow"
                  type="number"
                  min={1}
                  max={60}
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(parseInt(e.target.value) || 10)}
                  data-testid="input-time-window"
                />
                <p className="text-xs text-muted-foreground">
                  Employees can check in/out within this many minutes of the scheduled time
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="geofenceRadius">Geofence Radius (metres)</Label>
                <Input
                  id="geofenceRadius"
                  type="number"
                  min={50}
                  max={5000}
                  value={geofenceRadius}
                  onChange={(e) => setGeofenceRadius(parseInt(e.target.value) || 200)}
                  data-testid="input-geofence-radius"
                />
                <p className="text-xs text-muted-foreground">
                  Employees must be within this distance of the site to check in/out
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate({ checkinTimeWindowMinutes: timeWindow, geofenceRadiusMetres: geofenceRadius })}
                disabled={updateMutation.isPending}
                data-testid="button-save-geofence"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); if (geoSettings) { setTimeWindow(geoSettings.checkinTimeWindowMinutes); setGeofenceRadius(geoSettings.geofenceRadiusMetres); } }} data-testid="button-cancel-geofence">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Check-in/out Time Window</span>
              <Badge className="no-default-hover-elevate no-default-active-elevate bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid="text-time-window">
                &#177; {geoSettings?.checkinTimeWindowMinutes ?? 10} minutes
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">Geofence Radius</span>
              <Badge className="no-default-hover-elevate no-default-active-elevate bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid="text-geofence-radius">
                {geoSettings?.geofenceRadiusMetres ?? 200}m
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SupplierVisibilitySettingsCard() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { data: visSettings } = useQuery<{ supplierDataVisibilityMonths: number | null }>({
    queryKey: ["/api/tenant/supplier-visibility-settings"],
  });
  const [months, setMonths] = useState<string>("");

  useEffect(() => {
    if (visSettings) {
      setMonths(visSettings.supplierDataVisibilityMonths?.toString() ?? "");
    }
  }, [visSettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { supplierDataVisibilityMonths: number | null }) => {
      const res = await apiRequest("PATCH", "/api/tenant/supplier-visibility-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/supplier-visibility-settings"] });
      setIsEditing(false);
      toast({ title: "Settings updated", description: "Supplier data visibility window has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const currentMonths = visSettings?.supplierDataVisibilityMonths;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Supplier Data Visibility</h3>
              <p className="text-xs text-muted-foreground">Control how far back suppliers can see timesheets and invoices</p>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-supplier-visibility">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="visibilityMonths">Default visibility window (months)</Label>
              <Select
                value={months || "unlimited"}
                onValueChange={(v) => setMonths(v === "unlimited" ? "" : v)}
              >
                <SelectTrigger data-testid="select-visibility-months">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unlimited">Unlimited (no restriction)</SelectItem>
                  <SelectItem value="1">1 month</SelectItem>
                  <SelectItem value="3">3 months</SelectItem>
                  <SelectItem value="6">6 months</SelectItem>
                  <SelectItem value="12">12 months</SelectItem>
                  <SelectItem value="24">24 months</SelectItem>
                  <SelectItem value="36">36 months</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Suppliers will only see data from the last N months. Individual suppliers can be overridden on their detail page.
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate({ supplierDataVisibilityMonths: months ? parseInt(months) : null })}
                disabled={updateMutation.isPending}
                data-testid="button-save-supplier-visibility"
              >
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setMonths(currentMonths?.toString() ?? ""); }} data-testid="button-cancel-supplier-visibility">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Default Window</span>
            <Badge className="no-default-hover-elevate no-default-active-elevate bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid="text-visibility-months">
              {currentMonths ? `${currentMonths} months` : "Unlimited"}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProbationSettingsCard() {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const { data: probSettings } = useQuery<{ defaultProbationWeeks: number }>({
    queryKey: ["/api/tenant/probation-settings"],
  });
  const [weeks, setWeeks] = useState("12");

  useEffect(() => {
    if (probSettings) setWeeks(String(probSettings.defaultProbationWeeks ?? 12));
  }, [probSettings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { defaultProbationWeeks: number }) => {
      const res = await apiRequest("PATCH", "/api/tenant/probation-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/probation-settings"] });
      setIsEditing(false);
      toast({ title: "Settings updated", description: "Default probation period has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">Probation Period Settings</h3>
              <p className="text-xs text-muted-foreground">Default probation length for new starters — used to auto-set review dates</p>
            </div>
          </div>
          {!isEditing && (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} data-testid="button-edit-probation-settings">
              <Edit className="w-4 h-4 mr-1" /> Edit
            </Button>
          )}
        </div>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="probationWeeks">Default probation period (weeks)</Label>
              <Select value={weeks} onValueChange={setWeeks}>
                <SelectTrigger data-testid="select-probation-weeks">
                  <SelectValue placeholder="Select weeks..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 weeks</SelectItem>
                  <SelectItem value="8">8 weeks</SelectItem>
                  <SelectItem value="12">12 weeks (standard)</SelectItem>
                  <SelectItem value="16">16 weeks</SelectItem>
                  <SelectItem value="26">26 weeks (6 months)</SelectItem>
                  <SelectItem value="52">52 weeks (1 year)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                When a new employee is added with a start date, the probation review date is automatically set to start date + this duration.
                Review reminders are sent at 28 days and 7 days before the review date.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => updateMutation.mutate({ defaultProbationWeeks: parseInt(weeks) })} disabled={updateMutation.isPending} data-testid="button-save-probation-settings">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
              <Button variant="outline" size="sm" onClick={() => { setIsEditing(false); setWeeks(String(probSettings?.defaultProbationWeeks ?? 12)); }} data-testid="button-cancel-probation-settings">
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">Default Period</span>
            <Badge className="no-default-hover-elevate no-default-active-elevate bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid="text-probation-weeks">
              {probSettings?.defaultProbationWeeks ?? 12} weeks
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type TemplateSection = { heading: string; text: string };

function DocumentTemplatesTab() {
  const { toast } = useToast();
  const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [editHeaderTitle, setEditHeaderTitle] = useState("");
  const [editHeaderSubtitle, setEditHeaderSubtitle] = useState("");
  const [editSections, setEditSections] = useState<TemplateSection[]>([]);
  const [editFooterText, setEditFooterText] = useState("");
  const [editComplianceText, setEditComplianceText] = useState("");
  const [editPaymentTermsText, setEditPaymentTermsText] = useState("");
  const [editInvoiceFormat, setEditInvoiceFormat] = useState<string>("detailed");
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [defaultConfirmId, setDefaultConfirmId] = useState<number | null>(null);
  const [agreementOpen, setAgreementOpen] = useState(true);
  const [invoiceOpen, setInvoiceOpen] = useState(true);
  const [timesheetOpen, setTimesheetOpen] = useState(true);
  const [purchaseLedgerOpen, setPurchaseLedgerOpen] = useState(true);

  const { data: templates = [], isLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/document-templates"],
  });

  const agreementTemplates = templates.filter(t => t.documentType === "self_billing_agreement");
  const invoiceTemplates = templates.filter(t => t.documentType === "self_billing_invoice");
  const timesheetTemplates = templates.filter(t => t.documentType === "timesheet");
  const purchaseLedgerTemplates = templates.filter(t => t.documentType === "purchase_ledger");

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/document-templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setEditingTemplate(null);
      toast({ title: "Template saved", description: "Your changes have been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("POST", `/api/document-templates/${id}/duplicate`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setEditingTemplate(null);
      toast({ title: "Template created", description: "A new template has been created from your changes." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/document-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setDeleteConfirmId(null);
      toast({ title: "Template deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/document-templates/${id}/set-default`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/document-templates"] });
      setDefaultConfirmId(null);
      toast({ title: "Default template updated", description: "This template will now be used for new documents." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const openEditor = (template: DocumentTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditHeaderTitle(template.headerTitle || "");
    setEditHeaderSubtitle(template.headerSubtitle || "");
    setEditSections(Array.isArray(template.sections) ? (template.sections as TemplateSection[]) : []);
    setEditFooterText(template.footerText || "");
    setEditComplianceText(template.complianceText || "");
    setEditPaymentTermsText(template.paymentTermsText || "");
    setEditInvoiceFormat((template as any).invoiceFormat || "detailed");
  };

  const handleSave = () => {
    if (!editingTemplate) return;
    const data: any = {
      name: editName,
      headerTitle: editHeaderTitle || null,
      headerSubtitle: editHeaderSubtitle || null,
      sections: editSections.length > 0 ? editSections : null,
      footerText: editFooterText || null,
      complianceText: editComplianceText || null,
      paymentTermsText: editPaymentTermsText || null,
      ...((editingTemplate.documentType === "self_billing_invoice" || editingTemplate.documentType === "timesheet") && { invoiceFormat: editInvoiceFormat }),
    };
    updateMutation.mutate({ id: editingTemplate.id, data });
  };

  const handleSaveAsNew = () => {
    if (!editingTemplate) return;
    const data: any = {
      name: editName + " (Copy)",
      headerTitle: editHeaderTitle || null,
      headerSubtitle: editHeaderSubtitle || null,
      sections: editSections.length > 0 ? editSections : null,
      footerText: editFooterText || null,
      complianceText: editComplianceText || null,
      paymentTermsText: editPaymentTermsText || null,
      ...((editingTemplate.documentType === "self_billing_invoice" || editingTemplate.documentType === "timesheet") && { invoiceFormat: editInvoiceFormat }),
    };
    duplicateMutation.mutate({ id: editingTemplate.id, data });
  };

  const handlePreview = (id: number, vatParam?: string) => {
    const url = vatParam !== undefined ? `/api/document-templates/${id}/preview?vat=${vatParam}` : `/api/document-templates/${id}/preview`;
    window.open(url, "_blank");
  };

  const addSection = () => {
    setEditSections([...editSections, { heading: "New Clause", text: "" }]);
  };

  const removeSection = (index: number) => {
    setEditSections(editSections.filter((_, i) => i !== index));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newSections = [...editSections];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSections.length) return;
    [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
    setEditSections(newSections);
  };

  const updateSection = (index: number, field: "heading" | "text", value: string) => {
    const newSections = [...editSections];
    newSections[index] = { ...newSections[index], [field]: value };
    setEditSections(newSections);
  };

  const renderTemplateCard = (template: DocumentTemplate) => (
    <Card key={template.id} data-testid={`card-template-${template.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
              <FileText className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-sm truncate" data-testid={`text-template-name-${template.id}`}>{template.name}</h3>
                {template.isDefault && (
                  <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-default-${template.id}`}>
                    <Star className="w-3 h-3 mr-1" />
                    Default
                  </Badge>
                )}
                {template.documentType === "self_billing_invoice" && (template as any).invoiceFormat === "summary" && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-format-${template.id}`}>
                    Summary
                  </Badge>
                )}
                {template.documentType === "self_billing_invoice" && (template as any).invoiceFormat === "with_remittance" && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid={`badge-format-remit-${template.id}`}>
                    With Remittance
                  </Badge>
                )}
                {template.documentType === "self_billing_invoice" && (template as any).invoiceFormat === "summary_with_remittance" && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" data-testid={`badge-format-summary-remit-${template.id}`}>
                    Summary + Remittance
                  </Badge>
                )}
                {template.documentType === "timesheet" && (template as any).invoiceFormat === "with_officer" && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-format-officer-${template.id}`}>
                    With Officer
                  </Badge>
                )}
                {template.documentType === "timesheet" && (template as any).invoiceFormat === "without_officer" && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-format-no-officer-${template.id}`}>
                    Without Officer
                  </Badge>
                )}
                {template.documentType === "timesheet" && (template as any).invoiceFormat === "detailed" && (
                  <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid={`badge-format-detailed-${template.id}`}>
                    Detailed (Landscape)
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground" data-testid={`text-template-updated-${template.id}`}>
                Updated {formatDateTime(template.updatedAt as unknown as string)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {template.documentType === "self_billing_agreement" ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid={`button-preview-${template.id}`} title="Preview PDF">
                    <Eye className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handlePreview(template.id, "true")} data-testid={`button-preview-vat-${template.id}`}>
                    Preview (VAT Supplier)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePreview(template.id, "false")} data-testid={`button-preview-nonvat-${template.id}`}>
                    Preview (Non-VAT Supplier)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : template.documentType !== "timesheet" ? (
              <Button variant="ghost" size="sm" onClick={() => handlePreview(template.id)} data-testid={`button-preview-${template.id}`} title="Preview PDF">
                <Eye className="w-4 h-4" />
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" onClick={() => openEditor(template)} data-testid={`button-edit-${template.id}`} title="Edit">
              <Edit className="w-4 h-4" />
            </Button>
            {!template.isDefault && (
              <Button variant="ghost" size="sm" onClick={() => setDefaultConfirmId(template.id)} data-testid={`button-set-default-${template.id}`} title="Set as Default">
                <Star className="w-4 h-4" />
              </Button>
            )}
            {!template.isDefault && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteConfirmId(template.id)} data-testid={`button-delete-template-${template.id}`} title="Delete">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="templates-tab">
      <div className="space-y-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2 w-full justify-start"
          onClick={() => setAgreementOpen(!agreementOpen)}
          data-testid="button-toggle-agreement-section"
        >
          {agreementOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          <span className="text-lg font-semibold">Self-Billing Agreement Templates</span>
          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">{agreementTemplates.length}</Badge>
        </Button>
        {agreementOpen && (
          <div className="space-y-2 pl-6">
            {agreementTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No agreement templates found. They will be auto-created when needed.</p>
            ) : (
              agreementTemplates.map(renderTemplateCard)
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2 w-full justify-start"
          onClick={() => setInvoiceOpen(!invoiceOpen)}
          data-testid="button-toggle-invoice-section"
        >
          {invoiceOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          <span className="text-lg font-semibold">Self-Billing Invoice Templates</span>
          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">{invoiceTemplates.length}</Badge>
        </Button>
        {invoiceOpen && (
          <div className="space-y-2 pl-6">
            {invoiceTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No invoice templates found. They will be auto-created when needed.</p>
            ) : (
              invoiceTemplates.map(renderTemplateCard)
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2 w-full justify-start"
          onClick={() => setTimesheetOpen(!timesheetOpen)}
          data-testid="button-toggle-timesheet-section"
        >
          {timesheetOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          <span className="text-lg font-semibold">Timesheet Templates</span>
          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">{timesheetTemplates.length}</Badge>
        </Button>
        {timesheetOpen && (
          <div className="space-y-2 pl-6">
            {timesheetTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No timesheet templates found.</p>
            ) : (
              timesheetTemplates.map(renderTemplateCard)
            )}
            <p className="text-xs text-muted-foreground pt-2">
              Set the default timesheet template to control whether officer names appear on downloaded timesheets. The template marked as default will be used for all timesheet PDF downloads.
            </p>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <Button
          variant="ghost"
          className="flex items-center gap-2 w-full justify-start"
          onClick={() => setPurchaseLedgerOpen(!purchaseLedgerOpen)}
          data-testid="button-toggle-purchase-ledger-section"
        >
          {purchaseLedgerOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          <span className="text-lg font-semibold">Purchase Ledger Format</span>
          <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate">{purchaseLedgerTemplates.length}</Badge>
        </Button>
        {purchaseLedgerOpen && (
          <div className="space-y-2 pl-6">
            {purchaseLedgerTemplates.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No purchase ledger format options found. Visit the Purchase Ledger page to initialise them.</p>
            ) : (
              purchaseLedgerTemplates.map((template) => (
                <Card key={template.id} data-testid={`card-pl-template-${template.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-primary/10">
                          <FileText className="w-4 h-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-medium text-sm" data-testid={`text-pl-template-name-${template.id}`}>{template.name}</h3>
                            {template.isDefault && (
                              <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 no-default-hover-elevate no-default-active-elevate text-xs" data-testid={`badge-pl-default-${template.id}`}>
                                <Star className="w-3 h-3 mr-1" />
                                Active
                              </Badge>
                            )}
                            {(template as any).invoiceFormat === "accounting_style" && (
                              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid={`badge-pl-format-${template.id}`}>
                                Accounting Style
                              </Badge>
                            )}
                            {(template as any).invoiceFormat === "hmrc_audit" && (
                              <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" data-testid={`badge-pl-hmrc-${template.id}`}>
                                HMRC Audit
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {(template as any).invoiceFormat === "accounting_style"
                              ? "Invoice Date, Contact, Source, Reference, Due Date, Net, Gross, VAT, Payments/Debits, Balance — with a bold Total row and page footer."
                              : "Full HMRC audit trail: Date, Vendor, VAT No., Description, Category, Net, VAT%, VAT, Gross, VAT Status, Payment, Bank Ref, Source."}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {!template.isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDefaultConfirmId(template.id)}
                            data-testid={`button-pl-set-active-${template.id}`}
                          >
                            <Star className="w-3.5 h-3.5 mr-1" />
                            Set Active
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
            <p className="text-xs text-muted-foreground pt-2">
              The active format is used when exporting the Purchase Ledger as PDF. Switch between the HMRC audit trail layout and the accounting-software-style ledger layout by clicking "Set Active".
            </p>
          </div>
        )}
      </div>

      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {editingTemplate && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                    <Edit className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <DialogTitle data-testid="text-edit-template-title">Edit Template</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      {editingTemplate.documentType === "self_billing_agreement" ? "Self-Billing Agreement" : editingTemplate.documentType === "timesheet" ? "Timesheet" : "Self-Billing Invoice"}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    data-testid="input-template-name"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Header Title</Label>
                  <Input
                    value={editHeaderTitle}
                    onChange={(e) => setEditHeaderTitle(e.target.value)}
                    placeholder="e.g. SELF-BILLING AGREEMENT"
                    data-testid="input-header-title"
                  />
                </div>

                {editingTemplate.documentType === "self_billing_agreement" && (
                  <>
                    <div className="space-y-2">
                      <Label>Header Subtitle</Label>
                      <Input
                        value={editHeaderSubtitle}
                        onChange={(e) => setEditHeaderSubtitle(e.target.value)}
                        placeholder="e.g. Under VAT Regulations 1995"
                        data-testid="input-header-subtitle"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Agreement Clauses</Label>
                        <Button variant="outline" size="sm" onClick={addSection} data-testid="button-add-clause">
                          <Plus className="w-3 h-3 mr-1" />
                          Add Clause
                        </Button>
                      </div>
                      {editSections.map((section, index) => (
                        <Card key={index} data-testid={`card-clause-${index}`}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs text-muted-foreground font-medium w-6 flex-shrink-0">{index + 1}.</span>
                              <Input
                                value={section.heading}
                                onChange={(e) => updateSection(index, "heading", e.target.value)}
                                className="h-8 text-sm font-medium"
                                data-testid={`input-clause-heading-${index}`}
                              />
                              <div className="flex items-center gap-0.5 flex-shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => moveSection(index, "up")} disabled={index === 0} data-testid={`button-clause-up-${index}`}>
                                  <ChevronUp className="w-3 h-3" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => moveSection(index, "down")} disabled={index === editSections.length - 1} data-testid={`button-clause-down-${index}`}>
                                  <ChevronDown className="w-3 h-3" />
                                </Button>
                                <Button variant="destructive" size="icon" onClick={() => removeSection(index)} data-testid={`button-clause-remove-${index}`}>
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            <Textarea
                              value={section.text}
                              onChange={(e) => updateSection(index, "text", e.target.value)}
                              className="text-sm min-h-[60px]"
                              data-testid={`textarea-clause-text-${index}`}
                            />
                          </CardContent>
                        </Card>
                      ))}
                      {editSections.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No clauses defined. The default agreement terms will be used.</p>
                      )}
                    </div>
                  </>
                )}

                {editingTemplate.documentType === "timesheet" && (
                  <div className="space-y-2">
                    <Label>Timesheet Format</Label>
                    <Select value={editInvoiceFormat} onValueChange={setEditInvoiceFormat}>
                      <SelectTrigger data-testid="select-timesheet-format">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="without_officer">Without Officer — Date, Site, Hours, Rate, Amount</SelectItem>
                        <SelectItem value="with_officer">With Officer — Date, Officer, Site, Hours, Rate, Amount</SelectItem>
                        <SelectItem value="detailed">Detailed — Date, Site, Start, End, Hours, Rate, Amount (landscape)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {editInvoiceFormat === "with_officer"
                        ? "The timesheet will include an Officer column showing the assigned employee name for each shift."
                        : editInvoiceFormat === "detailed"
                        ? "Landscape layout with Date, Site, Start, End, Hours, Rate and Amount columns."
                        : "The timesheet will show shift details without officer names."}
                    </p>
                  </div>
                )}

                {editingTemplate.documentType === "self_billing_invoice" && (
                  <>
                    <div className="space-y-2">
                      <Label>Invoice Format</Label>
                      <Select value={editInvoiceFormat} onValueChange={setEditInvoiceFormat}>
                        <SelectTrigger data-testid="select-invoice-format">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="detailed">Detailed — List every shift as a line item</SelectItem>
                          <SelectItem value="summary">Summary — Single row referencing attached timesheet</SelectItem>
                          <SelectItem value="with_remittance">With Remittance — Invoice + payment allocation report</SelectItem>
                          <SelectItem value="summary_with_remittance">Summary + Remittance — No timesheet, with payment allocations</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {editInvoiceFormat === "summary"
                          ? "The invoice will show a single summary line with total hours and a reference to the attached itemised timesheet."
                          : editInvoiceFormat === "with_remittance"
                          ? "The invoice will include a remittance advice page listing all matched bank transactions and payment allocations."
                          : editInvoiceFormat === "summary_with_remittance"
                          ? "The invoice will show a summary line (no individual shifts) plus a remittance advice page with payment allocations."
                          : "The invoice will list each shift individually as a separate line item."}
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>Footer / Notes Text</Label>
                      <Textarea
                        value={editFooterText}
                        onChange={(e) => setEditFooterText(e.target.value)}
                        placeholder="Additional notes to appear at the bottom of the invoice..."
                        className="min-h-[80px]"
                        data-testid="textarea-footer-text"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Compliance Text</Label>
                      <Textarea
                        value={editComplianceText}
                        onChange={(e) => setEditComplianceText(e.target.value)}
                        placeholder="HMRC compliance references and legal basis..."
                        className="min-h-[80px]"
                        data-testid="textarea-compliance-text"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Payment Terms Text</Label>
                      <Textarea
                        value={editPaymentTermsText}
                        onChange={(e) => setEditPaymentTermsText(e.target.value)}
                        placeholder="Payment terms and conditions..."
                        className="min-h-[80px]"
                        data-testid="textarea-payment-terms"
                      />
                    </div>
                  </>
                )}

                <div className="flex items-center gap-2 pt-3 border-t">
                  <Button onClick={handleSave} disabled={updateMutation.isPending || !editName} className="flex-1" data-testid="button-save-template">
                    {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    Save
                  </Button>
                  <Button variant="outline" onClick={handleSaveAsNew} disabled={duplicateMutation.isPending || !editName} data-testid="button-save-as-new">
                    {duplicateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                    Save as New
                  </Button>
                  <Button variant="ghost" onClick={() => setEditingTemplate(null)} data-testid="button-cancel-template-edit">
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone. The template will be permanently removed.</p>
          <div className="flex items-center gap-2 pt-2">
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete
            </Button>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!defaultConfirmId} onOpenChange={() => setDefaultConfirmId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set as Default?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This template will be used for all new documents of this type. The current default will be unset.</p>
          <div className="flex items-center gap-2 pt-2">
            <Button className="flex-1" onClick={() => defaultConfirmId && setDefaultMutation.mutate(defaultConfirmId)} disabled={setDefaultMutation.isPending} data-testid="button-confirm-default">
              {setDefaultMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Star className="w-4 h-4 mr-2" />}
              Set as Default
            </Button>
            <Button variant="outline" onClick={() => setDefaultConfirmId(null)} data-testid="button-cancel-default">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function SettingsPage() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"users" | "invitations" | "tenant" | "templates" | "integrations">("users");
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<SafeUser | null>(null);
  const [editRole, setEditRole] = useState("");
  const [editActive, setEditActive] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteRole, setInviteRole] = useState("employee");
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [companyForm, setCompanyForm] = useState({
    name: "", tradingName: "", industry: "", email: "", phone: "",
    vatNumber: "", companyRegNumber: "", siaAcsNumber: "",
    addressLine1: "", addressLine2: "", city: "", county: "", postcode: "", website: "",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();

  // Xero integration state
  const [xeroClientId, setXeroClientId] = useState("");
  const [xeroClientSecret, setXeroClientSecret] = useState("");
  const [xeroSyncInterval, setXeroSyncInterval] = useState("60");
  const [xeroConnecting, setXeroConnecting] = useState(false);
  const [xeroSaving, setXeroSaving] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "integrations") {
      setActiveTab("integrations");
      const connected = params.get("xero_connected");
      const orgName = params.get("org");
      const xeroError = params.get("xero_error");
      if (connected === "true") {
        toast({ title: "Xero connected!", description: `Your Xero organisation${orgName ? ` "${orgName}"` : ""} has been connected.` });
      } else if (xeroError) {
        toast({ title: "Xero connection failed", description: xeroError, variant: "destructive" });
      }
      setLocation("/settings?tab=integrations", { replace: true });
    }
  }, []);

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/admin/users"],
  });

  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<TenantInvitation[]>({
    queryKey: ["/api/admin/invitations"],
  });

  const { data: tenantProfile, isLoading: tenantLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/profile"],
    enabled: !!currentUser?.tenantId,
  });

  useEffect(() => {
    if (tenantProfile) {
      setCompanyForm({
        name: tenantProfile.name || "",
        tradingName: tenantProfile.tradingName || "",
        industry: tenantProfile.industry || "security",
        email: tenantProfile.email || "",
        phone: tenantProfile.phone || "",
        vatNumber: tenantProfile.vatNumber || "",
        companyRegNumber: tenantProfile.companyRegNumber || "",
        siaAcsNumber: tenantProfile.siaAcsNumber || "",
        addressLine1: tenantProfile.addressLine1 || "",
        addressLine2: tenantProfile.addressLine2 || "",
        city: tenantProfile.city || "",
        county: tenantProfile.county || "",
        postcode: tenantProfile.postcode || "",
        website: tenantProfile.website || "",
      });
    }
  }, [tenantProfile]);

  const updateTenantMutation = useMutation({
    mutationFn: async (data: Partial<typeof companyForm>) => {
      const res = await apiRequest("PATCH", "/api/tenant/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      setIsEditingCompany(false);
      toast({ title: "Company details updated", description: "Your company information has been saved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  // Xero queries & mutations
  const { data: xeroAddon } = useQuery<{ active: boolean }>({
    queryKey: ["/api/addons/check/xero"],
    enabled: activeTab === "integrations",
    staleTime: 60000,
  });

  const { data: xeroConn, isLoading: xeroLoading } = useQuery<any>({
    queryKey: ["/api/xero/connection"],
    enabled: activeTab === "integrations",
    refetchInterval: activeTab === "integrations" ? 30000 : false,
  });

  const xeroSaveCredMutation = useMutation({
    mutationFn: async (data: { clientId: string; clientSecret: string }) => {
      const res = await apiRequest("POST", "/api/xero/connection/save-credentials", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/connection"] });
      toast({ title: "Credentials saved", description: data.message || "Click Connect to authorise with Xero." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const xeroUpdateMutation = useMutation({
    mutationFn: async (data: { syncEnabled?: boolean; syncIntervalMinutes?: number }) => {
      const res = await apiRequest("PUT", "/api/xero/connection", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/connection"] });
      toast({ title: "Xero settings updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const xeroDisconnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/xero/connection");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/connection"] });
      toast({ title: "Xero disconnected", description: "The Xero connection has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const xeroTestMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/connection/test");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/connection"] });
      if (data.success) {
        toast({ title: "Connection verified", description: data.message });
      } else {
        toast({ title: "Connection test failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const handleXeroConnect = async () => {
    setXeroConnecting(true);
    try {
      const res = await apiRequest("GET", "/api/xero/auth-url");
      const data = await res.json();
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Error", description: data.message || "Could not generate auth URL", variant: "destructive" });
        setXeroConnecting(false);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      setXeroConnecting(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5MB.", variant: "destructive" });
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    setLogoUploading(true);
    try {
      const res = await fetch("/api/uploads/upload", {
        method: "POST",
        headers: { "Content-Type": file.type, "X-File-Name": file.name },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      await apiRequest("PATCH", "/api/tenant/profile", { logoUrl: data.objectPath });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      toast({ title: "Logo uploaded", description: "Company logo has been updated." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setLogoUploading(false);
    }
  };

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, role, isActive }: { id: string; role: string; isActive: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${id}`, { role, isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
      toast({ title: "User updated", description: "User settings have been saved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const sendInviteMutation = useMutation({
    mutationFn: async (data: { email: string; role: string; firstName: string; lastName: string }) => {
      const res = await apiRequest("POST", "/api/admin/invitations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invitations"] });
      setShowInviteDialog(false);
      setInviteEmail("");
      setInviteFirstName("");
      setInviteLastName("");
      setInviteRole("employee");
      toast({ title: "Invitation sent", description: "Team member has been invited successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/invitations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/invitations"] });
      toast({ title: "Invitation revoked", description: "The invitation has been cancelled." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = users.filter((u) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search) ||
      u.email.toLowerCase().includes(search) ||
      u.username.toLowerCase().includes(search);
    if (roleFilter === "all") return matchesSearch;
    return matchesSearch && u.role === roleFilter;
  });

  const openUserDialog = (user: SafeUser) => {
    setSelectedUser(user);
    setEditRole(user.role);
    setEditActive(user.isActive ?? true);
  };

  const handleSaveUser = () => {
    if (!selectedUser) return;
    updateUserMutation.mutate({
      id: selectedUser.id,
      role: editRole,
      isActive: editActive,
    });
  };

  const handleSendInvite = () => {
    if (!inviteEmail) return;
    sendInviteMutation.mutate({
      email: inviteEmail,
      role: inviteRole,
      firstName: inviteFirstName,
      lastName: inviteLastName,
    });
  };

  const pendingInvites = invitations.filter(i => i.status === "pending");
  const otherInvites = invitations.filter(i => i.status !== "pending");

  return (
    <div className="p-6 space-y-6" data-testid="settings-page">
      <div className="flex items-center gap-3 flex-wrap">
        <Settings className="w-6 h-6 text-muted-foreground" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Admin Settings</h1>
          <p className="text-muted-foreground text-sm">Manage users, invitations, and tenant configuration.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant={activeTab === "users" ? "default" : "outline"}
          onClick={() => setActiveTab("users")}
          data-testid="button-tab-users"
        >
          <Users className="w-4 h-4 mr-2" />
          User Management
        </Button>
        <Button
          variant={activeTab === "invitations" ? "default" : "outline"}
          onClick={() => setActiveTab("invitations")}
          data-testid="button-tab-invitations"
        >
          <Mail className="w-4 h-4 mr-2" />
          Team Invitations
          {pendingInvites.length > 0 && (
            <Badge className="ml-2 no-default-hover-elevate no-default-active-elevate bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
              {pendingInvites.length}
            </Badge>
          )}
        </Button>
        <Button
          variant={activeTab === "tenant" ? "default" : "outline"}
          onClick={() => setActiveTab("tenant")}
          data-testid="button-tab-tenant"
        >
          <Building2 className="w-4 h-4 mr-2" />
          Tenant Settings
        </Button>
        <Button
          variant={activeTab === "templates" ? "default" : "outline"}
          onClick={() => setActiveTab("templates")}
          data-testid="button-tab-templates"
        >
          <FileText className="w-4 h-4 mr-2" />
          Document Templates
        </Button>
        <Button
          variant={activeTab === "integrations" ? "default" : "outline"}
          onClick={() => setActiveTab("integrations")}
          data-testid="button-tab-integrations"
        >
          <Plug className="w-4 h-4 mr-2" />
          Integrations
        </Button>
      </div>

      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-search-users"
                placeholder="Search by name, email, username..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-role-filter">
                <SelectValue placeholder="Filter by role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                {ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_CONFIG[role].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setShowInviteDialog(true)} data-testid="button-invite-user">
              <UserPlus className="w-4 h-4 mr-2" />
              Invite Team Member
            </Button>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-56 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold">No users found</h3>
                <p className="text-sm text-muted-foreground">
                  {searchTerm || roleFilter !== "all"
                    ? "Try adjusting your search or filters."
                    : "Users will appear here once they have been created."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="table-users">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Name</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden md:table-cell">Email</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden lg:table-cell">Username</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Role</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden lg:table-cell">Last Login</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground hidden xl:table-cell">Created</th>
                    <th className="pb-3 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((user) => {
                    const roleConf = ROLE_CONFIG[user.role] || ROLE_CONFIG.employee;
                    return (
                      <tr
                        key={user.id}
                        className="border-b last:border-b-0 hover-elevate cursor-pointer"
                        onClick={() => openUserDialog(user)}
                        data-testid={`row-user-${user.id}`}
                      >
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-medium">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                              </span>
                            </div>
                            <span className="font-medium truncate" data-testid={`text-user-name-${user.id}`}>
                              {user.firstName} {user.lastName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden md:table-cell" data-testid={`text-user-email-${user.id}`}>
                          {user.email}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden lg:table-cell" data-testid={`text-user-username-${user.id}`}>
                          {user.username}
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            className={`no-default-hover-elevate no-default-active-elevate ${roleConf.className}`}
                            data-testid={`badge-role-${user.id}`}
                          >
                            {roleConf.label}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge
                            className={`no-default-hover-elevate no-default-active-elevate ${
                              user.isActive
                                ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            }`}
                            data-testid={`badge-status-${user.id}`}
                          >
                            {user.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden lg:table-cell" data-testid={`text-last-login-${user.id}`}>
                          {formatDateTime(user.lastLoginAt as unknown as string)}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground hidden xl:table-cell" data-testid={`text-created-${user.id}`}>
                          {formatDate(user.createdAt as unknown as string)}
                        </td>
                        <td className="py-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openUserDialog(user);
                            }}
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="text-xs text-muted-foreground" data-testid="text-user-count">
            Showing {filtered.length} of {users.length} users
          </div>
        </div>
      )}

      {activeTab === "invitations" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-lg">Team Invitations</h3>
              <p className="text-sm text-muted-foreground">Invite new team members and manage pending invitations.</p>
            </div>
            <Button onClick={() => setShowInviteDialog(true)} data-testid="button-invite-from-tab">
              <Plus className="w-4 h-4 mr-2" />
              Send Invitation
            </Button>
          </div>

          {invitationsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-muted animate-pulse" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-56 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : invitations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Mail className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No invitations yet</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Send invitations to add team members to your organisation.
                </p>
                <Button onClick={() => setShowInviteDialog(true)} data-testid="button-invite-empty">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Invite First Team Member
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {pendingInvites.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Pending Invitations ({pendingInvites.length})
                  </h4>
                  {pendingInvites.map((inv) => {
                    const roleConf = ROLE_CONFIG[inv.role] || ROLE_CONFIG.employee;
                    const isExpired = new Date(inv.expiresAt) < new Date();
                    return (
                      <Card key={inv.id} data-testid={`card-invite-${inv.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(27, 100%, 95%)" }}>
                                <Send className="w-4 h-4" style={{ color: "hsl(27, 100%, 55%)" }} />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium" data-testid={`text-invite-email-${inv.id}`}>{inv.email}</span>
                                  <Badge className={`no-default-hover-elevate no-default-active-elevate ${roleConf.className}`}>
                                    {roleConf.label}
                                  </Badge>
                                  {isExpired && (
                                    <Badge className="no-default-hover-elevate no-default-active-elevate bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                      Expired
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {inv.firstName && inv.lastName ? `${inv.firstName} ${inv.lastName} · ` : ""}
                                  Sent {formatDate(inv.createdAt as unknown as string)}
                                  {!isExpired && ` · Expires ${formatDate(inv.expiresAt as unknown as string)}`}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => revokeInviteMutation.mutate(inv.id)}
                              disabled={revokeInviteMutation.isPending}
                              data-testid={`button-revoke-${inv.id}`}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Revoke
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {otherInvites.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Invitation History ({otherInvites.length})
                  </h4>
                  {otherInvites.map((inv) => {
                    const roleConf = ROLE_CONFIG[inv.role] || ROLE_CONFIG.employee;
                    const statusClass = STATUS_BADGE[inv.status] || STATUS_BADGE.pending;
                    return (
                      <Card key={inv.id} className="opacity-75" data-testid={`card-invite-history-${inv.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{inv.email}</span>
                                <Badge className={`no-default-hover-elevate no-default-active-elevate ${roleConf.className}`}>
                                  {roleConf.label}
                                </Badge>
                                <Badge className={`no-default-hover-elevate no-default-active-elevate capitalize ${statusClass}`}>
                                  {inv.status}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {inv.firstName && inv.lastName ? `${inv.firstName} ${inv.lastName} · ` : ""}
                                Sent {formatDate(inv.createdAt as unknown as string)}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {activeTab === "tenant" && (
        <div className="space-y-6">
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleLogoUpload(file);
              e.target.value = "";
            }}
            data-testid="input-logo-file"
          />

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Image className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">Company Logo</h3>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div
                  className="relative w-24 h-24 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden cursor-pointer group transition-colors hover:border-primary/50"
                  onClick={() => logoInputRef.current?.click()}
                  data-testid="button-upload-logo"
                >
                  {tenantProfile?.logoUrl ? (
                    <>
                      <img
                        src={tenantProfile.logoUrl}
                        alt="Company logo"
                        className="w-full h-full object-contain"
                        data-testid="img-company-logo"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Camera className="w-5 h-5 text-white" />
                      </div>
                    </>
                  ) : logoUploading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  ) : (
                    <div className="text-center">
                      <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                      <span className="text-xs text-muted-foreground">Upload</span>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium mb-1">Upload your company logo</p>
                  <p className="text-xs text-muted-foreground mb-3">PNG, JPG or SVG, max 5MB. Displayed across the platform.</p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => logoInputRef.current?.click()}
                      disabled={logoUploading}
                      data-testid="button-choose-logo"
                    >
                      {logoUploading ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                      ) : (
                        <Upload className="w-3 h-3 mr-2" />
                      )}
                      {tenantProfile?.logoUrl ? "Change Logo" : "Upload Logo"}
                    </Button>
                    {tenantProfile?.logoUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          await apiRequest("PATCH", "/api/tenant/profile", { logoUrl: null });
                          queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
                          toast({ title: "Logo removed" });
                        }}
                        data-testid="button-remove-logo"
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">Company Information</h3>
                </div>
                {!isEditingCompany ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingCompany(true)}
                    data-testid="button-edit-company"
                  >
                    <Edit className="w-3 h-3 mr-2" />
                    Edit Details
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => updateTenantMutation.mutate(companyForm)}
                      disabled={updateTenantMutation.isPending}
                      data-testid="button-save-company"
                    >
                      {updateTenantMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin mr-2" />
                      ) : (
                        <Save className="w-3 h-3 mr-2" />
                      )}
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditingCompany(false);
                        if (tenantProfile) {
                          setCompanyForm({
                            name: tenantProfile.name || "",
                            tradingName: tenantProfile.tradingName || "",
                            industry: tenantProfile.industry || "security",
                            email: tenantProfile.email || "",
                            phone: tenantProfile.phone || "",
                            vatNumber: tenantProfile.vatNumber || "",
                            companyRegNumber: tenantProfile.companyRegNumber || "",
                            siaAcsNumber: tenantProfile.siaAcsNumber || "",
                            addressLine1: tenantProfile.addressLine1 || "",
                            addressLine2: tenantProfile.addressLine2 || "",
                            city: tenantProfile.city || "",
                            county: tenantProfile.county || "",
                            postcode: tenantProfile.postcode || "",
                            website: tenantProfile.website || "",
                          });
                        }
                      }}
                      data-testid="button-cancel-company"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
              </div>

              {tenantLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-3 w-20 bg-muted animate-pulse rounded" />
                      <div className="h-9 bg-muted animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : isEditingCompany ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Company Name *</Label>
                      <Input
                        value={companyForm.name}
                        onChange={(e) => setCompanyForm(f => ({ ...f, name: e.target.value }))}
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Trading Name</Label>
                      <Input
                        value={companyForm.tradingName}
                        onChange={(e) => setCompanyForm(f => ({ ...f, tradingName: e.target.value }))}
                        placeholder="If different from company name"
                        data-testid="input-trading-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Industry</Label>
                      <Select value={companyForm.industry} onValueChange={(v) => setCompanyForm(f => ({ ...f, industry: v }))}>
                        <SelectTrigger data-testid="select-industry">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="security">Security Services</SelectItem>
                          <SelectItem value="cleaning">Cleaning Services</SelectItem>
                          <SelectItem value="maintenance">Maintenance</SelectItem>
                          <SelectItem value="engineering">Engineering</SelectItem>
                          <SelectItem value="facilities">Facilities Management</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Email</Label>
                      <Input
                        type="email"
                        value={companyForm.email}
                        onChange={(e) => setCompanyForm(f => ({ ...f, email: e.target.value }))}
                        data-testid="input-company-email"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Phone</Label>
                      <Input
                        value={companyForm.phone}
                        onChange={(e) => setCompanyForm(f => ({ ...f, phone: e.target.value }))}
                        data-testid="input-company-phone"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Website</Label>
                      <Input
                        value={companyForm.website}
                        onChange={(e) => setCompanyForm(f => ({ ...f, website: e.target.value }))}
                        placeholder="https://example.co.uk"
                        data-testid="input-company-website"
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Registration & Compliance</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Company Reg Number</Label>
                        <Input
                          value={companyForm.companyRegNumber}
                          onChange={(e) => setCompanyForm(f => ({ ...f, companyRegNumber: e.target.value }))}
                          placeholder="e.g. 12345678"
                          data-testid="input-reg-number"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">VAT Number</Label>
                        <Input
                          value={companyForm.vatNumber}
                          onChange={(e) => setCompanyForm(f => ({ ...f, vatNumber: e.target.value }))}
                          placeholder="e.g. GB123456789"
                          data-testid="input-vat-number"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">SIA ACS Number</Label>
                        <Input
                          value={companyForm.siaAcsNumber}
                          onChange={(e) => setCompanyForm(f => ({ ...f, siaAcsNumber: e.target.value }))}
                          placeholder="ACS number"
                          data-testid="input-sia-number"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4 mt-4">
                    <p className="text-xs font-medium text-muted-foreground mb-3">Registered Address</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Address Line 1</Label>
                        <Input
                          value={companyForm.addressLine1}
                          onChange={(e) => setCompanyForm(f => ({ ...f, addressLine1: e.target.value }))}
                          data-testid="input-address-1"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Address Line 2</Label>
                        <Input
                          value={companyForm.addressLine2}
                          onChange={(e) => setCompanyForm(f => ({ ...f, addressLine2: e.target.value }))}
                          data-testid="input-address-2"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">City</Label>
                        <Input
                          value={companyForm.city}
                          onChange={(e) => setCompanyForm(f => ({ ...f, city: e.target.value }))}
                          data-testid="input-city"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">County</Label>
                        <Input
                          value={companyForm.county}
                          onChange={(e) => setCompanyForm(f => ({ ...f, county: e.target.value }))}
                          data-testid="input-county"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Postcode</Label>
                        <Input
                          value={companyForm.postcode}
                          onChange={(e) => setCompanyForm(f => ({ ...f, postcode: e.target.value }))}
                          data-testid="input-postcode"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Company Name</Label>
                    <p className="text-sm font-medium" data-testid="text-company-name">
                      {tenantProfile?.name || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Trading Name</Label>
                    <p className="text-sm font-medium" data-testid="text-trading-name">
                      {tenantProfile?.tradingName || "Same as company name"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Industry</Label>
                    <p className="text-sm font-medium capitalize" data-testid="text-industry">
                      {tenantProfile?.industry || "Security Services"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Email</Label>
                    <p className="text-sm font-medium" data-testid="text-company-email">
                      {tenantProfile?.email || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="text-sm font-medium" data-testid="text-company-phone">
                      {tenantProfile?.phone || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Website</Label>
                    <p className="text-sm font-medium" data-testid="text-company-website">
                      {tenantProfile?.website || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Company Reg Number</Label>
                    <p className="text-sm font-medium" data-testid="text-reg-number">
                      {tenantProfile?.companyRegNumber || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">VAT Number</Label>
                    <p className="text-sm font-medium" data-testid="text-vat-number">
                      {tenantProfile?.vatNumber || "Not set"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">SIA ACS Number</Label>
                    <p className="text-sm font-medium" data-testid="text-sia-number">
                      {tenantProfile?.siaAcsNumber || "Not set"}
                    </p>
                  </div>
                  {tenantProfile?.addressLine1 && (
                    <div className="md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Registered Address</Label>
                      <p className="text-sm font-medium" data-testid="text-address">
                        {[tenantProfile.addressLine1, tenantProfile.addressLine2, tenantProfile.city, tenantProfile.county, tenantProfile.postcode].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">Financial Settings</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Default VAT Rate</span>
                    <Badge className="no-default-hover-elevate no-default-active-elevate bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid="text-vat-rate">
                      20%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Invoice Terms</span>
                    <Badge className="no-default-hover-elevate no-default-active-elevate bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" data-testid="text-invoice-terms">
                      Net 30
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Key className="w-5 h-5 text-muted-foreground" />
                  <h3 className="font-semibold">System Access</h3>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Total Users</span>
                    <span className="text-sm font-medium" data-testid="text-total-users">{users.length}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Active Users</span>
                    <span className="text-sm font-medium" data-testid="text-active-users">
                      {users.filter((u) => u.isActive).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted-foreground">Pending Invitations</span>
                    <span className="text-sm font-medium" data-testid="text-pending-invites">
                      {pendingInvites.length}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <LeaveEntitlementSettingsCard />
          <TenantOfficerTypesSettingsCard />
          <GeofenceSettingsCard />
          <SupplierVisibilitySettingsCard />
          <ProbationSettingsCard />
        </div>
      )}

      {activeTab === "templates" && (
        <DocumentTemplatesTab />
      )}

      {activeTab === "integrations" && (
        <div className="space-y-6 max-w-2xl">
          <div>
            <h2 className="text-lg font-semibold mb-1">Third-Party Integrations</h2>
            <p className="text-sm text-muted-foreground">Connect external services to synchronise data automatically.</p>
          </div>

          <TenantEmailSettingsCard />

          {/* Xero Integration */}
          <Card data-testid="card-xero-integration">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#13B5EA] font-bold text-lg">X</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-base">Xero Accounting</h3>
                    <p className="text-sm text-muted-foreground">Sync invoices, contacts, and payments two-ways with your Xero organisation.</p>
                  </div>
                </div>
                {xeroLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-1" />
                ) : xeroConn?.status === "connected" ? (
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 shrink-0">
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="outline" className="shrink-0 text-muted-foreground">
                    Disconnected
                  </Badge>
                )}
              </div>

              {/* Addon activation gate */}
              {xeroAddon?.active === false && (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 p-3 text-sm text-amber-800 dark:text-amber-400" data-testid="notice-xero-addon-inactive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-medium">Add-on not active.</span> Activate the <strong>Xero Accounting Integration</strong> from the <a href="/addons" className="underline underline-offset-2 font-medium">Add-ons page</a> before configuring credentials.
                  </div>
                </div>
              )}

              {xeroConn?.status === "connected" ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-muted/40 p-4 text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Organisation</span>
                      <span className="font-medium">{xeroConn.xeroTenantName || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Last synced</span>
                      <span className="font-medium">{xeroConn.lastSyncedAt ? new Date(xeroConn.lastSyncedAt).toLocaleString("en-GB") : "Never"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Auto-sync</span>
                      <span className={`font-medium ${xeroConn.syncEnabled ? "text-green-600" : "text-muted-foreground"}`}>{xeroConn.syncEnabled ? `Every ${xeroConn.syncIntervalMinutes} min` : "Off"}</span>
                    </div>
                    {xeroConn.lastError && (
                      <div className="flex items-start gap-2 text-red-600 pt-1">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="text-xs">{xeroConn.lastError}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm whitespace-nowrap">Sync interval (minutes)</Label>
                      <Input
                        type="number"
                        min={15}
                        max={1440}
                        value={xeroSyncInterval}
                        onChange={(e) => setXeroSyncInterval(e.target.value)}
                        className="w-24"
                        data-testid="input-xero-sync-interval"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => xeroUpdateMutation.mutate({ syncEnabled: true, syncIntervalMinutes: parseInt(xeroSyncInterval) || 60 })}
                      disabled={xeroUpdateMutation.isPending}
                      data-testid="button-xero-enable-sync"
                    >
                      {xeroUpdateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
                      Enable Auto-sync
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => xeroUpdateMutation.mutate({ syncEnabled: false })}
                      disabled={xeroUpdateMutation.isPending}
                      data-testid="button-xero-disable-sync"
                    >
                      Pause Auto-sync
                    </Button>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => xeroTestMutation.mutate()}
                      disabled={xeroTestMutation.isPending}
                      data-testid="button-xero-test"
                    >
                      {xeroTestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                      Test Connection
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => xeroDisconnectMutation.mutate()}
                      disabled={xeroDisconnectMutation.isPending}
                      data-testid="button-xero-disconnect"
                    >
                      {xeroDisconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Link2Off className="w-4 h-4 mr-1" />}
                      Disconnect Xero
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    To connect Xero, create an <strong>OAuth 2.0 App</strong> in the <a href="https://developer.xero.com/app/manage" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">Xero Developer Portal</a>, set the redirect URI to <code className="bg-muted px-1 rounded text-xs">{window.location.origin}/api/xero/callback</code>, then paste the credentials below.
                  </p>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="xero-client-id">Client ID</Label>
                      <Input
                        id="xero-client-id"
                        placeholder="Your Xero app Client ID"
                        value={xeroClientId}
                        onChange={(e) => setXeroClientId(e.target.value)}
                        data-testid="input-xero-client-id"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="xero-client-secret">Client Secret</Label>
                      <Input
                        id="xero-client-secret"
                        type="password"
                        placeholder="Your Xero app Client Secret"
                        value={xeroClientSecret}
                        onChange={(e) => setXeroClientSecret(e.target.value)}
                        data-testid="input-xero-client-secret"
                      />
                    </div>
                  </div>

                  {xeroConn?.clientId && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-green-500" /> Credentials saved — click Connect to authorise.
                    </p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => xeroSaveCredMutation.mutate({ clientId: xeroClientId, clientSecret: xeroClientSecret })}
                      disabled={xeroSaveCredMutation.isPending || !xeroClientId || !xeroClientSecret}
                      data-testid="button-xero-save-credentials"
                    >
                      {xeroSaveCredMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                      Save Credentials
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleXeroConnect}
                      disabled={xeroConnecting || !xeroConn?.clientId}
                      data-testid="button-xero-connect"
                    >
                      {xeroConnecting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Link2 className="w-4 h-4 mr-1" />}
                      Connect to Xero
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          {selectedUser && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <UserCog className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle data-testid="text-dialog-user-name">
                      {selectedUser.firstName} {selectedUser.lastName}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{selectedUser.email}</p>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Username</Label>
                    <p className="font-medium" data-testid="text-dialog-username">{selectedUser.username}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Last Login</Label>
                    <p className="font-medium" data-testid="text-dialog-last-login">
                      {formatDateTime(selectedUser.lastLoginAt as unknown as string)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Created</Label>
                    <p className="font-medium" data-testid="text-dialog-created">
                      {formatDate(selectedUser.createdAt as unknown as string)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Phone</Label>
                    <p className="font-medium" data-testid="text-dialog-phone">
                      {selectedUser.phone || "N/A"}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select value={editRole} onValueChange={setEditRole}>
                    <SelectTrigger data-testid="select-edit-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_CONFIG[role].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editActive ? "active" : "inactive"}
                    onValueChange={(v) => setEditActive(v === "active")}
                  >
                    <SelectTrigger data-testid="select-edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={handleSaveUser}
                    disabled={updateUserMutation.isPending}
                    data-testid="button-save-user"
                  >
                    {updateUserMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setSelectedUser(null)}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "hsl(27, 100%, 95%)" }}>
                <UserPlus className="w-5 h-5" style={{ color: "hsl(27, 100%, 55%)" }} />
              </div>
              <div>
                <DialogTitle>Invite Team Member</DialogTitle>
                <p className="text-sm text-muted-foreground">Send an invitation to join your organisation.</p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input
                  placeholder="John"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  data-testid="input-invite-firstname"
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input
                  placeholder="Smith"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  data-testid="input-invite-lastname"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email Address *</Label>
              <Input
                type="email"
                placeholder="john@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                data-testid="input-invite-email"
              />
            </div>
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVITE_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_CONFIG[role].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={handleSendInvite}
                disabled={sendInviteMutation.isPending || !inviteEmail}
                data-testid="button-send-invite"
              >
                {sendInviteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Invitation
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowInviteDialog(false)}
                data-testid="button-cancel-invite"
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
