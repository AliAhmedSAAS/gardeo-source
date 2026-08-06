import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PoundSterling, Receipt, TrendingUp, AlertTriangle, FileText, Calculator,
  Plus, Loader2,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type FinanceSummary = {
  totalInvoiced: string;
  totalVat: string;
  totalPaid: string;
  totalPending: string;
  totalOverdue: string;
  invoiceCount: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
};

type EnrichedInvoice = {
  id: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalHours: string | null;
  hourlyRate: string | null;
  subtotal: string;
  vatRate: string | null;
  vatAmount: string;
  totalAmount: string;
  status: string | null;
  dueDate: string | null;
  supplierName: string | null;
  employeeName: string | null;
  notes: string | null;
  createdAt: string | null;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  pending: { label: "Pending", variant: "secondary" },
  approved: { label: "Approved", variant: "default" },
  paid: { label: "Paid", variant: "default" },
  overdue: { label: "Overdue", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

function formatCurrency(value: string | number | null | undefined): string {
  const num = parseFloat(String(value || "0"));
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatPeriod(start: string, end: string): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}

export default function FinancePage() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    periodStart: "",
    periodEnd: "",
    totalHours: "",
    hourlyRate: "",
    notes: "",
  });
  const { toast } = useToast();

  const { data: summary, isLoading: summaryLoading } = useQuery<FinanceSummary>({
    queryKey: ["/api/finance/summary"],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<EnrichedInvoice[]>({
    queryKey: ["/api/invoices"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, string>) => {
      const hours = parseFloat(data.totalHours || "0");
      const rate = parseFloat(data.hourlyRate || "0");
      const subtotal = hours * rate;
      const vatAmount = subtotal * 0.2;
      const totalAmount = subtotal + vatAmount;
      await apiRequest("POST", "/api/invoices", {
        invoiceNumber: data.invoiceNumber,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        totalHours: data.totalHours,
        hourlyRate: data.hourlyRate,
        subtotal: subtotal.toFixed(2),
        vatRate: "20",
        vatAmount: vatAmount.toFixed(2),
        totalAmount: totalAmount.toFixed(2),
        notes: data.notes || null,
        status: "draft",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/finance/summary"] });
      setCreateOpen(false);
      setFormData({ invoiceNumber: "", periodStart: "", periodEnd: "", totalHours: "", hourlyRate: "", notes: "" });
      toast({ title: "Invoice created", description: "The invoice has been created successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = invoices.filter((inv) => {
    if (statusFilter === "all") return true;
    return inv.status === statusFilter;
  });

  const calcSubtotal = parseFloat(formData.totalHours || "0") * parseFloat(formData.hourlyRate || "0");
  const calcVat = calcSubtotal * 0.2;
  const calcTotal = calcSubtotal + calcVat;

  const isLoading = summaryLoading || invoicesLoading;

  return (
    <div className="p-6 space-y-6" data-testid="finance-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Finance & Self-Billing</h1>
          <p className="text-muted-foreground text-sm">Manage invoices, track payments, and monitor VAT compliance.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} data-testid="button-create-invoice">
          <Plus className="w-4 h-4 mr-2" />
          Create Invoice
        </Button>
      </div>

      {summaryLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 w-20 bg-muted animate-pulse rounded mb-2" />
                <div className="h-6 w-24 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs text-muted-foreground">Total Invoiced</span>
                <PoundSterling className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold" data-testid="text-total-invoiced">{formatCurrency(summary.totalInvoiced)}</div>
              <div className="text-xs text-muted-foreground">{summary.invoiceCount} invoices</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs text-muted-foreground">VAT Collected</span>
                <Calculator className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold" data-testid="text-total-vat">{formatCurrency(summary.totalVat)}</div>
              <div className="text-xs text-muted-foreground">20% standard rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs text-muted-foreground">Paid</span>
                <TrendingUp className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400" data-testid="text-total-paid">{formatCurrency(summary.totalPaid)}</div>
              <div className="text-xs text-muted-foreground">{summary.paidCount} paid</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs text-muted-foreground">Pending</span>
                <Receipt className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold" data-testid="text-total-pending">{formatCurrency(summary.totalPending)}</div>
              <div className="text-xs text-muted-foreground">{summary.pendingCount} pending</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-1 mb-2">
                <span className="text-xs text-muted-foreground">Overdue</span>
                <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-xl font-bold text-destructive" data-testid="text-total-overdue">{formatCurrency(summary.totalOverdue)}</div>
              <div className="text-xs text-muted-foreground">{summary.overdueCount} overdue</div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Calculator className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm">HMRC VAT Compliance</h3>
              <p className="text-xs text-muted-foreground">Self-billing arrangement under HMRC regulations</p>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <div className="text-sm font-semibold" data-testid="text-vat-rate">20%</div>
                <div className="text-xs text-muted-foreground">Current Rate</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold" data-testid="text-vat-period">Q1 2026</div>
                <div className="text-xs text-muted-foreground">VAT Period</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold" data-testid="text-vat-collected">{formatCurrency(summary?.totalVat)}</div>
                <div className="text-xs text-muted-foreground">Total VAT</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 flex-wrap">
        {[
          { value: "all", label: "All" },
          { value: "draft", label: "Draft" },
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "paid", label: "Paid" },
          { value: "overdue", label: "Overdue" },
          { value: "cancelled", label: "Cancelled" },
        ].map((f) => (
          <Button
            key={f.value}
            variant={statusFilter === f.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(f.value)}
            data-testid={`button-filter-${f.value}`}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {invoicesLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    <div className="h-3 w-48 bg-muted animate-pulse rounded" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold" data-testid="text-empty-title">No invoices found</h3>
            <p className="text-sm text-muted-foreground">
              {statusFilter !== "all"
                ? "Try adjusting your filter to see more invoices."
                : "Create your first invoice to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3 font-medium text-muted-foreground">Invoice #</th>
                  <th className="p-3 font-medium text-muted-foreground">Period</th>
                  <th className="p-3 font-medium text-muted-foreground">Employee / Supplier</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Subtotal</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">VAT</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Total</th>
                  <th className="p-3 font-medium text-muted-foreground">Status</th>
                  <th className="p-3 font-medium text-muted-foreground">Due Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const statusConf = STATUS_CONFIG[inv.status || "draft"] || STATUS_CONFIG.draft;
                  return (
                    <tr key={inv.id} className="border-b last:border-0" data-testid={`row-invoice-${inv.id}`}>
                      <td className="p-3 font-medium" data-testid={`text-invoice-number-${inv.id}`}>{inv.invoiceNumber}</td>
                      <td className="p-3 text-muted-foreground">{formatPeriod(inv.periodStart, inv.periodEnd)}</td>
                      <td className="p-3">
                        <div>{inv.employeeName || "N/A"}</div>
                        {inv.supplierName && (
                          <div className="text-xs text-muted-foreground">{inv.supplierName}</div>
                        )}
                      </td>
                      <td className="p-3 text-right" data-testid={`text-subtotal-${inv.id}`}>{formatCurrency(inv.subtotal)}</td>
                      <td className="p-3 text-right text-muted-foreground">{formatCurrency(inv.vatAmount)}</td>
                      <td className="p-3 text-right font-medium" data-testid={`text-total-${inv.id}`}>{formatCurrency(inv.totalAmount)}</td>
                      <td className="p-3">
                        <Badge variant={statusConf.variant} data-testid={`badge-status-${inv.id}`}>
                          {statusConf.label}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDate(inv.dueDate)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              createMutation.mutate(formData);
            }}
            className="space-y-4"
            data-testid="form-create-invoice"
          >
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber">Invoice Number</Label>
              <Input
                id="invoiceNumber"
                data-testid="input-invoice-number"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                placeholder="INV-001"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="periodStart">Period Start</Label>
                <Input
                  id="periodStart"
                  type="date"
                  data-testid="input-period-start"
                  value={formData.periodStart}
                  onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="periodEnd">Period End</Label>
                <Input
                  id="periodEnd"
                  type="date"
                  data-testid="input-period-end"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalHours">Total Hours</Label>
                <Input
                  id="totalHours"
                  type="number"
                  step="0.5"
                  min="0"
                  data-testid="input-total-hours"
                  value={formData.totalHours}
                  onChange={(e) => setFormData({ ...formData, totalHours: e.target.value })}
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourlyRate">Hourly Rate (£)</Label>
                <Input
                  id="hourlyRate"
                  type="number"
                  step="0.01"
                  min="0"
                  data-testid="input-hourly-rate"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            <Card>
              <CardContent className="p-3">
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span data-testid="text-calc-subtotal">{formatCurrency(calcSubtotal)}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">VAT (20%)</span>
                    <span data-testid="text-calc-vat">{formatCurrency(calcVat)}</span>
                  </div>
                  <div className="flex justify-between gap-2 font-semibold border-t pt-1">
                    <span>Total</span>
                    <span data-testid="text-calc-total">{formatCurrency(calcTotal)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                data-testid="input-notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} data-testid="button-cancel-create">
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-invoice">
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}