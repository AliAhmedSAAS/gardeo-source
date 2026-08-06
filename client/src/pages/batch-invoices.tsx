import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileStack, Loader2, ShieldAlert, CheckCircle2, AlertTriangle,
  ChevronRight, Square, CheckSquare, ArrowRight, StopCircle,
  Wand2, RotateCcw, Clock, PoundSterling, History, FileDown,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Supplier {
  id: number;
  companyName: string;
  supplierCode: string;
  billingFrequency: string | null;
  selfBillingAgreementStatus: string | null;
  selfBillingExpiryDate: string | null;
}

interface RateBreakdownItem {
  rate: number;
  shifts: number;
  hours: number;
  amount: number;
}

interface SupplierMonthBreakdown {
  supplierId: number;
  supplierName: string;
  shiftCount: number;
  calculatedTotal: number;
  billingFrequency: string;
  rateBreakdown?: RateBreakdownItem[];
}

interface MonthPreview {
  month: string;
  shiftCount: number;
  supplierBreakdown: SupplierMonthBreakdown[];
}

interface BatchPreviewResponse {
  months: MonthPreview[];
  totalShifts: number;
  pendingApprovalCount: number;
}

interface InvoiceResult {
  supplierId: number;
  supplierName: string;
  invoiceId: number;
  invoiceNumber: string;
  period: string;
  shiftCount: number;
  subtotal: number;
  vatAmount: number;
  totalAmount: number;
  adjustmentApplied: boolean;
}

interface SkippedSupplier {
  supplierId: number;
  supplierName: string;
  reason: string;
}

interface MonthProcessResult {
  month: string;
  shiftsAutoApproved: number;
  shiftsAdjusted: number;
  invoicesCreated: number;
  results: InvoiceResult[];
  skipped: SkippedSupplier[];
  warnings: string[];
}

interface REPreviewMonth {
  paymentMonth: string;
  workMonth: string;
  paymentCount: number;
  totalPayment: number;
  hourlyRate: number;
  invoiceCount: number;
  invoiceTotal: number;
  difference: number;
  action: string;
  alreadyProcessed: boolean;
  logEntry: { id: number; shifts_added: number; strategy: string; created_at: string } | null;
}

interface REPreview {
  supplierId: number;
  supplierName: string;
  rateCards: { hourly_rate: string; effective_from: string; effective_to: string | null }[];
  months: REPreviewMonth[];
}

interface RELogEntry {
  id: number;
  supplier_name: string;
  payment_month: string;
  work_month: string;
  total_payment_amount: string;
  hourly_rate_used: string;
  hours_generated: string;
  shifts_added: number;
  strategy: string;
  status: string;
  batch_id: string;
  created_at: string;
  rolled_back_at: string | null;
  invoice_total_before: string | null;
  invoice_total_after: string | null;
}

interface REGenerateResult {
  success: boolean;
  strategy: string;
  shiftsAdded?: number;
  shiftsRemoved?: number;
  hoursAdded?: number;
  hoursRemoved?: number;
  invoicesCreated?: number;
  invoiceTotal?: number;
  invoiceTotalBefore?: number;
  invoiceTotalAfter?: number;
  difference?: number;
  paymentMonth: string;
  workMonth?: string;
  message?: string;
}

