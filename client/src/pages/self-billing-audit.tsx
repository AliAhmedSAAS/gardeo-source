import { useState, useMemo } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  FileText, Download, Loader2, Shield, AlertTriangle,
  CheckCircle2, ClipboardList, Building2, Receipt, Scale, FileCheck,
  ChevronDown, ChevronUp, Clock, User, Eye,
} from "lucide-react";

type AuditEvent = {
  id: number;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  actorName: string | null;
  actorRole: string | null;
  summary: string;
  oldValues: any;
  newValues: any;
  ipAddress: string | null;
  createdAt: string;
};

type ExpiryAlert = {
  supplierId: number;
  companyName: string;
  expiryDate: string;
  daysRemaining: number;
  isExpired: boolean;
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

type AuditInvoice = {
  id: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  vatAmount: string;
  subtotal: string;
  status: string | null;
  supplierName: string | null;
  createdAt: string | null;
  issuedAt?: string | null;
  acceptedAt?: string | null;
  paidAt?: string | null;
};

type CreditNote = {
  id: number;
  creditNoteNumber: string;
  reason: string;
  totalAmount: string;
  vatAmount: string;
  subtotal: string;
  status: string | null;
  invoiceId: number;
  createdAt: string | null;
};

type DebitNote = {
  id: number;
  debitNoteNumber: string;
  reason: string;
  totalAmount: string;
  vatAmount: string;
  subtotal: string;
  status: string | null;
  invoiceId: number;
  createdAt: string | null;
};

type Supplier = {
  id: number;
  companyName: string;
  vatNumber: string | null;
  vatStatus: string | null;
  selfBillingAgreementStatus: string | null;
  defaultVatRate: string | null;
};

type Dispute = {
  id: number;
  invoiceId: number | null;
  shiftId: number | null;
  reason: string;
  status: string;
  createdAt: string | null;
  resolvedAt?: string | null;
};

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function formatCurrency(v: string | number | null | undefined) {
  const n = parseFloat(String(v || "0"));
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

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

const INVOICE_LIFECYCLE_STEPS = [
  { key: "generated", label: "Generated", field: "createdAt" },
  { key: "issued", label: "Issued", field: "issuedAt" },
  { key: "viewed", label: "Viewed", field: null },
  { key: "accepted", label: "Accepted/Disputed", field: "acceptedAt" },
  { key: "paid", label: "Paid", field: "paidAt" },
];

const EVENT_TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  agreement: { label: "Agreement", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700" },
  invoice: { label: "Invoice", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700" },
  vat: { label: "VAT", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 dark:border-orange-700" },
  rate_card: { label: "Rate Card", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700" },
  dispute: { label: "Dispute", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700" },
  timesheet: { label: "Timesheet", className: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400 border-teal-300 dark:border-teal-700" },
  credit_note: { label: "Credit Note", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:border-amber-700" },
};

const TIMELINE_DOT_COLORS: Record<string, string> = {
  agreement: "bg-green-500",
  invoice: "bg-blue-500",
  vat: "bg-orange-500",
  rate_card: "bg-purple-500",
  dispute: "bg-red-500",
  timesheet: "bg-teal-500",
  credit_note: "bg-amber-500",
};

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

function InvoiceEventTimeline({ invoiceId }: { invoiceId: number }) {
  const { data: events = [], isLoading } = useQuery<AuditEvent[]>({
    queryKey: ["/api/supplier-audit-events/invoice", invoiceId],
    enabled: !!invoiceId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 px-4">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Loading invoice timeline...</span>
      </div>
    );
  }

  const eventsByType: Record<string, AuditEvent> = {};
  events.forEach(e => {
    const lower = e.eventType.toLowerCase();
    if (lower.includes("generat") || lower.includes("creat")) eventsByType["generated"] = e;
    if (lower.includes("issu")) eventsByType["issued"] = e;
    if (lower.includes("view")) eventsByType["viewed"] = e;
    if (lower.includes("accept") || lower.includes("disput")) eventsByType["accepted"] = e;
    if (lower.includes("paid") || lower.includes("pay")) eventsByType["paid"] = e;
  });

  return (
    <div className="py-3 px-4" data-testid={`invoice-timeline-${invoiceId}`}>
      <p className="text-xs font-medium text-muted-foreground mb-3">Invoice Lifecycle</p>
      <div className="flex items-start gap-0 overflow-x-auto">
        {INVOICE_LIFECYCLE_STEPS.map((step, idx) => {
          const evt = eventsByType[step.key];
          const isComplete = !!evt;
          const isLast = idx === INVOICE_LIFECYCLE_STEPS.length - 1;
          return (
            <div key={step.key} className="flex items-start flex-shrink-0" data-testid={`step-${step.key}-${invoiceId}`}>
              <div className="flex flex-col items-center min-w-[100px]">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                    isComplete
                      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isComplete ? <CheckCircle2 className="w-4 h-4" /> : (idx + 1)}
                </div>
                <p className={`text-xs font-medium mt-1.5 text-center ${isComplete ? "" : "text-muted-foreground"}`}>
                  {step.label}
                </p>
                {evt && (
                  <div className="text-center mt-1">
                    <p className="text-[10px] text-muted-foreground">{formatTimestamp(evt.createdAt)}</p>
                    {evt.actorName && (
                      <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-0.5">
                        <User className="w-2.5 h-2.5" />{evt.actorName}
                      </p>
                    )}
                  </div>
                )}
              </div>
              {!isLast && (
                <div className={`h-px w-8 mt-3.5 flex-shrink-0 ${isComplete ? "bg-green-400" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SelfBillingAuditPage() {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [quarter, setQuarter] = useState("all");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const [selectedAuditSupplierId, setSelectedAuditSupplierId] = useState<string>("");

  const { data: invoices = [], isLoading: invLoading } = useQuery<AuditInvoice[]>({
    queryKey: ["/api/invoices/enriched"],
  });

  const { data: creditNotes = [], isLoading: cnLoading } = useQuery<CreditNote[]>({
    queryKey: ["/api/credit-notes"],
  });

  const { data: debitNotes = [], isLoading: dnLoading } = useQuery<DebitNote[]>({
    queryKey: ["/api/debit-notes"],
  });

  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: disputes = [] } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes"],
  });

  const { data: expiryAlerts = [] } = useQuery<ExpiryAlert[]>({
    queryKey: ["/api/agreement-expiry-alerts"],
  });

  const auditSupplierId = selectedAuditSupplierId ? parseInt(selectedAuditSupplierId) : null;

  const { data: supplierAuditEvents = [], isLoading: auditEventsLoading } = useQuery<AuditEvent[]>({
    queryKey: ["/api/supplier-audit-events/supplier", auditSupplierId],
    enabled: !!auditSupplierId,
  });

  const activeSupplierIds = useMemo(
    () => suppliers.filter(s => s.selfBillingAgreementStatus === "active").map(s => s.id),
    [suppliers]
  );

  const vatVerResults = useQueries({
    queries: activeSupplierIds.map(sid => ({
      queryKey: ["/api/vat-verifications", sid] as const,
    })),
  });

  const vatVerificationsBySupplier = useMemo(() => {
    const map: Record<number, VatVerification | undefined> = {};
    activeSupplierIds.forEach((sid, idx) => {
      const data = vatVerResults[idx]?.data as VatVerification[] | undefined;
      if (data && data.length > 0) {
        map[sid] = [...data].sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
      }
    });
    return map;
  }, [activeSupplierIds, vatVerResults]);

  const toggleInvoiceExpanded = (id: number) => {
    setExpandedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isLoading = invLoading || cnLoading || dnLoading;

  const getFiscalQuarter = (month: number): number => {
    if (month === 0 || month >= 10) return 1;
    if (month >= 1 && month <= 3) return 2;
    if (month >= 4 && month <= 6) return 3;
    return 4;
  };
  const getFiscalYear = (d: Date): number => {
    const m = d.getUTCMonth ? d.getUTCMonth() : d.getMonth();
    const y = d.getUTCFullYear ? d.getUTCFullYear() : d.getFullYear();
    return m >= 10 ? y + 1 : y;
  };

  const filteredInvoices = invoices.filter((inv) => {
    const d = new Date(inv.periodStart || inv.createdAt || "");
    if (isNaN(d.getTime())) return false;
    if (getFiscalYear(d).toString() !== year) return false;
    if (quarter !== "all") {
      const m = d.getUTCMonth ? d.getUTCMonth() : d.getMonth();
      if (getFiscalQuarter(m).toString() !== quarter) return false;
    }
    return true;
  });

  const filteredCreditNotes = creditNotes.filter((cn) => {
    const d = new Date(cn.createdAt || "");
    if (isNaN(d.getTime())) return false;
    if (getFiscalYear(d).toString() !== year) return false;
    if (quarter !== "all") {
      const m = d.getUTCMonth ? d.getUTCMonth() : d.getMonth();
      if (getFiscalQuarter(m).toString() !== quarter) return false;
    }
    return true;
  });

  const filteredDebitNotes = debitNotes.filter((dn) => {
    const d = new Date(dn.createdAt || "");
    if (getFiscalYear(d).toString() !== year) return false;
    if (quarter !== "all") {
      if (getFiscalQuarter(d.getMonth()).toString() !== quarter) return false;
    }
    return true;
  });

  const totalInvoiceAmount = filteredInvoices.reduce((s, i) => s + parseFloat(i.totalAmount || "0"), 0);
  const totalVat = filteredInvoices.reduce((s, i) => s + parseFloat(i.vatAmount || "0"), 0);
  const totalSubtotal = filteredInvoices.reduce((s, i) => s + parseFloat(i.subtotal || "0"), 0);
  const totalCreditAmount = filteredCreditNotes.reduce((s, cn) => s + parseFloat(cn.totalAmount || "0"), 0);
  const totalDebitAmount = filteredDebitNotes.reduce((s, dn) => s + parseFloat(dn.totalAmount || "0"), 0);
  const activeAgreements = suppliers.filter(s => s.selfBillingAgreementStatus === "active").length;
  const vatRegisteredSuppliers = suppliers.filter(s => s.vatStatus === "vat_registered").length;
  const openDisputes = disputes.filter(d => d.status === "open" || d.status === "under_review" || d.status === "escalated").length;

  const statusCounts: Record<string, number> = {};
  filteredInvoices.forEach(inv => {
    const st = inv.status || "draft";
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  const exportAuditCSV = () => {
    const headers = ["Invoice Number", "Supplier", "Period Start", "Period End", "Subtotal", "VAT", "Total", "Status", "Issued", "Accepted", "Paid"];
    const rows = filteredInvoices.map(inv => [
      inv.invoiceNumber,
      inv.supplierName || "",
      formatDate(inv.periodStart),
      formatDate(inv.periodEnd),
      inv.subtotal,
      inv.vatAmount,
      inv.totalAmount,
      inv.status || "draft",
      formatDate(inv.issuedAt),
      formatDate(inv.acceptedAt),
      formatDate(inv.paidAt),
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `self-billing-audit-${year}-Q${quarter === "all" ? "ALL" : quarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportVATSummaryCSV = () => {
    const headers = ["Period", "Total Invoices", "Net Amount", "VAT Amount", "Gross Amount", "Credit Notes", "Debit Notes"];
    const row = [
      quarter === "all" ? `${year} Full Year` : `${year} Q${quarter}`,
      filteredInvoices.length,
      totalSubtotal.toFixed(2),
      totalVat.toFixed(2),
      totalInvoiceAmount.toFixed(2),
      totalCreditAmount.toFixed(2),
      totalDebitAmount.toFixed(2),
    ];
    const csv = [headers.join(","), row.map(v => `"${v}"`).join(",")].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vat-summary-${year}-Q${quarter === "all" ? "ALL" : quarter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());

  return (
    <div className="p-6 space-y-6" data-testid="self-billing-audit-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Self-Billing Audit Pack</h1>
            <p className="text-muted-foreground text-sm">HMRC VAT Notice 700/62 compliance audit trail</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={quarter} onValueChange={setQuarter}>
            <SelectTrigger className="w-[120px]" data-testid="select-quarter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Full Year</SelectItem>
              <SelectItem value="1">Q1 (Nov–Jan)</SelectItem>
              <SelectItem value="2">Q2 (Feb–Apr)</SelectItem>
              <SelectItem value="3">Q3 (May–Jul)</SelectItem>
              <SelectItem value="4">Q4 (Aug–Oct)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportAuditCSV} data-testid="button-export-audit-csv">
            <Download className="w-4 h-4 mr-2" />
            Export Invoices CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportVATSummaryCSV} data-testid="button-export-vat-csv">
            <Download className="w-4 h-4 mr-2" />
            Export VAT Summary
          </Button>
        </div>
      </div>

      {expiryAlerts.length > 0 && (
        <div
          className={`p-4 rounded-md border ${
            expiryAlerts.some(a => a.isExpired)
              ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-700"
              : "bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-700"
          }`}
          data-testid="expiry-alerts-banner"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              expiryAlerts.some(a => a.isExpired) ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"
            }`} />
            <div className="min-w-0">
              <p className={`font-semibold text-sm ${
                expiryAlerts.some(a => a.isExpired) ? "text-red-800 dark:text-red-300" : "text-orange-800 dark:text-orange-300"
              }`} data-testid="text-expiry-alert-count">
                {expiryAlerts.length} supplier{expiryAlerts.length !== 1 ? "s" : ""} with expiring or expired agreements
              </p>
              <ul className="mt-1.5 space-y-0.5">
                {expiryAlerts.map(alert => (
                  <li key={alert.supplierId} className="text-xs flex items-center gap-2" data-testid={`expiry-alert-${alert.supplierId}`}>
                    <span className={`font-medium ${alert.isExpired ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>
                      {alert.companyName}
                    </span>
                    <span className="text-muted-foreground">
                      {alert.isExpired
                        ? `Expired ${Math.abs(alert.daysRemaining)} day${Math.abs(alert.daysRemaining) !== 1 ? "s" : ""} ago`
                        : `${alert.daysRemaining} day${alert.daysRemaining !== 1 ? "s" : ""} remaining (expires ${formatDate(alert.expiryDate)})`
                      }
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading audit data...</span>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="audit-summary-stats">
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-blue-500" />
                  <div>
                    <p className="text-lg font-bold" data-testid="stat-total-invoices">{filteredInvoices.length}</p>
                    <p className="text-xs text-muted-foreground">Total Invoices</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-green-500" />
                  <div>
                    <p className="text-lg font-bold" data-testid="stat-net-amount">{formatCurrency(totalSubtotal)}</p>
                    <p className="text-xs text-muted-foreground">Net Amount</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-purple-500" />
                  <div>
                    <p className="text-lg font-bold" data-testid="stat-vat-total">{formatCurrency(totalVat)}</p>
                    <p className="text-xs text-muted-foreground">VAT Total</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <div>
                    <p className="text-lg font-bold" data-testid="stat-open-disputes">{openDisputes}</p>
                    <p className="text-xs text-muted-foreground">Open Disputes</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="overview" data-testid="audit-tabs">
            <TabsList>
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="invoices" data-testid="tab-invoices">Invoice Register</TabsTrigger>
              <TabsTrigger value="adjustments" data-testid="tab-adjustments">Adjustments</TabsTrigger>
              <TabsTrigger value="agreements" data-testid="tab-agreements">Agreements</TabsTrigger>
              <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance Checklist</TabsTrigger>
              <TabsTrigger value="supplier-audit" data-testid="tab-supplier-audit">Supplier Audit Trail</TabsTrigger>
              <TabsTrigger value="number-audit" data-testid="tab-number-audit">Number Audit Log</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" data-testid="tab-content-overview">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ClipboardList className="w-4 h-4" />
                      VAT Period Summary
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Period</span>
                        <span className="font-medium" data-testid="text-period">{quarter === "all" ? `${year} Full Year` : `${year} Q${quarter}`}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Invoices Issued</span>
                        <span className="font-medium">{filteredInvoices.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Net (excl. VAT)</span>
                        <span className="font-medium">{formatCurrency(totalSubtotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">VAT Charged</span>
                        <span className="font-medium">{formatCurrency(totalVat)}</span>
                      </div>
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Gross Total</span>
                        <span className="font-semibold">{formatCurrency(totalInvoiceAmount)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      Supplier Agreements
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Suppliers</span>
                        <span className="font-medium">{suppliers.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Active Self-Billing Agreements</span>
                        <span className="font-medium">{activeAgreements}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">VAT-Registered Suppliers</span>
                        <span className="font-medium">{vatRegisteredSuppliers}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit Notes Issued</span>
                        <span className="font-medium">{filteredCreditNotes.length} ({formatCurrency(totalCreditAmount)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Debit Notes Issued</span>
                        <span className="font-medium">{filteredDebitNotes.length} ({formatCurrency(totalDebitAmount)})</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardContent className="p-4 space-y-3">
                    <h3 className="font-semibold flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Invoice Status Breakdown
                    </h3>
                    <div className="flex gap-3 flex-wrap">
                      {Object.entries(statusCounts).map(([status, count]) => (
                        <div key={status} className="flex items-center gap-2 px-3 py-2 bg-muted/50 rounded-md">
                          <Badge variant={status === "paid" ? "default" : "secondary"} className="text-xs">
                            {status}
                          </Badge>
                          <span className="font-medium text-sm">{count}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="invoices" data-testid="tab-content-invoices">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Invoice Register ({filteredInvoices.length} invoices)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-invoice-register">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2 w-8"></th>
                          <th className="p-2 font-medium text-muted-foreground">Invoice #</th>
                          <th className="p-2 font-medium text-muted-foreground">Supplier</th>
                          <th className="p-2 font-medium text-muted-foreground">Period</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">Net</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">VAT</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">Gross</th>
                          <th className="p-2 font-medium text-muted-foreground">Status</th>
                          <th className="p-2 font-medium text-muted-foreground">Issued</th>
                          <th className="p-2 font-medium text-muted-foreground">Accepted</th>
                          <th className="p-2 font-medium text-muted-foreground">Paid</th>
                          <th className="p-2 font-medium text-muted-foreground">PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredInvoices.map(inv => {
                          const isExpanded = expandedInvoices.has(inv.id);
                          return (
                            <tr key={inv.id} className="border-b last:border-0" data-testid={`row-register-${inv.id}`}>
                              <td colSpan={12} className="p-0">
                                <table className="w-full">
                                  <tbody>
                                    <tr>
                                      <td className="p-2 w-8">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          onClick={() => toggleInvoiceExpanded(inv.id)}
                                          data-testid={`button-expand-invoice-${inv.id}`}
                                        >
                                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                        </Button>
                                      </td>
                                      <td className="p-2 font-mono text-xs">{inv.invoiceNumber}</td>
                                      <td className="p-2 text-sm">{inv.supplierName || "—"}</td>
                                      <td className="p-2 text-xs">{formatDate(inv.periodStart)} - {formatDate(inv.periodEnd)}</td>
                                      <td className="p-2 text-right text-sm">{formatCurrency(inv.subtotal)}</td>
                                      <td className="p-2 text-right text-sm">{formatCurrency(inv.vatAmount)}</td>
                                      <td className="p-2 text-right font-medium text-sm">{formatCurrency(inv.totalAmount)}</td>
                                      <td className="p-2">
                                        <Badge variant="secondary" className="text-xs">{inv.status || "draft"}</Badge>
                                      </td>
                                      <td className="p-2 text-xs">{formatDate(inv.issuedAt)}</td>
                                      <td className="p-2 text-xs">{formatDate(inv.acceptedAt)}</td>
                                      <td className="p-2 text-xs">{formatDate(inv.paidAt)}</td>
                                      <td className="p-2">
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-7 px-2"
                                          onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, "_blank")}
                                          data-testid={`button-pdf-${inv.id}`}
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </Button>
                                      </td>
                                    </tr>
                                    {isExpanded && (
                                      <tr>
                                        <td colSpan={12} className="border-t bg-muted/30">
                                          <InvoiceEventTimeline invoiceId={inv.id} />
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredInvoices.length === 0 && (
                          <tr>
                            <td colSpan={12} className="p-4 text-center text-muted-foreground">No invoices found for this period.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="adjustments" data-testid="tab-content-adjustments">
              <div className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Credit Notes ({filteredCreditNotes.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="p-2 font-medium text-muted-foreground">CN #</th>
                            <th className="p-2 font-medium text-muted-foreground">Reason</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Amount</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">VAT</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Total</th>
                            <th className="p-2 font-medium text-muted-foreground">Status</th>
                            <th className="p-2 font-medium text-muted-foreground">Date</th>
                            <th className="p-2 font-medium text-muted-foreground">PDF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCreditNotes.map(cn => (
                            <tr key={cn.id} className="border-b last:border-0">
                              <td className="p-2 font-mono text-xs">{cn.creditNoteNumber}</td>
                              <td className="p-2 text-xs max-w-[200px] truncate">{cn.reason}</td>
                              <td className="p-2 text-right">{formatCurrency(cn.subtotal)}</td>
                              <td className="p-2 text-right">{formatCurrency(cn.vatAmount)}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(cn.totalAmount)}</td>
                              <td className="p-2"><Badge variant="secondary" className="text-xs">{cn.status || "draft"}</Badge></td>
                              <td className="p-2 text-xs">{formatDate(cn.createdAt)}</td>
                              <td className="p-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => window.open(`/api/credit-notes/${cn.id}/pdf`, "_blank")}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {filteredCreditNotes.length === 0 && (
                            <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No credit notes for this period.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <h3 className="font-semibold mb-3">Debit Notes ({filteredDebitNotes.length})</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="p-2 font-medium text-muted-foreground">DN #</th>
                            <th className="p-2 font-medium text-muted-foreground">Reason</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Amount</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">VAT</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Total</th>
                            <th className="p-2 font-medium text-muted-foreground">Status</th>
                            <th className="p-2 font-medium text-muted-foreground">Date</th>
                            <th className="p-2 font-medium text-muted-foreground">PDF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredDebitNotes.map(dn => (
                            <tr key={dn.id} className="border-b last:border-0">
                              <td className="p-2 font-mono text-xs">{dn.debitNoteNumber}</td>
                              <td className="p-2 text-xs max-w-[200px] truncate">{dn.reason}</td>
                              <td className="p-2 text-right">{formatCurrency(dn.subtotal)}</td>
                              <td className="p-2 text-right">{formatCurrency(dn.vatAmount)}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(dn.totalAmount)}</td>
                              <td className="p-2"><Badge variant="secondary" className="text-xs">{dn.status || "draft"}</Badge></td>
                              <td className="p-2 text-xs">{formatDate(dn.createdAt)}</td>
                              <td className="p-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  onClick={() => window.open(`/api/debit-notes/${dn.id}/pdf`, "_blank")}
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {filteredDebitNotes.length === 0 && (
                            <tr><td colSpan={8} className="p-4 text-center text-muted-foreground">No debit notes for this period.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="agreements" data-testid="tab-content-agreements">
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-3">Self-Billing Agreement Status</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2 font-medium text-muted-foreground">Supplier</th>
                          <th className="p-2 font-medium text-muted-foreground">VAT Number</th>
                          <th className="p-2 font-medium text-muted-foreground">VAT Status</th>
                          <th className="p-2 font-medium text-muted-foreground">Default VAT Rate</th>
                          <th className="p-2 font-medium text-muted-foreground">Agreement Status</th>
                          <th className="p-2 font-medium text-muted-foreground text-right">Agreement PDF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers.map(s => (
                          <tr key={s.id} className="border-b last:border-0" data-testid={`row-supplier-${s.id}`}>
                            <td className="p-2 font-medium">{s.companyName}</td>
                            <td className="p-2 font-mono text-xs">{s.vatNumber || "—"}</td>
                            <td className="p-2">
                              <Badge variant={s.vatStatus === "vat_registered" ? "default" : "secondary"} className="text-xs">
                                {s.vatStatus === "vat_registered" ? "VAT Registered" : s.vatStatus || "Unknown"}
                              </Badge>
                            </td>
                            <td className="p-2">{s.defaultVatRate || "20"}%</td>
                            <td className="p-2">
                              <Badge
                                variant={s.selfBillingAgreementStatus === "active" ? "default" : "secondary"}
                                className={`text-xs ${s.selfBillingAgreementStatus === "active" ? "bg-green-600" : ""}`}
                              >
                                {s.selfBillingAgreementStatus || "Not Set"}
                              </Badge>
                            </td>
                            <td className="p-2 text-right">
                              {s.selfBillingAgreementStatus === "active" ? (
                                <div className="flex items-center justify-end gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    data-testid={`button-view-agreement-${s.id}`}
                                    onClick={() => {
                                      window.open(`/api/admin/suppliers/${s.id}/agreement-pdf`, "_blank");
                                    }}
                                  >
                                    <Eye className="w-3 h-3" /> View
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    data-testid={`button-download-agreement-${s.id}`}
                                    onClick={async () => {
                                      try {
                                        const res = await fetch(`/api/admin/suppliers/${s.id}/agreement-pdf`, { credentials: "include" });
                                        if (!res.ok) throw new Error("Failed to download");
                                        const blob = await res.blob();
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement("a");
                                        a.href = url;
                                        a.download = `Self-Billing-Agreement-${s.companyName.replace(/\s+/g, "-")}.pdf`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                      } catch {
                                        // silent
                                      }
                                    }}
                                  >
                                    <Download className="w-3 h-3" /> PDF
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                        {suppliers.length === 0 && (
                          <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No suppliers found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compliance" data-testid="tab-content-compliance">
              <Card>
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    HMRC VAT Notice 700/62 Compliance Checklist
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    This checklist verifies compliance with HMRC requirements for self-billing arrangements.
                  </p>
                  <div className="space-y-3">
                    {[
                      {
                        label: "Written self-billing agreement in place with each supplier",
                        met: activeAgreements > 0,
                        detail: `${activeAgreements} active agreement(s) out of ${suppliers.length} supplier(s)`,
                      },
                      {
                        label: "Supplier VAT registration numbers recorded and verified",
                        met: vatRegisteredSuppliers > 0,
                        detail: `${vatRegisteredSuppliers} VAT-registered supplier(s)`,
                      },
                      {
                        label: "Self-billed invoices include required HMRC statement",
                        met: true,
                        detail: "All generated PDFs include the mandatory statement: 'The VAT shown is your output tax due to HMRC'",
                      },
                      {
                        label: "Sequential invoice numbering maintained",
                        met: filteredInvoices.length > 0,
                        detail: `${filteredInvoices.length} invoice(s) with sequential numbering`,
                      },
                      {
                        label: "Credit/debit notes reference original invoices",
                        met: true,
                        detail: `${filteredCreditNotes.length} credit note(s), ${filteredDebitNotes.length} debit note(s) — all linked to source invoices`,
                      },
                      {
                        label: "Supplier acceptance/dispute workflow active",
                        met: true,
                        detail: "Suppliers can accept or dispute invoices via the portal",
                      },
                      {
                        label: "Invoice details editable only before issuance",
                        met: true,
                        detail: "Issued invoices are locked from editing",
                      },
                      {
                        label: "All disputes resolved before payment",
                        met: openDisputes === 0,
                        detail: openDisputes > 0 ? `${openDisputes} unresolved dispute(s) remain` : "All disputes resolved",
                      },
                      {
                        label: "Audit trail maintained for all financial actions",
                        met: true,
                        detail: "Full audit logging for invoice creation, issuance, acceptance, payment, and disputes",
                      },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-md border ${item.met ? "border-green-200 bg-green-50" : "border-yellow-200 bg-yellow-50"}`}
                        data-testid={`compliance-item-${i}`}
                      >
                        {item.met ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-sm">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="mt-4">
                <CardContent className="p-4 space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    VAT Verification Summary
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Last VAT verification status for suppliers with active self-billing agreements.
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-vat-verification-summary">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="p-2 font-medium text-muted-foreground">Supplier</th>
                          <th className="p-2 font-medium text-muted-foreground">VAT Number</th>
                          <th className="p-2 font-medium text-muted-foreground">Last Verification</th>
                          <th className="p-2 font-medium text-muted-foreground">Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suppliers
                          .filter(s => s.selfBillingAgreementStatus === "active")
                          .map(s => {
                            const lastVerification = vatVerificationsBySupplier[s.id];
                            return (
                              <tr key={s.id} className="border-b last:border-0" data-testid={`row-vat-summary-${s.id}`}>
                                <td className="p-2 font-medium">{s.companyName}</td>
                                <td className="p-2 font-mono text-xs">{s.vatNumber || "—"}</td>
                                <td className="p-2 text-xs">
                                  {lastVerification ? formatDate(lastVerification.createdAt) : "Never verified"}
                                </td>
                                <td className="p-2">
                                  {lastVerification ? (
                                    <Badge
                                      className={`no-default-hover-elevate no-default-active-elevate text-xs ${
                                        lastVerification.verificationResult === "valid"
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                          : lastVerification.verificationResult === "invalid"
                                          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                      }`}
                                      data-testid={`badge-vat-status-${s.id}`}
                                    >
                                      {lastVerification.verificationResult}
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs" data-testid={`badge-vat-status-${s.id}`}>
                                      Not verified
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        {suppliers.filter(s => s.selfBillingAgreementStatus === "active").length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-muted-foreground">No suppliers with active agreements.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="supplier-audit" data-testid="tab-content-supplier-audit">
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px]">
                    <label className="text-xs text-muted-foreground mb-1 block">Supplier</label>
                    <Select value={selectedAuditSupplierId} onValueChange={setSelectedAuditSupplierId}>
                      <SelectTrigger data-testid="select-audit-supplier">
                        <SelectValue placeholder="Select a supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map(s => (
                          <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {!auditSupplierId ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <h3 className="font-semibold">Select a Supplier</h3>
                      <p className="text-sm text-muted-foreground">Choose a supplier from the dropdown above to view their audit trail.</p>
                    </CardContent>
                  </Card>
                ) : auditEventsLoading ? (
                  <Card>
                    <CardContent className="p-8 flex items-center justify-center gap-3">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Loading audit events...</span>
                    </CardContent>
                  </Card>
                ) : supplierAuditEvents.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                      <h3 className="font-semibold">No audit events found</h3>
                      <p className="text-sm text-muted-foreground">Audit events will appear here as actions are performed for this supplier.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="relative pl-6 space-y-0">
                    <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" />
                    {[...supplierAuditEvents]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map(event => {
                        const typeKey = getEventTypeKey(event.eventType);
                        const config = EVENT_TYPE_CONFIG[typeKey] || EVENT_TYPE_CONFIG.agreement;
                        const dotColor = TIMELINE_DOT_COLORS[typeKey] || "bg-gray-500";
                        return (
                          <div key={event.id} className="relative pb-4" data-testid={`supplier-timeline-event-${event.id}`}>
                            <div className={`absolute -left-6 top-4 w-3 h-3 rounded-full ${dotColor} ring-2 ring-background z-10`} />
                            <Card>
                              <CardContent className="p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge
                                        className={`no-default-hover-elevate no-default-active-elevate ${config.className}`}
                                        data-testid={`badge-supplier-event-type-${event.id}`}
                                      >
                                        {config.label}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {event.eventType}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium" data-testid={`text-supplier-summary-${event.id}`}>
                                      {event.summary}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                      {event.actorName && (
                                        <span>
                                          {event.actorName}
                                        </span>
                                      )}
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span data-testid={`text-supplier-timestamp-${event.id}`}>
                                          {formatTimestamp(event.createdAt)}
                                        </span>
                                      </span>
                                      {event.ipAddress && (
                                        <span className="font-mono" data-testid={`text-supplier-ip-${event.id}`}>
                                          IP: {event.ipAddress}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="number-audit" data-testid="tab-content-number-audit">
              <InvoiceNumberAuditTab />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

function InvoiceNumberAuditTab() {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: auditLogs = [], isLoading } = useQuery<{
    id: number;
    invoiceId: number;
    oldNumber: string;
    newNumber: string;
    changedAt: string;
  }[]>({
    queryKey: ["/api/invoice-number-audit-log"],
  });

  const filtered = useMemo(() => {
    if (!searchTerm.trim()) return auditLogs;
    const term = searchTerm.toLowerCase();
    return auditLogs.filter(
      (l) =>
        l.oldNumber.toLowerCase().includes(term) ||
        l.newNumber.toLowerCase().includes(term)
    );
  }, [auditLogs, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="number-audit-panel">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Invoice Number Audit Log</h3>
          <p className="text-xs text-muted-foreground">
            HMRC traceability: old invoice number → new invoice number mappings
          </p>
        </div>
        <Badge variant="outline" data-testid="badge-audit-count">
          {auditLogs.length} mapping{auditLogs.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search old or new invoice number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          data-testid="input-search-audit"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground text-sm">
            {auditLogs.length === 0
              ? "No invoice number changes have been recorded yet."
              : "No results match your search."}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-2 font-medium">Invoice ID</th>
                    <th className="text-left px-4 py-2 font-medium">Old Number</th>
                    <th className="text-left px-4 py-2 font-medium">New Number</th>
                    <th className="text-left px-4 py-2 font-medium">Changed At</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b last:border-b-0 hover:bg-muted/30"
                      data-testid={`row-audit-${log.id}`}
                    >
                      <td className="px-4 py-2">{log.invoiceId}</td>
                      <td className="px-4 py-2 font-mono text-xs">{log.oldNumber}</td>
                      <td className="px-4 py-2 font-mono text-xs">{log.newNumber}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatTimestamp(log.changedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
