import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import {
  RotateCcw, CheckCircle2, Loader2, AlertTriangle, ScrollText, ShieldAlert, Calendar, X, ChevronDown, ChevronRight,
} from "lucide-react";

interface Supplier {
  id: number;
  companyName: string;
  supplierCode: string;
  status: string;
  approvedAt: string | null;
  createdAt: string | null;
}

interface AllocationDetail {
  paymentDate: string;
  paymentAmount: string;
  invoiceNumber: string;
  allocatedAmount: string;
}

interface AdjustedInvoice {
  invoiceNumber: string;
  originalTotal: string;
  newTotal: string;
  difference: string;
}

interface UnmatchedPayment {
  transactionDate: string;
  amount: string;
  unallocated: string;
  description: string;
}

interface NormalisationDetail {
  invoiceNumber: string;
  shiftsNormalised: number;
  sitePatterns: Record<string, number>;
  adjustmentShifts: number;
}

interface SkippedInvoice {
  invoiceNumber: string;
  reason: string;
}

interface NormalisationResult {
  invoicesNormalised: number;
  totalShiftsNormalised: number;
  totalAdjustmentShifts: number;
  details: NormalisationDetail[];
  skippedInvoices: SkippedInvoice[];
  warnings: string[];
}

interface ReAuditResult {
  supplierId: number;
  supplierName: string;
  eventsCreated: number;
  startDate: string;
  reconciliation?: {
    allocationsCreated: number;
    invoicesAdjusted: number;
    unallocatedPayments: number;
    totalAllocated: string;
    allocationDetails: AllocationDetail[];
    adjustedInvoices: AdjustedInvoice[];
    unmatchedPayments: UnmatchedPayment[];
  };
  normalisation?: NormalisationResult;
}

const ALLOWED_ROLES = ["super_admin", "tenant_admin", "admin"];

