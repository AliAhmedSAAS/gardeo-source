import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form, FormField, FormItem, FormLabel, FormControl, FormMessage,
} from "@/components/ui/form";
import {
  Shield, Loader2, ChevronDown, ChevronUp, Clock,
  FileText, Receipt, Scale, AlertTriangle, CreditCard,
  Plus, Building2, CheckCircle2,
} from "lucide-react";

type SupplierAuditEvent = {
  id: number;
  tenantId: number;
  supplierId: number;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  actorUserId: string | null;
  actorName: string | null;
  actorRole: string | null;
  summary: string;
  oldValues: any;
  newValues: any;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
};

type VatVerification = {
  id: number;
  supplierId: number;
  vatNumber: string;
  verificationResult: string;
  verificationMethod: string | null;
  verifiedByName: string | null;
  notes: string | null;
  createdAt: string;
};

type RateCardHistoryEntry = {
  id: number;
  supplierId: number;
  changeType: string;
  roleType: string | null;
  oldHourlyRate: string | null;
  newHourlyRate: string | null;
  oldOvertimeRate: string | null;
  newOvertimeRate: string | null;
  effectiveFrom: string | null;
  changedByName: string | null;
  reason: string | null;
  createdAt: string;
};

type Supplier = {
  id: number;
  companyName: string;
  vatNumber: string | null;
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  agreement: { label: "Agreement", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700" },
  invoice: { label: "Invoice", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700" },
  vat: { label: "VAT", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 dark:border-orange-700" },
  rate_card: { label: "Rate Card", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700" },
  dispute: { label: "Dispute", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700" },
  timesheet: { label: "Timesheet", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-300 dark:border-teal-700" },
  credit_note: { label: "Credit Note", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700" },
};

const EVENT_FILTER_OPTIONS = [
  { value: "all", label: "All Events" },
  { value: "agreement", label: "Agreement Events" },
  { value: "invoice", label: "Invoice Events" },
  { value: "timesheet", label: "Timesheet Events" },
  { value: "credit_note", label: "Credit Note Events" },
  { value: "vat", label: "VAT Events" },
  { value: "rate_card", label: "Rate Card Events" },
  { value: "dispute", label: "Dispute Events" },
];

const TIMELINE_DOT_COLORS: Record<string, string> = {
  agreement: "bg-green-500",
  invoice: "bg-blue-500",
  vat: "bg-orange-500",
  rate_card: "bg-purple-500",
  dispute: "bg-red-500",
  timesheet: "bg-teal-500",
  credit_note: "bg-amber-500",
};

function formatTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(v: string | null | undefined): string {
  const n = parseFloat(String(v || "0"));
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function getEventTypeKey(eventType: string): string {
  const lower = eventType.toLowerCase();
  if (lower.includes("timesheet")) return "timesheet";
  if (lower.includes("credit_note")) return "credit_note";
  if (lower.includes("agreement")) return "agreement";
  if (lower.includes("invoice")) return "invoice";
  if (lower.includes("vat")) return "vat";
  if (lower.includes("rate") || lower.includes("card")) return "rate_card";
  if (lower.includes("dispute")) return "dispute";
  return "agreement";
}

function ComparisonTable({ oldValues, newValues }: { oldValues: any; newValues: any }) {
  if (!oldValues && !newValues) return null;
  const oldObj = typeof oldValues === "object" && oldValues ? oldValues : {};
  const newObj = typeof newValues === "object" && newValues ? newValues : {};
  const allKeys = Array.from(new Set([...Object.keys(oldObj), ...Object.keys(newObj)]));
  if (allKeys.length === 0) return null;

  return (
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left font-medium text-muted-foreground">Field</th>
            <th className="p-2 text-left font-medium text-muted-foreground">Old Value</th>
            <th className="p-2 text-left font-medium text-muted-foreground">New Value</th>
          </tr>
        </thead>
        <tbody>
          {allKeys.map((key) => {
            const oldVal = oldObj[key];
            const newVal = newObj[key];
            const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
            return (
              <tr key={key} className={`border-b last:border-0 ${changed ? "bg-yellow-50/50 dark:bg-yellow-900/10" : ""}`}>
                <td className="p-2 font-medium">{key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                <td className="p-2 text-muted-foreground">{oldVal !== undefined ? String(oldVal) : "—"}</td>
                <td className="p-2">{newVal !== undefined ? String(newVal) : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const vatVerificationSchema = z.object({
  vatNumber: z.string().optional().default(""),
  verificationResult: z.enum(["valid", "invalid", "not_registered"]),
  verificationMethod: z.enum(["manual", "hmrc_api", "third_party"]),
  notes: z.string().optional(),
});

type VatVerificationFormData = z.infer<typeof vatVerificationSchema>;

export default function SupplierHmrcAuditPage() {
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>("");
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [vatDialogOpen, setVatDialogOpen] = useState(false);
  const { toast } = useToast();

  const supplierId = selectedSupplierId ? parseInt(selectedSupplierId) : null;

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: auditEvents = [], isLoading: eventsLoading } = useQuery<SupplierAuditEvent[]>({
    queryKey: ["/api/supplier-audit-events/supplier", supplierId],
    enabled: !!supplierId,
  });

  const { data: vatVerifications = [], isLoading: vatLoading } = useQuery<VatVerification[]>({
    queryKey: ["/api/vat-verifications", supplierId],
    enabled: !!supplierId,
  });

  const { data: rateCardHistory = [], isLoading: rateCardLoading } = useQuery<RateCardHistoryEntry[]>({
    queryKey: ["/api/rate-card-history", supplierId],
    enabled: !!supplierId,
  });

  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  const form = useForm<VatVerificationFormData>({
    resolver: zodResolver(vatVerificationSchema),
    defaultValues: {
      vatNumber: selectedSupplier?.vatNumber || "",
      verificationResult: "valid",
      verificationMethod: "manual",
      notes: "",
    },
  });

  const vatMutation = useMutation({
    mutationFn: async (data: VatVerificationFormData) => {
      await apiRequest("POST", "/api/vat-verifications", {
        ...data,
        supplierId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vat-verifications", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-audit-events/supplier", supplierId] });
      setVatDialogOpen(false);
      form.reset();
      toast({ title: "Verification recorded", description: "VAT verification has been recorded successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filteredEvents = useMemo(() => {
    return auditEvents.filter((event) => {
      if (eventTypeFilter !== "all") {
        const key = getEventTypeKey(event.eventType);
        if (key !== eventTypeFilter) return false;
      }
      if (dateFrom) {
        const eventDate = new Date(event.createdAt).toISOString().slice(0, 10);
        if (eventDate < dateFrom) return false;
      }
      if (dateTo) {
        const eventDate = new Date(event.createdAt).toISOString().slice(0, 10);
        if (eventDate > dateTo) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [auditEvents, eventTypeFilter, dateFrom, dateTo]);

  const toggleExpanded = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openVatDialog = () => {
    form.reset({
      vatNumber: selectedSupplier?.vatNumber || "",
      verificationResult: "valid",
      verificationMethod: "manual",
      notes: "",
    });
    setVatDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6" data-testid="supplier-hmrc-audit-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Supplier HMRC Audit Trail</h1>
            <p className="text-muted-foreground text-sm">HMRC VAT Notice 700/62 compliance event history</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px]">
          <label className="text-xs text-muted-foreground mb-1 block">Supplier</label>
          <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId}>
            <SelectTrigger data-testid="select-supplier">
              <SelectValue placeholder="Select a supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px]">
          <label className="text-xs text-muted-foreground mb-1 block">Event Type</label>
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger data-testid="select-event-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-auto"
            data-testid="input-date-from"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-auto"
            data-testid="input-date-to"
          />
        </div>
      </div>

      {!supplierId ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">Select a Supplier</h3>
            <p className="text-sm text-muted-foreground">Choose a supplier from the dropdown above to view their HMRC audit trail.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="timeline" data-testid="audit-tabs">
          <TabsList>
            <TabsTrigger value="timeline" data-testid="tab-timeline">Audit Timeline</TabsTrigger>
            <TabsTrigger value="vat" data-testid="tab-vat">VAT Verifications</TabsTrigger>
            <TabsTrigger value="rate-cards" data-testid="tab-rate-cards">Rate Card History</TabsTrigger>
          </TabsList>

          <TabsContent value="timeline" data-testid="tab-content-timeline">
            {eventsLoading ? (
              <Card>
                <CardContent className="p-8 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Loading audit events...</span>
                </CardContent>
              </Card>
            ) : filteredEvents.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold">No audit events found</h3>
                  <p className="text-sm text-muted-foreground">
                    {eventTypeFilter !== "all" || dateFrom || dateTo
                      ? "Try adjusting your filters."
                      : "Audit events will appear here as actions are performed for this supplier."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="relative pl-6 space-y-0">
                <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" />
                {filteredEvents.map((event) => {
                  const typeKey = getEventTypeKey(event.eventType);
                  const config = EVENT_TYPE_CONFIG[typeKey] || EVENT_TYPE_CONFIG.agreement;
                  const dotColor = TIMELINE_DOT_COLORS[typeKey] || "bg-gray-500";
                  const isExpanded = expandedRows.has(event.id);
                  const hasDetails = event.oldValues || event.newValues;

                  return (
                    <div key={event.id} className="relative pb-4" data-testid={`timeline-event-${event.id}`}>
                      <div className={`absolute -left-6 top-4 w-3 h-3 rounded-full ${dotColor} ring-2 ring-background z-10`} />
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                  className={`no-default-hover-elevate no-default-active-elevate ${config.className}`}
                                  data-testid={`badge-event-type-${event.id}`}
                                >
                                  {config.label}
                                </Badge>
                                <span className="text-xs text-muted-foreground" data-testid={`text-event-type-${event.id}`}>
                                  {event.eventType}
                                </span>
                              </div>
                              <p className="text-sm font-medium" data-testid={`text-summary-${event.id}`}>
                                {event.summary}
                              </p>
                              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                {event.actorName && (
                                  <span data-testid={`text-actor-${event.id}`}>
                                    {event.actorName}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span data-testid={`text-timestamp-${event.id}`}>
                                    {formatTimestamp(event.createdAt)}
                                  </span>
                                </span>
                                {event.ipAddress && (
                                  <span className="font-mono" data-testid={`text-ip-${event.id}`}>
                                    IP: {event.ipAddress}
                                  </span>
                                )}
                              </div>
                            </div>
                            {hasDetails && (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleExpanded(event.id)}
                                data-testid={`button-expand-${event.id}`}
                              >
                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                              </Button>
                            )}
                          </div>
                          {isExpanded && hasDetails && (
                            <div className="mt-3 pt-3 border-t" data-testid={`details-${event.id}`}>
                              <ComparisonTable oldValues={event.oldValues} newValues={event.newValues} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="vat" data-testid="tab-content-vat">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h3 className="font-semibold text-sm">VAT Verification History</h3>
                <Button size="sm" onClick={openVatDialog} data-testid="button-record-vat-verification">
                  <Plus className="w-4 h-4 mr-2" />
                  Record VAT Verification
                </Button>
              </div>
              {vatLoading ? (
                <Card>
                  <CardContent className="p-8 flex items-center justify-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="text-muted-foreground">Loading VAT verifications...</span>
                  </CardContent>
                </Card>
              ) : vatVerifications.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <CheckCircle2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h3 className="font-semibold">No VAT verifications recorded</h3>
                    <p className="text-sm text-muted-foreground">Click the button above to record a new VAT verification.</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid="table-vat-verifications">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="p-2 font-medium text-muted-foreground">VAT Number</th>
                            <th className="p-2 font-medium text-muted-foreground">Result</th>
                            <th className="p-2 font-medium text-muted-foreground">Method</th>
                            <th className="p-2 font-medium text-muted-foreground">Verified By</th>
                            <th className="p-2 font-medium text-muted-foreground">Notes</th>
                            <th className="p-2 font-medium text-muted-foreground">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vatVerifications.map((v) => (
                            <tr key={v.id} className="border-b last:border-0" data-testid={`row-vat-${v.id}`}>
                              <td className="p-2 font-mono text-xs">{v.vatNumber || "N/A — Not VAT Registered"}</td>
                              <td className="p-2">
                                <Badge
                                  className={`no-default-hover-elevate no-default-active-elevate ${
                                    v.verificationResult === "valid"
                                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                      : v.verificationResult === "invalid"
                                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                      : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                  }`}
                                  data-testid={`badge-vat-result-${v.id}`}
                                >
                                  {v.verificationResult}
                                </Badge>
                              </td>
                              <td className="p-2 text-xs">{v.verificationMethod || "—"}</td>
                              <td className="p-2 text-xs">{v.verifiedByName || "—"}</td>
                              <td className="p-2 text-xs max-w-[200px] truncate">{v.notes || "—"}</td>
                              <td className="p-2 text-xs">{formatTimestamp(v.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rate-cards" data-testid="tab-content-rate-cards">
            {rateCardLoading ? (
              <Card>
                <CardContent className="p-8 flex items-center justify-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Loading rate card history...</span>
                </CardContent>
              </Card>
            ) : rateCardHistory.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="font-semibold">No rate card changes recorded</h3>
                  <p className="text-sm text-muted-foreground">Rate card change history will appear here.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-rate-card-history">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2 font-medium text-muted-foreground">Change Type</th>
                          <th className="p-2 font-medium text-muted-foreground">Role</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">Old Hourly</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">New Hourly</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">Old Overtime</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">New Overtime</th>
                          <th className="p-2 font-medium text-muted-foreground">Effective From</th>
                          <th className="p-2 font-medium text-muted-foreground">Changed By</th>
                          <th className="p-2 font-medium text-muted-foreground">Reason</th>
                          <th className="p-2 font-medium text-muted-foreground">Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateCardHistory.map((entry) => (
                          <tr key={entry.id} className="border-b last:border-0" data-testid={`row-rate-card-${entry.id}`}>
                            <td className="p-2">
                              <Badge variant="secondary" className="text-xs" data-testid={`badge-change-type-${entry.id}`}>
                                {entry.changeType}
                              </Badge>
                            </td>
                            <td className="p-2 text-xs">{entry.roleType || "—"}</td>
                            <td className="p-2 text-right text-xs">{entry.oldHourlyRate ? formatCurrency(entry.oldHourlyRate) : "—"}</td>
                            <td className="p-2 text-right text-xs">{entry.newHourlyRate ? formatCurrency(entry.newHourlyRate) : "—"}</td>
                            <td className="p-2 text-right text-xs">{entry.oldOvertimeRate ? formatCurrency(entry.oldOvertimeRate) : "—"}</td>
                            <td className="p-2 text-right text-xs">{entry.newOvertimeRate ? formatCurrency(entry.newOvertimeRate) : "—"}</td>
                            <td className="p-2 text-xs">{formatDate(entry.effectiveFrom)}</td>
                            <td className="p-2 text-xs">{entry.changedByName || "—"}</td>
                            <td className="p-2 text-xs max-w-[200px] truncate">{entry.reason || "—"}</td>
                            <td className="p-2 text-xs">{formatTimestamp(entry.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={vatDialogOpen} onOpenChange={setVatDialogOpen}>
        <DialogContent className="max-w-md" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle data-testid="text-vat-dialog-title">Record VAT Verification</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => vatMutation.mutate(data))}
              className="space-y-4"
              data-testid="form-vat-verification"
            >
              <FormField
                control={form.control}
                name="vatNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VAT Number</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-vat-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="verificationResult"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Result</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-verification-result">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="valid">Valid</SelectItem>
                        <SelectItem value="invalid">Invalid</SelectItem>
                        <SelectItem value="not_registered">Not Registered</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="verificationMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-verification-method">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="hmrc_api">HMRC API</SelectItem>
                        <SelectItem value="third_party">Third Party</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Optional notes about this verification..." data-testid="textarea-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setVatDialogOpen(false)} data-testid="button-cancel-vat">
                  Cancel
                </Button>
                <Button type="submit" disabled={vatMutation.isPending} data-testid="button-submit-vat">
                  {vatMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Record Verification
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
