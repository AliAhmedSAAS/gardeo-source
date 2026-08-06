import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Supplier } from "@shared/schema";
import { Link, useLocation } from "wouter";
import {
  Search, Building2, Clock, CheckCircle2, AlertTriangle, AlertCircle, Ban,
  Plus, Mail, Phone, MapPin, FileText, CreditCard, Shield,
  Users, Loader2, ExternalLink, Download,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-400" },
  pending: { label: "Pending", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  submitted: { label: "Submitted", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" },
  approved: { label: "Approved", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  info_required: { label: "Info Required", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
  active: { label: "Active", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
  suspended: { label: "Suspended", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
  terminated: { label: "Terminated", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400" },
};

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  let d = new Date(dateStr);
  if (isNaN(d.getTime()) && dateStr.includes("/")) {
    const parts = dateStr.split("/");
    if (parts.length === 3) {
      d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  }
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "N/A";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

type CompaniesHouseLookup = {
  companyName: string;
  companyNumber: string;
  address: string;
  city: string;
  postcode: string;
  country: string;
  registeredOfficeAddress: string;
  registeredOfficeCity: string;
  registeredOfficePostcode: string;
  registeredOfficeCountry: string | null;
  companyCategory: string;
  companyStatus: string;
  countryOfOrigin: string;
  incorporationDate: string | null;
  sicCodes: string | null;
  accountsNextDue: string | null;
  accountsLastMadeUpDate: string | null;
  accountCategory: string | null;
  accountsAccountRefDay: string | null;
  accountsAccountRefMonth: string | null;
  returnsNextDue: string | null;
  returnsLastMadeUpDate: string | null;
  previousNames: Array<{ CompanyName?: string; CONDate?: string }>;
  mortgages: { NumMortCharges?: string; NumMortOutstanding?: string; NumMortPartSatisfied?: string; NumMortSatisfied?: string } | null;
};

type AddSupplierForm = {
  companyName: string;
  contactName: string;
  email: string;
  supplierType: "labour" | "non_labour";
  phone: string;
  address: string;
  city: string;
  postcode: string;
  vatNumber: string;
  vatStatus: string;
  companyRegNumber: string;
  notes: string;
  registeredOfficeAddress?: string;
  registeredOfficeCity?: string;
  registeredOfficePostcode?: string;
  registeredOfficeCountry?: string;
  companyCategory?: string;
  companyStatus?: string;
  countryOfOrigin?: string;
  incorporationDate?: string;
  sicCodes?: string;
  accountsNextDue?: string;
  accountsLastMadeUpDate?: string;
  accountCategory?: string;
  accountsAccountRefDay?: string;
  accountsAccountRefMonth?: string;
  returnsNextDue?: string;
  returnsLastMadeUpDate?: string;
  previousNames?: Array<{ CompanyName?: string; CONDate?: string }>;
  mortgages?: { NumMortCharges?: string; NumMortOutstanding?: string; NumMortPartSatisfied?: string; NumMortSatisfied?: string } | null;
};

export default function SuppliersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const XERO_EXPORT_ROLES = ["super_admin", "tenant_admin", "ceo", "operations_manager", "regional_manager", "admin", "accountant", "payroll_manager"];
  const canExportXero = !!user && XERO_EXPORT_ROLES.includes(user.role);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: selectedSupplier, isLoading: isDetailLoading, isError: isDetailError, error: detailError } = useQuery<Supplier>({
    queryKey: ["/api/suppliers", selectedSupplierId],
    enabled: !!selectedSupplierId,
  });

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupData, setLookupData] = useState<CompaniesHouseLookup | null>(null);
  const addFormDefaults: AddSupplierForm = {
    companyName: "", contactName: "", email: "", supplierType: "labour", phone: "",
    address: "", city: "", postcode: "", vatNumber: "", vatStatus: "",
    companyRegNumber: "", notes: "",
    registeredOfficeAddress: "", registeredOfficeCity: "", registeredOfficePostcode: "", registeredOfficeCountry: "",
    companyCategory: "", companyStatus: "", countryOfOrigin: "", incorporationDate: "", sicCodes: "",
    accountsNextDue: "", accountsLastMadeUpDate: "", accountCategory: "",
    accountsAccountRefDay: "", accountsAccountRefMonth: "",
    returnsNextDue: "", returnsLastMadeUpDate: "",
    previousNames: [], mortgages: undefined,
  };
  const form = useForm<AddSupplierForm>({ defaultValues: addFormDefaults });

  useEffect(() => {
    if (addDialogOpen) {
      form.reset(addFormDefaults);
      setLookupData(null);
    }
  }, [addDialogOpen]);

  const fetchCompaniesHouse = async () => {
    const crn = form.getValues("companyRegNumber")?.trim().replace(/\s/g, "");
    if (!crn) {
      toast({ title: "Enter company number", description: "Enter a UK company registration number to look up.", variant: "destructive" });
      return;
    }
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/companies-house/lookup/${encodeURIComponent(crn)}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Company not found");
      }
      const data = (await res.json()) as CompaniesHouseLookup;
      setLookupData(data);
      form.setValue("companyName", data.companyName || form.getValues("companyName"));
      form.setValue("companyRegNumber", data.companyNumber || crn);
      form.setValue("address", data.address || form.getValues("address"));
      form.setValue("city", data.city || form.getValues("city"));
      form.setValue("postcode", data.postcode || form.getValues("postcode"));
      form.setValue("registeredOfficeAddress", data.registeredOfficeAddress ?? "");
      form.setValue("registeredOfficeCity", data.registeredOfficeCity ?? "");
      form.setValue("registeredOfficePostcode", data.registeredOfficePostcode ?? "");
      form.setValue("registeredOfficeCountry", data.registeredOfficeCountry ?? "");
      form.setValue("companyCategory", data.companyCategory ?? "");
      form.setValue("companyStatus", data.companyStatus ?? "");
      form.setValue("countryOfOrigin", data.countryOfOrigin ?? "");
      form.setValue("incorporationDate", data.incorporationDate ?? "");
      form.setValue("sicCodes", data.sicCodes ?? "");
      form.setValue("accountsNextDue", data.accountsNextDue ?? "");
      form.setValue("accountsLastMadeUpDate", data.accountsLastMadeUpDate ?? "");
      form.setValue("accountCategory", data.accountCategory ?? "");
      form.setValue("accountsAccountRefDay", data.accountsAccountRefDay ?? "");
      form.setValue("accountsAccountRefMonth", data.accountsAccountRefMonth ?? "");
      form.setValue("returnsNextDue", data.returnsNextDue ?? "");
      form.setValue("returnsLastMadeUpDate", data.returnsLastMadeUpDate ?? "");
      form.setValue("previousNames", data.previousNames ?? []);
      form.setValue("mortgages", data.mortgages ?? undefined);
      toast({ title: "Company details loaded", description: `${data.companyName || "Company"} details have been auto-filled from Companies House.` });
    } catch (e: any) {
      toast({ title: "Lookup failed", description: e?.message || "Could not fetch company data.", variant: "destructive" });
    } finally {
      setLookupLoading(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: AddSupplierForm) => {
      await apiRequest("POST", "/api/suppliers", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      setAddDialogOpen(false);
      form.reset(addFormDefaults);
      toast({ title: "Supplier added", description: "The supplier has been created successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("PATCH", `/api/suppliers/${id}/approve`);
    },
    onSuccess: (_, approvedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      if (selectedSupplierId) {
        queryClient.invalidateQueries({ queryKey: ["/api/suppliers", selectedSupplierId] });
      }
      toast({ title: "Supplier approved", description: "The supplier has been approved successfully." });
      setLocation(`/suppliers/${approvedId}`);
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const filtered = suppliers.filter((s) => {
    const search = searchTerm.toLowerCase();
    const matchesSearch =
      (s.companyName || "").toLowerCase().includes(search) ||
      (s.contactName || "").toLowerCase().includes(search) ||
      (s.email || "").toLowerCase().includes(search) ||
      (s.city || "").toLowerCase().includes(search);

    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && s.status === statusFilter;
  });

  const stats = {
    total: suppliers.length,
    draft: suppliers.filter((s) => s.status === "draft").length,
    submitted: suppliers.filter((s) => s.status === "submitted").length,
    pending: suppliers.filter((s) => s.status === "pending").length,
    active: suppliers.filter((s) => s.status === "active" || s.status === "approved").length,
    suspended: suppliers.filter((s) => s.status === "suspended").length,
  };

  return (
    <div className="p-6 space-y-6" data-testid="suppliers-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Supplier Management</h1>
          <p className="text-muted-foreground text-sm">Manage your suppliers, approvals, and company details.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canExportXero && (
            <Button
              variant="outline"
              onClick={() => window.open("/api/admin/suppliers/export-xero", "_blank")}
              data-testid="button-export-xero"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to Xero CSV
            </Button>
          )}
          <Button onClick={() => setAddDialogOpen(true)} data-testid="button-add-supplier">
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Building2 className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
            <div className="text-2xl font-bold" data-testid="text-total-suppliers">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Suppliers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-slate-500" />
            <div className="text-2xl font-bold" data-testid="text-draft-suppliers">{stats.draft}</div>
            <div className="text-xs text-muted-foreground">Draft</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileText className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-submitted-suppliers">{stats.submitted}</div>
            <div className="text-xs text-muted-foreground">Submitted</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-green-500" />
            <div className="text-2xl font-bold text-green-600 dark:text-green-400" data-testid="text-active-suppliers">{stats.active}</div>
            <div className="text-xs text-muted-foreground">Active</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-orange-500" />
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400" data-testid="text-suspended-suppliers">{stats.suspended}</div>
            <div className="text-xs text-muted-foreground">Suspended</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-suppliers"
            placeholder="Search by company, contact, email, city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { value: "all", label: "All" },
            { value: "draft", label: "Draft" },
            { value: "pending", label: "Pending" },
            { value: "submitted", label: "Submitted" },
            { value: "approved", label: "Approved" },
            { value: "info_required", label: "Info Required" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "terminated", label: "Terminated" },
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
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
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
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No suppliers found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your search or filters."
                : "Suppliers will appear here once they have been added."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((supplier) => {
            const statusConf = STATUS_CONFIG[supplier.status || "pending"];
            return (
              <Card
                key={supplier.id}
                className="hover-elevate cursor-pointer"
                onClick={() => setSelectedSupplierId(supplier.id)}
                data-testid={`card-supplier-${supplier.id}`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-5 h-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {(supplier as any).supplierCode && <span className="text-xs text-muted-foreground font-mono" data-testid={`text-supplier-code-${supplier.id}`}>{(supplier as any).supplierCode}</span>}
                          <div className="font-medium text-sm truncate" data-testid={`text-supplier-name-${supplier.id}`}>
                            {supplier.companyName}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {supplier.contactName} {supplier.email ? `- ${supplier.email}` : ""}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      {supplier.city && (
                        <span className="text-xs text-muted-foreground hidden sm:block">
                          {supplier.city}
                        </span>
                      )}
                      <Badge
                        className={`no-default-hover-elevate no-default-active-elevate ${statusConf.className}`}
                        data-testid={`badge-status-${supplier.id}`}
                      >
                        {statusConf.label}
                      </Badge>
                      <Button asChild size="sm" variant="ghost" className="gap-1" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Link href={`/suppliers/${supplier.id}`} data-testid={`link-view-supplier-${supplier.id}`}>
                          <ExternalLink className="w-3 h-3" />
                          View
                        </Link>
                      </Button>
                      {(supplier.status === "draft" || supplier.status === "pending" || supplier.status === "submitted") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            approveMutation.mutate(supplier.id);
                          }}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${supplier.id}`}
                        >
                          {approveMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin mr-1" />
                          ) : (
                            <Shield className="w-3 h-3 mr-1" />
                          )}
                          Approve
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selectedSupplierId} onOpenChange={() => setSelectedSupplierId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          {isDetailLoading ? (
            <>
              <DialogTitle className="sr-only">Supplier details</DialogTitle>
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            </>
          ) : isDetailError || !selectedSupplier ? (
            <>
              <DialogTitle className="sr-only">Supplier details</DialogTitle>
              <div className="flex flex-col items-center justify-center h-32 gap-3">
                <AlertCircle className="w-6 h-6 text-destructive" />
                <p className="text-sm text-muted-foreground">{detailError?.message || "Failed to load supplier details"}</p>
                <Button size="sm" variant="outline" onClick={() => setSelectedSupplierId(null)}>Close</Button>
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <DialogTitle data-testid="text-detail-company-name">
                      {selectedSupplier.companyName}
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">{selectedSupplier.contactName}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button asChild size="sm" variant="outline" onClick={() => setSelectedSupplierId(null)}>
                      <Link href={`/suppliers/${selectedSupplier.id}`} data-testid="link-open-supplier-page">
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Open in new page
                      </Link>
                    </Button>
                    <div>
                    {(() => {
                      const conf = STATUS_CONFIG[selectedSupplier.status || "pending"];
                      return (
                        <Badge className={`no-default-hover-elevate no-default-active-elevate ${conf.className}`} data-testid="badge-detail-status">
                          {conf.label}
                        </Badge>
                      );
                    })()}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-6 mt-4">
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Contact Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem icon={Mail} label="Email" value={selectedSupplier.email} testId="text-detail-email" />
                    <DetailItem icon={Phone} label="Phone" value={selectedSupplier.phone} testId="text-detail-phone" />
                    <div className="col-span-2">
                      <DetailItem
                        icon={MapPin}
                        label="Address"
                        value={[selectedSupplier.address, selectedSupplier.city, selectedSupplier.postcode].filter(Boolean).join(", ") || null}
                        testId="text-detail-address"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" /> Company Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="VAT Number" value={selectedSupplier.vatNumber} testId="text-detail-vat" />
                    <DetailItem label="VAT Status" value={selectedSupplier.vatStatus === "vat_registered" ? "VAT Registered" : selectedSupplier.vatStatus === "not_vat_registered" ? "Not VAT Registered" : "Not Set"} testId="text-detail-vat-status" />
                    <DetailItem label="Company Reg." value={selectedSupplier.companyRegNumber} testId="text-detail-reg" />
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <CreditCard className="w-4 h-4" /> Bank Details
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <DetailItem label="Account Title" value={selectedSupplier.bankName} testId="text-detail-bank" />
                    <DetailItem label="Sort Code" value={selectedSupplier.sortCode} testId="text-detail-sort-code" />
                    <DetailItem label="Account Number" value={selectedSupplier.accountNumber} testId="text-detail-account" />
                  </div>
                </div>

                {selectedSupplier.notes && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-detail-notes">{selectedSupplier.notes}</p>
                  </div>
                )}

                {selectedSupplier.approvedAt && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span data-testid="text-audit-approved">
                          Approved on {formatDateTime(selectedSupplier.approvedAt as unknown as string)}
                          {selectedSupplier.approvedBy ? ` by User ${selectedSupplier.approvedBy}` : ""}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(selectedSupplier.status === "draft" || selectedSupplier.status === "pending" || selectedSupplier.status === "submitted") && (
                  <Button
                    className="w-full"
                    onClick={() => approveMutation.mutate(selectedSupplier.id)}
                    disabled={approveMutation.isPending}
                    data-testid="button-approve-detail"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Shield className="w-4 h-4 mr-2" />
                    )}
                    Approve Supplier
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
              className="space-y-4 mt-2"
              data-testid="form-add-supplier"
            >
              <FormField
                control={form.control}
                name="companyRegNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Registration Number (UK) — optional</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input {...field} data-testid="input-company-reg" placeholder="UK company number" className="flex-1" />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={fetchCompaniesHouse}
                        disabled={lookupLoading}
                        title="Look up company from Companies House"
                        data-testid="button-lookup-company"
                      >
                        {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Enter a UK CRN and click search to auto-fill company details, or leave blank to create manually.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {lookupData && (
                <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20" data-testid="card-lookup-summary">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-semibold text-green-800 dark:text-green-400">Companies House Data Loaded</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-muted-foreground">Company Name</span>
                        <p className="font-medium" data-testid="text-lookup-name">{lookupData.companyName || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CRN</span>
                        <p className="font-medium" data-testid="text-lookup-crn">{lookupData.companyNumber || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status</span>
                        <p className="font-medium" data-testid="text-lookup-status">
                          <Badge variant="secondary" className="text-xs no-default-hover-elevate no-default-active-elevate">
                            {lookupData.companyStatus || "Unknown"}
                          </Badge>
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Type</span>
                        <p className="font-medium" data-testid="text-lookup-category">{lookupData.companyCategory || "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Incorporated</span>
                        <p className="font-medium" data-testid="text-lookup-incorporated">{lookupData.incorporationDate ? formatDate(lookupData.incorporationDate) : "N/A"}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Country</span>
                        <p className="font-medium" data-testid="text-lookup-country">{lookupData.countryOfOrigin || lookupData.country || "N/A"}</p>
                      </div>
                      {lookupData.registeredOfficeAddress && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Registered Address</span>
                          <p className="font-medium" data-testid="text-lookup-address">
                            {[lookupData.registeredOfficeAddress, lookupData.registeredOfficeCity, lookupData.registeredOfficePostcode].filter(Boolean).join(", ")}
                          </p>
                        </div>
                      )}
                      {lookupData.sicCodes && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">SIC Codes</span>
                          <p className="font-medium whitespace-pre-line" data-testid="text-lookup-sic">{lookupData.sicCodes}</p>
                        </div>
                      )}
                      {(lookupData.accountCategory || lookupData.accountsNextDue || lookupData.accountsLastMadeUpDate) && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Accounts</span>
                          <p className="font-medium" data-testid="text-lookup-accounts">
                            {[
                              lookupData.accountCategory && `Category: ${lookupData.accountCategory}`,
                              lookupData.accountsLastMadeUpDate && `Last made up: ${formatDate(lookupData.accountsLastMadeUpDate)}`,
                              lookupData.accountsNextDue && `Next due: ${formatDate(lookupData.accountsNextDue)}`,
                              lookupData.accountsAccountRefDay && lookupData.accountsAccountRefMonth && `Ref: ${lookupData.accountsAccountRefDay}/${lookupData.accountsAccountRefMonth}`,
                            ].filter(Boolean).join(" | ")}
                          </p>
                        </div>
                      )}
                      {(lookupData.returnsNextDue || lookupData.returnsLastMadeUpDate) && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Confirmation Statement</span>
                          <p className="font-medium" data-testid="text-lookup-returns">
                            {[
                              lookupData.returnsLastMadeUpDate && `Last made up: ${formatDate(lookupData.returnsLastMadeUpDate)}`,
                              lookupData.returnsNextDue && `Next due: ${formatDate(lookupData.returnsNextDue)}`,
                            ].filter(Boolean).join(" | ")}
                          </p>
                        </div>
                      )}
                      {lookupData.previousNames && lookupData.previousNames.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Previous Names</span>
                          <p className="font-medium" data-testid="text-lookup-previous-names">
                            {lookupData.previousNames.map(pn => pn.CompanyName).filter(Boolean).join(", ")}
                          </p>
                        </div>
                      )}
                      {lookupData.mortgages && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Charges</span>
                          <p className="font-medium" data-testid="text-lookup-mortgages">
                            {lookupData.mortgages.NumMortCharges || "0"} total, {lookupData.mortgages.NumMortOutstanding || "0"} outstanding, {lookupData.mortgages.NumMortSatisfied || "0"} satisfied
                          </p>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground italic">Trading address has been set to match the registered address. You can edit it below.</p>
                  </CardContent>
                </Card>
              )}
              <FormField
                control={form.control}
                name="companyName"
                rules={{ required: "Company name is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-company-name" placeholder="Enter company name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactName"
                rules={{ required: "Contact name is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Name *</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-contact-name" placeholder="Enter contact name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                rules={{ required: "Email is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-email" placeholder="Enter email address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplierType"
                rules={{ required: "Supplier type is required" }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-supplier-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="labour">Labour Provider</SelectItem>
                        <SelectItem value="non_labour">Non-Labour Supplier</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-phone" placeholder="Phone number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {lookupData && (
                <div className="pt-1">
                  <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trading Address</Label>
                  <p className="text-xs text-muted-foreground mb-2">Auto-filled from Companies House registered address. Edit if trading address differs.</p>
                </div>
              )}
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{lookupData ? "Trading Address" : "Address"}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-address" placeholder="Street address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-city" placeholder="City" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postcode</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-postcode" placeholder="Postcode" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="vatNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Number</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-vat-number" placeholder="e.g. GB123456789" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vatStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>VAT Status</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vat-status">
                            <SelectValue placeholder="Select VAT status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="vat_registered">VAT Registered</SelectItem>
                          <SelectItem value="not_vat_registered">Not VAT Registered</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-notes" placeholder="Additional notes..." className="resize-none" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-supplier">
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Add Supplier
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value, testId }: {
  icon?: typeof Mail;
  label: string;
  value: string | null | undefined;
  testId?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon className="w-3 h-3" />}
        {label}
      </div>
      <div className="text-sm font-medium" data-testid={testId}>{value || "N/A"}</div>
    </div>
  );
}