function ReverseEngineerDialog({ supplierId, supplierName, open, onOpenChange }: {
  supplierId: number;
  supplierName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<"preview" | "history">("preview");
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<REGenerateResult[]>([]);

  const previewQuery = useQuery<REPreview>({
    queryKey: ["/api/reverse-engineer/preview", supplierId],
    queryFn: async () => {
      const r = await fetch(`/api/reverse-engineer/preview/${supplierId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load preview");
      return r.json();
    },
    enabled: open,
  });

  const logsQuery = useQuery<RELogEntry[]>({
    queryKey: ["/api/reverse-engineer/logs", supplierId],
    queryFn: async () => {
      const r = await fetch(`/api/reverse-engineer/logs/${supplierId}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load logs");
      return r.json();
    },
    enabled: open && tab === "history",
  });

  const rollbackMutation = useMutation({
    mutationFn: async (logId: number) => {
      const r = await apiRequest("POST", `/api/reverse-engineer/rollback/${logId}`, {});
      return r.json();
    },
    onSuccess: (data) => {
      toast({ title: "Rolled back", description: `${data.shiftsRemoved || data.shiftsRestored || 0} shifts affected.` });
      queryClient.invalidateQueries({ queryKey: ["/api/reverse-engineer/preview", supplierId] });
      queryClient.invalidateQueries({ queryKey: ["/api/reverse-engineer/logs", supplierId] });
    },
    onError: (err: any) => {
      toast({ title: "Rollback failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleMonth = (pm: string) => {
    setSelectedMonths(prev => {
      const next = new Set(prev);
      if (next.has(pm)) next.delete(pm); else next.add(pm);
      return next;
    });
  };

  const selectAllMonths = () => {
    const eligible = (previewQuery.data?.months || []).filter(m => m.action !== "matched" && !m.alreadyProcessed && m.hourlyRate > 0);
    setSelectedMonths(new Set(eligible.map(m => m.paymentMonth)));
  };

  const handleGenerate = async () => {
    if (selectedMonths.size === 0) return;
    setProcessing(true);
    setResults([]);
    const sorted = Array.from(selectedMonths).sort();
    const newResults: REGenerateResult[] = [];

    for (const pm of sorted) {
      try {
        const r = await apiRequest("POST", "/api/reverse-engineer/generate", { supplierId, paymentMonth: pm });
        const data = await r.json();
        newResults.push({ ...data, paymentMonth: pm });
      } catch (err: any) {
        let msg = "Failed";
        try { msg = err?.message || "Failed"; } catch { /* ignore */ }
        newResults.push({ success: false, strategy: "error", paymentMonth: pm, message: msg });
      }
    }

    setResults(newResults);
    setProcessing(false);
    setSelectedMonths(new Set());
    queryClient.invalidateQueries({ queryKey: ["/api/reverse-engineer/preview", supplierId] });
    queryClient.invalidateQueries({ queryKey: ["/api/reverse-engineer/logs", supplierId] });
    toast({ title: "Processing complete", description: `${newResults.filter(r => r.success).length} month(s) processed.` });
  };

  const fmtMonth = (m: string) => {
    const [y, mo] = m.split("-");
    const d = new Date(parseInt(y), parseInt(mo) - 1, 1);
    return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  };

  const fmtCurrency = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

  const actionBadge = (action: string) => {
    switch (action) {
      case "matched": return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Matched</Badge>;
      case "adjust_up": return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Adjust Up</Badge>;
      case "adjust_down": return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Adjust Down</Badge>;
      case "create": return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Create</Badge>;
      default: return <Badge variant="outline">{action}</Badge>;
    }
  };

  const preview = previewQuery.data;
  const eligibleCount = (preview?.months || []).filter(m => m.action !== "matched" && !m.alreadyProcessed && m.hourlyRate > 0).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-[#FF8C42]" />
            Reverse Engineer Shifts — {supplierName}
          </DialogTitle>
          <DialogDescription>
            Match invoices to bank payments. Adjusts existing invoices or creates new ones with shifts.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button variant={tab === "preview" ? "default" : "outline"} size="sm" onClick={() => setTab("preview")} data-testid="tab-re-preview">
            <PoundSterling className="h-4 w-4 mr-1" /> Payment vs Invoice Analysis
          </Button>
          <Button variant={tab === "history" ? "default" : "outline"} size="sm" onClick={() => setTab("history")} data-testid="tab-re-history">
            <History className="h-4 w-4 mr-1" /> Change History
          </Button>
        </div>

        {tab === "preview" && (
          <>
            {previewQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Analysing payments and invoices...</span>
              </div>
            ) : !preview ? (
              <p className="text-muted-foreground py-4">Failed to load data.</p>
            ) : preview.months.length === 0 ? (
              <p className="text-muted-foreground py-4">No bank payments found for this supplier.</p>
            ) : (
              <>
                {preview.rateCards.length > 0 && (
                  <div className="mb-3 text-sm text-muted-foreground">
                    Rate card: {preview.rateCards.map((rc, i) => {
                      const fmtDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
                      return (
                        <Badge key={i} variant="outline" className="mx-1">
                          £{parseFloat(rc.hourly_rate).toFixed(2)}/hr from {fmtDate(rc.effective_from)}{rc.effective_to ? ` to ${fmtDate(rc.effective_to)}` : ""}
                        </Badge>
                      );
                    })}
                  </div>
                )}

                {preview.rateCards.length === 0 && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    No rate card found. Add one in supplier settings first.
                  </div>
                )}

                <div className="flex gap-2 mb-3">
                  <Button variant="outline" size="sm" onClick={selectAllMonths} disabled={eligibleCount === 0} data-testid="button-re-select-all">
                    <CheckSquare className="h-4 w-4 mr-1" /> Select All Actionable ({eligibleCount})
                  </Button>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Pay Month</TableHead>
                        <TableHead>Work Month</TableHead>
                        <TableHead className="text-right">Bank Payment</TableHead>
                        <TableHead className="text-right">Invoice Total</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead className="text-center">Invoices</TableHead>
                        <TableHead className="text-center">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.months.map(m => {
                        const canProcess = m.action !== "matched" && !m.alreadyProcessed && m.hourlyRate > 0;
                        const rowClass = m.alreadyProcessed ? "bg-emerald-50/50"
                          : m.action === "matched" ? ""
                          : m.action === "adjust_down" ? "bg-red-50/30"
                          : m.action === "create" ? "bg-blue-50/30"
                          : "bg-amber-50/30";
                        return (
                          <TableRow key={m.paymentMonth} className={rowClass} data-testid={`row-re-month-${m.paymentMonth}`}>
                            <TableCell>
                              {canProcess && (
                                <Checkbox
                                  checked={selectedMonths.has(m.paymentMonth)}
                                  onCheckedChange={() => toggleMonth(m.paymentMonth)}
                                  data-testid={`checkbox-re-${m.paymentMonth}`}
                                />
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{fmtMonth(m.paymentMonth)}</TableCell>
                            <TableCell>{fmtMonth(m.workMonth)}</TableCell>
                            <TableCell className="text-right">{fmtCurrency(m.totalPayment)}</TableCell>
                            <TableCell className="text-right">
                              {m.invoiceCount > 0 ? fmtCurrency(m.invoiceTotal) : <span className="text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {m.action === "matched" ? (
                                <span className="text-emerald-600">{fmtCurrency(m.difference)}</span>
                              ) : m.difference > 0 ? (
                                <span className="text-amber-600">+{fmtCurrency(m.difference)}</span>
                              ) : m.difference < 0 ? (
                                <span className="text-red-600">{fmtCurrency(m.difference)}</span>
                              ) : (
                                <span className="text-emerald-600">{fmtCurrency(0)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">{m.invoiceCount || "—"}</TableCell>
                            <TableCell className="text-center">
                              {m.alreadyProcessed ? (
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Processed</Badge>
                              ) : m.hourlyRate === 0 ? (
                                <Badge variant="destructive">No Rate</Badge>
                              ) : (
                                actionBadge(m.action)
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {results.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <h4 className="font-semibold text-sm flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Results
                    </h4>
                    {results.map((r, i) => (
                      <div key={i} className={`text-sm p-2 rounded ${r.success ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
                        {r.success ? (
                          r.strategy === "create" ? `${fmtMonth(r.workMonth || "")}: Created ${r.shiftsAdded} shifts + ${r.invoicesCreated} invoices = ${fmtCurrency(r.invoiceTotal || 0)}`
                          : r.strategy === "adjust_up" ? `${fmtMonth(r.workMonth || "")}: +${r.shiftsAdded} shifts, invoice ${fmtCurrency(r.invoiceTotalBefore || 0)} → ${fmtCurrency(r.invoiceTotalAfter || 0)} (diff: ${fmtCurrency(r.difference || 0)})`
                          : r.strategy === "adjust_down" ? `${fmtMonth(r.workMonth || "")}: -${r.shiftsRemoved} shifts removed, invoice ${fmtCurrency(r.invoiceTotalBefore || 0)} → ${fmtCurrency(r.invoiceTotalAfter || 0)}`
                          : r.strategy === "matched" ? `${fmtMonth(r.paymentMonth)}: Already matched`
                          : `${fmtMonth(r.paymentMonth)}: ${r.message || "Processed"}`
                        ) : (
                          `${fmtMonth(r.paymentMonth)}: ${r.message}`
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-4">
                  <Button
                    onClick={handleGenerate}
                    disabled={selectedMonths.size === 0 || processing}
                    data-testid="button-re-generate"
                  >
                    {processing ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
                    ) : (
                      <><Wand2 className="h-4 w-4 mr-2" /> Process {selectedMonths.size} Month{selectedMonths.size !== 1 ? "s" : ""}</>
                    )}
                  </Button>
                </div>
              </>
            )}
          </>
        )}

        {tab === "history" && (
          <>
            {logsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span>Loading history...</span>
              </div>
            ) : (logsQuery.data || []).length === 0 ? (
              <p className="text-muted-foreground py-4">No operations have been performed for this supplier.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Work Month</TableHead>
                      <TableHead className="text-center">Strategy</TableHead>
                      <TableHead className="text-right">Payment</TableHead>
                      <TableHead className="text-right">Invoice Before</TableHead>
                      <TableHead className="text-right">Invoice After</TableHead>
                      <TableHead className="text-center">Shifts</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(logsQuery.data || []).map(log => (
                      <TableRow key={log.id} data-testid={`row-re-log-${log.id}`}>
                        <TableCell className="font-medium">{fmtMonth(log.work_month)}</TableCell>
                        <TableCell className="text-center">
                          {log.strategy === "create" ? <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Create</Badge>
                          : log.strategy === "adjust_up" ? <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Adjust Up</Badge>
                          : log.strategy === "adjust_down" ? <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Adjust Down</Badge>
                          : <Badge variant="outline">{log.strategy || "legacy"}</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{fmtCurrency(parseFloat(log.total_payment_amount))}</TableCell>
                        <TableCell className="text-right">{log.invoice_total_before ? fmtCurrency(parseFloat(log.invoice_total_before)) : "—"}</TableCell>
                        <TableCell className="text-right">{log.invoice_total_after ? fmtCurrency(parseFloat(log.invoice_total_after)) : "—"}</TableCell>
                        <TableCell className="text-center">{log.shifts_added > 0 ? `+${log.shifts_added}` : log.shifts_added}</TableCell>
                        <TableCell className="text-center">
                          {log.status === "completed" ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Rolled Back</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleDateString("en-GB")}
                        </TableCell>
                        <TableCell>
                          {log.status === "completed" && (
                            <Button
                              variant="outline" size="sm"
                              onClick={() => rollbackMutation.mutate(log.id)}
                              disabled={rollbackMutation.isPending}
                              data-testid={`button-rollback-${log.id}`}
                            >
                              <RotateCcw className="h-3 w-3 mr-1" /> Rollback
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

type Phase = "selection" | "processing" | "complete";

const ALLOWED_ROLES = [
  "super_admin", "tenant_admin", "ceo", "operations_manager",
  "admin", "accountant", "payroll_manager",
];

function formatMonth(monthStr: string) {
  const [year, month] = monthStr.split("-");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(amount);
}

export default function BatchInvoicesPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [phase, setPhase] = useState<Phase>("selection");
  const [preview, setPreview] = useState<BatchPreviewResponse | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);
  const [payments, setPayments] = useState<Record<number, string>>({});
  const [monthResults, setMonthResults] = useState<MonthProcessResult[]>([]);
  const [currentResult, setCurrentResult] = useState<MonthProcessResult | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [reDialogSupplier, setReDialogSupplier] = useState<{ id: number; name: string } | null>(null);
  const [remittanceSupplier, setRemittanceSupplier] = useState<{ id: number; name: string } | null>(null);
  const [allowAdjustments, setAllowAdjustments] = useState(false);
  const [allowRecalculate, setAllowRecalculate] = useState(false);
  const [remittanceMonth, setRemittanceMonth] = useState("");

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const eligibleSuppliers = suppliers.filter(
    (s) => s.selfBillingAgreementStatus === "active"
  );

  if (!initialized && eligibleSuppliers.length > 0) {
    setSelectedIds(new Set(eligibleSuppliers.map((s) => s.id)));
    setInitialized(true);
  }

  const previewMutation = useMutation({
    mutationFn: async (supplierIds: number[]) => {
      const response = await apiRequest("POST", "/api/self-billing/batch-preview", { supplierIds, allowRecalculate });
      return response.json() as Promise<BatchPreviewResponse>;
    },
    onSuccess: (data) => {
      setPreview(data);
      setCurrentMonthIndex(0);
      setMonthResults([]);
      setCurrentResult(null);
      if (data.months.length > 0) {
        const initialPayments: Record<number, string> = {};
        for (const sb of data.months[0].supplierBreakdown) {
          initialPayments[sb.supplierId] = (sb.calculatedTotal ?? 0).toFixed(2);
        }
        setPayments(initialPayments);
        setPhase("processing");
      } else {
        toast({ title: "No shifts available", description: "No uninvoiced shifts found for the selected suppliers." });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to load preview", variant: "destructive" });
    },
  });

  const processMutation = useMutation({
    mutationFn: async (args: { supplierIds: number[]; month: string; payments: { supplierId: number; amount: number }[]; allowAdjustments?: boolean; allowRecalculate?: boolean }) => {
      const response = await apiRequest("POST", "/api/self-billing/batch-process-month", args);
      return response.json() as Promise<MonthProcessResult>;
    },
    onSuccess: (data) => {
      setCurrentResult(data);
      setMonthResults((prev) => [...prev, data]);
      if (data.warnings.length > 0) {
        toast({ title: "Warnings", description: data.warnings.join("; "), variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error processing month", description: err.message || "Something went wrong", variant: "destructive" });
    },
  });

  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4" data-testid="text-access-denied">
        <ShieldAlert className="h-16 w-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    );
  }

  const toggleSupplier = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(eligibleSuppliers.map((s) => s.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleStartBatch = () => {
    if (selectedIds.size === 0) {
      toast({ title: "No suppliers selected", description: "Please select at least one supplier.", variant: "destructive" });
      return;
    }
    previewMutation.mutate(Array.from(selectedIds));
  };

  const handleProcessMonth = () => {
    if (!preview) return;
    const currentMonth = preview.months[currentMonthIndex];
    const paymentList = currentMonth.supplierBreakdown.map((sb) => ({
      supplierId: sb.supplierId,
      amount: allowAdjustments
        ? parseFloat(payments[sb.supplierId] || (sb.calculatedTotal ?? 0).toFixed(2))
        : (sb.calculatedTotal ?? 0),
    }));
    if (allowAdjustments) {
      const invalid = paymentList.find((p) => isNaN(p.amount) || p.amount < 0);
      if (invalid) {
        toast({ title: "Invalid payment", description: "All payment amounts must be valid non-negative numbers.", variant: "destructive" });
        return;
      }
    }
    processMutation.mutate({
      supplierIds: Array.from(selectedIds),
      month: currentMonth.month,
      payments: paymentList,
      allowAdjustments,
      allowRecalculate,
    });
  };

  const handleContinue = () => {
    if (!preview) return;
    const nextIndex = currentMonthIndex + 1;
    if (nextIndex >= preview.months.length) {
      setPhase("complete");
    } else {
      setCurrentMonthIndex(nextIndex);
      setCurrentResult(null);
      const nextMonth = preview.months[nextIndex];
      const nextPayments: Record<number, string> = {};
      for (const sb of nextMonth.supplierBreakdown) {
        nextPayments[sb.supplierId] = (sb.calculatedTotal ?? 0).toFixed(2);
      }
      setPayments(nextPayments);
    }
  };

  const handleStop = () => {
    setPhase("complete");
  };

  const handleDone = () => {
    setPhase("selection");
    setPreview(null);
    setCurrentMonthIndex(0);
    setMonthResults([]);
    setCurrentResult(null);
    setPayments({});
  };

  const totalInvoicesCreated = monthResults.reduce((sum, r) => sum + r.invoicesCreated, 0);
  const totalShiftsApproved = monthResults.reduce((sum, r) => sum + r.shiftsAutoApproved, 0);
  const totalShiftsAdjusted = monthResults.reduce((sum, r) => sum + r.shiftsAdjusted, 0);
  const grandTotal = monthResults.reduce(
    (sum, r) => sum + r.results.reduce((s, inv) => s + inv.totalAmount, 0), 0
  );

  const reDialog = reDialogSupplier ? (
    <ReverseEngineerDialog
      supplierId={reDialogSupplier.id}
      supplierName={reDialogSupplier.name}
      open={!!reDialogSupplier}
      onOpenChange={(open) => { if (!open) setReDialogSupplier(null); }}
    />
  ) : null;

  const handleRemittanceDownload = () => {
    if (!remittanceSupplier || !remittanceMonth) return;
    window.open(`/api/suppliers/${remittanceSupplier.id}/remittance-pdf?month=${remittanceMonth}`, "_blank");
    setRemittanceSupplier(null);
    setRemittanceMonth("");
  };

  const remittanceDialog = (
    <Dialog open={!!remittanceSupplier} onOpenChange={(open) => { if (!open) { setRemittanceSupplier(null); setRemittanceMonth(""); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Download Remittance Advice</DialogTitle>
          <DialogDescription>
            Select the work month for {remittanceSupplier?.name || "this supplier"}'s remittance report.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Work Month</label>
            <select
              value={remittanceMonth}
              onChange={(e) => setRemittanceMonth(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              data-testid="input-remittance-month"
            >
              <option value="">Select a month...</option>
              {(() => {
                const months: { value: string; label: string }[] = [];
                const now = new Date();
                for (let y = now.getFullYear(); y >= 2021; y--) {
                  const endMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12;
                  for (let m = endMonth; m >= 1; m--) {
                    const val = `${y}-${String(m).padStart(2, "0")}`;
                    const label = new Date(y, m - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
                    months.push({ value: val, label });
                  }
                }
                return months.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ));
              })()}
            </select>
          </div>
          <Button
            onClick={handleRemittanceDownload}
            disabled={!remittanceMonth}
            className="w-full"
            data-testid="button-download-remittance"
          >
            <FileDown className="h-4 w-4 mr-2" />
            Download Remittance PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (phase === "selection") {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        {reDialog}
        {remittanceDialog}
        <div className="flex items-center gap-3 mb-2">
          <FileStack className="h-8 w-8 text-[#1F3A5F]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-page-title">Batch Invoices</h1>
            <p className="text-muted-foreground">
              Auto-approve shifts and generate self-billing invoices month by month. Enter payment amounts to reconcile invoice totals.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Suppliers</CardTitle>
            <CardDescription>
              Only suppliers with active self-billing agreements are shown. All are selected by default.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 py-8 justify-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading suppliers...</span>
              </div>
            ) : eligibleSuppliers.length === 0 ? (
              <p className="text-muted-foreground py-4" data-testid="text-no-suppliers">
                No suppliers with active self-billing agreements found.
              </p>
            ) : (
              <>
                <div className="flex gap-2 mb-4">
                  <Button variant="outline" size="sm" onClick={selectAll} data-testid="button-select-all">
                    <CheckSquare className="h-4 w-4 mr-1" /> Select All
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAll} data-testid="button-deselect-all">
                    <Square className="h-4 w-4 mr-1" /> Deselect All
                  </Button>
                </div>
                <div className="space-y-2">
                  {eligibleSuppliers.map((supplier) => (
                    <div
                      key={supplier.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => toggleSupplier(supplier.id)}
                      data-testid={`row-supplier-${supplier.id}`}
                    >
                      <Checkbox
                        checked={selectedIds.has(supplier.id)}
                        onCheckedChange={() => toggleSupplier(supplier.id)}
                        data-testid={`checkbox-supplier-${supplier.id}`}
                      />
                      <div className="flex-1">
                        <span className="font-medium" data-testid={`text-supplier-name-${supplier.id}`}>
                          {supplier.companyName}
                        </span>
                        <span className="text-muted-foreground text-sm ml-2">
                          {supplier.supplierCode}
                        </span>
                      </div>
                      <Badge variant="outline" data-testid={`badge-frequency-${supplier.id}`}>
                        {(supplier.billingFrequency || "monthly").charAt(0).toUpperCase() +
                          (supplier.billingFrequency || "monthly").slice(1)}
                      </Badge>
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">
                        Agreement Active
                      </Badge>
                      <Button
                        variant="ghost" size="sm"
                        className="text-[#FF8C42] hover:text-[#FF8C42] hover:bg-orange-50"
                        onClick={(e) => { e.stopPropagation(); setReDialogSupplier({ id: supplier.id, name: supplier.companyName }); }}
                        data-testid={`button-reverse-engineer-${supplier.id}`}
                      >
                        <Wand2 className="h-4 w-4 mr-1" /> Reverse Engineer
                      </Button>
                      <Button
                        variant="ghost" size="sm"
                        className="text-[#1F3A5F] hover:text-[#1F3A5F] hover:bg-blue-50"
                        onClick={(e) => { e.stopPropagation(); setRemittanceSupplier({ id: supplier.id, name: supplier.companyName }); }}
                        data-testid={`button-remittance-${supplier.id}`}
                      >
                        <FileDown className="h-4 w-4 mr-1" /> Remittance
                      </Button>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-3 p-3 mt-4 rounded-lg border bg-muted/30">
                  <Checkbox
                    id="allow-recalculate-selection"
                    checked={allowRecalculate}
                    onCheckedChange={(checked) => setAllowRecalculate(!!checked)}
                    data-testid="checkbox-allow-recalculate"
                  />
                  <div className="grid gap-1">
                    <label htmlFor="allow-recalculate-selection" className="text-sm font-medium cursor-pointer">
                      Recalculate existing invoices
                    </label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, existing invoices for each month will be deleted and regenerated from shift data
                    </p>
                  </div>
                </div>
                <div className="mt-6">
                  <Button
                    onClick={handleStartBatch}
                    disabled={selectedIds.size === 0 || previewMutation.isPending}
                    data-testid="button-start-batch"
                  >
                    {previewMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading preview...
                      </>
                    ) : (
                      <>
                        <FileStack className="h-4 w-4 mr-2" />
                        Start Batch Invoicing ({selectedIds.size} supplier{selectedIds.size !== 1 ? "s" : ""})
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "processing" && preview) {
    const currentMonth = preview.months[currentMonthIndex];
    const progressPercent = ((currentMonthIndex) / preview.months.length) * 100;
    const monthLabel = formatMonth(currentMonth.month);

    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <FileStack className="h-8 w-8 text-[#1F3A5F]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-page-title">Batch Invoices</h1>
            <p className="text-muted-foreground">Processing month by month</p>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" data-testid="text-progress-label">
                Month {currentMonthIndex + 1} of {preview.months.length}
              </span>
              <div className="flex items-center gap-3">
                {currentMonthIndex > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCurrentMonthIndex(0);
                      setCurrentResult(null);
                      setMonthResults([]);
                      const firstMonth = preview.months[0];
                      const firstPayments: Record<number, string> = {};
                      for (const sb of firstMonth.supplierBreakdown) {
                        firstPayments[sb.supplierId] = (sb.calculatedTotal ?? 0).toFixed(2);
                      }
                      setPayments(firstPayments);
                    }}
                    data-testid="button-reset-to-first"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Reset to First Month
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">
                  {Math.round(progressPercent)}% complete
                </span>
              </div>
            </div>
            <Progress value={progressPercent} className="h-3" data-testid="progress-bar" />
            <div className="flex gap-1 mt-2">
              {preview.months.map((m, i) => (
                <div
                  key={m.month}
                  className={`text-xs px-2 py-1 rounded ${
                    i < currentMonthIndex
                      ? "bg-emerald-100 text-emerald-800"
                      : i === currentMonthIndex
                        ? "bg-[#1F3A5F] text-white"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {formatMonth(m.month).split(" ")[0].substring(0, 3)} {m.month.split("-")[0]}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle data-testid="text-current-month">{monthLabel}</CardTitle>
            <CardDescription>
              {currentMonth.shiftCount} shift{currentMonth.shiftCount !== 1 ? "s" : ""} across{" "}
              {currentMonth.supplierBreakdown.length} supplier{currentMonth.supplierBreakdown.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!currentResult ? (
              <>
                <div className="flex items-start gap-3 p-3 mb-4 rounded-lg border bg-muted/30">
                  <Checkbox
                    id="allow-adjustments"
                    checked={allowAdjustments}
                    onCheckedChange={(checked) => setAllowAdjustments(!!checked)}
                    data-testid="checkbox-allow-adjustments"
                  />
                  <div className="grid gap-1">
                    <label htmlFor="allow-adjustments" className="text-sm font-medium cursor-pointer">
                      Enable shift adjustments
                    </label>
                    <p className="text-xs text-muted-foreground">
                      When enabled, shifts may be removed or shortened to match entered payment amounts
                    </p>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead className="text-center">Shifts</TableHead>
                      <TableHead className="text-center">Frequency</TableHead>
                      <TableHead className="text-right">Calculated Total (excl. VAT)</TableHead>
                      {allowAdjustments && <TableHead className="text-right">Payment Made (excl. VAT)</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentMonth.supplierBreakdown.map((sb) => {
                      const paymentVal = parseFloat(payments[sb.supplierId] || "0");
                      const diff = paymentVal - (sb.calculatedTotal ?? 0);
                      const hasDiff = Math.abs(diff) > 0.01;
                      return (
                        <TableRow key={sb.supplierId} data-testid={`row-payment-${sb.supplierId}`}>
                          <TableCell className="font-medium">
                            <div>{sb.supplierName}</div>
                            {sb.rateBreakdown && sb.rateBreakdown.length > 1 && (
                              <div className="mt-1 space-y-0.5">
                                {sb.rateBreakdown.map((rb) => (
                                  <div key={rb.rate} className="text-[10px] text-muted-foreground" data-testid={`batch-rate-${sb.supplierId}-${rb.rate}`}>
                                    {rb.shifts} shift{rb.shifts !== 1 ? "s" : ""} @ {formatCurrency(rb.rate)}/hr · {rb.hours.toFixed(2)} hrs = {formatCurrency(rb.amount)}
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">{sb.shiftCount}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{sb.billingFrequency.charAt(0).toUpperCase() + sb.billingFrequency.slice(1)}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatCurrency(sb.calculatedTotal ?? 0)}</TableCell>
                          {allowAdjustments && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={payments[sb.supplierId] || ""}
                                  onChange={(e) =>
                                    setPayments((prev) => ({ ...prev, [sb.supplierId]: e.target.value }))
                                  }
                                  className={`w-32 text-right ${hasDiff ? "border-amber-400 bg-amber-50" : ""}`}
                                  data-testid={`input-payment-${sb.supplierId}`}
                                />
                                {hasDiff && (
                                  <span className={`text-xs ${diff < 0 ? "text-red-600" : "text-amber-600"}`}>
                                    {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <div className="mt-6">
                  <Button
                    onClick={handleProcessMonth}
                    disabled={processMutation.isPending}
                    data-testid="button-process-month"
                  >
                    {processMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating invoices...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        Generate Invoices for {monthLabel}
                      </>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-invoices-created">
                        {currentResult.invoicesCreated}
                      </div>
                      <div className="text-sm text-muted-foreground">Invoices Created</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4 pb-4 text-center">
                      <div className="text-2xl font-bold text-emerald-600" data-testid="text-shifts-approved">
                        {currentResult.shiftsAutoApproved}
                      </div>
                      <div className="text-sm text-muted-foreground">Shifts Auto-Approved</div>
                    </CardContent>
                  </Card>
                  {allowAdjustments && (
                    <Card>
                      <CardContent className="pt-4 pb-4 text-center">
                        <div className="text-2xl font-bold text-amber-600" data-testid="text-shifts-adjusted">
                          {currentResult.shiftsAdjusted}
                        </div>
                        <div className="text-sm text-muted-foreground">Shifts Adjusted</div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {currentResult.results.length > 0 && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead className="text-center">Shifts</TableHead>
                        <TableHead className="text-right">Subtotal</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        {allowAdjustments && <TableHead className="text-center">Adjusted</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentResult.results.map((inv, idx) => (
                        <TableRow key={idx} data-testid={`row-invoice-${inv.invoiceId}`}>
                          <TableCell className="font-medium">{inv.supplierName}</TableCell>
                          <TableCell>{inv.period}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{inv.invoiceNumber}</Badge>
                          </TableCell>
                          <TableCell className="text-center">{inv.shiftCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.subtotal)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(inv.vatAmount)}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(inv.totalAmount)}</TableCell>
                          {allowAdjustments && (
                            <TableCell className="text-center">
                              {inv.adjustmentApplied ? (
                                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Yes</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}

                {currentResult.skipped.length > 0 && (
                  <div className="mt-4">
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Skipped Suppliers
                    </h4>
                    {currentResult.skipped.map((sk, idx) => (
                      <div key={idx} className="text-sm text-muted-foreground py-1" data-testid={`text-skipped-${sk.supplierId}`}>
                        {sk.supplierName}: {sk.reason}
                      </div>
                    ))}
                  </div>
                )}

                {currentResult.warnings.length > 0 && (
                  <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    {currentResult.warnings.map((w, idx) => (
                      <div key={idx} className="text-sm text-amber-800">{w}</div>
                    ))}
                  </div>
                )}

                <div className="flex gap-3 mt-6">
                  {currentMonthIndex < preview.months.length - 1 ? (
                    <Button onClick={handleContinue} data-testid="button-continue-next">
                      <ChevronRight className="h-4 w-4 mr-2" />
                      Continue to Next Month
                    </Button>
                  ) : (
                    <Button onClick={() => setPhase("complete")} data-testid="button-finish">
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Finish
                    </Button>
                  )}
                  {currentMonthIndex < preview.months.length - 1 && (
                    <Button variant="outline" onClick={handleStop} data-testid="button-stop">
                      <StopCircle className="h-4 w-4 mr-2" />
                      Stop Here
                    </Button>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (phase === "complete") {
    return (
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-page-title">Batch Invoicing Complete</h1>
            <p className="text-muted-foreground">Summary of all invoices generated</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-total-months">
                {monthResults.length}
              </div>
              <div className="text-sm text-muted-foreground">Months Processed</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-total-invoices">
                {totalInvoicesCreated}
              </div>
              <div className="text-sm text-muted-foreground">Invoices Created</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-2xl font-bold text-emerald-600" data-testid="text-total-approved">
                {totalShiftsApproved}
              </div>
              <div className="text-sm text-muted-foreground">Shifts Auto-Approved</div>
            </CardContent>
          </Card>
          {allowAdjustments && (
            <Card>
              <CardContent className="pt-4 pb-4 text-center">
                <div className="text-2xl font-bold text-amber-600" data-testid="text-total-adjusted">
                  {totalShiftsAdjusted}
                </div>
                <div className="text-sm text-muted-foreground">Shifts Adjusted</div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Summary</CardTitle>
            <CardDescription>Grand total: {formatCurrency(grandTotal)}</CardDescription>
          </CardHeader>
          <CardContent>
            {monthResults.map((mr, mIdx) => (
              <div key={mIdx} className="mb-6 last:mb-0">
                <h4 className="font-semibold text-[#1F3A5F] mb-2" data-testid={`text-summary-month-${mIdx}`}>
                  {formatMonth(mr.month)}
                </h4>
                {mr.results.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-center">Shifts</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {mr.results.map((inv, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{inv.supplierName}</TableCell>
                          <TableCell><Badge variant="outline">{inv.invoiceNumber}</Badge></TableCell>
                          <TableCell>{inv.period}</TableCell>
                          <TableCell className="text-center">{inv.shiftCount}</TableCell>
                          <TableCell className="text-right font-medium">{formatCurrency(inv.totalAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">No invoices generated for this month.</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Button onClick={handleDone} data-testid="button-done">
          Done
        </Button>
      </div>
    );
  }

  return null;
}
