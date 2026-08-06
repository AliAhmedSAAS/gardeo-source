import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  FileText, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Receipt, ChevronDown, ChevronUp, DollarSign,
  MessageSquare, Info, Download,
} from "lucide-react";

type Invoice = {
  id: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  status: string | null;
  acceptedAt: string | null;
  createdAt: string | null;
};

type LineItem = {
  id: number;
  description: string;
  hours: string;
  rate: string;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  lineTotal: string;
};

type InvoiceDetail = Invoice & {
  lineItems: LineItem[];
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
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

export default function SupplierInvoicesPage() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [acceptDialogId, setAcceptDialogId] = useState<number | null>(null);
  const [disputeDialog, setDisputeDialog] = useState<Invoice | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/supplier-portal/invoices"],
  });

  const { data: invoiceDetail, isLoading: detailLoading } = useQuery<InvoiceDetail>({
    queryKey: ["/api/supplier-portal/invoices", expandedId],
    queryFn: async () => {
      const res = await fetch(`/api/supplier-portal/invoices/${expandedId}`);
      if (!res.ok) throw new Error("Failed to fetch invoice detail");
      return res.json();
    },
    enabled: !!expandedId,
  });

  const acceptMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/supplier-portal/invoices/${id}/accept`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/invoices"] });
      setAcceptDialogId(null);
      toast({ title: "Invoice Accepted", description: "You have accepted this invoice." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const disputeMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/supplier-portal/invoices/${id}/dispute`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/supplier-portal/invoices"] });
      setDisputeDialog(null);
      setDisputeReason("");
      toast({ title: "Dispute Submitted", description: "Your dispute has been recorded and will be reviewed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleDisputeSubmit = () => {
    if (!disputeDialog || !disputeReason.trim()) {
      toast({ title: "Reason Required", description: "Please provide a reason for disputing this invoice.", variant: "destructive" });
      return;
    }
    disputeMutation.mutate({ id: disputeDialog.id, reason: disputeReason });
  };

  const totalInvoices = invoices.length;
  const pendingCount = invoices.filter(i => i.status === "pending" || i.status === "draft").length;
  const acceptedCount = invoices.filter(i => i.status === "approved").length;
  const paidCount = invoices.filter(i => i.status === "paid").length;

  const lineItems = expandedId && invoiceDetail?.lineItems ? invoiceDetail.lineItems : [];
  const summarySubtotal = lineItems.reduce((sum, li) => sum + parseFloat(li.subtotal || "0"), 0);
  const summaryVat = lineItems.reduce((sum, li) => sum + parseFloat(li.vatAmount || "0"), 0);
  const summaryTotal = lineItems.reduce((sum, li) => sum + parseFloat(li.lineTotal || "0"), 0);

  return (
    <div className="p-6 space-y-6" data-testid="supplier-invoices-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1F3A5F, #FF8C42)" }}
        >
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Invoices</h1>
          <p className="text-muted-foreground text-sm">
            View and manage your self-billed invoices
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="invoice-summary">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-total">{totalInvoices}</p>
                <p className="text-xs text-muted-foreground">Total Invoices</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-pending">{pendingCount}</p>
                <p className="text-xs text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-accepted">{acceptedCount}</p>
                <p className="text-xs text-muted-foreground">Accepted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-paid">{paidCount}</p>
                <p className="text-xs text-muted-foreground">Paid</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading invoices...</span>
          </CardContent>
        </Card>
      )}

      {!isLoading && invoices.length === 0 && (
        <Card data-testid="card-empty">
          <CardContent className="p-8 text-center">
            <Receipt className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold" data-testid="text-empty-invoices">No Invoices Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No self-billed invoices have been generated for your company yet.
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && invoices.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-invoices">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3 w-8"></th>
                  <th className="p-3 font-medium text-muted-foreground">Invoice Number</th>
                  <th className="p-3 font-medium text-muted-foreground">Period</th>
                  <th className="p-3 font-medium text-muted-foreground text-right">Amount (GBP)</th>
                  <th className="p-3 font-medium text-muted-foreground">Status</th>
                  <th className="p-3 font-medium text-muted-foreground">Accepted Date</th>
                  <th className="p-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const statusConf = STATUS_BADGES[inv.status || "draft"] || STATUS_BADGES.draft;
                  const isExpanded = expandedId === inv.id;
                  const isAccepted = inv.status === "approved" || inv.status === "paid";

                  return (
                    <InvoiceRow
                      key={inv.id}
                      invoice={inv}
                      statusConf={statusConf}
                      isExpanded={isExpanded}
                      isAccepted={isAccepted}
                      onToggle={() => setExpandedId(isExpanded ? null : inv.id)}
                      onAccept={() => setAcceptDialogId(inv.id)}
                      onDispute={() => setDisputeDialog(inv)}
                      detailLoading={detailLoading && expandedId === inv.id}
                      lineItems={isExpanded ? lineItems : []}
                      summarySubtotal={summarySubtotal}
                      summaryVat={summaryVat}
                      summaryTotal={summaryTotal}
                      acceptPending={acceptMutation.isPending}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <AlertDialog open={!!acceptDialogId} onOpenChange={(open) => { if (!open) setAcceptDialogId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-accept-dialog-title">Accept Invoice</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-accept-dialog-description">
              Are you sure you want to accept this invoice? By accepting, you confirm the amounts and VAT shown are correct.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-accept">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => acceptDialogId && acceptMutation.mutate(acceptDialogId)}
              disabled={acceptMutation.isPending}
              data-testid="button-confirm-accept"
            >
              {acceptMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Accept Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!disputeDialog} onOpenChange={(open) => { if (!open) { setDisputeDialog(null); setDisputeReason(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2" data-testid="text-dispute-dialog-title">
              <MessageSquare className="w-5 h-5" />
              Dispute Invoice
            </DialogTitle>
            <DialogDescription data-testid="text-dispute-dialog-description">
              {disputeDialog && (
                <>Invoice <span className="font-medium">{disputeDialog.invoiceNumber}</span> — {formatDate(disputeDialog.periodStart)} to {formatDate(disputeDialog.periodEnd)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Please explain why you are disputing this invoice. This will be reviewed by the operations team.</p>
            <Textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="e.g. Incorrect hours, wrong rate applied, missing shifts..."
              rows={4}
              data-testid="input-dispute-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDisputeDialog(null); setDisputeReason(""); }} data-testid="button-cancel-dispute">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisputeSubmit}
              disabled={disputeMutation.isPending || !disputeReason.trim()}
              data-testid="button-submit-dispute"
            >
              {disputeMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Submit Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvoiceRow({
  invoice,
  statusConf,
  isExpanded,
  isAccepted,
  onToggle,
  onAccept,
  onDispute,
  detailLoading,
  lineItems,
  summarySubtotal,
  summaryVat,
  summaryTotal,
  acceptPending,
}: {
  invoice: Invoice;
  statusConf: { label: string; className: string };
  isExpanded: boolean;
  isAccepted: boolean;
  onToggle: () => void;
  onAccept: () => void;
  onDispute: () => void;
  detailLoading: boolean;
  lineItems: LineItem[];
  summarySubtotal: number;
  summaryVat: number;
  summaryTotal: number;
  acceptPending: boolean;
}) {
  return (
    <>
      <tr
        className="border-b last:border-0 cursor-pointer hover-elevate"
        data-testid={`row-invoice-${invoice.id}`}
        onClick={onToggle}
      >
        <td className="p-3">
          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground rotate-180" />}
        </td>
        <td className="p-3 font-medium" data-testid={`text-invoice-number-${invoice.id}`}>{invoice.invoiceNumber}</td>
        <td className="p-3 text-muted-foreground" data-testid={`text-period-${invoice.id}`}>
          {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
        </td>
        <td className="p-3 text-right font-medium" data-testid={`text-amount-${invoice.id}`}>{formatCurrency(invoice.totalAmount)}</td>
        <td className="p-3">
          <Badge className={statusConf.className + " text-xs"} data-testid={`badge-status-${invoice.id}`}>
            {statusConf.label}
          </Badge>
        </td>
        <td className="p-3 text-muted-foreground" data-testid={`text-accepted-date-${invoice.id}`}>
          {invoice.acceptedAt ? formatDate(invoice.acceptedAt) : "—"}
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            {!isAccepted && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onAccept(); }}
                disabled={acceptPending}
                data-testid={`button-accept-${invoice.id}`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Accept
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200"
              onClick={(e) => { e.stopPropagation(); onDispute(); }}
              data-testid={`button-dispute-${invoice.id}`}
            >
              <XCircle className="w-3.5 h-3.5 mr-1.5" />
              Dispute
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`/api/supplier-portal/invoices/${invoice.id}/pdf`, "_blank");
              }}
              data-testid={`button-download-pdf-${invoice.id}`}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              PDF
            </Button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr data-testid={`row-invoice-detail-${invoice.id}`}>
          <td colSpan={7} className="p-4 bg-muted/30">
            <div className="space-y-4">
              {detailLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Loading invoice details...</span>
                </div>
              ) : lineItems.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2" data-testid={`text-no-line-items-${invoice.id}`}>
                  No line items found for this invoice.
                </p>
              ) : (
                <>
                  <div>
                    <h4 className="font-medium text-sm mb-2" data-testid={`text-line-items-heading-${invoice.id}`}>Line Items</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" data-testid={`table-line-items-${invoice.id}`}>
                        <thead>
                          <tr className="border-b text-left">
                            <th className="p-2 font-medium text-muted-foreground">Description</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Hours</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Rate</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Subtotal</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">VAT Rate</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">VAT Amount</th>
                            <th className="p-2 font-medium text-muted-foreground text-right">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineItems.map((li) => (
                            <tr key={li.id} className="border-b last:border-0" data-testid={`row-line-item-${li.id}`}>
                              <td className="p-2" data-testid={`text-li-description-${li.id}`}>{li.description}</td>
                              <td className="p-2 text-right" data-testid={`text-li-hours-${li.id}`}>{li.hours}</td>
                              <td className="p-2 text-right" data-testid={`text-li-rate-${li.id}`}>{formatCurrency(li.rate)}</td>
                              <td className="p-2 text-right" data-testid={`text-li-subtotal-${li.id}`}>{formatCurrency(li.subtotal)}</td>
                              <td className="p-2 text-right" data-testid={`text-li-vat-rate-${li.id}`}>{parseFloat(li.vatRate) === 0 ? "0% (Non-VAT)" : `${li.vatRate}%`}</td>
                              <td className="p-2 text-right" data-testid={`text-li-vat-amount-${li.id}`}>{formatCurrency(li.vatAmount)}</td>
                              <td className="p-2 text-right font-medium" data-testid={`text-li-line-total-${li.id}`}>{formatCurrency(li.lineTotal)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <div className="text-sm space-y-1 min-w-[200px]" data-testid={`summary-totals-${invoice.id}`}>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span className="font-medium" data-testid={`text-summary-subtotal-${invoice.id}`}>
                          {formatCurrency(summarySubtotal)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">VAT:</span>
                        <span className="font-medium" data-testid={`text-summary-vat-${invoice.id}`}>
                          {formatCurrency(summaryVat)}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 border-t pt-1">
                        <span className="font-semibold">Total:</span>
                        <span className="font-semibold" data-testid={`text-summary-total-${invoice.id}`}>
                          {formatCurrency(summaryTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 p-3 rounded-md border bg-blue-50/50 dark:bg-blue-950/10 border-blue-200 dark:border-blue-800" data-testid={`hmrc-statement-${invoice.id}`}>
                    <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-blue-800 dark:text-blue-300">
                      The VAT shown is your output tax due to HMRC
                    </p>
                  </div>
                </>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