export default function ReAuditPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [regenerateAgreement, setRegenerateAgreement] = useState(false);
  const [fixInvoiceDates, setFixInvoiceDates] = useState(false);
  const [reconcilePayments, setReconcilePayments] = useState(false);
  const [normaliseTimesheets, setNormaliseTimesheets] = useState(false);
  const [startMonth, setStartMonth] = useState<string>("");
  const [results, setResults] = useState<ReAuditResult[] | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
    enabled: !!user && ALLOWED_ROLES.includes(user.role),
  });

  const formatStartMonth = (month: string) => {
    if (!month) return "";
    const [year, m] = month.split("-");
    const date = new Date(parseInt(year), parseInt(m) - 1);
    return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  };

  const mutation = useMutation({
    mutationFn: async (supplierIds: number[]) => {
      const payload: any = { supplierIds, regenerateAgreement, fixInvoiceDates, reconcilePayments, normaliseTimesheets };
      if (startMonth) payload.startMonth = startMonth;
      const response = await apiRequest("POST", "/api/admin/re-audit", payload);
      return response.json();
    },
    onSuccess: (data) => {
      setResults(data.results);
      setSelectedIds(new Set());
      setExpandedIds(new Set());
      toast({
        title: "Audit trail generated",
        description: `Created events for ${data.results.length} supplier(s)`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error generating audit trail",
        description: err.message || "Something went wrong",
        variant: "destructive",
      });
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

  const toggleAll = () => {
    if (selectedIds.size === suppliers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suppliers.map((s) => s.id)));
    }
  };

  const handleGenerate = () => {
    if (selectedIds.size === 0) {
      toast({ title: "No suppliers selected", description: "Please select at least one supplier", variant: "destructive" });
      return;
    }
    setResults(null);
    mutation.mutate(Array.from(selectedIds));
  };

  const getStartDate = (s: Supplier) => {
    if (s.approvedAt) return new Date(s.approvedAt).toLocaleDateString("en-GB");
    if (s.createdAt) return new Date(s.createdAt).toLocaleDateString("en-GB");
    return "N/A";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-page-title">Re-Audit</h1>
        <p className="text-muted-foreground mt-1" data-testid="text-page-description">
          Generate realistic backdated audit trail entries for selected suppliers, starting from their onboarding date.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Select Suppliers</CardTitle>
              <CardDescription>
                Choose which suppliers to generate audit trail events for.
                {startMonth
                  ? ` Events from ${formatStartMonth(startMonth)} onwards will be deleted and regenerated.`
                  : " Events will be backdated from each supplier's approval/onboarding date."}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-2" data-testid="container-start-month">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium whitespace-nowrap">Start from:</span>
              <Input
                type="month"
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                className="w-44 h-8 text-sm"
                placeholder="All months"
                data-testid="input-start-month"
              />
              {startMonth && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setStartMonth("")}
                  data-testid="button-clear-start-month"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            <label className="flex items-center gap-2 cursor-pointer" data-testid="label-regenerate-agreement">
              <Checkbox
                checked={regenerateAgreement}
                onCheckedChange={(checked) => setRegenerateAgreement(!!checked)}
                data-testid="checkbox-regenerate-agreement"
              />
              <span className="text-sm font-medium">Regenerate Agreement</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer" data-testid="label-fix-invoice-dates">
              <Checkbox
                checked={fixInvoiceDates}
                onCheckedChange={(checked) => setFixInvoiceDates(!!checked)}
                data-testid="checkbox-fix-invoice-dates"
              />
              <span className="text-sm font-medium">Fix Invoice Dates</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer" data-testid="label-reconcile-payments">
              <Checkbox
                checked={reconcilePayments}
                onCheckedChange={(checked) => setReconcilePayments(!!checked)}
                data-testid="checkbox-reconcile-payments"
              />
              <span className="text-sm font-medium">Payment Reconcile</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer" data-testid="label-normalise-timesheets">
              <Checkbox
                checked={normaliseTimesheets}
                onCheckedChange={(checked) => setNormaliseTimesheets(!!checked)}
                data-testid="checkbox-normalise-timesheets"
              />
              <span className="text-sm font-medium">Normalise Timesheets</span>
            </label>
            <div className="flex-1" />
            <Badge variant="outline" data-testid="badge-selected-count">
              {selectedIds.size} selected
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
              data-testid="button-select-all"
            >
              {selectedIds.size === suppliers.length ? "Deselect All" : "Select All"}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={selectedIds.size === 0 || mutation.isPending}
              className="bg-[#1F3A5F] hover:bg-[#2a4d7a]"
              data-testid="button-generate-audit"
            >
              {mutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Generate Audit Trail
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground" data-testid="text-no-suppliers">
              <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-yellow-500" />
              <p>No suppliers found for this tenant.</p>
            </div>
          ) : (
            <div className="border rounded-lg divide-y max-h-[500px] overflow-y-auto">
              {suppliers.map((supplier) => (
                <label
                  key={supplier.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors"
                  data-testid={`row-supplier-${supplier.id}`}
                >
                  <Checkbox
                    checked={selectedIds.has(supplier.id)}
                    onCheckedChange={() => toggleSupplier(supplier.id)}
                    data-testid={`checkbox-supplier-${supplier.id}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate" data-testid={`text-supplier-name-${supplier.id}`}>
                        {supplier.companyName}
                      </span>
                      <Badge variant="secondary" className="text-xs" data-testid={`badge-supplier-code-${supplier.id}`}>
                        {supplier.supplierCode}
                      </Badge>
                      <Badge
                        variant={supplier.status === "approved" ? "default" : "outline"}
                        className={`text-xs ${supplier.status === "approved" ? "bg-green-100 text-green-700 border-green-200" : ""}`}
                        data-testid={`badge-supplier-status-${supplier.id}`}
                      >
                        {supplier.status}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-nowrap" data-testid={`text-supplier-date-${supplier.id}`}>
                    Start: {getStartDate(supplier)}
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {mutation.isPending && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-[#FF8C42]" />
              <p className="text-muted-foreground">Generating audit trail events...</p>
              <Progress value={50} className="w-64" />
            </div>
          </CardContent>
        </Card>
      )}

      {results && (
        <Card data-testid="card-results">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Audit Trail Generated
            </CardTitle>
            <CardDescription>
              Total events created: {results.reduce((sum, r) => sum + r.eventsCreated, 0)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg divide-y">
              {results.map((r) => {
                const isExpanded = expandedIds.has(r.supplierId);
                const hasExpandable = !!r.reconciliation || (!!r.normalisation && (r.normalisation.invoicesNormalised > 0 || r.normalisation.skippedInvoices.length > 0 || r.normalisation.warnings.length > 0));
                const toggleExpand = () => {
                  if (!hasExpandable) return;
                  setExpandedIds(prev => {
                    const next = new Set(prev);
                    if (next.has(r.supplierId)) next.delete(r.supplierId);
                    else next.add(r.supplierId);
                    return next;
                  });
                };
                return (
                  <div key={r.supplierId} data-testid={`result-supplier-${r.supplierId}`}>
                    <div
                      className={`px-4 py-3 ${hasExpandable ? "cursor-pointer hover:bg-muted/50 transition-colors" : ""}`}
                      onClick={toggleExpand}
                      data-testid={`toggle-expand-${r.supplierId}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {hasExpandable ? (
                            isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ScrollText className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{r.supplierName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">From: {new Date(r.startDate).toLocaleDateString("en-GB")}</span>
                          <Badge className="bg-[#FF8C42] hover:bg-[#e57d38]" data-testid={`badge-events-count-${r.supplierId}`}>
                            {r.eventsCreated} events
                          </Badge>
                        </div>
                      </div>
                      {r.reconciliation && (
                        <div className="mt-1 ml-7 flex items-center gap-3 text-xs text-muted-foreground" data-testid={`text-reconciliation-${r.supplierId}`}>
                          <span>{r.reconciliation.allocationsCreated} allocations (£{r.reconciliation.totalAllocated})</span>
                          {r.reconciliation.invoicesAdjusted > 0 && (
                            <Badge variant="outline" className="text-xs">{r.reconciliation.invoicesAdjusted} invoices adjusted</Badge>
                          )}
                          {r.reconciliation.unallocatedPayments > 0 && (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">{r.reconciliation.unallocatedPayments} unmatched payments</Badge>
                          )}
                        </div>
                      )}
                      {r.normalisation && (r.normalisation.invoicesNormalised > 0 || r.normalisation.skippedInvoices.length > 0 || r.normalisation.warnings.length > 0) && (
                        <div className="mt-1 ml-7 flex items-center gap-3 text-xs text-muted-foreground" data-testid={`text-normalisation-${r.supplierId}`}>
                          {r.normalisation.invoicesNormalised > 0 && (
                            <span>{r.normalisation.invoicesNormalised} invoices normalised ({r.normalisation.totalShiftsNormalised} shifts, {r.normalisation.totalAdjustmentShifts} adjusted)</span>
                          )}
                          {r.normalisation.invoicesNormalised === 0 && (
                            <span>No invoices normalised</span>
                          )}
                          {r.normalisation.skippedInvoices.length > 0 && (
                            <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">{r.normalisation.skippedInvoices.length} skipped</Badge>
                          )}
                          {r.normalisation.warnings.length > 0 && (
                            <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">{r.normalisation.warnings.length} warnings</Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {isExpanded && r.reconciliation && (
                      <div className="px-4 pb-4 pt-1 ml-7 space-y-4" data-testid={`details-panel-${r.supplierId}`}>
                        {r.reconciliation.allocationDetails.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Allocations</h4>
                            <div className="border rounded-md overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="text-left px-3 py-1.5 font-medium">Payment Date</th>
                                    <th className="text-right px-3 py-1.5 font-medium">Payment</th>
                                    <th className="text-left px-3 py-1.5 font-medium">Invoice #</th>
                                    <th className="text-right px-3 py-1.5 font-medium">Allocated</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {r.reconciliation.allocationDetails.map((a, i) => (
                                    <tr key={i} data-testid={`row-allocation-${r.supplierId}-${i}`}>
                                      <td className="px-3 py-1.5">{new Date(a.paymentDate).toLocaleDateString("en-GB")}</td>
                                      <td className="px-3 py-1.5 text-right">£{a.paymentAmount}</td>
                                      <td className="px-3 py-1.5 font-mono text-[11px]">{a.invoiceNumber}</td>
                                      <td className="px-3 py-1.5 text-right font-medium">£{a.allocatedAmount}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {r.reconciliation.adjustedInvoices.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Adjusted Invoices</h4>
                            <div className="border rounded-md overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/50">
                                  <tr>
                                    <th className="text-left px-3 py-1.5 font-medium">Invoice #</th>
                                    <th className="text-right px-3 py-1.5 font-medium">Original</th>
                                    <th className="text-right px-3 py-1.5 font-medium">New Total</th>
                                    <th className="text-right px-3 py-1.5 font-medium">Difference</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {r.reconciliation.adjustedInvoices.map((adj, i) => (
                                    <tr key={i} data-testid={`row-adjusted-${r.supplierId}-${i}`}>
                                      <td className="px-3 py-1.5 font-mono text-[11px]">{adj.invoiceNumber}</td>
                                      <td className="px-3 py-1.5 text-right">£{adj.originalTotal}</td>
                                      <td className="px-3 py-1.5 text-right font-medium">£{adj.newTotal}</td>
                                      <td className="px-3 py-1.5 text-right">
                                        <span className={parseFloat(adj.difference) > 0 ? "text-green-600" : "text-red-600"}>
                                          {parseFloat(adj.difference) > 0 ? "+" : ""}£{adj.difference}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {r.reconciliation.unmatchedPayments.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-2">Unmatched Payments</h4>
                            <div className="border border-yellow-200 rounded-md overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-yellow-50">
                                  <tr>
                                    <th className="text-left px-3 py-1.5 font-medium">Date</th>
                                    <th className="text-right px-3 py-1.5 font-medium">Amount</th>
                                    <th className="text-right px-3 py-1.5 font-medium">Unallocated</th>
                                    <th className="text-left px-3 py-1.5 font-medium">Description</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-yellow-100">
                                  {r.reconciliation.unmatchedPayments.map((up, i) => (
                                    <tr key={i} data-testid={`row-unmatched-${r.supplierId}-${i}`}>
                                      <td className="px-3 py-1.5">{new Date(up.transactionDate).toLocaleDateString("en-GB")}</td>
                                      <td className="px-3 py-1.5 text-right">£{up.amount}</td>
                                      <td className="px-3 py-1.5 text-right font-medium text-yellow-700">£{up.unallocated}</td>
                                      <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[200px]">{up.description || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {isExpanded && r.normalisation && (r.normalisation.invoicesNormalised > 0 || r.normalisation.skippedInvoices.length > 0 || r.normalisation.warnings.length > 0) && (
                      <div className="px-4 pb-4 pt-1 ml-7 space-y-4" data-testid={`normalisation-panel-${r.supplierId}`}>
                        {r.normalisation.invoicesNormalised > 0 && (<div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Normalised Invoices</h4>
                          <div className="border rounded-md overflow-hidden">
                            <table className="w-full text-xs">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-1.5 font-medium">Invoice #</th>
                                  <th className="text-right px-3 py-1.5 font-medium">Shifts</th>
                                  <th className="text-left px-3 py-1.5 font-medium">Patterns</th>
                                  <th className="text-right px-3 py-1.5 font-medium">Adjustments</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y">
                                {r.normalisation.details.map((nd, i) => (
                                  <tr key={i} data-testid={`row-normalised-${r.supplierId}-${i}`}>
                                    <td className="px-3 py-1.5 font-mono text-[11px]">{nd.invoiceNumber}</td>
                                    <td className="px-3 py-1.5 text-right">{nd.shiftsNormalised}</td>
                                    <td className="px-3 py-1.5">
                                      {Object.entries(nd.sitePatterns).map(([pattern, count]) => (
                                        <Badge key={pattern} variant="outline" className="text-[10px] mr-1">
                                          {count}x {pattern}
                                        </Badge>
                                      ))}
                                    </td>
                                    <td className="px-3 py-1.5 text-right">
                                      {nd.adjustmentShifts > 0 ? (
                                        <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-300">{nd.adjustmentShifts} adjusted</Badge>
                                      ) : (
                                        <span className="text-green-600">exact</span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>)}

                        {r.normalisation.skippedInvoices.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">Skipped Invoices ({r.normalisation.skippedInvoices.length})</h4>
                            <div className="border border-orange-200 rounded-md overflow-hidden">
                              <table className="w-full text-xs">
                                <thead className="bg-orange-50">
                                  <tr>
                                    <th className="text-left px-3 py-1.5 font-medium">Invoice #</th>
                                    <th className="text-left px-3 py-1.5 font-medium">Reason</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-orange-100">
                                  {r.normalisation.skippedInvoices.map((si, i) => (
                                    <tr key={i} data-testid={`row-skipped-${r.supplierId}-${i}`}>
                                      <td className="px-3 py-1.5 font-mono text-[11px]">{si.invoiceNumber}</td>
                                      <td className="px-3 py-1.5 text-orange-700">{si.reason}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {r.normalisation.warnings.length > 0 && (
                          <div>
                            <h4 className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-2">Normalisation Warnings</h4>
                            <div className="border border-yellow-200 rounded-md p-2 space-y-1">
                              {r.normalisation.warnings.map((w, i) => (
                                <p key={i} className="text-xs text-yellow-700" data-testid={`text-norm-warning-${r.supplierId}-${i}`}>
                                  {w}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
