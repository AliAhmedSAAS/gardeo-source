import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Building, Plus, Phone, Mail, MapPin, Calendar, FileText,
  Loader2, MapPinned, Edit, Trash2, CheckCircle2, Hash, PoundSterling, CreditCard,
} from "lucide-react";

type ClientRow = {
  id: number;
  tenant_id: number;
  company_name: string;
  company_reg_number: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string | null;
  postcode: string | null;
  contract_ref: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  billing_email: string | null;
  notes: string | null;
  is_active: boolean;
  site_count: string;
  created_at: string;
  client_code: string | null;
};

type ClientDetail = ClientRow & {
  sites: Array<{ id: number; name: string; address: string; city: string | null; postcode: string | null; is_active: boolean }>;
};

type RateCardRow = {
  id: number;
  client_id: number;
  site_id: number | null;
  site_name: string | null;
  role_type: string | null;
  hourly_charge_rate: string;
  effective_from: string;
  effective_to: string | null;
  notes: string | null;
};

type ClientTransaction = {
  id: number;
  transaction_date: string;
  description: string | null;
  amount: string;
  type: string;
  reference: string | null;
  is_allocated: boolean;
  allocated_amount: string | null;
  allocations: Array<{
    id: number;
    amount: string;
    client_invoice_id: number | null;
    invoice_number: string | null;
    notes: string | null;
  }>;
};

const emptyForm = {
  companyName: "", companyRegNumber: "", contactName: "", contactEmail: "", contactPhone: "",
  address: "", city: "", postcode: "", contractRef: "",
  contractStartDate: "", contractEndDate: "", billingEmail: "", notes: "",
};

const emptyRateForm = {
  hourlyChargeRate: "", roleType: "", effectiveFrom: "", effectiveTo: "", notes: "",
};

