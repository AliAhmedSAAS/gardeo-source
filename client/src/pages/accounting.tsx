import { useState, Fragment } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Upload, Search, Trash2, LinkIcon, Tag, Download, ArrowUpDown, Building2, FileText, Calculator, PoundSterling, TrendingUp, TrendingDown, Minus, Users, Sparkles, Check, X, Zap, Store, Plus, Pencil, CreditCard, FileDown, ChevronDown, ChevronRight, RefreshCw, CheckCircle2, AlertCircle, Link2, Clock, Activity } from "lucide-react";
import { ToastAction } from "@/components/ui/toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";

const EXPENSE_CATEGORIES = [
  "Software & Subscriptions",
  "Office Supplies",
  "Travel & Transport",
  "Insurance",
  "Professional Services",
  "Utilities",
  "Vehicle Costs",
  "Marketing & Advertising",
  "Training",
  "Telecommunications",
  "Rent & Rates",
  "Wages & Salaries",
  "Other",
];

function BankStatementsTab() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [allocationMode, setAllocationMode] = useState<"supplier" | "client" | "vat-purchase" | "non-vat-purchase" | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [allocAmounts, setAllocAmounts] = useState<Record<number, string>>({});
  const [clientAllocAmounts, setClientAllocAmounts] = useState<Record<number, string>>({});
  const [generalForm, setGeneralForm] = useState({ netAmount: "", vatAmount: "", expenseCategory: "", notes: "" });
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<any>(null);
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());

  const transactionsQuery = useQuery({
    queryKey: ["/api/accounting/bank-transactions", statusFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const res = await fetch(`/api/accounting/bank-transactions?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const batchesQuery = useQuery({
    queryKey: ["/api/accounting/bank-transactions/batches"],
  });

  const suppliersQuery = useQuery({
    queryKey: ["/api/accounting/suppliers"],
  });

  const clientsQuery = useQuery({
    queryKey: ["/api/accounting/clients"],
  });

  const unpaidInvoicesQuery = useQuery({
    queryKey: ["/api/accounting/supplier-invoices-unpaid", selectedSupplier],
    queryFn: async () => {
      if (!selectedSupplier) return [];
      const res = await fetch(`/api/accounting/supplier-invoices-unpaid/${selectedSupplier}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedSupplier,
  });

  const unpaidClientInvoicesQuery = useQuery({
    queryKey: ["/api/accounting/client-invoices-unpaid", selectedClient],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await fetch(`/api/accounting/client-invoices-unpaid/${selectedClient}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedClient,
  });

  const suggestedQuery = useQuery({
    queryKey: ["/api/accounting/suggested-matches", selectedTransaction?.id],
    queryFn: async () => {
      if (!selectedTransaction) return [];
      const res = await fetch(`/api/accounting/suggested-matches/${selectedTransaction.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedTransaction && allocationMode === "supplier" && !selectedSupplier,
  });

  const previewMutation = useMutation({
    mutationFn: async (csvData: string) => {
      const res = await apiRequest("POST", "/api/accounting/bank-statements/preview", { csvData });
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      const newSet = new Set<number>();
      for (const row of data.rows) {
        if (!row.isDuplicate) newSet.add(row.rowIndex);
      }
      setSelectedRowIndices(newSet);
    },
    onError: (err: any) => toast({ title: "Preview Failed", description: err.message, variant: "destructive" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ csvData, selectedRows }: { csvData: string; selectedRows: number[] }) => {
      const res = await apiRequest("POST", "/api/accounting/bank-statements/upload", { csvData, selectedRows });
      return res.json();
    },
    onSuccess: (data) => {
      const desc = data.autoClassified > 0
        ? `${data.message}. ${data.autoClassified} auto-classified suggestions ready for review.`
        : data.message;
      toast({ title: "Import Complete", description: desc });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
      setCsvFile(null);
      setCsvText(null);
      setPreviewData(null);
      setSelectedRowIndices(new Set());
    },
    onError: (err: any) => toast({ title: "Import Failed", description: err.message, variant: "destructive" }),
  });

  const allocateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounting/allocate", data);
      return res.json();
    },
    onSuccess: (data) => {
      const autoNote = data.autoClassified > 0 ? ` ${data.autoClassified} similar transactions suggested.` : "";
      if (data.paidInvoiceIds && data.paidInvoiceIds.length > 0) {
        toast({
          title: "Allocated — Invoices Paid",
          description: `${data.paidInvoiceIds.length} invoice(s) marked as paid.${autoNote}`,
          action: (
            <ToastAction
              altText="Download remittance PDF"
              onClick={() => {
                for (const invId of data.paidInvoiceIds) {
                  window.open(`/api/invoices/${invId}/remittance-pdf`, "_blank");
                }
              }}
              data-testid="button-toast-remittance"
            >
              <FileDown className="h-3 w-3 mr-1" />
              Remittance
            </ToastAction>
          ),
        });
      } else {
        toast({ title: "Allocated", description: `${data.message}${autoNote}` });
      }
      setSelectedTransaction(null);
      setAllocationMode(null);
      setSelectedSupplier("");
      setAllocAmounts({});
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/reconciliation"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Allocation Failed", description: err.message, variant: "destructive" }),
  });

  const allocateClientMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounting/allocate-client", data);
      return res.json();
    },
    onSuccess: (data) => {
      const autoNote = data.autoClassified > 0 ? ` ${data.autoClassified} similar transactions suggested.` : "";
      toast({ title: "Allocated", description: `${data.message}${autoNote}` });
      setSelectedTransaction(null);
      setAllocationMode(null);
      setSelectedClient("");
      setClientAllocAmounts({});
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/client-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Allocation Failed", description: err.message, variant: "destructive" }),
  });

  const categoriseMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounting/categorise-purchase", data);
      return res.json();
    },
    onSuccess: (data) => {
      const autoNote = data.autoClassified > 0 ? ` ${data.autoClassified} similar transactions suggested.` : "";
      toast({ title: "Categorised", description: `Transaction marked as general purchase.${autoNote}` });
      setSelectedTransaction(null);
      setAllocationMode(null);
      setGeneralForm({ netAmount: "", vatAmount: "", expenseCategory: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: async (batchId: string) => {
      const res = await apiRequest("DELETE", `/api/accounting/bank-transactions/batch/${batchId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Batch deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions/batches"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [editingSuggestionId, setEditingSuggestionId] = useState<number | null>(null);

  const purchaseVendorsQuery = useQuery({
    queryKey: ["/api/accounting/purchase-vendors"],
  });

  const suggestionsQuery = useQuery({
    queryKey: ["/api/accounting/classification-suggestions"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/classification-suggestions?status=pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const autoClassifyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounting/auto-classify", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Auto-Classification Complete", description: `Analysed ${data.classified} transactions. ${data.suggestions} new suggestions generated.` });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Auto-Classify Failed", description: err.message, variant: "destructive" }),
  });

  const autoAllocateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounting/auto-allocate-suppliers", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Auto-Allocation Complete", description: `${data.allocatedTransactions} transactions allocated to ${data.allocatedInvoices} invoices (£${data.totalAmount.toLocaleString()})` });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
    },
    onError: (err: any) => toast({ title: "Auto-Allocate Failed", description: err.message, variant: "destructive" }),
  });

  const acceptSuggestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/accounting/classification-suggestions/${id}/accept`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
    },
    onError: (err: any) => toast({ title: "Accept Failed", description: err.message, variant: "destructive" }),
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/accounting/classification-suggestions/${id}/reject`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Reject Failed", description: err.message, variant: "destructive" }),
  });

  const batchAcceptMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/accounting/classification-suggestions/batch-accept", { suggestionIds: ids });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Batch Accept", description: data.message });
      setSelectedSuggestions(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
    },
    onError: (err: any) => toast({ title: "Batch Accept Failed", description: err.message, variant: "destructive" }),
  });

  const batchRejectMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/accounting/classification-suggestions/batch-reject", { suggestionIds: ids });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Batch Reject", description: data.message });
      setSelectedSuggestions(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Batch Reject Failed", description: err.message, variant: "destructive" }),
  });

  const updateSuggestionMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; entityType?: string; entityId?: number | null; expenseCategory?: string | null; vendorId?: number | null; includesVat?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/accounting/classification-suggestions/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Update Failed", description: err.message, variant: "destructive" }),
  });

  const [selectedTxnIds, setSelectedTxnIds] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState<"supplier" | "client" | "purchase" | null>(null);
  const [bulkSupplierId, setBulkSupplierId] = useState("");
  const [bulkClientId, setBulkClientId] = useState("");
  const [bulkCategory, setBulkCategory] = useState("");
  const [bulkIncludesVat, setBulkIncludesVat] = useState(false);

  const bulkAssignSupplierMutation = useMutation({
    mutationFn: async (data: { transactionIds: number[]; supplierId: number }) => {
      const res = await apiRequest("POST", "/api/accounting/bulk-assign-supplier", data);
      return res.json();
    },
    onSuccess: (data) => {
      const extra = data.autoClassified > 0 ? ` ${data.autoClassified} similar transactions suggested.` : "";
      toast({ title: "Bulk Assign", description: `${data.assigned} transactions assigned to supplier.${extra}` });
      setSelectedTxnIds(new Set());
      setBulkMode(null);
      setBulkSupplierId("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Bulk Assign Failed", description: err.message, variant: "destructive" }),
  });

  const bulkAssignClientMutation = useMutation({
    mutationFn: async (data: { transactionIds: number[]; clientId: number }) => {
      const res = await apiRequest("POST", "/api/accounting/bulk-assign-client", data);
      return res.json();
    },
    onSuccess: (data) => {
      const extra = data.autoClassified > 0 ? ` ${data.autoClassified} similar transactions suggested.` : "";
      toast({ title: "Bulk Assign", description: `${data.assigned} transactions assigned to client.${extra}` });
      setSelectedTxnIds(new Set());
      setBulkMode(null);
      setBulkClientId("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Bulk Assign Failed", description: err.message, variant: "destructive" }),
  });

  const bulkCategoriseMutation = useMutation({
    mutationFn: async (data: { transactionIds: number[]; expenseCategory: string; includesVat: boolean }) => {
      const res = await apiRequest("POST", "/api/accounting/bulk-categorise-purchase", data);
      return res.json();
    },
    onSuccess: (data) => {
      const extra = data.autoClassified > 0 ? ` ${data.autoClassified} similar transactions suggested.` : "";
      toast({ title: "Bulk Categorise", description: `${data.assigned} transactions categorised as purchases.${extra}` });
      setSelectedTxnIds(new Set());
      setBulkMode(null);
      setBulkCategory("");
      setBulkIncludesVat(false);
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/classification-suggestions"] });
    },
    onError: (err: any) => toast({ title: "Bulk Categorise Failed", description: err.message, variant: "destructive" }),
  });

  const pendingSuggestions: any[] = suggestionsQuery.data || [];
  const pendingTxnIds = new Set(pendingSuggestions.map((s: any) => s.bank_transaction_id));
  const vendors: any[] = purchaseVendorsQuery.data || [];

  const handleFilePreview = async () => {
    if (!csvFile) return;
    const text = await csvFile.text();
    setCsvText(text);
    previewMutation.mutate(text);
  };

  const handleConfirmImport = () => {
    if (!csvText) return;
    const selected = Array.from(selectedRowIndices);
    if (selected.length === 0) {
      toast({ title: "Nothing selected", description: "Select at least one row to import.", variant: "destructive" });
      return;
    }
    uploadMutation.mutate({ csvData: csvText, selectedRows: selected });
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setCsvText(null);
    setSelectedRowIndices(new Set());
  };

  const handleAllocate = () => {
    const allocations = Object.entries(allocAmounts)
      .filter(([, amt]) => parseFloat(amt) > 0)
      .map(([invoiceId, amount]) => ({ invoiceId: parseInt(invoiceId), amount }));
    if (allocations.length === 0) return toast({ title: "No allocations", description: "Enter amounts", variant: "destructive" });
    allocateMutation.mutate({
      bankTransactionId: selectedTransaction.id,
      supplierId: parseInt(selectedSupplier),
      allocations,
    });
  };

  const handleAllocateClient = () => {
    const allocations = Object.entries(clientAllocAmounts)
      .filter(([, amt]) => parseFloat(amt) > 0)
      .map(([invoiceId, amount]) => ({ invoiceId: parseInt(invoiceId), amount }));
    if (allocations.length === 0) return toast({ title: "No allocations", description: "Enter amounts", variant: "destructive" });
    allocateClientMutation.mutate({
      bankTransactionId: selectedTransaction.id,
      clientId: parseInt(selectedClient),
      allocations,
    });
  };

  const handleCategorise = () => {
    if (!generalForm.expenseCategory || !generalForm.netAmount) return;
    categoriseMutation.mutate({
      bankTransactionId: selectedTransaction.id,
      ...generalForm,
    });
  };

  const transactions = transactionsQuery.data?.transactions || [];
  const totalPages = Math.ceil((transactionsQuery.data?.total || 0) / 50);
  const unallocatedOnPage = transactions.filter((t: any) => !t.is_allocated && !t.is_general_purchase);
  const selectedTotal = transactions.filter((t: any) => selectedTxnIds.has(t.id)).reduce((s: number, t: any) => s + Math.abs(parseFloat(t.amount)), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2" data-testid="text-upload-title"><Upload className="h-5 w-5" /> Import Bank Statement</CardTitle>
          <CardDescription>Upload a CSV file from your bank. Supports most UK bank formats. Duplicates are detected automatically.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!previewData ? (
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".csv"
                data-testid="input-csv-upload"
                onChange={(e) => { setCsvFile(e.target.files?.[0] || null); setPreviewData(null); }}
                className="max-w-sm"
              />
              <Button
                onClick={handleFilePreview}
                disabled={!csvFile || previewMutation.isPending}
                data-testid="button-preview-csv"
              >
                {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Preview & Check Duplicates
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-sm" data-testid="badge-total-rows">{previewData.totalRows} total rows</Badge>
                  <Badge className="bg-green-600 text-sm" data-testid="badge-new-rows">{previewData.newRows} new</Badge>
                  {previewData.duplicateRows > 0 && (
                    <Badge className="bg-amber-500 text-sm" data-testid="badge-duplicate-rows">{previewData.duplicateRows} potential duplicates</Badge>
                  )}
                  <span className="text-sm text-muted-foreground">{selectedRowIndices.size} selected for import</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newSet = new Set<number>();
                      for (const row of previewData.rows) {
                        if (!row.isDuplicate) newSet.add(row.rowIndex);
                      }
                      setSelectedRowIndices(newSet);
                    }}
                    data-testid="button-select-new-only"
                  >
                    Select New Only
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newSet = new Set<number>();
                      for (const row of previewData.rows) newSet.add(row.rowIndex);
                      setSelectedRowIndices(newSet);
                    }}
                    data-testid="button-select-all"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedRowIndices(new Set())}
                    data-testid="button-deselect-all"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="border rounded-lg max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left w-10">
                        <Checkbox
                          checked={selectedRowIndices.size === previewData.rows.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const all = new Set<number>();
                              for (const r of previewData.rows) all.add(r.rowIndex);
                              setSelectedRowIndices(all);
                            } else {
                              setSelectedRowIndices(new Set());
                            }
                          }}
                          data-testid="checkbox-select-all-rows"
                        />
                      </th>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Amount</th>
                      <th className="p-2 text-left">Type</th>
                      <th className="p-2 text-center">Status</th>
                      <th className="p-2 text-left">Existing Match</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.rows.map((row: any, idx: number) => (
                      <tr
                        key={idx}
                        className={`border-t ${row.isDuplicate ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                        data-testid={`row-preview-${idx}`}
                      >
                        <td className="p-2">
                          <Checkbox
                            checked={selectedRowIndices.has(row.rowIndex)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedRowIndices);
                              if (checked) next.add(row.rowIndex);
                              else next.delete(row.rowIndex);
                              setSelectedRowIndices(next);
                            }}
                            data-testid={`checkbox-row-${idx}`}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{row.date}</td>
                        <td className="p-2 max-w-[250px] truncate" title={row.description || ""}>{row.description || "—"}</td>
                        <td className="p-2 text-right font-mono whitespace-nowrap">
                          {row.amount < 0 ? `-£${Math.abs(row.amount).toFixed(2)}` : `£${row.amount.toFixed(2)}`}
                        </td>
                        <td className="p-2">
                          <Badge variant={row.type === "debit" ? "destructive" : "default"} className="text-xs">
                            {row.type === "debit" ? "Out" : "In"}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          {row.isDuplicate ? (
                            <Badge className="bg-amber-500 text-xs" data-testid={`badge-dup-${idx}`}>Duplicate</Badge>
                          ) : (
                            <Badge className="bg-green-600 text-xs" data-testid={`badge-new-${idx}`}>New</Badge>
                          )}
                        </td>
                        <td className="p-2 text-xs text-muted-foreground max-w-[200px] truncate" title={row.matchedDescription || ""}>
                          {row.isDuplicate ? (row.matchedDescription || `ID: ${row.matchedTransactionId}`) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  onClick={handleConfirmImport}
                  disabled={selectedRowIndices.size === 0 || uploadMutation.isPending}
                  data-testid="button-confirm-import"
                >
                  {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
                  Import {selectedRowIndices.size} Selected
                </Button>
                <Button variant="outline" onClick={handleCancelPreview} data-testid="button-cancel-preview">
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); setSelectedTxnIds(new Set()); setBulkMode(null); }}
            className="pl-10"
            data-testid="input-search-transactions"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); setSelectedTxnIds(new Set()); setBulkMode(null); }}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transactions</SelectItem>
            <SelectItem value="unallocated">Unallocated</SelectItem>
            <SelectItem value="allocated">Allocated</SelectItem>
            <SelectItem value="general">General Purchases</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={() => autoClassifyMutation.mutate()}
          disabled={autoClassifyMutation.isPending}
          data-testid="button-auto-classify"
          className="gap-2"
        >
          {autoClassifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          Auto-Classify
          {pendingSuggestions.length > 0 && (
            <Badge variant="secondary" className="ml-1 bg-amber-100 text-amber-800 border-amber-300">{pendingSuggestions.length}</Badge>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => autoAllocateMutation.mutate()}
          disabled={autoAllocateMutation.isPending}
          data-testid="button-auto-allocate"
          className="gap-2"
        >
          {autoAllocateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
          Auto Allocate
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {transactionsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-3 w-10">
                        <Checkbox
                          checked={unallocatedOnPage.length > 0 && unallocatedOnPage.every((t: any) => selectedTxnIds.has(t.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              const next = new Set(selectedTxnIds);
                              unallocatedOnPage.forEach((t: any) => next.add(t.id));
                              setSelectedTxnIds(next);
                            } else {
                              const next = new Set(selectedTxnIds);
                              unallocatedOnPage.forEach((t: any) => next.delete(t.id));
                              setSelectedTxnIds(next);
                            }
                          }}
                          data-testid="checkbox-select-all-txns"
                        />
                      </th>
                      <th className="text-left p-3 font-medium">Date</th>
                      <th className="text-left p-3 font-medium">Description</th>
                      <th className="text-right p-3 font-medium">Amount</th>
                      <th className="text-left p-3 font-medium">Supplier / Category</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-right p-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((txn: any) => {
                      const isUnallocated = !txn.is_allocated && !txn.is_general_purchase;
                      return (
                      <tr key={txn.id} className={`border-b hover:bg-muted/30 cursor-pointer ${selectedTxnIds.has(txn.id) ? 'bg-blue-50 dark:bg-blue-950/30' : ''}`} data-testid={`row-transaction-${txn.id}`}>
                        <td className="p-3">
                          {isUnallocated ? (
                            <Checkbox
                              checked={selectedTxnIds.has(txn.id)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedTxnIds);
                                if (checked) next.add(txn.id);
                                else next.delete(txn.id);
                                setSelectedTxnIds(next);
                              }}
                              data-testid={`checkbox-txn-${txn.id}`}
                            />
                          ) : null}
                        </td>
                        <td className="p-3 whitespace-nowrap">{String(txn.transaction_date).split('T')[0]}</td>
                        <td className="p-3 max-w-[300px] truncate" title={txn.description || txn.reference || txn.memo || ''}>
                          <span className="flex items-center gap-1.5">
                            {pendingTxnIds.has(txn.id) && (
                              <Sparkles className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                            )}
                            {txn.description || txn.reference || txn.memo || '-'}
                          </span>
                        </td>
                        <td className={`p-3 text-right font-mono whitespace-nowrap ${parseFloat(txn.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {parseFloat(txn.amount) < 0 ? '-' : ''}£{Math.abs(parseFloat(txn.amount)).toFixed(2)}
                        </td>
                        <td className="p-3">
                          {txn.is_general_purchase ? (
                            <span className="text-purple-600 text-xs">{txn.expense_category}</span>
                          ) : txn.client_name ? (
                            <span className="text-green-600 text-xs">{txn.client_name}</span>
                          ) : txn.supplier_name ? (
                            <span className="text-blue-600 text-xs">{txn.supplier_name}</span>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          {txn.is_general_purchase ? (
                            parseFloat(txn.vat_amount || '0') > 0 ? (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">VAT Purchase</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Non-VAT Purchase</Badge>
                            )
                          ) : txn.is_allocated ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Allocated</Badge>
                          ) : parseFloat(txn.allocated_amount || '0') > 0 ? (
                            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Partial</Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-600">Unallocated</Badge>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {!txn.is_allocated && !txn.is_general_purchase && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setSelectedTransaction(txn); setAllocationMode(null); setSelectedSupplier(""); setSelectedClient(""); setAllocAmounts({}); setClientAllocAmounts({}); setGeneralForm({ netAmount: "", vatAmount: "", expenseCategory: "", notes: "" }); }}
                              data-testid={`button-allocate-${txn.id}`}
                            >
                              <LinkIcon className="h-3 w-3 mr-1" /> Allocate
                            </Button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                    {transactions.length === 0 && (
                      <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No transactions found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t">
                  <span className="text-sm text-muted-foreground">Page {page} of {totalPages} ({transactionsQuery.data?.total} total)</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => { setPage(p => p - 1); setSelectedTxnIds(new Set()); setBulkMode(null); }} data-testid="button-prev-page">Previous</Button>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); setSelectedTxnIds(new Set()); setBulkMode(null); }} data-testid="button-next-page">Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {selectedTxnIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-background border-2 border-primary rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4 max-w-4xl" data-testid="bulk-action-bar">
          <div className="flex items-center gap-2 text-sm font-medium whitespace-nowrap">
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">{selectedTxnIds.size}</Badge>
            <span>selected</span>
            <span className="text-muted-foreground font-mono">({'\u00A3'}{selectedTotal.toFixed(2)})</span>
          </div>
          <div className="h-6 w-px bg-border" />
          {!bulkMode && (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkMode("supplier")} data-testid="button-bulk-supplier">
                <Building2 className="h-3.5 w-3.5" /> Assign Supplier
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkMode("client")} data-testid="button-bulk-client">
                <Users className="h-3.5 w-3.5" /> Assign Client
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setBulkMode("purchase")} data-testid="button-bulk-purchase">
                <Tag className="h-3.5 w-3.5" /> Mark as Purchase
              </Button>
            </>
          )}
          {bulkMode === "supplier" && (
            <div className="flex items-center gap-2">
              <Select value={bulkSupplierId} onValueChange={setBulkSupplierId}>
                <SelectTrigger className="w-[220px] h-8 text-xs" data-testid="select-bulk-supplier"><SelectValue placeholder="Choose supplier..." /></SelectTrigger>
                <SelectContent>
                  {(suppliersQuery.data as any[] || []).map((s: any) => (
                    <SelectItem key={s.id} value={String(s.id)}>{s.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!bulkSupplierId || bulkAssignSupplierMutation.isPending} onClick={() => bulkAssignSupplierMutation.mutate({ transactionIds: Array.from(selectedTxnIds), supplierId: parseInt(bulkSupplierId) })} data-testid="button-bulk-confirm-supplier">
                {bulkAssignSupplierMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setBulkMode(null); setBulkSupplierId(""); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {bulkMode === "client" && (
            <div className="flex items-center gap-2">
              <Select value={bulkClientId} onValueChange={setBulkClientId}>
                <SelectTrigger className="w-[220px] h-8 text-xs" data-testid="select-bulk-client"><SelectValue placeholder="Choose client..." /></SelectTrigger>
                <SelectContent>
                  {(clientsQuery.data as any[] || []).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" disabled={!bulkClientId || bulkAssignClientMutation.isPending} onClick={() => bulkAssignClientMutation.mutate({ transactionIds: Array.from(selectedTxnIds), clientId: parseInt(bulkClientId) })} data-testid="button-bulk-confirm-client">
                {bulkAssignClientMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setBulkMode(null); setBulkClientId(""); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {bulkMode === "purchase" && (
            <div className="flex items-center gap-2">
              <Select value={bulkCategory} onValueChange={setBulkCategory}>
                <SelectTrigger className="w-[180px] h-8 text-xs" data-testid="select-bulk-category"><SelectValue placeholder="Category..." /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                <Switch checked={bulkIncludesVat} onCheckedChange={setBulkIncludesVat} data-testid="switch-bulk-vat" />
                <span className="text-xs whitespace-nowrap">VAT</span>
              </div>
              <Button size="sm" disabled={!bulkCategory || bulkCategoriseMutation.isPending} onClick={() => bulkCategoriseMutation.mutate({ transactionIds: Array.from(selectedTxnIds), expenseCategory: bulkCategory, includesVat: bulkIncludesVat })} data-testid="button-bulk-confirm-purchase">
                {bulkCategoriseMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                Apply
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setBulkMode(null); setBulkCategory(""); setBulkIncludesVat(false); }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          <div className="h-6 w-px bg-border" />
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => { setSelectedTxnIds(new Set()); setBulkMode(null); }} data-testid="button-bulk-clear">
            Clear Selection
          </Button>
        </div>
      )}

      {(batchesQuery.data as any[])?.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Import History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(batchesQuery.data as any[]).map((batch: any) => (
                <div key={batch.import_batch_id} className="flex items-center justify-between p-2 rounded border" data-testid={`row-batch-${batch.import_batch_id}`}>
                  <div className="text-sm">
                    <span className="font-medium">{batch.transaction_count} transactions</span>
                    <span className="text-muted-foreground ml-2">{batch.earliest_date} to {batch.latest_date}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteBatchMutation.mutate(batch.import_batch_id)} data-testid={`button-delete-batch-${batch.import_batch_id}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {pendingSuggestions.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-500" />
                <CardTitle className="text-base" data-testid="text-suggestions-title">Smart Classification Suggestions</CardTitle>
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">{pendingSuggestions.length} pending</Badge>
              </div>
              <div className="flex items-center gap-2">
                {selectedSuggestions.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedSuggestions.size} selected</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-700 border-green-300 hover:bg-green-50"
                      onClick={() => batchAcceptMutation.mutate(Array.from(selectedSuggestions))}
                      disabled={batchAcceptMutation.isPending}
                      data-testid="button-batch-accept"
                    >
                      {batchAcceptMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Check className="h-3 w-3 mr-1" />}
                      Accept Selected
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      onClick={() => batchRejectMutation.mutate(Array.from(selectedSuggestions))}
                      disabled={batchRejectMutation.isPending}
                      data-testid="button-batch-reject"
                    >
                      {batchRejectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <X className="h-3 w-3 mr-1" />}
                      Reject Selected
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 w-10">
                      <Checkbox
                        checked={selectedSuggestions.size === pendingSuggestions.length && pendingSuggestions.length > 0}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedSuggestions(new Set(pendingSuggestions.map((s: any) => s.id)));
                          } else {
                            setSelectedSuggestions(new Set());
                          }
                        }}
                        data-testid="checkbox-select-all-suggestions"
                      />
                    </th>
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-left p-3 font-medium">Suggested Match</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-center p-3 font-medium">Confidence</th>
                    <th className="text-left p-3 font-medium">Reasons</th>
                    <th className="text-right p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingSuggestions.map((sug: any) => {
                    const conf = parseFloat(sug.confidence);
                    const confColor = conf >= 80 ? "bg-green-100 text-green-800 border-green-300" : conf >= 60 ? "bg-amber-100 text-amber-800 border-amber-300" : "bg-red-100 text-red-800 border-red-300";
                    const reasons: string[] = Array.isArray(sug.match_reasons) ? sug.match_reasons : [];
                    const reasonLabels: Record<string, string> = {
                      learned_rule: "Learned",
                      name_match: "Name",
                      partial_name_match: "Partial Name",
                      sort_code_match: "Sort Code",
                      account_number_match: "Account No.",
                      amount_match: "Amount",
                      invoice_reference: "Invoice Ref",
                      client_code_match: "Client Code",
                    };

                    return (
                      <tr key={sug.id} className="border-b hover:bg-muted/30" data-testid={`row-suggestion-${sug.id}`}>
                        <td className="p-3">
                          <Checkbox
                            checked={selectedSuggestions.has(sug.id)}
                            onCheckedChange={(checked) => {
                              setSelectedSuggestions(prev => {
                                const next = new Set(prev);
                                if (checked) next.add(sug.id); else next.delete(sug.id);
                                return next;
                              });
                            }}
                            data-testid={`checkbox-suggestion-${sug.id}`}
                          />
                        </td>
                        <td className="p-3 whitespace-nowrap">{String(sug.transaction_date).split('T')[0]}</td>
                        <td className="p-3 max-w-[200px] truncate" title={sug.txn_description || ''}>{sug.txn_description || '-'}</td>
                        <td className={`p-3 text-right font-mono whitespace-nowrap ${parseFloat(sug.txn_amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {parseFloat(sug.txn_amount) < 0 ? '-' : ''}£{Math.abs(parseFloat(sug.txn_amount)).toFixed(2)}
                        </td>
                        <td className="p-3 font-medium min-w-[180px]">
                          {editingSuggestionId === sug.id ? (
                            <div className="space-y-1">
                              {(sug.entity_type === 'supplier') && (
                                <Select
                                  value={sug.entity_id ? String(sug.entity_id) : ""}
                                  onValueChange={(val) => {
                                    const supplier = (suppliersQuery.data as any[] || []).find((s: any) => String(s.id) === val);
                                    updateSuggestionMutation.mutate({ id: sug.id, entityType: 'supplier', entityId: parseInt(val), vendorId: null, expenseCategory: null });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-supplier-${sug.id}`}><SelectValue placeholder="Choose supplier..." /></SelectTrigger>
                                  <SelectContent>
                                    {(suppliersQuery.data as any[] || []).map((s: any) => (
                                      <SelectItem key={s.id} value={String(s.id)}>{s.company_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {(sug.entity_type === 'client') && (
                                <Select
                                  value={sug.entity_id ? String(sug.entity_id) : ""}
                                  onValueChange={(val) => {
                                    updateSuggestionMutation.mutate({ id: sug.id, entityType: 'client', entityId: parseInt(val), vendorId: null, expenseCategory: null });
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-client-${sug.id}`}><SelectValue placeholder="Choose client..." /></SelectTrigger>
                                  <SelectContent>
                                    {(clientsQuery.data as any[] || []).map((c: any) => (
                                      <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {(sug.entity_type === 'purchase' || sug.entity_type === 'vendor') && (
                                <>
                                  <Select
                                    value={sug.expense_category || ""}
                                    onValueChange={(val) => {
                                      updateSuggestionMutation.mutate({ id: sug.id, expenseCategory: val });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-category-${sug.id}`}><SelectValue placeholder="Category..." /></SelectTrigger>
                                    <SelectContent>
                                      {EXPENSE_CATEGORIES.map((cat) => (
                                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  {vendors.length > 0 && (
                                    <Select
                                      value={sug.vendor_id ? String(sug.vendor_id) : "none"}
                                      onValueChange={(val) => {
                                        if (val === "none") {
                                          updateSuggestionMutation.mutate({ id: sug.id, entityType: 'purchase', vendorId: null });
                                        } else {
                                          const v = vendors.find((v: any) => String(v.id) === val);
                                          updateSuggestionMutation.mutate({
                                            id: sug.id, entityType: 'vendor', vendorId: parseInt(val),
                                            expenseCategory: v?.default_expense_category || sug.expense_category,
                                            includesVat: v?.vat_registered || false,
                                          });
                                        }
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-vendor-${sug.id}`}><SelectValue placeholder="Vendor..." /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">No vendor</SelectItem>
                                        {vendors.map((v: any) => (
                                          <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  )}
                                </>
                              )}
                              <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingSuggestionId(null)} data-testid={`button-done-edit-${sug.id}`}>Done</Button>
                            </div>
                          ) : (
                            <button
                              className="text-left hover:underline cursor-pointer text-sm"
                              onClick={() => setEditingSuggestionId(sug.id)}
                              data-testid={`button-edit-match-${sug.id}`}
                            >
                              {sug.entity_type === 'vendor' ? (sug.vendor_name || sug.expense_category || 'Vendor') :
                               sug.entity_type === 'purchase' ? (sug.expense_category || 'General Purchase') :
                               (sug.entity_name || '-')}
                              <Pencil className="h-3 w-3 inline ml-1 text-muted-foreground" />
                            </button>
                          )}
                        </td>
                        <td className="p-3 min-w-[120px]">
                          {editingSuggestionId === sug.id ? (
                            <Select
                              value={sug.entity_type}
                              onValueChange={(val) => {
                                const updates: any = { id: sug.id, entityType: val };
                                if (val === 'supplier' || val === 'client') {
                                  updates.entityId = null;
                                  updates.vendorId = null;
                                  updates.expenseCategory = null;
                                } else if (val === 'purchase') {
                                  updates.entityId = null;
                                  updates.vendorId = null;
                                } else if (val === 'vendor') {
                                  updates.entityId = null;
                                }
                                updateSuggestionMutation.mutate(updates);
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs" data-testid={`select-edit-type-${sug.id}`}><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="supplier">Supplier</SelectItem>
                                <SelectItem value="client">Client</SelectItem>
                                <SelectItem value="purchase">Purchase</SelectItem>
                                {vendors.length > 0 && <SelectItem value="vendor">Vendor</SelectItem>}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="outline" className={
                              sug.entity_type === 'supplier' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                              sug.entity_type === 'client' ? 'bg-green-50 text-green-700 border-green-200' :
                              sug.entity_type === 'vendor' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                              'bg-purple-50 text-purple-700 border-purple-200'
                            }>
                              {sug.entity_type === 'supplier' ? 'Supplier' : sug.entity_type === 'client' ? 'Client' : sug.entity_type === 'vendor' ? 'Vendor' : sug.includes_vat ? 'VAT Purchase' : 'Non-VAT Purchase'}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className={confColor}>{conf.toFixed(0)}%</Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {reasons.map((r) => (
                              <Badge key={r} variant="secondary" className="text-[10px] px-1.5 py-0">{reasonLabels[r] || r}</Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-green-700 hover:bg-green-50"
                                    onClick={() => acceptSuggestionMutation.mutate(sug.id)}
                                    disabled={acceptSuggestionMutation.isPending}
                                    data-testid={`button-accept-suggestion-${sug.id}`}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Accept suggestion</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 text-red-600 hover:bg-red-50"
                                    onClick={() => rejectSuggestionMutation.mutate(sug.id)}
                                    disabled={rejectSuggestionMutation.isPending}
                                    data-testid={`button-reject-suggestion-${sug.id}`}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reject suggestion</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedTransaction} onOpenChange={(open) => { if (!open) { setSelectedTransaction(null); setAllocationMode(null); setSelectedClient(""); setClientAllocAmounts({}); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allocate Transaction</DialogTitle>
            <DialogDescription>
              {selectedTransaction && (
                <span className="flex items-center gap-3 mt-1">
                  <span>{String(selectedTransaction.transaction_date).split('T')[0]}</span>
                  <span className="truncate max-w-[200px]" title={selectedTransaction.description || selectedTransaction.reference || ''}>{selectedTransaction.description || selectedTransaction.reference}</span>
                  <span className={`font-mono font-bold ${parseFloat(selectedTransaction.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    £{Math.abs(parseFloat(selectedTransaction.amount)).toFixed(2)}
                  </span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {!allocationMode && (
            <div className="grid grid-cols-2 gap-4 py-4">
              <Card className="cursor-pointer hover:border-blue-400 transition-colors" onClick={() => setAllocationMode("supplier")} data-testid="button-mode-supplier">
                <CardContent className="p-6 text-center">
                  <Building2 className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                  <p className="font-medium">Supplier Payment</p>
                  <p className="text-xs text-muted-foreground mt-1">Allocate to supplier invoices</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-green-400 transition-colors" onClick={() => setAllocationMode("client")} data-testid="button-mode-client">
                <CardContent className="p-6 text-center">
                  <Users className="h-8 w-8 mx-auto mb-2 text-green-600" />
                  <p className="font-medium">Client Payment</p>
                  <p className="text-xs text-muted-foreground mt-1">Link to client invoice</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-purple-400 transition-colors" onClick={() => {
                const total = Math.abs(parseFloat(selectedTransaction?.amount || '0'));
                const net = Math.floor((total / 1.2) * 100) / 100;
                const vat = Math.floor((total - net) * 100) / 100;
                setGeneralForm(prev => ({ ...prev, netAmount: net.toFixed(2), vatAmount: vat.toFixed(2) }));
                setAllocationMode("vat-purchase");
              }} data-testid="button-mode-vat-purchase">
                <CardContent className="p-6 text-center">
                  <Tag className="h-8 w-8 mx-auto mb-2 text-purple-600" />
                  <p className="font-medium">VAT Purchase</p>
                  <p className="text-xs text-muted-foreground mt-1">Includes 20% VAT (auto-calculated)</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:border-orange-400 transition-colors" onClick={() => {
                const total = Math.abs(parseFloat(selectedTransaction?.amount || '0'));
                setGeneralForm(prev => ({ ...prev, netAmount: total.toFixed(2), vatAmount: "0.00" }));
                setAllocationMode("non-vat-purchase");
              }} data-testid="button-mode-non-vat-purchase">
                <CardContent className="p-6 text-center">
                  <FileText className="h-8 w-8 mx-auto mb-2 text-orange-600" />
                  <p className="font-medium">Non-VAT Purchase</p>
                  <p className="text-xs text-muted-foreground mt-1">No VAT (exempt or zero-rated)</p>
                </CardContent>
              </Card>
            </div>
          )}

          {allocationMode === "supplier" && (
            <div className="space-y-4">
              {!selectedSupplier && suggestedQuery.data?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Suggested Matches (by amount)</Label>
                  <div className="space-y-1">
                    {(suggestedQuery.data as any[]).slice(0, 5).map((match: any) => (
                      <div key={match.id} className="flex items-center justify-between p-2 border rounded text-sm hover:bg-muted/50 cursor-pointer"
                        onClick={() => { setSelectedSupplier(String(match.supplier_id)); }}
                        data-testid={`suggestion-${match.id}`}
                      >
                        <div>
                          <span className="font-medium">{match.supplier_name}</span>
                          <span className="text-muted-foreground ml-2">#{match.invoice_number}</span>
                        </div>
                        <span className="font-mono">£{parseFloat(match.remaining).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <Label>Select Supplier</Label>
                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                  <SelectTrigger data-testid="select-supplier"><SelectValue placeholder="Choose supplier..." /></SelectTrigger>
                  <SelectContent>
                    {(suppliersQuery.data as any[] || []).map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSupplier && (
                <div>
                  <Label className="text-sm mb-2 block">Unpaid Invoices</Label>
                  {unpaidInvoicesQuery.isLoading ? (
                    <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                  ) : (unpaidInvoicesQuery.data as any[])?.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No unpaid invoices for this supplier</p>
                  ) : (
                    <div className="space-y-2">
                      {(unpaidInvoicesQuery.data as any[]).map((inv: any) => (
                        <div key={inv.id} className="flex items-center gap-3 p-2 border rounded" data-testid={`invoice-row-${inv.id}`}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{inv.invoice_number}</div>
                            <div className="text-xs text-muted-foreground">{inv.period_start} – {inv.period_end}</div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-mono">Total: £{parseFloat(inv.total_amount).toFixed(2)}</div>
                            <div className="text-green-600">Remaining: £{parseFloat(inv.remaining).toFixed(2)}</div>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={parseFloat(inv.remaining)}
                            value={allocAmounts[inv.id] || ""}
                            onChange={(e) => setAllocAmounts(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-28 text-right"
                            data-testid={`input-alloc-${inv.id}`}
                          />
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-sm text-muted-foreground">
                          Allocating: £{Object.values(allocAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)}
                          {" / "}£{Math.abs(parseFloat(selectedTransaction?.amount || '0')).toFixed(2)}
                        </span>
                        <Button onClick={handleAllocate} disabled={allocateMutation.isPending} data-testid="button-confirm-allocate">
                          {allocateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                          Allocate
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {allocationMode === "client" && (
            <div className="space-y-4">
              <div>
                <Label>Select Client</Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-client"><SelectValue placeholder="Choose client..." /></SelectTrigger>
                  <SelectContent>
                    {(clientsQuery.data as any[] || []).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedClient && (
                <div>
                  <Label className="text-sm mb-2 block">Unpaid Client Invoices</Label>
                  {unpaidClientInvoicesQuery.isLoading ? (
                    <div className="py-4 text-center"><Loader2 className="h-4 w-4 animate-spin mx-auto" /></div>
                  ) : (unpaidClientInvoicesQuery.data as any[])?.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No unpaid invoices for this client</p>
                  ) : (
                    <div className="space-y-2">
                      {(unpaidClientInvoicesQuery.data as any[]).map((inv: any) => (
                        <div key={inv.id} className="flex items-center gap-3 p-2 border rounded" data-testid={`client-invoice-row-${inv.id}`}>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{inv.invoice_number}</div>
                            <div className="text-xs text-muted-foreground">{inv.period_start} – {inv.period_end}</div>
                          </div>
                          <div className="text-right text-xs">
                            <div className="font-mono">Total: £{parseFloat(inv.total_amount).toFixed(2)}</div>
                            <div className="text-green-600">Remaining: £{parseFloat(inv.remaining).toFixed(2)}</div>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max={parseFloat(inv.remaining)}
                            value={clientAllocAmounts[inv.id] || ""}
                            onChange={(e) => setClientAllocAmounts(prev => ({ ...prev, [inv.id]: e.target.value }))}
                            placeholder="0.00"
                            className="w-28 text-right"
                            data-testid={`input-client-alloc-${inv.id}`}
                          />
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-sm text-muted-foreground">
                          Allocating: £{Object.values(clientAllocAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0).toFixed(2)}
                          {" / "}£{Math.abs(parseFloat(selectedTransaction?.amount || '0')).toFixed(2)}
                        </span>
                        <Button onClick={handleAllocateClient} disabled={allocateClientMutation.isPending} data-testid="button-confirm-allocate-client">
                          {allocateClientMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                          Allocate to Client
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(allocationMode === "vat-purchase" || allocationMode === "non-vat-purchase") && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                {allocationMode === "vat-purchase" ? (
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">VAT Purchase (20%)</Badge>
                ) : (
                  <Badge className="bg-orange-100 text-orange-700 border-orange-200">Non-VAT Purchase</Badge>
                )}
              </div>
              <div>
                <Label>Expense Category</Label>
                <Select value={generalForm.expenseCategory} onValueChange={(v) => setGeneralForm(prev => ({ ...prev, expenseCategory: v }))}>
                  <SelectTrigger data-testid="select-expense-category"><SelectValue placeholder="Select category..." /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Net Amount (ex VAT)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={generalForm.netAmount}
                    onChange={(e) => {
                      const net = e.target.value;
                      if (allocationMode === "vat-purchase") {
                        const vat = (parseFloat(net) * 0.2).toFixed(2);
                        setGeneralForm(prev => ({ ...prev, netAmount: net, vatAmount: vat }));
                      } else {
                        setGeneralForm(prev => ({ ...prev, netAmount: net, vatAmount: "0.00" }));
                      }
                    }}
                    placeholder="0.00"
                    data-testid="input-net-amount"
                  />
                </div>
                <div>
                  <Label>VAT Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={generalForm.vatAmount}
                    onChange={(e) => setGeneralForm(prev => ({ ...prev, vatAmount: e.target.value }))}
                    placeholder="0.00"
                    disabled={allocationMode === "non-vat-purchase"}
                    data-testid="input-vat-amount"
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Total: £{((parseFloat(generalForm.netAmount) || 0) + (parseFloat(generalForm.vatAmount) || 0)).toFixed(2)}
                {" vs transaction: £"}{Math.abs(parseFloat(selectedTransaction?.amount || '0')).toFixed(2)}
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Textarea
                  value={generalForm.notes}
                  onChange={(e) => setGeneralForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Description of purchase..."
                  data-testid="input-general-notes"
                />
              </div>
              <Button onClick={handleCategorise} disabled={categoriseMutation.isPending || !generalForm.expenseCategory || !generalForm.netAmount} className="w-full" data-testid="button-confirm-categorise">
                {categoriseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Tag className="h-4 w-4 mr-2" />}
                {allocationMode === "vat-purchase" ? "Categorise as VAT Purchase" : "Categorise as Non-VAT Purchase"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AllocationOverviewTab() {
  const { toast } = useToast();
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showRecentAllocs, setShowRecentAllocs] = useState(false);

  const dashboardQuery = useQuery<any>({
    queryKey: ["/api/accounting/allocation-dashboard"],
  });

  const allocationsQuery = useQuery({
    queryKey: ["/api/accounting/allocations", supplierFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (supplierFilter !== "all") params.set("supplierId", supplierFilter);
      const res = await fetch(`/api/accounting/allocations?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: showRecentAllocs,
  });

  const removeAllocMutation = useMutation({
    mutationFn: async (allocId: number) => {
      const res = await apiRequest("DELETE", `/api/accounting/allocations/${allocId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Removed", description: "Allocation removed" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/allocations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/allocation-dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/bank-transactions"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const summary = dashboardQuery.data?.summary || {};
  const allSuppliers = (dashboardQuery.data?.suppliers || []) as any[];
  const filteredSuppliers = statusFilter === "all" ? allSuppliers : allSuppliers.filter((s: any) => s.status === statusFilter);

  const fmtCurrency = (v: number) => '£' + v.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    fully_allocated: { label: "Fully Allocated", color: "text-green-700 dark:text-green-400", bgColor: "bg-green-100 dark:bg-green-900/30" },
    partial: { label: "Partial", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-900/30" },
    needs_attention: { label: "Needs Attention", color: "text-orange-700 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-900/30" },
    no_invoices: { label: "No Invoices", color: "text-red-700 dark:text-red-400", bgColor: "bg-red-100 dark:bg-red-900/30" },
    no_payments: { label: "No Payments", color: "text-gray-700 dark:text-gray-400", bgColor: "bg-gray-100 dark:bg-gray-800" },
  };

  const getBarColor = (pct: number) => {
    if (pct >= 95) return "bg-green-500";
    if (pct >= 70) return "bg-blue-500";
    if (pct >= 40) return "bg-yellow-500";
    return "bg-orange-500";
  };

  if (dashboardQuery.isLoading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  const handleExport = (format: "csv" | "pdf") => {
    window.open(`/api/accounting/allocation-dashboard/export?format=${format}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 -mt-1 mb-1">
        <Button variant="outline" size="sm" onClick={() => handleExport("csv")} data-testid="button-export-alloc-csv">
          <Download className="h-4 w-4 mr-1" /> CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleExport("pdf")} data-testid="button-export-alloc-pdf">
          <FileDown className="h-4 w-4 mr-1" /> PDF
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="cursor-pointer hover:ring-2 ring-primary/30 transition-all" onClick={() => setStatusFilter("all")} data-testid="card-total-suppliers">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold" data-testid="text-total-suppliers">{summary.totalSuppliers || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Total Suppliers</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-green-400/30 transition-all" onClick={() => setStatusFilter(statusFilter === "fully_allocated" ? "all" : "fully_allocated")} data-testid="card-fully-allocated">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-600" data-testid="text-fully-allocated">{summary.fullyAllocated || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Fully Allocated</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-blue-400/30 transition-all" onClick={() => setStatusFilter(statusFilter === "partial" ? "all" : "partial")} data-testid="card-partial">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-600" data-testid="text-partial">{summary.partial || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Partial</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-orange-400/30 transition-all" onClick={() => setStatusFilter(statusFilter === "needs_attention" ? "all" : "needs_attention")} data-testid="card-needs-attention">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-orange-600" data-testid="text-needs-attention">{summary.needsAttention || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Needs Attention</div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:ring-2 ring-red-400/30 transition-all" onClick={() => setStatusFilter(statusFilter === "no_invoices" ? "all" : "no_invoices")} data-testid="card-no-invoices">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-red-600" data-testid="text-no-invoices">{summary.noInvoices || 0}</div>
            <div className="text-xs text-muted-foreground mt-1">No Invoices</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Invoiced</div>
            <div className="text-xl font-bold font-mono" data-testid="text-dash-invoiced">{fmtCurrency(summary.totalInvoiced || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Total Payments</div>
            <div className="text-xl font-bold font-mono" data-testid="text-dash-payments">{fmtCurrency(summary.totalPayments || 0)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">Overall Allocation</div>
                <div className="text-xl font-bold font-mono" data-testid="text-dash-alloc-pct">{summary.overallPct || 0}%</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Allocated</div>
                <div className="text-sm font-mono">{fmtCurrency(summary.totalAllocated || 0)}</div>
              </div>
            </div>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${getBarColor(summary.overallPct || 0)}`} style={{ width: `${summary.overallPct || 0}%` }} />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Supplier Allocation Progress</CardTitle>
            <div className="flex items-center gap-2">
              {statusFilter !== "all" && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => setStatusFilter("all")} data-testid="badge-clear-filter">
                  {statusConfig[statusFilter]?.label} <X className="h-3 w-3 ml-1" />
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">{filteredSuppliers.length} supplier(s)</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Supplier</th>
                  <th className="text-left p-3 font-medium w-[100px]">Status</th>
                  <th className="text-right p-3 font-medium">Invoices</th>
                  <th className="text-right p-3 font-medium">Payments</th>
                  <th className="text-left p-3 font-medium w-[180px]">Allocation</th>
                  <th className="text-right p-3 font-medium">Difference</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map((s: any) => {
                  const sc = statusConfig[s.status] || statusConfig.needs_attention;
                  return (
                    <tr key={s.supplierId} className="border-b hover:bg-muted/30" data-testid={`row-dash-supplier-${s.supplierId}`}>
                      <td className="p-3">
                        <div className="font-medium text-sm">{s.companyName}</div>
                        <div className="text-xs text-muted-foreground">
                          {s.paidInvoiceCount}/{s.invoiceCount} inv paid · {s.allocatedTxnCount}/{s.transactionCount} txns alloc
                        </div>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bgColor} ${sc.color}`} data-testid={`badge-status-${s.supplierId}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <div>{fmtCurrency(s.invoiceTotal)}</div>
                        {s.unpaidInvoiceCount > 0 && <div className="text-xs text-orange-600">{s.unpaidInvoiceCount} unpaid</div>}
                      </td>
                      <td className="p-3 text-right font-mono">
                        <div>{fmtCurrency(s.paymentTotal)}</div>
                        <div className="text-xs text-muted-foreground">{s.transactionCount} txns</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${getBarColor(s.allocationPct)}`} style={{ width: `${s.allocationPct}%` }} />
                          </div>
                          <span className="text-xs font-mono w-[32px] text-right" data-testid={`text-alloc-pct-${s.supplierId}`}>{s.allocationPct}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{fmtCurrency(s.allocatedTotal)} allocated</div>
                      </td>
                      <td className="p-3 text-right font-mono">
                        <span className={s.difference > 0.5 ? 'text-orange-600' : s.difference < -0.5 ? 'text-blue-600' : 'text-green-600'}>
                          {s.difference > 0 ? '+' : ''}{fmtCurrency(s.difference)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filteredSuppliers.length === 0 && (
                  <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No suppliers match the filter</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button variant="ghost" className="text-base font-semibold p-0 h-auto hover:bg-transparent" onClick={() => setShowRecentAllocs(!showRecentAllocs)} data-testid="button-toggle-recent-allocs">
              Recent Allocations {showRecentAllocs ? <ChevronDown className="h-4 w-4 inline ml-1" /> : <ChevronRight className="h-4 w-4 inline ml-1" />}
            </Button>
            {showRecentAllocs && (
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[200px]" data-testid="select-alloc-supplier-filter"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {allSuppliers.map((s: any) => (
                    <SelectItem key={s.supplierId} value={String(s.supplierId)}>{s.companyName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
        {showRecentAllocs && (
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Transaction</th>
                    <th className="text-left p-3 font-medium">Supplier</th>
                    <th className="text-left p-3 font-medium">Invoice</th>
                    <th className="text-right p-3 font-medium">Amount</th>
                    <th className="text-right p-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {((allocationsQuery.data || []) as any[]).slice(0, 50).map((a: any) => (
                    <tr key={a.id} className="border-b" data-testid={`row-alloc-${a.id}`}>
                      <td className="p-3 whitespace-nowrap">{String(a.transaction_date).split('T')[0]}</td>
                      <td className="p-3 max-w-[200px] truncate" title={a.transaction_description || ''}>{a.transaction_description}</td>
                      <td className="p-3">{a.supplier_name}</td>
                      <td className="p-3">{a.invoice_number || '-'}</td>
                      <td className="p-3 text-right font-mono">£{parseFloat(a.amount).toFixed(2)}</td>
                      <td className="p-3 text-right">
                        <Button size="sm" variant="ghost" className="text-red-600 h-7" onClick={() => removeAllocMutation.mutate(a.id)} data-testid={`button-remove-alloc-${a.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {((allocationsQuery.data || []) as any[]).length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No allocations yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

function ClientInvoicesTab() {
  const { toast } = useToast();
  const [showGenerate, setShowGenerate] = useState(false);
  const [selectedClient, setSelectedClient] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [selectedTxns, setSelectedTxns] = useState<Set<number>>(new Set());
  const [txnClientFilter, setTxnClientFilter] = useState("all");
  const [showTxns, setShowTxns] = useState(true);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<number>>(new Set());

  const clientsQuery = useQuery({ queryKey: ["/api/accounting/clients"] });
  const invoicesQuery = useQuery({
    queryKey: ["/api/accounting/client-invoices", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/accounting/client-invoices?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const clientTxnsQuery = useQuery({
    queryKey: ["/api/accounting/client-transactions"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/client-transactions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (transactionIds: number[]) => {
      const res = await apiRequest("POST", "/api/accounting/client-invoices/from-transaction", { transactionIds });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Created ${data.created} invoice(s)` });
      setSelectedTxns(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/client-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/client-transactions"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const bulkStatusMutation = useMutation({
    mutationFn: async ({ invoiceIds, status }: { invoiceIds: number[]; status: string }) => {
      const res = await apiRequest("PATCH", "/api/accounting/client-invoices/bulk", { invoiceIds, status });
      return res.json();
    },
    onSuccess: (data, vars) => {
      toast({ title: `${data.updated} invoice(s) marked as ${vars.status}` });
      setSelectedInvoices(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/client-invoices"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const invoicesList = (invoicesQuery.data || []) as any[];

  const toggleInvoice = (id: number) => {
    setSelectedInvoices(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllInvoices = () => {
    if (selectedInvoices.size === invoicesList.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoicesList.map((i: any) => i.id)));
    }
  };

  const selectedHasDrafts = invoicesList.some((i: any) => selectedInvoices.has(i.id) && i.status === 'draft');
  const selectedHasIssuable = invoicesList.some((i: any) => selectedInvoices.has(i.id) && (i.status === 'draft' || i.status === 'issued'));

  const filteredTxns = (clientTxnsQuery.data as any[] || []).filter((t: any) => {
    if (t.is_allocated) return false;
    if (txnClientFilter !== "all" && String(t.client_id) !== txnClientFilter) return false;
    return true;
  });

  const txnClients = Array.from(new Map(
    (clientTxnsQuery.data as any[] || [])
      .filter((t: any) => !t.is_allocated)
      .map((t: any) => [String(t.client_id), t.client_name])
  ).entries()).sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));

  const toggleTxn = (id: number) => {
    setSelectedTxns(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTxns = () => {
    if (selectedTxns.size === filteredTxns.length) {
      setSelectedTxns(new Set());
    } else {
      setSelectedTxns(new Set(filteredTxns.map((t: any) => t.id)));
    }
  };

  const lineItemsQuery = useQuery({
    queryKey: ["/api/accounting/client-invoices", viewingInvoice?.id, "line-items"],
    queryFn: async () => {
      const res = await fetch(`/api/accounting/client-invoices/${viewingInvoice.id}/line-items`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!viewingInvoice,
  });

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounting/client-invoices/generate", data);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Invoice Generated", description: `${data.invoiceNumber} — £${data.totalAmount}` });
      setShowGenerate(false);
      setSelectedClient("");
      setPeriodStart("");
      setPeriodEnd("");
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/client-invoices"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/accounting/client-invoices/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/client-invoices"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      draft: "bg-gray-50 text-gray-600 border-gray-200",
      issued: "bg-blue-50 text-blue-700 border-blue-200",
      paid: "bg-green-50 text-green-700 border-green-200",
      overdue: "bg-red-50 text-red-700 border-red-200",
      cancelled: "bg-red-50 text-red-600 border-red-200",
    };
    return <Badge variant="outline" className={map[status] || ""}>{status}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-client-invoice-status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setShowGenerate(true)} data-testid="button-generate-client-invoice">
          <FileText className="h-4 w-4 mr-2" /> Generate Invoice
        </Button>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setShowTxns(!showTxns)} data-testid="button-toggle-txns">
                <CreditCard className="h-4 w-4 mr-1" />
                Client Transactions ({filteredTxns.length})
                {showTxns ? <X className="h-3 w-3 ml-1" /> : <Plus className="h-3 w-3 ml-1" />}
              </Button>
              {showTxns && (
                <Select value={txnClientFilter} onValueChange={(v) => { setTxnClientFilter(v); setSelectedTxns(new Set()); }}>
                  <SelectTrigger className="w-[200px] h-8 text-xs" data-testid="select-txn-client-filter"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {txnClients.map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {showTxns && selectedTxns.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{selectedTxns.size} selected</span>
                <Button size="sm" onClick={() => convertMutation.mutate(Array.from(selectedTxns))} disabled={convertMutation.isPending} data-testid="button-convert-to-invoices">
                  {convertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <FileText className="h-4 w-4 mr-1" />}
                  Convert to Invoices
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedTxns(new Set())} data-testid="button-clear-txn-selection">Clear</Button>
              </div>
            )}
          </div>
          {showTxns && (
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto border rounded-md mb-4">
              {clientTxnsQuery.isLoading ? (
                <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : filteredTxns.length === 0 ? (
                <div className="py-6 text-center text-muted-foreground text-sm">No unallocated client transactions</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 w-8">
                        <Checkbox
                          checked={selectedTxns.size === filteredTxns.length && filteredTxns.length > 0}
                          onCheckedChange={toggleAllTxns}
                          data-testid="checkbox-select-all-txns"
                        />
                      </th>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-left p-2 font-medium">Client</th>
                      <th className="text-left p-2 font-medium">Description</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                      <th className="text-right p-2 font-medium">Net</th>
                      <th className="text-right p-2 font-medium">VAT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTxns.map((t: any) => {
                      const gross = parseFloat(t.amount);
                      const net = Math.round((gross / 1.2) * 100) / 100;
                      const vat = Math.round((gross - net) * 100) / 100;
                      return (
                        <tr key={t.id} className={`border-b hover:bg-muted/30 ${selectedTxns.has(t.id) ? "bg-blue-50 dark:bg-blue-950/20" : ""}`} data-testid={`row-client-txn-${t.id}`}>
                          <td className="p-2">
                            <Checkbox
                              checked={selectedTxns.has(t.id)}
                              onCheckedChange={() => toggleTxn(t.id)}
                              data-testid={`checkbox-txn-${t.id}`}
                            />
                          </td>
                          <td className="p-2 whitespace-nowrap text-xs">{t.transaction_date}</td>
                          <td className="p-2 text-xs font-medium">{t.client_name}</td>
                          <td className="p-2 text-xs truncate max-w-[200px]" title={t.description}>{t.description}</td>
                          <td className="p-2 text-right font-mono text-xs font-bold">£{gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-2 text-right font-mono text-xs">£{net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-2 text-right font-mono text-xs text-muted-foreground">£{vat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {selectedInvoices.size > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 border-b">
              <span className="text-sm font-medium">{selectedInvoices.size} selected</span>
              {selectedHasDrafts && (
                <Button size="sm" variant="outline" onClick={() => bulkStatusMutation.mutate({ invoiceIds: Array.from(selectedInvoices), status: 'issued' })} disabled={bulkStatusMutation.isPending} data-testid="button-bulk-issue">
                  {bulkStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Issue All
                </Button>
              )}
              {selectedHasIssuable && (
                <Button size="sm" variant="outline" className="text-green-600" onClick={() => bulkStatusMutation.mutate({ invoiceIds: Array.from(selectedInvoices), status: 'paid' })} disabled={bulkStatusMutation.isPending} data-testid="button-bulk-paid">
                  {bulkStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  Mark All Paid
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelectedInvoices(new Set())} data-testid="button-clear-invoice-selection">Clear</Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 w-8">
                    <Checkbox
                      checked={selectedInvoices.size === invoicesList.length && invoicesList.length > 0}
                      onCheckedChange={toggleAllInvoices}
                      data-testid="checkbox-select-all-invoices"
                    />
                  </th>
                  <th className="text-left p-3 font-medium">Invoice #</th>
                  <th className="text-left p-3 font-medium">Client</th>
                  <th className="text-left p-3 font-medium">Period</th>
                  <th className="text-right p-3 font-medium">Subtotal</th>
                  <th className="text-right p-3 font-medium">VAT</th>
                  <th className="text-right p-3 font-medium">Total</th>
                  <th className="text-left p-3 font-medium">Status</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoicesList.map((inv: any) => (
                  <tr key={inv.id} className={`border-b hover:bg-muted/30 ${selectedInvoices.has(inv.id) ? "bg-blue-50 dark:bg-blue-950/20" : ""}`} data-testid={`row-client-invoice-${inv.id}`}>
                    <td className="p-3">
                      <Checkbox
                        checked={selectedInvoices.has(inv.id)}
                        onCheckedChange={() => toggleInvoice(inv.id)}
                        data-testid={`checkbox-invoice-${inv.id}`}
                      />
                    </td>
                    <td className="p-3 font-medium">{inv.invoice_number}</td>
                    <td className="p-3">{inv.client_name}</td>
                    <td className="p-3 whitespace-nowrap text-xs">{inv.period_start} – {inv.period_end}</td>
                    <td className="p-3 text-right font-mono">£{parseFloat(inv.subtotal).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono">£{parseFloat(inv.vat_amount).toFixed(2)}</td>
                    <td className="p-3 text-right font-mono font-bold">£{parseFloat(inv.total_amount).toFixed(2)}</td>
                    <td className="p-3">{statusBadge(inv.status)}</td>
                    <td className="p-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setViewingInvoice(inv)} data-testid={`button-view-invoice-${inv.id}`}>View</Button>
                      {inv.status === 'draft' && (
                        <Button size="sm" variant="outline" onClick={() => updateMutation.mutate({ id: inv.id, status: 'issued' })} data-testid={`button-issue-${inv.id}`}>Issue</Button>
                      )}
                      {(inv.status === 'issued' || inv.status === 'draft') && (
                        <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateMutation.mutate({ id: inv.id, status: 'paid' })} data-testid={`button-mark-paid-${inv.id}`}>Paid</Button>
                      )}
                    </td>
                  </tr>
                ))}
                {invoicesList.length === 0 && (
                  <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">No client invoices yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Client Invoice</DialogTitle>
            <DialogDescription>Create an invoice for a client based on completed shifts with charge rates.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Client</Label>
              <Select value={selectedClient} onValueChange={setSelectedClient}>
                <SelectTrigger data-testid="select-invoice-client"><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>
                  {((clientsQuery.data || []) as any[]).map((c: any) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Period Start</Label>
                <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} data-testid="input-period-start" />
              </div>
              <div>
                <Label>Period End</Label>
                <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} data-testid="input-period-end" />
              </div>
            </div>
            <Button
              onClick={() => generateMutation.mutate({ clientId: parseInt(selectedClient), periodStart, periodEnd })}
              disabled={!selectedClient || !periodStart || !periodEnd || generateMutation.isPending}
              className="w-full"
              data-testid="button-confirm-generate"
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
              Generate Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingInvoice} onOpenChange={(open) => { if (!open) setViewingInvoice(null); }}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingInvoice?.invoice_number} — {viewingInvoice?.client_name}</DialogTitle>
            <DialogDescription>{viewingInvoice?.period_start} to {viewingInvoice?.period_end}</DialogDescription>
          </DialogHeader>
          {lineItemsQuery.isLoading ? (
            <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-2 font-medium">Description</th>
                    <th className="text-right p-2 font-medium">Hours</th>
                    <th className="text-right p-2 font-medium">Rate</th>
                    <th className="text-right p-2 font-medium">Subtotal</th>
                    <th className="text-right p-2 font-medium">VAT</th>
                    <th className="text-right p-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {((lineItemsQuery.data || []) as any[]).map((item: any) => (
                    <tr key={item.id} className="border-b">
                      <td className="p-2 text-xs">{item.description}</td>
                      <td className="p-2 text-right font-mono">{parseFloat(item.hours).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">£{parseFloat(item.charge_rate).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">£{parseFloat(item.subtotal).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">£{parseFloat(item.vat_amount).toFixed(2)}</td>
                      <td className="p-2 text-right font-mono">£{parseFloat(item.line_total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2">
                    <td colSpan={3} className="p-2 text-right">Totals:</td>
                    <td className="p-2 text-right font-mono">£{parseFloat(viewingInvoice?.subtotal || '0').toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">£{parseFloat(viewingInvoice?.vat_amount || '0').toFixed(2)}</td>
                    <td className="p-2 text-right font-mono">£{parseFloat(viewingInvoice?.total_amount || '0').toFixed(2)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VATReturnTab() {
  const { toast } = useToast();
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const defaultQuarterNum = currentMonth >= 11 ? 1 : currentMonth >= 8 ? 4 : currentMonth >= 5 ? 3 : currentMonth >= 2 ? 2 : 1;
  const defaultYear = defaultQuarterNum === 1 && currentMonth >= 11 ? currentYear + 1 : currentYear;

  const [selectedYear, setSelectedYear] = useState(String(defaultYear));
  const [selectedQuarterNum, setSelectedQuarterNum] = useState(String(defaultQuarterNum));
  const selectedQuarter = `${selectedYear}-Q${selectedQuarterNum}`;
  const [showVendorDialog, setShowVendorDialog] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());

  const years: string[] = [];
  for (let y = 2020; y <= currentYear + 1; y++) {
    years.push(String(y));
  }

  const vatQuery = useQuery({
    queryKey: ["/api/accounting/vat-return", selectedQuarter],
    queryFn: async () => {
      const res = await fetch(`/api/accounting/vat-return?quarter=${selectedQuarter}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
  });

  const data = vatQuery.data as any;
  const vatCalcType = data?.vatCalculationType || "accrual";

  const unclassifiedQuery = useQuery({
    queryKey: ["/api/accounting/unclassified-vendors"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/unclassified-vendors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: vatCalcType === "cash",
  });

  const classifiedQuery = useQuery({
    queryKey: ["/api/accounting/vendor-classifications"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/vendor-classifications", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: vatCalcType === "cash",
  });

  const toggleVatType = async (newType: string) => {
    try {
      await apiRequest("PATCH", "/api/accounting/vat-calculation-type", { type: newType });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vat-return"] });
      toast({ title: `Switched to ${newType === "cash" ? "Cash" : "Accrual"} accounting` });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  };

  const autoClassifyVendors = async () => {
    try {
      const res = await apiRequest("POST", "/api/accounting/vendor-classifications/auto-classify");
      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/unclassified-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vendor-classifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vat-return"] });
      toast({ title: `Auto-classified ${result.autoClassified} personal names as non-VAT. ${result.remaining} vendors remaining.` });
    } catch {
      toast({ title: "Failed to auto-classify", variant: "destructive" });
    }
  };

  const bulkClassifyVendors = async (vatQualifying: boolean) => {
    if (selectedVendors.size === 0) return;
    try {
      const classifications = Array.from(selectedVendors).map(vendorName => ({ vendorName, vatQualifying }));
      await apiRequest("POST", "/api/accounting/vendor-classifications/bulk", { classifications });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/unclassified-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vendor-classifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vat-return"] });
      toast({ title: `Classified ${selectedVendors.size} vendors as ${vatQualifying ? "VAT Qualifying" : "Non-VAT"}` });
      setSelectedVendors(new Set());
    } catch {
      toast({ title: "Failed to bulk classify", variant: "destructive" });
    }
  };

  const toggleVendorSelection = (vendorName: string) => {
    setSelectedVendors(prev => {
      const next = new Set(prev);
      if (next.has(vendorName)) next.delete(vendorName);
      else next.add(vendorName);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const allVendors = (unclassifiedQuery.data as any[]) || [];
    if (selectedVendors.size === allVendors.length) {
      setSelectedVendors(new Set());
    } else {
      setSelectedVendors(new Set(allVendors.map((v: any) => v.vendor_name)));
    }
  };

  const classifyVendor = async (vendorName: string, vatQualifying: boolean) => {
    try {
      await apiRequest("POST", "/api/accounting/vendor-classifications", { vendorName, vatQualifying });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/unclassified-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vendor-classifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/vat-return"] });
    } catch {
      toast({ title: "Failed to classify vendor", variant: "destructive" });
    }
  };

  const downloadCSV = () => {
    if (!data) return;
    const rows = [
      ["VAT Return Summary", data.quarter],
      ["Period", `${data.periodStart} to ${data.periodEnd}`],
      [""],
      ["", "Description", "Amount (£)"],
      ["VAT Basis", vatCalcType === "cash" ? "Cash Accounting" : "Accrual Accounting"],
      [""],
      ["A", vatCalcType === "cash" ? "Sales VAT (cash received)" : "Sales VAT (from clients)", data.salesVat.toFixed(2)],
      ["B", vatCalcType === "cash" ? "Purchases VAT (classified vendors)" : "VATable Purchases VAT", data.generalPurchasesVat.toFixed(2)],
      ["C", vatCalcType === "cash" ? "Supplier VAT (cash paid to VAT-registered)" : "Supplier VAT (self-billing)", data.supplierVat.toFixed(2)],
      ["", "Net VAT (A - (B + C))", data.netVat.toFixed(2)],
      [""],
      ["", "Sales Net (ex VAT)", data.salesNet.toFixed(0)],
      ["", "Supplier Net (ex VAT)", data.supplierNet.toFixed(0)],
      ["", "General Purchases Net (ex VAT)", data.generalNet.toFixed(0)],
      ["", "Box 7 — Total Value of Purchases (ex VAT, excl. wages)", (data.box7 ?? (data.supplierNet + data.generalNet)).toFixed(0)],
      ["", "Wages excluded from VAT (memo only)", Number(data.wagesTotal || 0).toFixed(2)],
      [""],
      ["Monthly Breakdown"],
      ["Month", "Sales VAT", "Supplier VAT", "General Purchases VAT", "Net VAT"],
      ...data.monthlyBreakdown.map((m: any) => [
        m.month,
        m.outputVat.toFixed(2),
        m.inputVatSupplier.toFixed(2),
        m.inputVatGeneral.toFixed(2),
        (m.outputVat - (m.inputVatGeneral + m.inputVatSupplier)).toFixed(2),
      ]),
    ];
    if (data.generalPurchasesByCategory?.length > 0) {
      rows.push([""], ["General Purchases by Category"], ["Category", "Net", "VAT", "Count"]);
      data.generalPurchasesByCategory.forEach((c: any) => {
        rows.push([c.expense_category, parseFloat(c.net_total).toFixed(2), parseFloat(c.vat_total).toFixed(2), c.count]);
      });
    }
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `vat-return-${data.quarter}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-wrap">
          <Label>Year</Label>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[100px]" data-testid="select-vat-year"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[...years].reverse().map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label>Quarter</Label>
          <Select value={selectedQuarterNum} onValueChange={setSelectedQuarterNum}>
            <SelectTrigger className="w-[180px]" data-testid="select-vat-quarter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Q1 (Nov-Jan)</SelectItem>
              <SelectItem value="2">Q2 (Feb-Apr)</SelectItem>
              <SelectItem value="3">Q3 (May-Jul)</SelectItem>
              <SelectItem value="4">Q4 (Aug-Oct)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border rounded-md px-3 py-1.5">
            <Label className="text-xs font-medium whitespace-nowrap">VAT Basis</Label>
            <div className="flex items-center gap-1.5">
              <span className={`text-xs ${vatCalcType === "accrual" ? "font-bold" : "text-muted-foreground"}`}>Accrual</span>
              <Switch
                checked={vatCalcType === "cash"}
                onCheckedChange={(checked) => toggleVatType(checked ? "cash" : "accrual")}
                data-testid="switch-vat-basis"
              />
              <span className={`text-xs ${vatCalcType === "cash" ? "font-bold" : "text-muted-foreground"}`}>Cash</span>
            </div>
          </div>
          {vatCalcType === "cash" && (
            <Button variant="outline" size="sm" onClick={() => setShowVendorDialog(true)} data-testid="button-classify-vendors">
              <Store className="h-4 w-4 mr-1" /> Classify Vendors
              {(data?.unclassifiedVendorCount || 0) > 0 && (
                <Badge variant="destructive" className="ml-1.5 text-xs px-1.5">{data.unclassifiedVendorCount}</Badge>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={downloadCSV} disabled={!data} data-testid="button-export-vat">
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(`/api/accounting/vat-return/export/pdf?quarter=${selectedQuarter}`, "_blank")}
            disabled={!data}
            data-testid="button-export-vat-pdf"
          >
            <FileDown className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </div>

      {vatQuery.isLoading ? (
        <div className="py-12 text-center"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" /> A — Sales VAT</div>
                <div className="text-2xl font-bold font-mono mt-1" data-testid="text-sales-vat">£{data.salesVat.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{vatCalcType === "cash" ? "VAT on cash received" : "VAT on client invoices"}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-red-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingDown className="h-4 w-4" /> B — Purchases VAT</div>
                <div className="text-2xl font-bold font-mono mt-1" data-testid="text-purchases-vat">£{data.generalPurchasesVat.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{vatCalcType === "cash" ? "VAT on classified purchase payments" : "VAT on VATable purchases"}</div>
              </CardContent>
            </Card>
            <Card className="border-l-4 border-l-indigo-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><TrendingUp className="h-4 w-4" /> C — Supplier VAT</div>
                <div className="text-2xl font-bold font-mono mt-1" data-testid="text-supplier-vat">£{data.supplierVat.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">{vatCalcType === "cash" ? "VAT on supplier payments (VAT-registered)" : "VAT on self-billing invoices"}</div>
              </CardContent>
            </Card>
            <Card className={`border-l-4 ${data.netVat >= 0 ? 'border-l-orange-500' : 'border-l-green-500'}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Minus className="h-4 w-4" /> Net VAT (A − (B + C))</div>
                <div className={`text-2xl font-bold font-mono mt-1 ${data.netVat >= 0 ? 'text-orange-600' : 'text-green-600'}`} data-testid="text-net-vat">
                  {data.netVat >= 0 ? '' : '-'}£{Math.abs(data.netVat).toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">{data.netVat >= 0 ? 'Owed to HMRC' : 'Refund due from HMRC'}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Sales Net (ex VAT)</div>
                <div className="text-xl font-bold font-mono" data-testid="text-sales-net">£{data.salesNet.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">Supplier Net (ex VAT)</div>
                <div className="text-xl font-bold font-mono" data-testid="text-supplier-net">£{data.supplierNet.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground">General Purchases Net (ex VAT)</div>
                <div className="text-xl font-bold font-mono" data-testid="text-general-net">£{data.generalNet.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-l-4 border-l-slate-400 bg-muted/30">
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="text-sm font-medium flex items-center gap-2">
                  <Minus className="h-4 w-4 text-muted-foreground" /> Wages excluded from VAT
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Memo only — wages are not included in Box 7 (total value of purchases) and carry no input VAT.
                  {typeof data.wagesCount === "number" && data.wagesCount > 0 ? ` Based on ${data.wagesCount} ledger entr${data.wagesCount === 1 ? "y" : "ies"} this period.` : ""}
                </div>
              </div>
              <div className="text-xl font-bold font-mono whitespace-nowrap" data-testid="text-wages-excluded">
                £{Number(data.wagesTotal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Month</th>
                    <th className="text-right p-3 font-medium">Sales VAT (A)</th>
                    <th className="text-right p-3 font-medium">Purchases VAT (B)</th>
                    <th className="text-right p-3 font-medium">Supplier VAT (C)</th>
                    <th className="text-right p-3 font-medium">Net VAT (A−(B+C))</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthlyBreakdown.map((m: any) => {
                    const netPosition = m.outputVat - (m.inputVatGeneral + m.inputVatSupplier);
                    return (
                      <tr key={m.month} className="border-b" data-testid={`row-month-${m.month}`}>
                        <td className="p-3 font-medium">{m.month}</td>
                        <td className="p-3 text-right font-mono">£{m.outputVat.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">£{m.inputVatGeneral.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">£{m.inputVatSupplier.toFixed(2)}</td>
                        <td className={`p-3 text-right font-mono font-bold ${netPosition >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                          {netPosition >= 0 ? '' : '-'}£{Math.abs(netPosition).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>

          {data.generalPurchasesByCategory?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">General Purchases by Category</CardTitle></CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Category</th>
                      <th className="text-right p-3 font-medium">Net Total</th>
                      <th className="text-right p-3 font-medium">VAT Total</th>
                      <th className="text-right p-3 font-medium">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.generalPurchasesByCategory.map((c: any) => (
                      <tr key={c.expense_category} className="border-b" data-testid={`row-category-${c.expense_category}`}>
                        <td className="p-3">{c.expense_category}</td>
                        <td className="p-3 text-right font-mono">£{parseFloat(c.net_total).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono">£{parseFloat(c.vat_total).toFixed(2)}</td>
                        <td className="p-3 text-right">{c.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      <Dialog open={showVendorDialog} onOpenChange={setShowVendorDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Vendor Classifications</DialogTitle>
            <DialogDescription>Classify vendors as VAT-qualifying or non-VAT to determine which purchases include reclaimable VAT.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 pb-2">
            <Button size="sm" variant="outline" onClick={autoClassifyVendors} data-testid="button-auto-classify">
              <Sparkles className="h-4 w-4 mr-1" /> Auto-classify personal names as Non-VAT
            </Button>
          </div>
          <Tabs defaultValue="unclassified" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="unclassified">
                Unclassified
                {(unclassifiedQuery.data as any[])?.length > 0 && (
                  <Badge variant="destructive" className="ml-1.5 text-xs px-1.5">{(unclassifiedQuery.data as any[]).length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="classified">Classified</TabsTrigger>
            </TabsList>
            <TabsContent value="unclassified" className="flex-1 overflow-auto mt-2">
              {unclassifiedQuery.isLoading ? (
                <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (unclassifiedQuery.data as any[])?.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">All vendors classified</div>
              ) : (
                <>
                  {selectedVendors.size > 0 && (
                    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md mb-2">
                      <span className="text-sm font-medium">{selectedVendors.size} selected</span>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-green-700 border-green-300 hover:bg-green-50" onClick={() => bulkClassifyVendors(true)} data-testid="button-bulk-vat-yes">
                        <Check className="h-3 w-3 mr-1" /> Mark as VAT
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs px-3 text-red-700 border-red-300 hover:bg-red-50" onClick={() => bulkClassifyVendors(false)} data-testid="button-bulk-vat-no">
                        <X className="h-3 w-3 mr-1" /> Mark as Non-VAT
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setSelectedVendors(new Set())} data-testid="button-clear-selection">
                        Clear
                      </Button>
                    </div>
                  )}
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-2 w-8">
                          <Checkbox
                            checked={selectedVendors.size === (unclassifiedQuery.data as any[])?.length && selectedVendors.size > 0}
                            onCheckedChange={toggleSelectAll}
                            data-testid="checkbox-select-all-vendors"
                          />
                        </th>
                        <th className="text-left p-2 font-medium">Vendor</th>
                        <th className="text-right p-2 font-medium">Transactions</th>
                        <th className="text-right p-2 font-medium">Total</th>
                        <th className="text-center p-2 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(unclassifiedQuery.data as any[])?.map((v: any) => (
                        <tr key={v.vendor_name} className={`border-b hover:bg-muted/30 ${selectedVendors.has(v.vendor_name) ? "bg-blue-50 dark:bg-blue-950/20" : ""}`} data-testid={`row-vendor-${v.vendor_name}`}>
                          <td className="p-2">
                            <Checkbox
                              checked={selectedVendors.has(v.vendor_name)}
                              onCheckedChange={() => toggleVendorSelection(v.vendor_name)}
                              data-testid={`checkbox-vendor-${v.vendor_name}`}
                            />
                          </td>
                          <td className="p-2 font-medium text-xs">{v.vendor_name}</td>
                          <td className="p-2 text-right font-mono text-xs">{v.transaction_count}</td>
                          <td className="p-2 text-right font-mono text-xs">£{parseFloat(v.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                          <td className="p-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-green-700 border-green-300 hover:bg-green-50" onClick={() => classifyVendor(v.vendor_name, true)} data-testid={`button-vat-yes-${v.vendor_name}`}>
                                <Check className="h-3 w-3 mr-1" /> VAT
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-xs px-2 text-red-700 border-red-300 hover:bg-red-50" onClick={() => classifyVendor(v.vendor_name, false)} data-testid={`button-vat-no-${v.vendor_name}`}>
                                <X className="h-3 w-3 mr-1" /> No VAT
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </TabsContent>
            <TabsContent value="classified" className="flex-1 overflow-auto mt-2">
              {classifiedQuery.isLoading ? (
                <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (classifiedQuery.data as any[])?.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No vendors classified yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-2 font-medium">Vendor</th>
                      <th className="text-center p-2 font-medium">VAT Status</th>
                      <th className="text-center p-2 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(classifiedQuery.data as any[])?.map((v: any) => (
                      <tr key={v.vendor_name} className="border-b hover:bg-muted/30">
                        <td className="p-2 font-medium text-xs">{v.vendor_name}</td>
                        <td className="p-2 text-center">
                          <Badge variant={v.vat_qualifying ? "default" : "secondary"} className="text-xs">
                            {v.vat_qualifying ? "VAT Qualifying" : "Non-VAT"}
                          </Badge>
                        </td>
                        <td className="p-2 text-center">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => classifyVendor(v.vendor_name, !v.vat_qualifying)}>
                            Switch to {v.vat_qualifying ? "Non-VAT" : "VAT"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseVendorsTab() {
  const { toast } = useToast();
  const [showDialog, setShowDialog] = useState(false);
  const [editVendor, setEditVendor] = useState<any>(null);
  const [expandedVendor, setExpandedVendor] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", vatRegistered: false, vatNumber: "", defaultExpenseCategory: "",
    bankName: "", accountName: "", sortCode: "", accountNumber: "",
  });

  const vendorsQuery = useQuery({ queryKey: ["/api/accounting/purchase-vendors"] });
  const vendorTransactionsQuery = useQuery({
    queryKey: ["/api/accounting/purchase-vendors", expandedVendor, "transactions"],
    queryFn: async () => {
      if (!expandedVendor) return [];
      const res = await fetch(`/api/accounting/purchase-vendors/${expandedVendor}/transactions`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!expandedVendor,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounting/purchase-vendors", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vendor Created" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/purchase-vendors"] });
      setShowDialog(false);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await apiRequest("PATCH", `/api/accounting/purchase-vendors/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vendor Updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/purchase-vendors"] });
      setShowDialog(false);
      setEditVendor(null);
      resetForm();
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/accounting/purchase-vendors/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Vendor Deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/purchase-vendors"] });
    },
    onError: (err: any) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => setForm({ name: "", vatRegistered: false, vatNumber: "", defaultExpenseCategory: "", bankName: "", accountName: "", sortCode: "", accountNumber: "" });

  const openEdit = (v: any) => {
    setEditVendor(v);
    setForm({
      name: v.name || "", vatRegistered: v.vat_registered || false, vatNumber: v.vat_number || "",
      defaultExpenseCategory: v.default_expense_category || "", bankName: v.bank_name || "",
      accountName: v.account_name || "", sortCode: v.sort_code || "", accountNumber: v.account_number || "",
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) return toast({ title: "Name required", variant: "destructive" });
    if (editVendor) {
      updateMutation.mutate({ id: editVendor.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const vendorsList: any[] = vendorsQuery.data || [];
  const vendorTxns: any[] = vendorTransactionsQuery.data || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2" data-testid="text-vendors-title">
          <Store className="h-5 w-5" /> Purchase Vendors
        </h2>
        <Button onClick={() => { resetForm(); setEditVendor(null); setShowDialog(true); }} data-testid="button-add-vendor">
          <Plus className="h-4 w-4 mr-1" /> Add Vendor
        </Button>
      </div>

      {vendorsQuery.isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : vendorsList.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">No purchase vendors yet. Add your first vendor to track purchases and VAT treatment.</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Name</th>
                  <th className="text-left p-3 font-medium">VAT Status</th>
                  <th className="text-left p-3 font-medium">Default Category</th>
                  <th className="text-left p-3 font-medium">Bank Details</th>
                  <th className="text-center p-3 font-medium">Transactions</th>
                  <th className="text-right p-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vendorsList.map((v: any) => (
                  <Fragment key={v.id}>
                    <tr className="border-b hover:bg-muted/30 cursor-pointer" onClick={() => setExpandedVendor(expandedVendor === v.id ? null : v.id)} data-testid={`row-vendor-${v.id}`}>
                      <td className="p-3 font-medium">{v.name}</td>
                      <td className="p-3">
                        <Badge variant="outline" className={v.vat_registered ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'}>
                          {v.vat_registered ? 'VAT Registered' : 'Not VAT Registered'}
                        </Badge>
                        {v.vat_number && <span className="text-xs text-muted-foreground ml-2">{v.vat_number}</span>}
                      </td>
                      <td className="p-3">{v.default_expense_category || <span className="text-muted-foreground">-</span>}</td>
                      <td className="p-3 text-xs">
                        {v.sort_code || v.account_number ? (
                          <span>{v.sort_code && <span>SC: {v.sort_code}</span>} {v.account_number && <span className="ml-2">Acc: {v.account_number}</span>}</span>
                        ) : <span className="text-muted-foreground">-</span>}
                      </td>
                      <td className="p-3 text-center"><Badge variant="secondary">{v.transaction_count || 0}</Badge></td>
                      <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(v)} data-testid={`button-edit-vendor-${v.id}`}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-600" onClick={() => deleteMutation.mutate(v.id)} data-testid={`button-delete-vendor-${v.id}`}><Trash2 className="h-3 w-3" /></Button>
                      </td>
                    </tr>
                    {expandedVendor === v.id && (
                      <tr key={`${v.id}-txns`}>
                        <td colSpan={6} className="p-3 bg-muted/20">
                          <div className="text-xs font-medium mb-2">Linked Transactions</div>
                          {vendorTransactionsQuery.isLoading ? (
                            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
                          ) : vendorTxns.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No transactions linked to this vendor yet.</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead><tr className="border-b"><th className="text-left p-2">Date</th><th className="text-left p-2">Description</th><th className="text-right p-2">Amount</th><th className="text-left p-2">Category</th></tr></thead>
                              <tbody>
                                {vendorTxns.map((t: any) => (
                                  <tr key={t.id} className="border-b" data-testid={`row-vendor-txn-${t.id}`}>
                                    <td className="p-2">{String(t.transaction_date).split('T')[0]}</td>
                                    <td className="p-2 max-w-[200px] truncate" title={t.description || ''}>{t.description}</td>
                                    <td className={`p-2 text-right font-mono ${parseFloat(t.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}>£{Math.abs(parseFloat(t.amount)).toFixed(2)}</td>
                                    <td className="p-2">{t.expense_category || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => { if (!open) { setShowDialog(false); setEditVendor(null); resetForm(); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editVendor ? 'Edit Vendor' : 'Add Purchase Vendor'}</DialogTitle>
            <DialogDescription>Manage vendor details and VAT treatment for purchase tracking.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Vendor Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Amazon Business" data-testid="input-vendor-name" />
            </div>
            <div className="flex items-center justify-between">
              <Label>VAT Registered</Label>
              <Switch checked={form.vatRegistered} onCheckedChange={(checked) => setForm({ ...form, vatRegistered: checked })} data-testid="switch-vat-registered" />
            </div>
            {form.vatRegistered && (
              <div>
                <Label>VAT Number</Label>
                <Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} placeholder="GB123456789" data-testid="input-vat-number" />
              </div>
            )}
            <div>
              <Label>Default Expense Category</Label>
              <Select value={form.defaultExpenseCategory} onValueChange={(val) => setForm({ ...form, defaultExpenseCategory: val })}>
                <SelectTrigger data-testid="select-expense-category"><SelectValue placeholder="Select category..." /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3 flex items-center gap-1"><CreditCard className="h-4 w-4" /> Bank Details</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Bank Name</Label>
                  <Input value={form.bankName} onChange={(e) => setForm({ ...form, bankName: e.target.value })} placeholder="e.g. Barclays" data-testid="input-bank-name" />
                </div>
                <div>
                  <Label>Account Name</Label>
                  <Input value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} placeholder="Account holder name" data-testid="input-account-name" />
                </div>
                <div>
                  <Label>Sort Code</Label>
                  <Input value={form.sortCode} onChange={(e) => setForm({ ...form, sortCode: e.target.value })} placeholder="12-34-56" data-testid="input-sort-code" />
                </div>
                <div>
                  <Label>Account Number</Label>
                  <Input value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value })} placeholder="12345678" data-testid="input-account-number" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowDialog(false); setEditVendor(null); resetForm(); }} data-testid="button-cancel-vendor">Cancel</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-save-vendor">
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editVendor ? 'Update' : 'Create'} Vendor
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function XeroSyncTab() {
  const { toast } = useToast();

  const { data: xeroConn, isLoading: connLoading } = useQuery<any>({
    queryKey: ["/api/xero/connection"],
    refetchInterval: 30000,
  });

  const { data: syncStatus, isLoading: statusLoading, refetch: refetchStatus } = useQuery<any>({
    queryKey: ["/api/xero/sync/status"],
    enabled: xeroConn?.status === "connected",
    refetchInterval: 60000,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/xero/sync");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/xero/sync/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/xero/connection"] });
      toast({ title: "Xero sync complete", description: `Contacts: ${data.contacts ?? 0}, Invoices: ${data.invoices ?? 0}, Payments: ${data.payments ?? 0}` });
    },
    onError: (err: Error) => {
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  if (connLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (xeroConn?.status !== "connected") {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-3">
          <Link2 className="w-10 h-10 mx-auto text-muted-foreground" />
          <p className="text-base font-medium">Xero is not connected</p>
          <p className="text-sm text-muted-foreground">Go to <strong>Settings → Integrations</strong> to connect your Xero organisation.</p>
        </CardContent>
      </Card>
    );
  }

  const statusColor = (s: string) =>
    s === "synced" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
    : s === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#13B5EA]/10 flex items-center justify-center">
                <span className="text-[#13B5EA] font-bold text-sm">X</span>
              </div>
              <span className="font-semibold">{xeroConn.xeroTenantName || "Xero"}</span>
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                <CheckCircle2 className="w-3 h-3 mr-1" /> Connected
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pl-10">
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Last synced: {xeroConn.lastSyncedAt ? new Date(xeroConn.lastSyncedAt).toLocaleString("en-GB") : "Never"}</span>
              <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Auto-sync: {xeroConn.syncEnabled ? `Every ${xeroConn.syncIntervalMinutes} min` : "Off"}</span>
            </div>
          </div>
          <Button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            data-testid="button-xero-manual-sync"
          >
            {syncMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sync Now
          </Button>
        </CardContent>
      </Card>

      {xeroConn.lastError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/10 p-3 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div><span className="font-medium">Last error:</span> {xeroConn.lastError}</div>
        </div>
      )}

      {statusLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : syncStatus ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sync Records</CardTitle>
              <div className="flex gap-3 text-sm">
                <span className="text-green-600 font-medium">{syncStatus.synced} synced</span>
                <span className="text-amber-600 font-medium">{syncStatus.pending} pending</span>
                <span className="text-red-600 font-medium">{syncStatus.error} errors</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {syncStatus.records && syncStatus.records.length > 0 ? (
              <div className="divide-y">
                {syncStatus.records.slice(0, 50).map((r: any) => (
                  <div key={`${r.entityType}-${r.entityId}`} className="flex items-center justify-between px-5 py-3 text-sm" data-testid={`row-xero-sync-${r.entityType}-${r.entityId}`}>
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline" className="text-xs shrink-0">{r.entityType}</Badge>
                      <span className="font-medium text-muted-foreground">#{r.entityId}</span>
                      {r.xeroId && <span className="text-xs text-muted-foreground truncate">Xero: {r.xeroId}</span>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {r.syncedAt && <span className="text-xs text-muted-foreground">{new Date(r.syncedAt).toLocaleDateString("en-GB")}</span>}
                      <Badge className={`text-xs ${statusColor(r.syncStatus)}`}>{r.syncStatus}</Badge>
                      {r.syncStatus === "error" && (
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={async () => {
                          await apiRequest("POST", `/api/xero/sync/retry/${r.entityType}/${r.entityId}`);
                          refetchStatus();
                        }}>Retry</Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">No sync records yet. Click Sync Now to push data to Xero.</div>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default function AccountingPage() {
  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
          <Calculator className="h-6 w-6" /> Accounting
        </h1>
        <p className="text-muted-foreground mt-1">Bank statements, payment allocation, client invoicing, and VAT returns</p>
      </div>

      <Tabs defaultValue="bank-statements">
        <TabsList className="mb-4" data-testid="tabs-accounting">
          <TabsTrigger value="bank-statements" data-testid="tab-bank-statements">Bank Statements</TabsTrigger>
          <TabsTrigger value="allocations" data-testid="tab-allocations">Allocation Overview</TabsTrigger>
          <TabsTrigger value="client-invoices" data-testid="tab-client-invoices">Client Invoices</TabsTrigger>
          <TabsTrigger value="purchase-vendors" data-testid="tab-purchase-vendors">Purchase Vendors</TabsTrigger>
          <TabsTrigger value="vat-returns" data-testid="tab-vat-returns">VAT Returns</TabsTrigger>
          <TabsTrigger value="xero-sync" data-testid="tab-xero-sync">Xero Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="bank-statements">
          <BankStatementsTab />
        </TabsContent>

        <TabsContent value="allocations">
          <AllocationOverviewTab />
        </TabsContent>

        <TabsContent value="client-invoices">
          <ClientInvoicesTab />
        </TabsContent>

        <TabsContent value="purchase-vendors">
          <PurchaseVendorsTab />
        </TabsContent>

        <TabsContent value="vat-returns">
          <VATReturnTab />
        </TabsContent>

        <TabsContent value="xero-sync">
          <XeroSyncTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
