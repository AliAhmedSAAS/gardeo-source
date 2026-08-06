import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  FileText, Plus, Loader2, Trash2, Receipt, CreditCard, CalendarRange,
  CheckCircle2, Building2, ChevronDown, ChevronRight, ChevronLeft, Send, Calendar, Banknote, Download, RefreshCw, Eye, Undo2, AlertTriangle, Pencil, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";

type EnrichedInvoice = {
  id: number;
  invoiceNumber: string;
  invoiceType: string | null;
  supplierId: number;
  periodStart: string;
  periodEnd: string;
  totalAmount: string;
  status: string | null;
  supplierName: string | null;
  createdAt: string | null;
  issuedAt: string | null;
  generatedAt: string | null;
  vatRate: string | null;
};

type Supplier = {
  id: number;
  companyName: string;
  selfBillingAgreementStatus: string | null;
};

type RateCard = {
  id: number;
  supplierId: number;
  supplierName?: string;
  siteName?: string | null;
  siteId?: number | null;
  employeeId?: number | null;
  employeeName?: string | null;
  roleType: string;
  hourlyRate: string;
  overtimeRate: string | null;
  effectiveFrom: string;
  effectiveTo: string | null;
};

type LineItem = {
  id: number;
  invoiceId: number;
  shiftId: number | null;
  description: string;
  hours: string;
  rate: string;
  subtotal: string;
  vatRate: string;
  vatAmount: string;
  lineTotal: string;
};

type GenerateResult = {
  invoiceNumber: string;
  totalAmount: string;
};

type PreviewShift = {
  shiftId: number;
  date: string;
  siteName: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  rate: number;
  amount: number;
  title: string;
};

type RateBreakdownItem = {
  rate: number;
  shifts: number;
  hours: number;
  amount: number;
};

type PreviewSummary = {
  totalShifts: number;
  totalHours: number;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalAmount: number;
  rateBreakdown?: RateBreakdownItem[];
};