function formatDate(d: string | null) {
  if (!d) return "N/A";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(v: string | number) {
  const num = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
}

export default function ClientsPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [companyLookupNumber, setCompanyLookupNumber] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [showRateForm, setShowRateForm] = useState(false);
  const [editRateId, setEditRateId] = useState<number | null>(null);
  const [rateForm, setRateForm] = useState(emptyRateForm);

  const { data: clients = [], isLoading } = useQuery<ClientRow[]>({ queryKey: ["/api/clients"] });
  const { data: detail } = useQuery<ClientDetail>({
    queryKey: ["/api/clients", selectedId],
    enabled: !!selectedId,
  });
  const { data: rateCards = [] } = useQuery<RateCardRow[]>({
    queryKey: ["/api/clients", selectedId, "rate-cards"],
    enabled: !!selectedId,
  });
  const { data: clientTransactions = [], isLoading: transactionsLoading } = useQuery<ClientTransaction[]>({
    queryKey: ["/api/accounting/client-transactions", selectedId],
    enabled: !!selectedId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await apiRequest("POST", "/api/clients", data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Client created" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setShowAdd(false);
      setForm(emptyForm);
      setCompanyLookupNumber("");
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof emptyForm }) => {
      const res = await apiRequest("PATCH", `/api/clients/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Client updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Client deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      setSelectedId(null);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const createRateMutation = useMutation({
    mutationFn: async (data: typeof emptyRateForm) => {
      const res = await apiRequest("POST", `/api/clients/${selectedId}/rate-cards`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rate card added" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedId, "rate-cards"] });
      setShowRateForm(false);
      setRateForm(emptyRateForm);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateRateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof emptyRateForm }) => {
      const res = await apiRequest("PATCH", `/api/client-rate-cards/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Rate card updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedId, "rate-cards"] });
      setEditRateId(null);
      setRateForm(emptyRateForm);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteRateMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/client-rate-cards/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Rate card deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", selectedId, "rate-cards"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const filtered = clients.filter(c =>
    c.company_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.city || "").toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: clients.length,
    active: clients.filter(c => c.is_active).length,
    totalSites: clients.reduce((sum, c) => sum + parseInt(c.site_count || "0"), 0),
  };

  const openEdit = (c: ClientRow) => {
    setForm({
      companyName: c.company_name || "", companyRegNumber: c.company_reg_number || "",
      contactName: c.contact_name || "",
      contactEmail: c.contact_email || "", contactPhone: c.contact_phone || "",
      address: c.address || "", city: c.city || "", postcode: c.postcode || "",
      contractRef: c.contract_ref || "", contractStartDate: c.contract_start_date || "",
      contractEndDate: c.contract_end_date || "", billingEmail: c.billing_email || "",
      notes: c.notes || "",
    });
    setCompanyLookupNumber(c.company_reg_number || "");
    setEditId(c.id);
  };

  const doCompanyLookup = async () => {
    if (!companyLookupNumber.trim()) return;
    setLookingUp(true);
    try {
      const res = await fetch(`/api/companies-house/lookup/${encodeURIComponent(companyLookupNumber.trim())}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Company not found" }));
        toast({ title: "Lookup failed", description: err.message || "Company not found on Companies House", variant: "destructive" });
        return;
      }
      const data = await res.json();
      setForm(f => ({
        ...f,
        companyName: data.companyName || f.companyName,
        companyRegNumber: data.companyNumber || companyLookupNumber.trim(),
        address: [data.addressLine1, data.addressLine2].filter(Boolean).join(", ") || f.address,
        city: data.city || f.city,
        postcode: data.postcode || f.postcode,
      }));
      toast({ title: "Company found", description: `Auto-filled details for ${data.companyName}` });
    } catch {
      toast({ title: "Lookup failed", description: "Could not connect to Companies House", variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  };

  const renderForm = (isEdit: boolean) => (
    <div className="space-y-4 mt-2">
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <Label className="text-xs font-medium text-blue-800 dark:text-blue-300 flex items-center gap-1 mb-1.5">
          <Hash className="w-3.5 h-3.5" /> Companies House Lookup
        </Label>
        <div className="flex gap-2">
          <Input
            placeholder="Enter company number (e.g. 12345678)"
            value={companyLookupNumber}
            onChange={e => setCompanyLookupNumber(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); doCompanyLookup(); } }}
            className="flex-1"
            data-testid="input-company-lookup"
          />
          <Button
            type="button"
            size="sm"
            onClick={doCompanyLookup}
            disabled={lookingUp || !companyLookupNumber.trim()}
            className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
            data-testid="button-company-lookup"
          >
            {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          </Button>
        </div>
        <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Auto-fill company details from Companies House</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Company Name *</Label>
          <Input value={form.companyName} onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))} data-testid="input-client-name" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Company Reg Number</Label>
          <Input value={form.companyRegNumber} onChange={e => setForm(f => ({ ...f, companyRegNumber: e.target.value }))} placeholder="e.g. 12345678" data-testid="input-company-reg" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Contact Name</Label>
          <Input value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} data-testid="input-contact-name" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Contact Email</Label>
          <Input type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} data-testid="input-contact-email" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Contact Phone</Label>
          <Input value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} data-testid="input-contact-phone" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Billing Email</Label>
          <Input type="email" value={form.billingEmail} onChange={e => setForm(f => ({ ...f, billingEmail: e.target.value }))} data-testid="input-billing-email" />
        </div>
      </div>
      <Separator />
      <h4 className="text-sm font-medium">Address</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Address</Label>
          <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} data-testid="input-client-address" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City</Label>
          <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} data-testid="input-client-city" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Postcode</Label>
          <Input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} data-testid="input-client-postcode" />
        </div>
      </div>
      <Separator />
      <h4 className="text-sm font-medium">Contract Details</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Contract Reference</Label>
          <Input value={form.contractRef} onChange={e => setForm(f => ({ ...f, contractRef: e.target.value }))} data-testid="input-contract-ref" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={form.contractStartDate} onChange={e => setForm(f => ({ ...f, contractStartDate: e.target.value }))} data-testid="input-contract-start" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">End Date</Label>
          <Input type="date" value={form.contractEndDate} onChange={e => setForm(f => ({ ...f, contractEndDate: e.target.value }))} data-testid="input-contract-end" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-client-notes" />
      </div>
    </div>
  );

  const renderRateForm = () => (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Hourly Charge Rate (£) *</Label>
          <Input
            type="number" step="0.01" min="0"
            value={rateForm.hourlyChargeRate}
            onChange={e => setRateForm(f => ({ ...f, hourlyChargeRate: e.target.value }))}
            placeholder="e.g. 18.50"
            data-testid="input-rate-charge"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Role Type</Label>
          <Input
            value={rateForm.roleType}
            onChange={e => setRateForm(f => ({ ...f, roleType: e.target.value }))}
            placeholder="e.g. Security Officer"
            data-testid="input-rate-role"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Effective From *</Label>
          <Input type="date" value={rateForm.effectiveFrom} onChange={e => setRateForm(f => ({ ...f, effectiveFrom: e.target.value }))} data-testid="input-rate-from" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Effective To</Label>
          <Input type="date" value={rateForm.effectiveTo} onChange={e => setRateForm(f => ({ ...f, effectiveTo: e.target.value }))} data-testid="input-rate-to" />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Notes</Label>
        <Input value={rateForm.notes} onChange={e => setRateForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes" data-testid="input-rate-notes" />
      </div>
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="outline" onClick={() => { setShowRateForm(false); setEditRateId(null); setRateForm(emptyRateForm); }}>Cancel</Button>
        {editRateId ? (
          <Button
            size="sm"
            onClick={() => updateRateMutation.mutate({ id: editRateId, data: rateForm })}
            disabled={updateRateMutation.isPending || !rateForm.hourlyChargeRate || !rateForm.effectiveFrom}
            className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
            data-testid="button-update-rate"
          >
            {updateRateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />} Update
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => createRateMutation.mutate(rateForm)}
            disabled={createRateMutation.isPending || !rateForm.hourlyChargeRate || !rateForm.effectiveFrom}
            className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90"
            data-testid="button-save-rate"
          >
            {createRateMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Add
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6" data-testid="clients-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground text-sm">Manage client companies and their contracts.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setCompanyLookupNumber(""); setShowAdd(true); }} className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" data-testid="button-add-client">
          <Plus className="w-4 h-4 mr-2" /> Add Client
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><div className="text-xs text-muted-foreground">Total Clients</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600">{stats.active}</div><div className="text-xs text-muted-foreground">Active</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600">{stats.totalSites}</div><div className="text-xs text-muted-foreground">Total Sites</div></CardContent></Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-clients" />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted animate-pulse rounded" /></CardContent></Card>)}</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><Building className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><h3 className="font-semibold">No clients found</h3><p className="text-sm text-muted-foreground">{search ? "Try adjusting your search." : "Click 'Add Client' to add your first client."}</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => (
            <Card key={c.id} className="hover-elevate cursor-pointer" onClick={() => setSelectedId(c.id)} data-testid={`card-client-${c.id}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building className="w-5 h-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {c.client_code && <span className="text-xs text-muted-foreground font-mono" data-testid={`text-client-code-${c.id}`}>{c.client_code}</span>}
                        <div className="font-medium text-sm truncate" data-testid={`text-client-name-${c.id}`}>{c.company_name}</div>
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {c.company_reg_number && <span className="font-mono">#{c.company_reg_number} • </span>}
                        {c.contact_name && <span>{c.contact_name} • </span>}
                        {c.city && <span>{c.city} • </span>}
                        {c.contract_ref && <span>Ref: {c.contract_ref}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <MapPinned className="w-3.5 h-3.5" /> {c.site_count} sites
                    </div>
                    <Badge variant={c.is_active ? "default" : "destructive"}>
                      {c.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Client Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Add New Client</DialogTitle></DialogHeader>
          {renderForm(false)}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate(form)} disabled={createMutation.isPending || !form.companyName} className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" data-testid="button-submit-client">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Add Client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Client Dialog */}
      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5" /> Edit Client</DialogTitle></DialogHeader>
          {renderForm(true)}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={() => editId && updateMutation.mutate({ id: editId, data: form })} disabled={updateMutation.isPending || !form.companyName} className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" data-testid="button-update-client">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Client Detail Dialog */}
      <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {!detail ? (
            <div className="flex items-center justify-center h-32"><div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" /></div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <DialogTitle data-testid="text-detail-client-name">{detail.company_name}</DialogTitle>
                        {detail.client_code && <Badge variant="outline" className="text-xs font-mono" data-testid="text-detail-client-code">{detail.client_code}</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {detail.company_reg_number && <span className="font-mono">Company #{detail.company_reg_number} • </span>}
                        {detail.contract_ref ? `Contract: ${detail.contract_ref}` : "No contract ref"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setSelectedId(null); openEdit(detail); }} data-testid="button-edit-client">
                      <Edit className="w-3.5 h-3.5 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm("Delete this client?")) deleteMutation.mutate(detail.id); }} data-testid="button-delete-client">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-sm"><Mail className="w-4 h-4 text-muted-foreground" /><span>{detail.contact_email || "N/A"}</span></div>
                  <div className="flex items-center gap-2 text-sm"><Phone className="w-4 h-4 text-muted-foreground" /><span>{detail.contact_phone || "N/A"}</span></div>
                  <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-muted-foreground" /><span>{[detail.address, detail.city, detail.postcode].filter(Boolean).join(", ") || "N/A"}</span></div>
                  <div className="flex items-center gap-2 text-sm"><Calendar className="w-4 h-4 text-muted-foreground" /><span>{formatDate(detail.contract_start_date)} — {formatDate(detail.contract_end_date)}</span></div>
                </div>

                {detail.notes && (
                  <div className="flex items-start gap-2 text-sm"><FileText className="w-4 h-4 text-muted-foreground mt-0.5" /><span className="text-muted-foreground">{detail.notes}</span></div>
                )}

                <Separator />

                {/* Charge Rate Cards Section */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><PoundSterling className="w-4 h-4 text-[#FF8C42]" /> Charge Rate Cards ({rateCards.length})</h4>
                  {!showRateForm && !editRateId && (
                    <Button size="sm" variant="outline" onClick={() => { setRateForm(emptyRateForm); setShowRateForm(true); }} data-testid="button-add-rate">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Rate
                    </Button>
                  )}
                </div>

                {(showRateForm || editRateId) && renderRateForm()}

                {rateCards.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-left">
                          <th className="p-2 font-medium text-xs">Role</th>
                          <th className="p-2 font-medium text-xs text-right">Rate/hr</th>
                          <th className="p-2 font-medium text-xs">From</th>
                          <th className="p-2 font-medium text-xs">To</th>
                          <th className="p-2 font-medium text-xs text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rateCards.map(rc => (
                          <tr key={rc.id} className="border-t" data-testid={`row-rate-${rc.id}`}>
                            <td className="p-2 text-xs">{rc.role_type || "All Roles"}</td>
                            <td className="p-2 text-xs text-right font-medium text-green-700 dark:text-green-400" data-testid={`text-rate-amount-${rc.id}`}>{formatCurrency(rc.hourly_charge_rate)}</td>
                            <td className="p-2 text-xs">{formatDate(rc.effective_from)}</td>
                            <td className="p-2 text-xs">{rc.effective_to ? formatDate(rc.effective_to) : "Ongoing"}</td>
                            <td className="p-2 text-xs text-right">
                              <div className="flex gap-1 justify-end">
                                <Button
                                  size="sm" variant="ghost" className="h-6 w-6 p-0"
                                  onClick={() => {
                                    setRateForm({
                                      hourlyChargeRate: rc.hourly_charge_rate,
                                      roleType: rc.role_type || "",
                                      effectiveFrom: rc.effective_from,
                                      effectiveTo: rc.effective_to || "",
                                      notes: rc.notes || "",
                                    });
                                    setEditRateId(rc.id);
                                    setShowRateForm(false);
                                  }}
                                  data-testid={`button-edit-rate-${rc.id}`}
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm" variant="ghost" className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                  onClick={() => { if (confirm("Delete this rate card?")) deleteRateMutation.mutate(rc.id); }}
                                  data-testid={`button-delete-rate-${rc.id}`}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : !showRateForm && !editRateId ? (
                  <p className="text-sm text-muted-foreground">No charge rates configured. Click "Add Rate" to set hourly charge rates for this client.</p>
                ) : null}

                <Separator />
                <h4 className="text-sm font-semibold flex items-center gap-2"><MapPinned className="w-4 h-4 text-[#1F3A5F]" /> Sites ({detail.sites?.length || 0})</h4>
                {detail.sites && detail.sites.length > 0 ? (
                  <div className="space-y-2">
                    {detail.sites.map(site => (
                      <Card key={site.id}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{site.name}</div>
                            <div className="text-xs text-muted-foreground">{[site.address, site.city, site.postcode].filter(Boolean).join(", ")}</div>
                          </div>
                          <Badge variant={site.is_active ? "default" : "secondary"}>{site.is_active ? "Active" : "Inactive"}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No sites assigned to this client yet.</p>
                )}

                <Separator />
                <h4 className="text-sm font-semibold flex items-center gap-2" data-testid="text-payments-heading">
                  <CreditCard className="w-4 h-4 text-green-600" /> Payments ({clientTransactions.length})
                </h4>
                {(() => {
                  const totalReceived = clientTransactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
                  return (
                    <div className="flex gap-4" data-testid="text-payments-summary">
                      <div className="text-sm"><span className="text-muted-foreground">Total Received:</span> <span className="font-medium text-green-700 dark:text-green-400">{formatCurrency(totalReceived)}</span></div>
                      <div className="text-sm"><span className="text-muted-foreground">Transactions:</span> <span className="font-medium">{clientTransactions.length}</span></div>
                    </div>
                  );
                })()}
                {transactionsLoading ? (
                  <div className="flex items-center justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : clientTransactions.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/50 text-left">
                          <th className="p-2 font-medium text-xs">Date</th>
                          <th className="p-2 font-medium text-xs">Description</th>
                          <th className="p-2 font-medium text-xs text-right">Amount</th>
                          <th className="p-2 font-medium text-xs">Invoice</th>
                          <th className="p-2 font-medium text-xs">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clientTransactions.map(txn => {
                          const amt = Math.abs(parseFloat(txn.amount));
                          const allocated = parseFloat(txn.allocated_amount || "0");
                          const status = txn.is_allocated ? "Allocated" : allocated > 0 ? "Partial" : "Unallocated";
                          const invoiceNumbers = txn.allocations
                            .filter(a => a.invoice_number)
                            .map(a => a.invoice_number)
                            .join(", ");
                          return (
                            <tr key={txn.id} className="border-t" data-testid={`row-client-txn-${txn.id}`}>
                              <td className="p-2 text-xs">{formatDate(txn.transaction_date)}</td>
                              <td className="p-2 text-xs truncate max-w-[150px]" title={txn.description || ""}>{txn.description || "—"}</td>
                              <td className="p-2 text-xs text-right font-medium text-green-700 dark:text-green-400" data-testid={`text-txn-amount-${txn.id}`}>{formatCurrency(amt)}</td>
                              <td className="p-2 text-xs">{invoiceNumbers || "—"}</td>
                              <td className="p-2 text-xs">
                                <Badge
                                  variant={status === "Allocated" ? "default" : status === "Partial" ? "secondary" : "outline"}
                                  data-testid={`badge-txn-status-${txn.id}`}
                                >
                                  {status}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No payments linked to this client yet.</p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