type PreviewResult = {
  shifts: PreviewShift[];
  allShiftIds?: number[];
  total: number;
  page: number;
  limit: number;
  summary: PreviewSummary;
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  paid: { label: "Paid", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400" },
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

export default function SelfBillingPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("invoices");
  const [rateCardDialogOpen, setRateCardDialogOpen] = useState(false);
  const [editingRateCard, setEditingRateCard] = useState<RateCard | null>(null);

  const [generateForm, setGenerateForm] = useState({
    supplierId: "",
    periodStart: "",
    periodEnd: "",
  });
  const [generateResult, setGenerateResult] = useState<GenerateResult | null>(null);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [selectedShiftIds, setSelectedShiftIds] = useState<Set<number>>(new Set());
  const [previewPage, setPreviewPage] = useState(1);
  const previewLimit = 100;

  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [confirmIssueId, setConfirmIssueId] = useState<number | null>(null);
  const [confirmMarkPaidId, setConfirmMarkPaidId] = useState<number | null>(null);
  const [paymentDateDialogId, setPaymentDateDialogId] = useState<number | null>(null);
  const [paymentDateForm, setPaymentDateForm] = useState({ dueDate: "", paymentDate: "" });

  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [renewForm, setRenewForm] = useState({ supplierId: "", years: "2" });

  const [creditNoteDialogId, setCreditNoteDialogId] = useState<number | null>(null);
  const [creditNoteReason, setCreditNoteReason] = useState("");

  const [invoiceSupplierFilter, setInvoiceSupplierFilter] = useState<string>("all");
  const [invoiceVatFilter, setInvoiceVatFilter] = useState<string>("all");
  const [invoiceDateFrom, setInvoiceDateFrom] = useState("");
  const [invoiceDateTo, setInvoiceDateTo] = useState("");

  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkDeleteSelection, setBulkDeleteSelection] = useState<Set<number>>(new Set());

  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [recordPaymentSelected, setRecordPaymentSelected] = useState<Set<number>>(new Set());
  const [recordPaymentBankRef, setRecordPaymentBankRef] = useState("");
  const [recordPaymentDate, setRecordPaymentDate] = useState("");
  const [rpSupplierFilter, setRpSupplierFilter] = useState<string>("all");
  const [rpSelectedTxnId, setRpSelectedTxnId] = useState<number | null>(null);
  const [batchPdfLoading, setBatchPdfLoading] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>("invoiceNumber");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const [rateCardForm, setRateCardForm] = useState({
    supplierId: "",
    siteId: "",
    employeeId: "",
    roleType: "",
    hourlyRate: "",
    overtimeRate: "",
    effectiveFrom: "",
    effectiveTo: "",
  });

  const { data: allInvoices = [], isLoading: invoicesLoading } = useQuery<EnrichedInvoice[]>({
    queryKey: ["/api/invoices"],
  });

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: rateCards = [], isLoading: rateCardsLoading } = useQuery<RateCard[]>({
    queryKey: ["/api/rate-cards"],
  });

  type AddressAuditItem = {
    id: number;
    companyName: string;
    supplierCode: string;
    vatNumber: string | null;
    agreementAddress: string;
    currentAddress: string;
    agreementSignedAt: string | null;
    agreementExpiry: string | null;
    invoiceCount: number;
  };
  type AddressAuditData = { mismatchCount: number; suppliers: AddressAuditItem[] };
  const { data: addressAudit, isLoading: addressAuditLoading, isError: addressAuditError } = useQuery<AddressAuditData>({
    queryKey: ["/api/self-billing/address-audit"],
    enabled: activeTab === "address-audit",
  });

  type BankTxn = {
    id: number;
    transactionDate: string;
    description: string;
    amount: string;
    allocatedAmount: string;
    isAllocated: boolean;
  };
  const { data: rpBankTxns = [] } = useQuery<BankTxn[]>({
    queryKey: ["/api/accounting/supplier-transactions", rpSupplierFilter],
    queryFn: async () => {
      if (!rpSupplierFilter || rpSupplierFilter === "all") return [];
      const res = await fetch(`/api/accounting/supplier-transactions/${rpSupplierFilter}?unallocated=true`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: recordPaymentOpen && rpSupplierFilter !== "all",
  });

  const [siteSearch, setSiteSearch] = useState("");
  const [siteSearchResults, setSiteSearchResults] = useState<any[]>([]);
  const [selectedSiteName, setSelectedSiteName] = useState("");
  const [showSiteDropdown, setShowSiteDropdown] = useState(false);
  const siteSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const siteDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (siteSearchTimerRef.current) clearTimeout(siteSearchTimerRef.current);
    if (siteSearch.length < 2) { setSiteSearchResults([]); return; }
    siteSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sites/search?q=${encodeURIComponent(siteSearch)}&limit=20`);
        if (res.ok) setSiteSearchResults(await res.json());
      } catch {}
    }, 300);
    return () => { if (siteSearchTimerRef.current) clearTimeout(siteSearchTimerRef.current); };
  }, [siteSearch]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (siteDropdownRef.current && !siteDropdownRef.current.contains(e.target as Node)) {
        setShowSiteDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const rcSelectedSupplierId = rateCardForm.supplierId ? parseInt(rateCardForm.supplierId) : null;
  const { data: rcSupplierEmployees = [] } = useQuery<any[]>({
    queryKey: ["/api/suppliers", rcSelectedSupplierId, "employees"],
    queryFn: async () => {
      const res = await fetch(`/api/suppliers/${rcSelectedSupplierId}/employees`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!rcSelectedSupplierId,
  });

  const { data: lineItems = [], isLoading: lineItemsLoading } = useQuery<LineItem[]>({
    queryKey: ["/api/invoices", expandedInvoiceId, "line-items"],
    queryFn: async () => {
      const res = await fetch(`/api/invoices/${expandedInvoiceId}/line-items`);
      if (!res.ok) throw new Error("Failed to fetch line items");
      return res.json();
    },
    enabled: !!expandedInvoiceId,
  });

  const selfBilledInvoices = allInvoices.filter((inv) => inv.invoiceType === "self_billed");
  const filteredInvoices = selfBilledInvoices.filter((inv) => {
    if (invoiceSupplierFilter !== "all" && inv.supplierId !== parseInt(invoiceSupplierFilter)) return false;
    if (invoiceVatFilter === "vat" && parseFloat(inv.vatRate || "0") === 0) return false;
    if (invoiceVatFilter === "non-vat" && parseFloat(inv.vatRate || "0") > 0) return false;
    if (invoiceDateFrom) {
      const endDate = new Date(inv.periodEnd);
      const fromDate = new Date(invoiceDateFrom);
      if (endDate < fromDate) return false;
    }
    if (invoiceDateTo) {
      const startDate = new Date(inv.periodStart);
      const toDate = new Date(invoiceDateTo);
      if (startDate > toDate) return false;
    }
    return true;
  }).sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    switch (sortColumn) {
      case "invoiceNumber": return dir * a.invoiceNumber.localeCompare(b.invoiceNumber);
      case "supplier": return dir * (a.supplierName || "").localeCompare(b.supplierName || "");
      case "period": return dir * (a.periodStart || "").localeCompare(b.periodStart || "");
      case "amount": return dir * (parseFloat(a.totalAmount || "0") - parseFloat(b.totalAmount || "0"));
      case "status": return dir * (a.status || "").localeCompare(b.status || "");
      case "dateGenerated": {
        const da = a.generatedAt || a.createdAt || "";
        const db = b.generatedAt || b.createdAt || "";
        return dir * da.localeCompare(db);
      }
      default: return 0;
    }
  });
  const invoiceSupplierOptions = Array.from(new Map(selfBilledInvoices.map((inv) => [inv.supplierId, inv.supplierName || `Supplier #${inv.supplierId}`])).entries()).sort((a, b) => a[1].localeCompare(b[1]));
  const hasActiveFilters = invoiceSupplierFilter !== "all" || invoiceVatFilter !== "all" || invoiceDateFrom !== "" || invoiceDateTo !== "";
  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };
  const SortIcon = ({ col }: { col: string }) => {
    if (sortColumn !== col) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40" />;
    return sortDirection === "asc" ? <ArrowUp className="w-3.5 h-3.5 ml-1" /> : <ArrowDown className="w-3.5 h-3.5 ml-1" />;
  };
  const activeSuppliers = suppliers.filter((s) => s.selfBillingAgreementStatus === "active");

  const issueMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/issue`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setConfirmIssueId(null);
      toast({ title: "Invoice Issued", description: "The invoice has been issued successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const setPaymentDateMutation = useMutation({
    mutationFn: async ({ id, dueDate, paymentDate }: { id: number; dueDate: string; paymentDate: string }) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/set-payment-date`, { dueDate, paymentDate });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setPaymentDateDialogId(null);
      setPaymentDateForm({ dueDate: "", paymentDate: "" });
      toast({ title: "Payment Date Set", description: "The payment dates have been updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("PATCH", `/api/invoices/${id}/mark-paid`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setConfirmMarkPaidId(null);
      toast({ title: "Invoice Paid", description: "The invoice has been marked as paid." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async ({ invoiceIds, bankTransactionId, bankReference, datePaid }: { invoiceIds: number[]; bankTransactionId?: number; bankReference: string; datePaid: string }) => {
      const res = await apiRequest("POST", "/api/invoices/record-payment", { invoiceIds, bankTransactionId, bankReference, datePaid });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/supplier-transactions"] });
      setRecordPaymentOpen(false);
      setRecordPaymentSelected(new Set());
      setRecordPaymentBankRef("");
      setRecordPaymentDate("");
      setRpSupplierFilter("all");
      setRpSelectedTxnId(null);
      toast({ title: "Payment Recorded", description: `${data.count} invoice(s) allocated.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteInvoiceMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/invoices/${id}`);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setDeleteConfirmId(null);
      toast({ title: "Invoice Deleted", description: `Invoice ${data.invoiceNumber} deleted permanently.${data.allocationsRemoved > 0 ? ` ${data.allocationsRemoved} bank allocation(s) also removed.` : ""}` });
    },
    onError: (err: Error) => {
      toast({ title: "Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (invoiceIds: number[]) => {
      const res = await apiRequest("POST", "/api/invoices/bulk-delete", { invoiceIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setBulkDeleteDialogOpen(false);
      setBulkDeleteSelection(new Set());
      toast({ title: "Invoices Deleted", description: `${data.deletedCount} invoice(s) deleted (£${parseFloat(data.totalAmountDeleted).toLocaleString("en-GB", { minimumFractionDigits: 2 })}).${data.totalAllocationsRemoved > 0 ? ` ${data.totalAllocationsRemoved} bank allocation(s) also removed.` : ""}` });
    },
    onError: (err: Error) => {
      toast({ title: "Bulk Delete Failed", description: err.message, variant: "destructive" });
    },
  });

  const creditNoteMutation = useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: number; reason: string }) => {
      const res = await apiRequest("POST", `/api/invoices/${invoiceId}/credit-note`, { reason });
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/credit-notes"] });
      setCreditNoteDialogId(null);
      setCreditNoteReason("");
      toast({ title: "Credit Note Issued", description: `Credit note ${data.creditNoteNumber} issued. Invoice cancelled and shifts released for re-invoicing.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const { data: creditNotes = [] } = useQuery<Array<{ id: number; invoiceId: number; creditNoteNumber: string; reason: string; totalAmount: string; status: string }>>({
    queryKey: ["/api/credit-notes"],
  });

  const creditNotesByInvoiceId = new Map(creditNotes.map(cn => [cn.invoiceId, cn]));

  const previewMutation = useMutation({
    mutationFn: async (data: { supplierId: number; periodStart?: string; periodEnd?: string; page?: number; limit?: number }) => {
      const res = await apiRequest("POST", "/api/self-billing/preview", data);
      return res.json() as Promise<PreviewResult>;
    },
    onSuccess: (data: PreviewResult, variables) => {
      setPreviewData(data);
      if ((!variables.page || variables.page === 1) && data.allShiftIds) {
        setSelectedShiftIds(new Set(data.allShiftIds));
      }
      setGenerateResult(null);
    },
    onError: (err: Error) => {
      setPreviewData(null);
      toast({ title: "No Shifts Found", description: err.message, variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: { supplierId: number; periodStart: string; periodEnd: string; shiftIds?: number[] }) => {
      const res = await apiRequest("POST", "/api/self-billing/generate", data);
      return res.json();
    },
    onSuccess: (data: GenerateResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      setGenerateResult(data);
      setPreviewData(null);
      setSelectedShiftIds(new Set());
      toast({ title: "Invoice Generated", description: `Invoice ${data.invoiceNumber} created successfully.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createRateCardMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await apiRequest("POST", "/api/rate-cards", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      setRateCardDialogOpen(false);
      setRateCardForm({ supplierId: "", siteId: "", employeeId: "", roleType: "", hourlyRate: "", overtimeRate: "", effectiveFrom: "", effectiveTo: "" });
      toast({ title: "Rate Card Created", description: "The rate card has been added successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteRateCardMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/rate-cards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      toast({ title: "Rate Card Deleted", description: "The rate card has been removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateRateCardMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/rate-cards/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rate-cards"] });
      setRateCardDialogOpen(false);
      setEditingRateCard(null);
      setRateCardForm({ supplierId: "", siteId: "", employeeId: "", roleType: "", hourlyRate: "", overtimeRate: "", effectiveFrom: "", effectiveTo: "" });
      toast({ title: "Rate Card Updated", description: "The rate card has been updated successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const renewMutation = useMutation({
    mutationFn: async (data: { supplierId: number; years: number }) => {
      const res = await apiRequest("POST", "/api/self-billing/renew-agreement", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setRenewDialogOpen(false);
      setRenewForm({ supplierId: "", years: "2" });
      toast({ title: "Agreement Renewed", description: `${data.supplierName} agreement renewed until ${new Date(data.newExpiryDate).toLocaleDateString("en-GB")}.` });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleRenew = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!renewForm.supplierId) {
      toast({ title: "Missing Fields", description: "Please select a supplier.", variant: "destructive" });
      return;
    }
    renewMutation.mutate({ supplierId: parseInt(renewForm.supplierId), years: parseInt(renewForm.years) || 2 });
  };

  const triggerPreview = (supplierId: string, periodStart: string, periodEnd: string, pg?: number) => {
    if (!supplierId) return;
    setGenerateResult(null);
    const pageNum = pg || 1;
    if (!pg) setPreviewPage(1);
    const payload: { supplierId: number; periodStart?: string; periodEnd?: string; page: number; limit: number } = {
      supplierId: parseInt(supplierId),
      page: pageNum,
      limit: previewLimit,
    };
    if (periodStart && periodEnd) {
      payload.periodStart = periodStart;
      payload.periodEnd = periodEnd;
    }
    previewMutation.mutate(payload);
  };

  const prevSupplierRef = useRef(generateForm.supplierId);
  useEffect(() => {
    if (generateForm.supplierId && generateForm.supplierId !== prevSupplierRef.current) {
      prevSupplierRef.current = generateForm.supplierId;
      triggerPreview(generateForm.supplierId, generateForm.periodStart, generateForm.periodEnd);
    }
  }, [generateForm.supplierId]);

  const handlePreview = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!generateForm.supplierId) {
      toast({ title: "Missing Fields", description: "Please select a supplier.", variant: "destructive" });
      return;
    }
    triggerPreview(generateForm.supplierId, generateForm.periodStart, generateForm.periodEnd);
  };

  const handleConfirmGenerate = () => {
    if (selectedShiftIds.size === 0) {
      toast({ title: "No Shifts Selected", description: "Please select at least one shift to include in the invoice.", variant: "destructive" });
      return;
    }
    let { periodStart, periodEnd } = generateForm;
    if (!periodStart || !periodEnd) {
      if (previewData && previewData.shifts.length > 0) {
        const selectedShifts = previewData.shifts.filter(s => selectedShiftIds.has(s.shiftId));
        const dates = selectedShifts.map(s => s.date).sort();
        periodStart = dates[0];
        periodEnd = dates[dates.length - 1];
      }
    }
    if (!periodStart || !periodEnd) {
      toast({ title: "Missing Dates", description: "Please set period start and end dates, or select shifts to auto-determine the period.", variant: "destructive" });
      return;
    }
    generateMutation.mutate({
      supplierId: parseInt(generateForm.supplierId),
      periodStart,
      periodEnd,
      shiftIds: Array.from(selectedShiftIds),
    });
  };

  const toggleShiftSelection = (shiftId: number) => {
    setSelectedShiftIds(prev => {
      const next = new Set(prev);
      if (next.has(shiftId)) next.delete(shiftId);
      else next.add(shiftId);
      return next;
    });
  };

  const toggleAllShifts = () => {
    if (!previewData) return;
    if (selectedShiftIds.size === previewData.total) {
      setSelectedShiftIds(new Set());
    } else {
      setSelectedShiftIds(new Set(previewData.allShiftIds));
    }
  };

  const selectedSummary = previewData ? (() => {
    const selected = previewData.shifts.filter(s => selectedShiftIds.has(s.shiftId));
    const totalHours = selected.reduce((sum, s) => sum + s.hours, 0);
    const subtotal = selected.reduce((sum, s) => sum + s.amount, 0);
    const vatAmount = Math.round(subtotal * (previewData.summary.vatRate / 100) * 100) / 100;
    return {
      totalShifts: selected.length,
      totalHours: Math.round(totalHours * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      vatAmount,
      totalAmount: Math.round((subtotal + vatAmount) * 100) / 100,
    };
  })() : null;

  const handleEditRateCard = (rc: RateCard) => {
    setEditingRateCard(rc);
    setRateCardForm({
      supplierId: String(rc.supplierId),
      siteId: rc.siteId ? String(rc.siteId) : "",
      employeeId: rc.employeeId ? String(rc.employeeId) : "",
      roleType: rc.roleType,
      hourlyRate: rc.hourlyRate,
      overtimeRate: rc.overtimeRate || "",
      effectiveFrom: rc.effectiveFrom,
      effectiveTo: rc.effectiveTo || "",
    });
    setSelectedSiteName(rc.siteName || "");
    setSiteSearch("");
    setRateCardDialogOpen(true);
  };

  const handleCreateRateCard = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (!rateCardForm.supplierId || !rateCardForm.roleType || !rateCardForm.hourlyRate || !rateCardForm.effectiveFrom) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    const formData = {
      supplierId: parseInt(rateCardForm.supplierId),
      siteId: rateCardForm.siteId && rateCardForm.siteId !== "all" ? parseInt(rateCardForm.siteId) : null,
      employeeId: rateCardForm.employeeId && rateCardForm.employeeId !== "all" ? parseInt(rateCardForm.employeeId) : null,
      roleType: rateCardForm.roleType,
      hourlyRate: rateCardForm.hourlyRate,
      overtimeRate: rateCardForm.overtimeRate || null,
      effectiveFrom: rateCardForm.effectiveFrom,
      effectiveTo: rateCardForm.effectiveTo || null,
    };
    if (editingRateCard) {
      updateRateCardMutation.mutate({ id: editingRateCard.id, data: formData });
    } else {
      createRateCardMutation.mutate(formData);
    }
  };

  return (
    <div className="p-6 space-y-6" data-testid="self-billing-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1F3A5F, #FF8C42)" }}
        >
          <Receipt className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Self-Billing Management</h1>
          <p className="text-muted-foreground text-sm">
            Manage self-billing invoices, generate invoices from approved timesheets, and configure rate cards.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="tabs-self-billing">
        <TabsList data-testid="tabs-list">
          <TabsTrigger value="invoices" data-testid="tab-invoices">
            <FileText className="w-4 h-4 mr-2" />
            Self-Billing Invoices
          </TabsTrigger>
          <TabsTrigger value="generate" data-testid="tab-generate">
            <CalendarRange className="w-4 h-4 mr-2" />
            Generate Invoice
          </TabsTrigger>
          <TabsTrigger value="rate-cards" data-testid="tab-rate-cards">
            <CreditCard className="w-4 h-4 mr-2" />
            Rate Cards
          </TabsTrigger>
          <TabsTrigger value="address-audit" data-testid="tab-address-audit">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Address Audit
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" data-testid="tab-content-invoices">
          {!invoicesLoading && selfBilledInvoices.length > 0 && (
            <div className="flex flex-wrap items-end gap-4 mb-4" data-testid="invoice-filters">
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setRecordPaymentOpen(true);
                  setRecordPaymentSelected(new Set());
                  setRecordPaymentBankRef("");
                  setRecordPaymentDate("");
                }}
                data-testid="button-record-payment"
                className="self-end"
              >
                <Banknote className="w-4 h-4 mr-2" />
                Record Payment
              </Button>
              <div className="min-w-[220px]">
                <Label className="text-xs text-muted-foreground mb-1 block">Supplier</Label>
                <Select value={invoiceSupplierFilter} onValueChange={setInvoiceSupplierFilter}>
                  <SelectTrigger data-testid="filter-supplier">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Suppliers</SelectItem>
                    {invoiceSupplierOptions.map(([id, name]) => (
                      <SelectItem key={id} value={String(id)}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="min-w-[160px]">
                <Label className="text-xs text-muted-foreground mb-1 block">VAT Status</Label>
                <Select value={invoiceVatFilter} onValueChange={setInvoiceVatFilter}>
                  <SelectTrigger data-testid="filter-vat-status">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="vat">VAT Registered</SelectItem>
                    <SelectItem value="non-vat">Non-VAT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">From Date</Label>
                <Input
                  type="date"
                  value={invoiceDateFrom}
                  onChange={(e) => setInvoiceDateFrom(e.target.value)}
                  className="w-[160px]"
                  data-testid="filter-date-from"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">To Date</Label>
                <Input
                  type="date"
                  value={invoiceDateTo}
                  onChange={(e) => setInvoiceDateTo(e.target.value)}
                  className="w-[160px]"
                  data-testid="filter-date-to"
                />
              </div>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setInvoiceSupplierFilter("all"); setInvoiceVatFilter("all"); setInvoiceDateFrom(""); setInvoiceDateTo(""); }}
                  data-testid="button-clear-filters"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1" />
                  Clear Filters
                </Button>
              )}
              {hasActiveFilters && (
                <span className="text-xs text-muted-foreground" data-testid="text-filter-count">
                  Showing {filteredInvoices.length} of {selfBilledInvoices.length} invoices
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                className="ml-auto"
                onClick={() => {
                  const params = new URLSearchParams();
                  if (invoiceSupplierFilter !== "all") params.set("supplierId", invoiceSupplierFilter);
                  if (invoiceDateFrom) params.set("fromDate", invoiceDateFrom);
                  if (invoiceDateTo) params.set("toDate", invoiceDateTo);
                  window.open(`/api/invoices/export-csv?${params.toString()}`, "_blank");
                }}
                data-testid="button-export-csv-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV{hasActiveFilters ? " (Filtered)" : " (All)"}
              </Button>
            </div>
          )}
          {invoicesLoading ? (
            <Card>
              <CardContent className="p-8 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Loading invoices...</span>
              </CardContent>
            </Card>
          ) : selfBilledInvoices.length === 0 ? (
            <Card data-testid="card-empty-invoices">
              <CardContent className="p-8 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold" data-testid="text-empty-invoices">No Self-Billing Invoices</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Generate your first self-billing invoice from the "Generate Invoice" tab.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              {bulkDeleteSelection.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800" data-testid="toolbar-bulk-actions">
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    {bulkDeleteSelection.size} invoice{bulkDeleteSelection.size !== 1 ? "s" : ""} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const ids = Array.from(bulkDeleteSelection).join(",");
                      window.open(`/api/invoices/export-csv?ids=${ids}`, "_blank");
                    }}
                    data-testid="button-export-csv-selected"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Export CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={batchPdfLoading}
                    onClick={async () => {
                      setBatchPdfLoading(true);
                      try {
                        const response = await fetch("/api/invoices/batch-pdf", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          credentials: "include",
                          body: JSON.stringify({ invoiceIds: Array.from(bulkDeleteSelection) }),
                        });
                        if (!response.ok) throw new Error("Download failed");
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `invoices_batch_${new Date().toISOString().slice(0,10)}.zip`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        toast({ title: "Error", description: "Failed to download batch PDFs", variant: "destructive" });
                      } finally {
                        setBatchPdfLoading(false);
                      }
                    }}
                    data-testid="button-batch-pdf-selected"
                  >
                    {batchPdfLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                    Download PDFs
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    data-testid="button-bulk-delete"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Selected
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setBulkDeleteSelection(new Set())}
                    className="text-muted-foreground"
                    data-testid="button-clear-selection"
                  >
                    Clear Selection
                  </Button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-invoices">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 w-8">
                        <Checkbox
                          checked={filteredInvoices.length > 0 && filteredInvoices.every(inv => bulkDeleteSelection.has(inv.id))}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setBulkDeleteSelection(new Set(filteredInvoices.map(inv => inv.id)));
                            } else {
                              setBulkDeleteSelection(new Set());
                            }
                          }}
                          data-testid="checkbox-select-all-invoices"
                        />
                      </th>
                      <th className="p-3 w-8"></th>
                      <th className="p-3 font-medium text-muted-foreground w-12" data-testid="header-serial-number">#</th>
                      <th className="p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("invoiceNumber")} data-testid="sort-invoice-number">
                        <span className="inline-flex items-center">Invoice Number<SortIcon col="invoiceNumber" /></span>
                      </th>
                      <th className="p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("supplier")} data-testid="sort-supplier">
                        <span className="inline-flex items-center">Supplier<SortIcon col="supplier" /></span>
                      </th>
                      <th className="p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("period")} data-testid="sort-period">
                        <span className="inline-flex items-center">Period<SortIcon col="period" /></span>
                      </th>
                      <th className="p-3 font-medium text-muted-foreground text-right" data-testid="header-excl-vat">Excl. VAT</th>
                      <th className="p-3 font-medium text-muted-foreground text-right" data-testid="header-vat-amount">VAT</th>
                      <th className="p-3 font-medium text-muted-foreground text-right cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("amount")} data-testid="sort-amount">
                        <span className="inline-flex items-center justify-end">Amount (GBP)<SortIcon col="amount" /></span>
                      </th>
                      <th className="p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("status")} data-testid="sort-status">
                        <span className="inline-flex items-center">Status<SortIcon col="status" /></span>
                      </th>
                      <th className="p-3 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground" onClick={() => handleSort("dateGenerated")} data-testid="sort-date-generated">
                        <span className="inline-flex items-center">Date Generated<SortIcon col="dateGenerated" /></span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInvoices.map((inv, idx) => {
                      const statusConf = STATUS_BADGES[inv.status || "draft"] || STATUS_BADGES.draft;
                      const isExpanded = expandedInvoiceId === inv.id;
                      const isDraftOrPending = inv.status === "draft" || inv.status === "pending";
                      const isNotPaid = inv.status !== "paid";
                      return (
                        <>
                          <tr
                            key={inv.id}
                            className="border-b last:border-0 cursor-pointer hover-elevate"
                            data-testid={`row-invoice-${inv.id}`}
                            onClick={() => setExpandedInvoiceId(isExpanded ? null : inv.id)}
                          >
                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={bulkDeleteSelection.has(inv.id)}
                                onCheckedChange={(checked) => {
                                  setBulkDeleteSelection(prev => {
                                    const next = new Set(prev);
                                    if (checked) next.add(inv.id); else next.delete(inv.id);
                                    return next;
                                  });
                                }}
                                data-testid={`checkbox-invoice-${inv.id}`}
                              />
                            </td>
                            <td className="p-3">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                            </td>
                            <td className="p-3 text-muted-foreground text-sm" data-testid={`text-serial-${inv.id}`}>{idx + 1}</td>
                            <td className="p-3 font-medium" data-testid={`text-invoice-number-${inv.id}`}>{inv.invoiceNumber}</td>
                            <td className="p-3" data-testid={`text-supplier-${inv.id}`}>{inv.supplierName || "N/A"}</td>
                            <td className="p-3 text-muted-foreground">{formatDate(inv.periodStart)} - {formatDate(inv.periodEnd)}</td>
                            <td className="p-3 text-right text-muted-foreground" data-testid={`text-excl-vat-${inv.id}`}>{formatCurrency(inv.subtotal)}</td>
                            <td className="p-3 text-right text-muted-foreground" data-testid={`text-vat-amount-${inv.id}`}>{formatCurrency(inv.vatAmount)}</td>
                            <td className="p-3 text-right font-medium" data-testid={`text-amount-${inv.id}`}>{formatCurrency(inv.totalAmount)}</td>
                            <td className="p-3">
                              <Badge className={statusConf.className + " text-xs"} data-testid={`badge-status-${inv.id}`}>
                                {statusConf.label}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground" data-testid={`text-date-${inv.id}`}>{formatDate(inv.issuedAt || inv.createdAt)}</td>
                          </tr>
                          {isExpanded && (
                            <tr key={`detail-${inv.id}`} data-testid={`row-invoice-detail-${inv.id}`}>
                              <td colSpan={11} className="p-4 bg-muted/30">
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <h3 className="font-semibold" data-testid={`text-detail-title-${inv.id}`}>Invoice Details</h3>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {isDraftOrPending && (
                                        <Button
                                          size="sm"
                                          onClick={(e) => { e.stopPropagation(); setConfirmIssueId(inv.id); }}
                                          data-testid={`button-issue-invoice-${inv.id}`}
                                        >
                                          <Send className="w-4 h-4 mr-2" />
                                          Issue Invoice
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPaymentDateForm({ dueDate: "", paymentDate: "" });
                                          setPaymentDateDialogId(inv.id);
                                        }}
                                        data-testid={`button-set-payment-date-${inv.id}`}
                                      >
                                        <Calendar className="w-4 h-4 mr-2" />
                                        Set Payment Date
                                      </Button>
                                      {isNotPaid && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={(e) => { e.stopPropagation(); setConfirmMarkPaidId(inv.id); }}
                                          data-testid={`button-mark-paid-${inv.id}`}
                                        >
                                          <Banknote className="w-4 h-4 mr-2" />
                                          Mark as Paid
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          window.open(`/api/invoices/${inv.id}/pdf`, "_blank");
                                        }}
                                        data-testid={`button-download-pdf-${inv.id}`}
                                      >
                                        <Download className="w-4 h-4 mr-2" />
                                        Download PDF
                                      </Button>
                                      {inv.status !== "cancelled" && (
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setCreditNoteReason("");
                                            setCreditNoteDialogId(inv.id);
                                          }}
                                          data-testid={`button-credit-note-${inv.id}`}
                                        >
                                          <Undo2 className="w-4 h-4 mr-2" />
                                          Issue Credit Note
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setDeleteConfirmId(inv.id);
                                        }}
                                        data-testid={`button-delete-invoice-${inv.id}`}
                                      >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                      </Button>
                                    </div>
                                  </div>

                                  {creditNotesByInvoiceId.has(inv.id) && (
                                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md" data-testid={`credit-note-info-${inv.id}`}>
                                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                                      <div className="text-sm">
                                        <span className="font-medium text-amber-700 dark:text-amber-300">Credit Note Issued: </span>
                                        <span className="text-amber-600 dark:text-amber-400" data-testid={`text-credit-note-number-${inv.id}`}>
                                          {creditNotesByInvoiceId.get(inv.id)?.creditNoteNumber}
                                        </span>
                                        <span className="text-muted-foreground ml-2">— {creditNotesByInvoiceId.get(inv.id)?.reason}</span>
                                        <span className="text-muted-foreground ml-2">({formatCurrency(creditNotesByInvoiceId.get(inv.id)?.totalAmount || "0")})</span>
                                      </div>
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Status</span>
                                      <div className="mt-1">
                                        <Badge className={statusConf.className + " text-xs"} data-testid={`badge-detail-status-${inv.id}`}>
                                          {statusConf.label}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Issued Date</span>
                                      <p className="font-medium mt-1" data-testid={`text-issued-date-${inv.id}`}>{formatDate(inv.issuedAt || inv.createdAt)}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Period</span>
                                      <p className="font-medium mt-1">{formatDate(inv.periodStart)} - {formatDate(inv.periodEnd)}</p>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Total</span>
                                      <p className="font-medium mt-1" data-testid={`text-detail-total-${inv.id}`}>{formatCurrency(inv.totalAmount)}</p>
                                    </div>
                                  </div>

                                  <div>
                                    <h4 className="font-medium text-sm mb-2">Line Items</h4>
                                    {lineItemsLoading ? (
                                      <div className="flex items-center gap-2 py-4">
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        <span className="text-sm text-muted-foreground">Loading line items...</span>
                                      </div>
                                    ) : lineItems.length === 0 ? (
                                      <p className="text-sm text-muted-foreground py-2" data-testid={`text-no-line-items-${inv.id}`}>No line items found for this invoice.</p>
                                    ) : (
                                      <>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-sm" data-testid={`table-line-items-${inv.id}`}>
                                            <thead>
                                              <tr className="border-b text-left">
                                                <th className="p-2 font-medium text-muted-foreground">Date</th>
                                                <th className="p-2 font-medium text-muted-foreground">Site</th>
                                                <th className="p-2 font-medium text-muted-foreground text-right">Hours</th>
                                                <th className="p-2 font-medium text-muted-foreground text-right">Rate</th>
                                                <th className="p-2 font-medium text-muted-foreground text-right">Amount</th>
                                                <th className="p-2 font-medium text-muted-foreground text-right">VAT</th>
                                                <th className="p-2 font-medium text-muted-foreground text-right">Total</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {lineItems.map((li) => {
                                                const parts = (li.description || "").split(" — ");
                                                const dateStr = parts[0] || "";
                                                const siteName = parts[1] || li.description || "";
                                                const displayDate = dateStr.match(/^\d{4}-\d{2}-\d{2}$/) ? formatDate(dateStr) : dateStr;
                                                return (
                                                  <tr key={li.id} className="border-b last:border-0" data-testid={`row-line-item-${li.id}`}>
                                                    <td className="p-2 whitespace-nowrap" data-testid={`text-li-date-${li.id}`}>{displayDate}</td>
                                                    <td className="p-2" data-testid={`text-li-site-${li.id}`}>{siteName}</td>
                                                    <td className="p-2 text-right" data-testid={`text-li-hours-${li.id}`}>{parseFloat(li.hours).toFixed(2)}</td>
                                                    <td className="p-2 text-right" data-testid={`text-li-rate-${li.id}`}>{formatCurrency(li.rate)}</td>
                                                    <td className="p-2 text-right" data-testid={`text-li-subtotal-${li.id}`}>{formatCurrency(li.subtotal)}</td>
                                                    <td className="p-2 text-right" data-testid={`text-li-vat-amount-${li.id}`}>{formatCurrency(li.vatAmount)}</td>
                                                    <td className="p-2 text-right font-medium" data-testid={`text-li-line-total-${li.id}`}>{formatCurrency(li.lineTotal)}</td>
                                                  </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                        </div>

                                        <div className="flex justify-end mt-3">
                                          <div className="text-sm space-y-1 min-w-[200px]" data-testid={`summary-${inv.id}`}>
                                            <div className="flex justify-between gap-4">
                                              <span className="text-muted-foreground">Subtotal:</span>
                                              <span className="font-medium" data-testid={`text-summary-subtotal-${inv.id}`}>
                                                {formatCurrency(lineItems.reduce((sum, li) => sum + parseFloat(li.subtotal || "0"), 0))}
                                              </span>
                                            </div>
                                            <div className="flex justify-between gap-4">
                                              <span className="text-muted-foreground">VAT:</span>
                                              <span className="font-medium" data-testid={`text-summary-vat-${inv.id}`}>
                                                {formatCurrency(lineItems.reduce((sum, li) => sum + parseFloat(li.vatAmount || "0"), 0))}
                                              </span>
                                            </div>
                                            <div className="flex justify-between gap-4 border-t pt-1">
                                              <span className="font-semibold">Total:</span>
                                              <span className="font-semibold" data-testid={`text-summary-total-${inv.id}`}>
                                                {formatCurrency(inv.totalAmount)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })}
                    {filteredInvoices.length === 0 && hasActiveFilters && (
                      <tr data-testid="row-no-filter-results">
                        <td colSpan={7} className="p-8 text-center text-muted-foreground" data-testid="text-no-filter-results">
                          No invoices match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="generate" data-testid="tab-content-generate">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div
                  className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}
                >
                  <CalendarRange className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Generate Self-Billing Invoice</h2>
                  <p className="text-sm text-muted-foreground">Create an invoice from approved timesheets for a supplier and period.</p>
                </div>
              </div>

              <form onSubmit={handlePreview} className="space-y-4 max-w-lg" data-testid="form-generate-invoice">
                <div className="space-y-2">
                  <Label htmlFor="generate-supplier">Supplier</Label>
                  <Select
                    value={generateForm.supplierId}
                    onValueChange={(val) => {
                      setGenerateForm({ ...generateForm, supplierId: val });
                      setPreviewData(null);
                      setGenerateResult(null);
                    }}
                  >
                    <SelectTrigger data-testid="select-generate-supplier">
                      <Building2 className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliersLoading ? (
                        <SelectItem value="loading" disabled>Loading suppliers...</SelectItem>
                      ) : activeSuppliers.length === 0 ? (
                        <SelectItem value="none" disabled>No active self-billing suppliers</SelectItem>
                      ) : (
                        activeSuppliers.map((s) => (
                          <SelectItem key={s.id} value={String(s.id)} data-testid={`option-supplier-${s.id}`}>
                            {s.companyName}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="generate-period-start">Period Start <span className="text-muted-foreground font-normal">(optional filter)</span></Label>
                    <Input
                      id="generate-period-start"
                      type="date"
                      min="2020-01-01"
                      max="2030-12-31"
                      value={generateForm.periodStart}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        if (newStart && newStart.length === 10 && newStart.startsWith("20")) {
                          setGenerateForm(prev => ({ ...prev, periodStart: newStart }));
                          if (generateForm.supplierId && newStart && generateForm.periodEnd) {
                            triggerPreview(generateForm.supplierId, newStart, generateForm.periodEnd);
                          }
                        } else if (!newStart) {
                          setGenerateForm(prev => ({ ...prev, periodStart: "" }));
                          if (generateForm.supplierId && !generateForm.periodEnd) {
                            triggerPreview(generateForm.supplierId, "", "");
                          }
                        }
                      }}
                      data-testid="input-generate-period-start"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="generate-period-end">Period End <span className="text-muted-foreground font-normal">(optional filter)</span></Label>
                    <Input
                      id="generate-period-end"
                      type="date"
                      min="2020-01-01"
                      max="2030-12-31"
                      value={generateForm.periodEnd}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        if (newEnd && newEnd.length === 10 && newEnd.startsWith("20")) {
                          setGenerateForm(prev => ({ ...prev, periodEnd: newEnd }));
                          if (generateForm.supplierId && generateForm.periodStart && newEnd) {
                            triggerPreview(generateForm.supplierId, generateForm.periodStart, newEnd);
                          }
                        } else if (!newEnd) {
                          setGenerateForm(prev => ({ ...prev, periodEnd: "" }));
                          if (generateForm.supplierId && !generateForm.periodStart) {
                            triggerPreview(generateForm.supplierId, "", "");
                          }
                        }
                      }}
                      data-testid="input-generate-period-end"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={previewMutation.isPending || !generateForm.supplierId} data-testid="button-preview-shifts">
                    {previewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    <Eye className="w-4 h-4 mr-2" />
                    {previewData ? "Refresh Shifts" : "Preview Shifts"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setRenewDialogOpen(true)}
                    data-testid="button-renew-agreement"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Renew Agreement
                  </Button>
                </div>
              </form>

              {previewMutation.isPending && !previewData && (
                <div className="mt-6 flex items-center gap-3 text-muted-foreground" data-testid="loading-shifts">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Loading outstanding shifts...</span>
                </div>
              )}

              {previewData && !generateResult && (
                <div className="mt-6 space-y-4" data-testid="section-shift-preview">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <h3 className="text-base font-semibold">
                      Shift Preview — {previewData.total.toLocaleString()} shift{previewData.total !== 1 ? "s" : ""} found
                    </h3>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleAllShifts}
                        data-testid="button-toggle-all-shifts"
                      >
                        {selectedShiftIds.size === previewData.total ? "Deselect All" : "Select All"}
                      </Button>
                      <span className="text-sm text-muted-foreground" data-testid="text-selected-count">
                        {selectedShiftIds.size.toLocaleString()} of {previewData.total.toLocaleString()} selected
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="period-totals-summary">
                    <Card className="border-[#1F3A5F]/20">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Shifts</p>
                        <p className="text-lg font-bold" data-testid="stat-period-shifts">{previewData.summary.totalShifts.toLocaleString()}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-[#1F3A5F]/20">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                        <p className="text-lg font-bold" data-testid="stat-period-hours">{previewData.summary.totalHours.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-[#1F3A5F]/20">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Amount (ex. VAT)</p>
                        <p className="text-lg font-bold" data-testid="stat-period-subtotal">{formatCurrency(previewData.summary.subtotal)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-[#FF8C42]/20">
                      <CardContent className="p-3">
                        <p className="text-xs text-muted-foreground">Amount (inc. VAT{previewData.summary.vatRate > 0 ? ` @ ${previewData.summary.vatRate}%` : ""})</p>
                        <p className="text-lg font-bold text-[#FF8C42]" data-testid="stat-period-total">{formatCurrency(previewData.summary.totalAmount)}</p>
                      </CardContent>
                    </Card>
                  </div>

                  {previewData.summary.rateBreakdown && previewData.summary.rateBreakdown.length > 1 && (
                    <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3" data-testid="rate-breakdown-section">
                      <p className="text-xs font-semibold text-[#1F3A5F] dark:text-blue-300 mb-2">Rate Breakdown</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                        {previewData.summary.rateBreakdown.map((rb: RateBreakdownItem) => (
                          <div key={rb.rate} className="flex items-center justify-between text-xs bg-white dark:bg-gray-900 rounded px-2.5 py-1.5 border" data-testid={`rate-breakdown-${rb.rate}`}>
                            <span className="font-medium text-[#1F3A5F] dark:text-blue-300">{formatCurrency(rb.rate)}/hr</span>
                            <span className="text-muted-foreground">
                              {rb.shifts} shift{rb.shifts !== 1 ? "s" : ""} · {rb.hours.toFixed(2)} hrs · {formatCurrency(rb.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-shift-preview">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="p-3 text-left w-10">
                            <Checkbox
                              checked={selectedShiftIds.size === previewData.total}
                              onCheckedChange={toggleAllShifts}
                              data-testid="checkbox-select-all"
                            />
                          </th>
                          <th className="p-3 text-left font-medium">Date</th>
                          <th className="p-3 text-left font-medium">Site</th>
                          <th className="p-3 text-left font-medium">Employee</th>
                          <th className="p-3 text-left font-medium">Start</th>
                          <th className="p-3 text-left font-medium">End</th>
                          <th className="p-3 text-right font-medium">Hours</th>
                          <th className="p-3 text-right font-medium">Rate</th>
                          <th className="p-3 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.shifts.map((shift) => (
                          <tr
                            key={shift.shiftId}
                            className={`border-b last:border-b-0 hover:bg-muted/30 transition-colors ${!selectedShiftIds.has(shift.shiftId) ? "opacity-50" : ""}`}
                            data-testid={`row-shift-${shift.shiftId}`}
                          >
                            <td className="p-3">
                              <Checkbox
                                checked={selectedShiftIds.has(shift.shiftId)}
                                onCheckedChange={() => toggleShiftSelection(shift.shiftId)}
                                data-testid={`checkbox-shift-${shift.shiftId}`}
                              />
                            </td>
                            <td className="p-3 whitespace-nowrap" data-testid={`text-shift-date-${shift.shiftId}`}>{formatDate(shift.date)}</td>
                            <td className="p-3" data-testid={`text-shift-site-${shift.shiftId}`}>{shift.siteName}</td>
                            <td className="p-3" data-testid={`text-shift-employee-${shift.shiftId}`}>{shift.employeeName}</td>
                            <td className="p-3 whitespace-nowrap">{shift.startTime}</td>
                            <td className="p-3 whitespace-nowrap">{shift.endTime}</td>
                            <td className="p-3 text-right whitespace-nowrap">{shift.hours.toFixed(2)}</td>
                            <td className="p-3 text-right whitespace-nowrap">{formatCurrency(shift.rate)}</td>
                            <td className="p-3 text-right whitespace-nowrap font-medium">{formatCurrency(shift.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {selectedSummary && (
                        <tfoot>
                          <tr className="border-t-2 bg-muted/30">
                            <td colSpan={6} className="p-3 font-semibold" data-testid="text-summary-label">
                              Selected: {selectedSummary.totalShifts} shift{selectedSummary.totalShifts !== 1 ? "s" : ""}
                            </td>
                            <td className="p-3 text-right font-semibold" data-testid="text-summary-hours">{selectedSummary.totalHours.toFixed(2)}</td>
                            <td className="p-3 text-right"></td>
                            <td className="p-3 text-right font-semibold" data-testid="text-summary-subtotal">{formatCurrency(selectedSummary.subtotal)}</td>
                          </tr>
                          {previewData.summary.vatRate > 0 && (
                            <tr className="bg-muted/30">
                              <td colSpan={11} className="p-3 text-right text-sm text-muted-foreground">
                                VAT ({previewData.summary.vatRate}%)
                              </td>
                              <td className="p-3 text-right font-medium" data-testid="text-summary-vat">{formatCurrency(selectedSummary.vatAmount)}</td>
                            </tr>
                          )}
                          <tr className="bg-muted/50 border-t">
                            <td colSpan={11} className="p-3 text-right font-semibold">Total</td>
                            <td className="p-3 text-right font-bold text-base" data-testid="text-summary-total">{formatCurrency(selectedSummary.totalAmount)}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>

                  {previewData.total > previewLimit && (
                    <div className="flex items-center justify-between pt-2" data-testid="preview-pagination">
                      <span className="text-sm text-muted-foreground">
                        Showing {((previewData.page - 1) * previewLimit + 1).toLocaleString()}–{Math.min(previewData.page * previewLimit, previewData.total).toLocaleString()} of {previewData.total.toLocaleString()} shifts
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={previewPage <= 1 || previewMutation.isPending}
                          onClick={() => {
                            const newPage = previewPage - 1;
                            setPreviewPage(newPage);
                            triggerPreview(generateForm.supplierId, generateForm.periodStart, generateForm.periodEnd, newPage);
                          }}
                          data-testid="button-preview-prev"
                        >
                          <ChevronLeft className="w-4 h-4 mr-1" />
                          Previous
                        </Button>
                        <span className="text-sm font-medium">
                          Page {previewPage} of {Math.ceil(previewData.total / previewLimit)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={previewPage >= Math.ceil(previewData.total / previewLimit) || previewMutation.isPending}
                          onClick={() => {
                            const newPage = previewPage + 1;
                            setPreviewPage(newPage);
                            triggerPreview(generateForm.supplierId, generateForm.periodStart, generateForm.periodEnd, newPage);
                          }}
                          data-testid="button-preview-next"
                        >
                          Next
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={handleConfirmGenerate}
                      disabled={generateMutation.isPending || selectedShiftIds.size === 0}
                      data-testid="button-confirm-generate"
                    >
                      {generateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Confirm & Generate Invoice ({selectedShiftIds.size.toLocaleString()} shift{selectedShiftIds.size !== 1 ? "s" : ""})
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => { setPreviewData(null); setSelectedShiftIds(new Set()); setPreviewPage(1); }}
                      data-testid="button-cancel-preview"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {generateResult && (
                <Card className="mt-6">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold text-green-700 dark:text-green-400" data-testid="text-generate-success">Invoice Generated Successfully</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Invoice Number: <span className="font-medium" data-testid="text-generated-invoice-number">{generateResult.invoiceNumber}</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Total: <span className="font-medium" data-testid="text-generated-total">{formatCurrency(generateResult.totalAmount)}</span>
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-cards" data-testid="tab-content-rate-cards">
          <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
            <h2 className="text-lg font-semibold">Rate Cards</h2>
            <Button onClick={() => setRateCardDialogOpen(true)} data-testid="button-add-rate-card">
              <Plus className="w-4 h-4 mr-2" />
              Add Rate Card
            </Button>
          </div>

          {rateCardsLoading ? (
            <Card>
              <CardContent className="p-8 flex items-center justify-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Loading rate cards...</span>
              </CardContent>
            </Card>
          ) : rateCards.length === 0 ? (
            <Card data-testid="card-empty-rate-cards">
              <CardContent className="p-8 text-center">
                <CreditCard className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <h3 className="font-semibold" data-testid="text-empty-rate-cards">No Rate Cards</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Add rate cards to define hourly rates for suppliers and roles.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-rate-cards">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="p-3 font-medium text-muted-foreground">Supplier</th>
                      <th className="p-3 font-medium text-muted-foreground">Applies To</th>
                      <th className="p-3 font-medium text-muted-foreground">Role Type</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Hourly Rate</th>
                      <th className="p-3 font-medium text-muted-foreground text-right">Overtime Rate</th>
                      <th className="p-3 font-medium text-muted-foreground">Effective From</th>
                      <th className="p-3 font-medium text-muted-foreground">Effective To</th>
                      <th className="p-3 font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateCards.map((rc) => (
                      <tr key={rc.id} className="border-b last:border-0" data-testid={`row-rate-card-${rc.id}`}>
                        <td className="p-3 font-medium" data-testid={`text-rc-supplier-${rc.id}`}>{rc.supplierName || `Supplier #${rc.supplierId}`}</td>
                        <td className="p-3 text-muted-foreground" data-testid={`text-rc-applies-${rc.id}`}>{(() => { const p: string[] = []; if (rc.employeeName) p.push(`Employee: ${rc.employeeName}`); if (rc.siteName) p.push(`Site: ${rc.siteName}`); return p.length > 0 ? p.join(" · ") : "General (All)"; })()}</td>
                        <td className="p-3" data-testid={`text-rc-role-${rc.id}`}>{rc.roleType}</td>
                        <td className="p-3 text-right font-medium" data-testid={`text-rc-hourly-${rc.id}`}>{formatCurrency(rc.hourlyRate)}</td>
                        <td className="p-3 text-right text-muted-foreground" data-testid={`text-rc-overtime-${rc.id}`}>{rc.overtimeRate ? formatCurrency(rc.overtimeRate) : "N/A"}</td>
                        <td className="p-3 text-muted-foreground">{formatDate(rc.effectiveFrom)}</td>
                        <td className="p-3 text-muted-foreground">{rc.effectiveTo ? formatDate(rc.effectiveTo) : "Ongoing"}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditRateCard(rc)}
                              data-testid={`button-edit-rate-card-${rc.id}`}
                            >
                              <Pencil className="w-4 h-4 text-[#1F3A5F]" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => deleteRateCardMutation.mutate(rc.id)}
                              disabled={deleteRateCardMutation.isPending}
                              data-testid={`button-delete-rate-card-${rc.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="address-audit" data-testid="tab-content-address-audit">
          <div className="space-y-4">
            <Card className="border-l-4 border-l-amber-500">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Invoice Address Compliance Check</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Self-billing invoices must use the supplier's registered address as captured at the time of their self-billing agreement signing.
                      The suppliers listed below have since changed their Companies House registered address. Invoices now use the agreement address.
                      Consider asking these suppliers to re-sign their agreement with their updated address.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {addressAuditLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : addressAuditError ? (
              <Card className="border-destructive">
                <CardContent className="p-8 text-center">
                  <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-2" />
                  <p className="text-sm font-medium">Failed to load address audit</p>
                  <p className="text-xs text-muted-foreground mt-1">Please try refreshing the page or contact support if the issue persists.</p>
                </CardContent>
              </Card>
            ) : addressAudit && addressAudit.mismatchCount === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500 mx-auto mb-2" />
                  <p className="text-sm font-medium">All Clear</p>
                  <p className="text-xs text-muted-foreground mt-1">All VAT-registered supplier agreement addresses match their current Companies House address.</p>
                </CardContent>
              </Card>
            ) : addressAudit ? (
              <>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive" data-testid="badge-mismatch-count">{addressAudit.mismatchCount}</Badge>
                  <span className="text-sm font-medium">suppliers with address discrepancies</span>
                </div>
                <div className="space-y-3">
                  {addressAudit.suppliers.map((item) => (
                    <Card key={item.id} className="hover-elevate" data-testid={`card-audit-supplier-${item.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-muted-foreground font-mono">{item.supplierCode}</span>
                              <span className="text-sm font-semibold" data-testid={`text-audit-name-${item.id}`}>{item.companyName}</span>
                              {item.vatNumber && <Badge variant="outline" className="text-[10px]">VAT: {item.vatNumber}</Badge>}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200 dark:border-green-800">
                                <p className="text-[10px] uppercase tracking-wider text-green-700 dark:text-green-400 font-semibold mb-1">Agreement Address (Used on Invoices)</p>
                                <p className="text-xs" data-testid={`text-agreement-addr-${item.id}`}>{item.agreementAddress}</p>
                                {item.agreementSignedAt && (
                                  <p className="text-[10px] text-muted-foreground mt-1">Signed: {formatDate(item.agreementSignedAt)}</p>
                                )}
                              </div>
                              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 border border-red-200 dark:border-red-800">
                                <p className="text-[10px] uppercase tracking-wider text-red-700 dark:text-red-400 font-semibold mb-1">Current Companies House Address</p>
                                <p className="text-xs" data-testid={`text-current-addr-${item.id}`}>{item.currentAddress}</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-lg font-bold text-primary" data-testid={`text-invoice-count-${item.id}`}>{item.invoiceCount}</div>
                            <div className="text-[10px] text-muted-foreground">invoices</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={rateCardDialogOpen} onOpenChange={(open) => { setRateCardDialogOpen(open); if (!open) { setEditingRateCard(null); setRateCardForm({ supplierId: "", siteId: "", employeeId: "", roleType: "", hourlyRate: "", overtimeRate: "", effectiveFrom: "", effectiveTo: "" }); setSiteSearch(""); setSelectedSiteName(""); setSiteSearchResults([]); setShowSiteDropdown(false); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingRateCard ? "Edit Rate Card" : "Add Rate Card"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateRateCard} className="space-y-4" data-testid="form-add-rate-card">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select
                value={rateCardForm.supplierId}
                onValueChange={(val) => setRateCardForm({ ...rateCardForm, supplierId: val })}
              >
                <SelectTrigger data-testid="select-rc-supplier">
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Site (optional)</Label>
              <div className="relative" ref={siteDropdownRef}>
                <Input
                  value={selectedSiteName || siteSearch}
                  onChange={(e) => {
                    setSiteSearch(e.target.value);
                    setSelectedSiteName("");
                    setRateCardForm({ ...rateCardForm, siteId: "" });
                    setShowSiteDropdown(true);
                  }}
                  onFocus={() => setShowSiteDropdown(true)}
                  placeholder="Type to search sites..."
                  data-testid="input-rc-site-search"
                />
                {rateCardForm.siteId && rateCardForm.siteId !== "all" && (
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => { setRateCardForm({ ...rateCardForm, siteId: "" }); setSelectedSiteName(""); setSiteSearch(""); }}>✕</button>
                )}
                {showSiteDropdown && siteSearch.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-48 overflow-y-auto">
                    {siteSearchResults.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No sites found</div>
                    ) : (
                      siteSearchResults.map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-accent truncate"
                          onClick={() => {
                            setRateCardForm({ ...rateCardForm, siteId: String(s.id) });
                            setSelectedSiteName(s.name);
                            setSiteSearch("");
                            setShowSiteDropdown(false);
                          }}
                          data-testid={`option-rc-site-${s.id}`}
                        >
                          {s.name}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {rcSelectedSupplierId && (
              <div className="space-y-2">
                <Label>Employee (optional)</Label>
                <Select value={rateCardForm.employeeId} onValueChange={(v) => setRateCardForm({ ...rateCardForm, employeeId: v })} data-testid="select-rc-employee">
                  <SelectTrigger data-testid="trigger-rc-employee">
                    <SelectValue placeholder="All employees" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {rcSupplierEmployees.map((emp: any) => (
                      <SelectItem key={emp.id} value={String(emp.id)}>{emp.firstName} {emp.lastName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="rc-role-type">Role Type</Label>
              <Input
                id="rc-role-type"
                value={rateCardForm.roleType}
                onChange={(e) => setRateCardForm({ ...rateCardForm, roleType: e.target.value })}
                placeholder="e.g. Security Officer"
                required
                data-testid="input-rc-role-type"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rc-hourly-rate">Hourly Rate (£)</Label>
                <Input
                  id="rc-hourly-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rateCardForm.hourlyRate}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, hourlyRate: e.target.value })}
                  placeholder="0.00"
                  required
                  data-testid="input-rc-hourly-rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rc-overtime-rate">Overtime Rate (£)</Label>
                <Input
                  id="rc-overtime-rate"
                  type="number"
                  step="0.01"
                  min="0"
                  value={rateCardForm.overtimeRate}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, overtimeRate: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-rc-overtime-rate"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rc-effective-from">Effective From</Label>
                <Input
                  id="rc-effective-from"
                  type="date"
                  value={rateCardForm.effectiveFrom}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, effectiveFrom: e.target.value })}
                  required
                  data-testid="input-rc-effective-from"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rc-effective-to">Effective To</Label>
                <Input
                  id="rc-effective-to"
                  type="date"
                  value={rateCardForm.effectiveTo}
                  onChange={(e) => setRateCardForm({ ...rateCardForm, effectiveTo: e.target.value })}
                  data-testid="input-rc-effective-to"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setRateCardDialogOpen(false)} data-testid="button-cancel-rate-card">
                Cancel
              </Button>
              <Button type="submit" disabled={createRateCardMutation.isPending || updateRateCardMutation.isPending} data-testid="button-submit-rate-card">
                {(createRateCardMutation.isPending || updateRateCardMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingRateCard ? "Save Changes" : "Add Rate Card"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent className="max-w-md" data-testid="dialog-delete-invoice">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete Invoice Permanently
            </DialogTitle>
          </DialogHeader>
          {deleteConfirmId && (() => {
            const inv = selfBilledInvoices.find(i => i.id === deleteConfirmId);
            if (!inv) return null;
            return (
              <div className="space-y-3">
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm font-medium text-red-700 dark:text-red-300">This action cannot be undone.</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    The invoice, all line items, linked credit/debit notes, and any bank payment allocations will be permanently removed.
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    The underlying shifts will NOT be deleted and can be re-invoiced.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Invoice:</span> <span className="font-medium">{inv.invoiceNumber}</span></div>
                  <div><span className="text-muted-foreground">Supplier:</span> <span className="font-medium">{inv.supplierName}</span></div>
                  <div><span className="text-muted-foreground">Amount:</span> <span className="font-medium">{formatCurrency(inv.totalAmount)}</span></div>
                  <div><span className="text-muted-foreground">Status:</span> <Badge className={`text-xs ${(STATUS_BADGES[inv.status || "draft"] || STATUS_BADGES.draft).className}`}>{(STATUS_BADGES[inv.status || "draft"] || STATUS_BADGES.draft).label}</Badge></div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)} data-testid="button-cancel-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && deleteInvoiceMutation.mutate(deleteConfirmId)}
              disabled={deleteInvoiceMutation.isPending}
              data-testid="button-confirm-delete"
            >
              {deleteInvoiceMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onOpenChange={(open) => { if (!open) setBulkDeleteDialogOpen(false); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-bulk-delete">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Delete {bulkDeleteSelection.size} Invoice{bulkDeleteSelection.size !== 1 ? "s" : ""} Permanently
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm font-medium text-red-700 dark:text-red-300">This action cannot be undone.</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                All selected invoices, line items, linked credit/debit notes, and bank payment allocations will be permanently removed.
                The underlying shifts will NOT be deleted and can be re-invoiced.
              </p>
            </div>
            {(() => {
              const selected = selfBilledInvoices.filter(inv => bulkDeleteSelection.has(inv.id));
              const totalAmount = selected.reduce((sum, inv) => sum + parseFloat(inv.totalAmount || "0"), 0);
              const paidCount = selected.filter(inv => inv.status === "paid").length;
              const supplierNames = Array.from(new Set(selected.map(inv => inv.supplierName || "Unknown")));
              return (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Invoices:</span> <span className="font-medium">{selected.length}</span></div>
                    <div><span className="text-muted-foreground">Total Amount:</span> <span className="font-medium">{formatCurrency(String(totalAmount))}</span></div>
                    <div><span className="text-muted-foreground">Suppliers:</span> <span className="font-medium">{supplierNames.join(", ")}</span></div>
                    {paidCount > 0 && (
                      <div><span className="text-amber-600 font-medium">{paidCount} paid invoice{paidCount !== 1 ? "s" : ""} — allocations will be removed</span></div>
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto border rounded-md p-2">
                    {selected.map(inv => (
                      <div key={inv.id} className="flex justify-between text-xs py-1 border-b last:border-0">
                        <span className="font-mono">{inv.invoiceNumber}</span>
                        <span className="text-muted-foreground">{inv.supplierName}</span>
                        <span className="font-medium">{formatCurrency(inv.totalAmount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)} data-testid="button-cancel-bulk-delete">Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => bulkDeleteMutation.mutate(Array.from(bulkDeleteSelection))}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Delete {bulkDeleteSelection.size} Invoice{bulkDeleteSelection.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmIssueId !== null} onOpenChange={(open) => { if (!open) setConfirmIssueId(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-confirm-issue">
          <DialogHeader>
            <DialogTitle>Issue Invoice</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to issue this invoice? This action will change the invoice status to issued.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmIssueId(null)} data-testid="button-cancel-issue">
              Cancel
            </Button>
            <Button
              onClick={() => confirmIssueId && issueMutation.mutate(confirmIssueId)}
              disabled={issueMutation.isPending}
              data-testid="button-confirm-issue"
            >
              {issueMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Issue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentDateDialogId !== null} onOpenChange={(open) => { if (!open) { setPaymentDateDialogId(null); setPaymentDateForm({ dueDate: "", paymentDate: "" }); } }}>
        <DialogContent className="max-w-sm" data-testid="dialog-set-payment-date">
          <DialogHeader>
            <DialogTitle>Set Payment Date</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="due-date">Due Date</Label>
              <Input
                id="due-date"
                type="date"
                value={paymentDateForm.dueDate}
                onChange={(e) => setPaymentDateForm({ ...paymentDateForm, dueDate: e.target.value })}
                data-testid="input-due-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-date">Payment Date</Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDateForm.paymentDate}
                onChange={(e) => setPaymentDateForm({ ...paymentDateForm, paymentDate: e.target.value })}
                data-testid="input-payment-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setPaymentDateDialogId(null); setPaymentDateForm({ dueDate: "", paymentDate: "" }); }} data-testid="button-cancel-payment-date">
              Cancel
            </Button>
            <Button
              onClick={() => paymentDateDialogId && setPaymentDateMutation.mutate({ id: paymentDateDialogId, dueDate: paymentDateForm.dueDate, paymentDate: paymentDateForm.paymentDate })}
              disabled={setPaymentDateMutation.isPending}
              data-testid="button-confirm-payment-date"
            >
              {setPaymentDateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Dates
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recordPaymentOpen} onOpenChange={(open) => { if (!open) { setRecordPaymentOpen(false); setRpSupplierFilter("all"); setRpSelectedTxnId(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-record-payment">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Banknote className="w-5 h-5" />
              Allocate Payment
            </DialogTitle>
          </DialogHeader>
          {(() => {
            const unpaidInvoices = selfBilledInvoices.filter(inv => inv.status !== "paid" && inv.status !== "cancelled");
            const supplierOptions = Array.from(new Map(unpaidInvoices.map(inv => [String(inv.supplierId), inv.supplierName || `Supplier #${inv.supplierId}`])).entries()).sort((a, b) => a[1].localeCompare(b[1]));

            const filteredUnpaid = rpSupplierFilter === "all" ? unpaidInvoices : unpaidInvoices.filter(inv => String(inv.supplierId) === rpSupplierFilter);
            const selectedTotal = filteredUnpaid
              .filter(inv => recordPaymentSelected.has(inv.id))
              .reduce((sum, inv) => sum + parseFloat(inv.totalAmount), 0);

            const selectedTxn = rpBankTxns.find(t => t.id === rpSelectedTxnId);
            const txnAmount = selectedTxn ? Math.abs(parseFloat(selectedTxn.amount)) : 0;
            const txnAllocated = selectedTxn ? parseFloat(selectedTxn.allocatedAmount || "0") : 0;
            const txnRemaining = txnAmount - txnAllocated;

            return (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Supplier</Label>
                  <Select value={rpSupplierFilter} onValueChange={(v) => { setRpSupplierFilter(v); setRpSelectedTxnId(null); setRecordPaymentSelected(new Set()); }}>
                    <SelectTrigger data-testid="select-rp-supplier">
                      <SelectValue placeholder="Select a supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Suppliers</SelectItem>
                      {supplierOptions.map(([id, name]) => (
                        <SelectItem key={id} value={id}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {rpSupplierFilter !== "all" && (
                  <div>
                    <Label className="text-sm font-medium">Bank Transaction</Label>
                    <Select value={rpSelectedTxnId ? String(rpSelectedTxnId) : ""} onValueChange={(v) => setRpSelectedTxnId(v ? Number(v) : null)}>
                      <SelectTrigger data-testid="select-rp-transaction">
                        <SelectValue placeholder="Select a bank transaction" />
                      </SelectTrigger>
                      <SelectContent>
                        {rpBankTxns.length === 0 ? (
                          <SelectItem value="__none" disabled>No unallocated transactions</SelectItem>
                        ) : rpBankTxns.map(txn => {
                          const absAmt = Math.abs(parseFloat(txn.amount));
                          const alloc = parseFloat(txn.allocatedAmount || "0");
                          const rem = absAmt - alloc;
                          return (
                            <SelectItem key={txn.id} value={String(txn.id)}>
                              {new Date(txn.transactionDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — {txn.description.substring(0, 35)} — £{rem.toFixed(2)} remaining
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    {selectedTxn && (
                      <div className="mt-2 text-xs text-muted-foreground flex gap-4">
                        <span>Total: £{txnAmount.toFixed(2)}</span>
                        <span>Already allocated: £{txnAllocated.toFixed(2)}</span>
                        <span className="font-semibold text-foreground">Remaining: £{txnRemaining.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}

                {rpSupplierFilter !== "all" && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Select Invoices</span>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRecordPaymentSelected(new Set(filteredUnpaid.map(inv => inv.id)))}
                          data-testid="button-select-all-payments"
                        >
                          Select All ({filteredUnpaid.length})
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setRecordPaymentSelected(new Set())}
                          data-testid="button-deselect-all-payments"
                        >
                          Deselect All
                        </Button>
                      </div>
                    </div>

                    <div className="border rounded-md max-h-[35vh] overflow-y-auto">
                      {filteredUnpaid.map(inv => (
                        <label
                          key={inv.id}
                          className="flex items-center gap-3 px-3 py-2 border-b last:border-b-0 cursor-pointer hover:bg-muted/30"
                          data-testid={`row-payment-invoice-${inv.id}`}
                        >
                          <Checkbox
                            checked={recordPaymentSelected.has(inv.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(recordPaymentSelected);
                              checked ? next.add(inv.id) : next.delete(inv.id);
                              setRecordPaymentSelected(next);
                            }}
                            data-testid={`checkbox-payment-${inv.id}`}
                          />
                          <span className="text-sm font-mono flex-shrink-0">{inv.invoiceNumber}</span>
                          <span className="text-xs text-muted-foreground flex-1">
                            {new Date(inv.periodStart).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} — {new Date(inv.periodEnd).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span className="text-sm font-mono font-medium">
                            £{parseFloat(inv.totalAmount).toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                          </span>
                        </label>
                      ))}
                      {filteredUnpaid.length === 0 && (
                        <div className="p-6 text-center text-sm text-muted-foreground" data-testid="text-no-unpaid">
                          No unpaid invoices for this supplier.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between bg-muted/50 rounded-md p-3">
                      <span className="text-sm">
                        {recordPaymentSelected.size} invoice(s) selected
                      </span>
                      <span className={`text-lg font-bold font-mono ${selectedTxn && selectedTotal > txnRemaining + 0.01 ? 'text-red-600' : ''}`} data-testid="text-payment-total">
                        £{selectedTotal.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
                        {selectedTxn && selectedTotal > txnRemaining + 0.01 && (
                          <span className="text-xs font-normal ml-2">(exceeds remaining by £{(selectedTotal - txnRemaining).toFixed(2)})</span>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRecordPaymentOpen(false); setRpSupplierFilter("all"); setRpSelectedTxnId(null); }} data-testid="button-cancel-record-payment">
              Cancel
            </Button>
            <Button
              onClick={() => {
                const selectedTxn = rpBankTxns.find(t => t.id === rpSelectedTxnId);
                recordPaymentMutation.mutate({
                  invoiceIds: Array.from(recordPaymentSelected),
                  bankTransactionId: rpSelectedTxnId || undefined,
                  bankReference: selectedTxn ? selectedTxn.description : recordPaymentBankRef,
                  datePaid: selectedTxn ? selectedTxn.transactionDate : recordPaymentDate,
                });
              }}
              disabled={recordPaymentMutation.isPending || recordPaymentSelected.size === 0 || !rpSelectedTxnId}
              data-testid="button-submit-record-payment"
            >
              {recordPaymentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Allocate Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmMarkPaidId !== null} onOpenChange={(open) => { if (!open) setConfirmMarkPaidId(null); }}>
        <DialogContent className="max-w-sm" data-testid="dialog-confirm-mark-paid">
          <DialogHeader>
            <DialogTitle>Mark as Paid</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to mark this invoice as paid? This will update the invoice status to paid.
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmMarkPaidId(null)} data-testid="button-cancel-mark-paid">
              Cancel
            </Button>
            <Button
              onClick={() => confirmMarkPaidId && markPaidMutation.mutate(confirmMarkPaidId)}
              disabled={markPaidMutation.isPending}
              data-testid="button-confirm-mark-paid"
            >
              {markPaidMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={creditNoteDialogId !== null} onOpenChange={(open) => { if (!open) { setCreditNoteDialogId(null); setCreditNoteReason(""); } }}>
        <DialogContent className="max-w-md" data-testid="dialog-credit-note">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Issue Credit Note
            </DialogTitle>
          </DialogHeader>
          {creditNoteDialogId && (() => {
            const inv = allInvoices.find(i => i.id === creditNoteDialogId);
            return inv ? (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-md text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Invoice:</span>
                    <span className="font-medium" data-testid="text-cn-invoice-number">{inv.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Supplier:</span>
                    <span className="font-medium">{inv.supplierName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount:</span>
                    <span className="font-medium" data-testid="text-cn-amount">{formatCurrency(inv.totalAmount)}</span>
                  </div>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
                  This will cancel the invoice and release all linked shifts, making them available for re-invoicing.
                </div>
                <div className="space-y-2">
                  <Label htmlFor="credit-note-reason">Reason for Credit Note</Label>
                  <Textarea
                    id="credit-note-reason"
                    placeholder="e.g. Incorrect rates applied, duplicate invoice, shift corrections needed..."
                    value={creditNoteReason}
                    onChange={(e) => setCreditNoteReason(e.target.value)}
                    rows={3}
                    data-testid="input-credit-note-reason"
                  />
                </div>
              </div>
            ) : null;
          })()}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => { setCreditNoteDialogId(null); setCreditNoteReason(""); }} data-testid="button-cancel-credit-note">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => creditNoteDialogId && creditNoteReason.trim() && creditNoteMutation.mutate({ invoiceId: creditNoteDialogId, reason: creditNoteReason })}
              disabled={creditNoteMutation.isPending || !creditNoteReason.trim()}
              data-testid="button-confirm-credit-note"
            >
              {creditNoteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Issue Credit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renewDialogOpen} onOpenChange={(open) => { if (!open) { setRenewDialogOpen(false); setRenewForm({ supplierId: "", years: "2" }); } }}>
        <DialogContent data-testid="dialog-renew-agreement">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5" />
              Renew Self-Billing Agreement
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRenew} className="space-y-4">
            <div className="space-y-2">
              <Label>Supplier</Label>
              <Select
                value={renewForm.supplierId}
                onValueChange={(val) => setRenewForm({ ...renewForm, supplierId: val })}
              >
                <SelectTrigger data-testid="select-renew-supplier">
                  <Building2 className="w-4 h-4 mr-2" />
                  <SelectValue placeholder="Select a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers
                    .filter((s: any) => s.selfBillingAgreementStatus && s.selfBillingAgreementStatus !== "none")
                    .map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {s.companyName}
                        {s.selfBillingExpiryDate && new Date(s.selfBillingExpiryDate) < new Date() && (
                          <span className="text-red-500 ml-2">(Expired)</span>
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Renewal Period</Label>
              <Select
                value={renewForm.years}
                onValueChange={(val) => setRenewForm({ ...renewForm, years: val })}
              >
                <SelectTrigger data-testid="select-renew-years">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Year</SelectItem>
                  <SelectItem value="2">2 Years</SelectItem>
                  <SelectItem value="3">3 Years</SelectItem>
                  <SelectItem value="5">5 Years</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">
              Per HMRC VAT Notice 700/62, self-billing agreements must be renewed periodically. The new expiry date will be calculated from today.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setRenewDialogOpen(false); setRenewForm({ supplierId: "", years: "2" }); }} data-testid="button-cancel-renew">
                Cancel
              </Button>
              <Button type="submit" disabled={renewMutation.isPending} data-testid="button-confirm-renew">
                {renewMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                <RefreshCw className="w-4 h-4 mr-2" />
                Renew Agreement
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
