import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Plus,
  Pencil,
  Search,
  Loader2,
  Globe,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import type { Tenant } from "@shared/schema";

const emptyTenantForm = {
  name: "",
  tradingName: "",
  slug: "",
  industry: "security",
  addressLine1: "",
  addressLine2: "",
  city: "",
  county: "",
  postcode: "",
  phone: "",
  email: "",
  website: "",
  vatNumber: "",
  companyRegNumber: "",
  companyStatus: "",
  siaAcsNumber: "",
};

export default function TenantManagementPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyTenantForm);
  const [searchQuery, setSearchQuery] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const { toast } = useToast();

  const { data: tenants = [], isLoading } = useQuery<Tenant[]>({
    queryKey: ["/api/admin/tenants"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyTenantForm) => {
      const res = await apiRequest("POST", "/api/admin/tenants", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setCreateOpen(false);
      setForm(emptyTenantForm);
      toast({ title: "Tenant created", description: "New company has been added to the platform." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof emptyTenantForm & { isActive: boolean }> }) => {
      const res = await apiRequest("PATCH", `/api/admin/tenants/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/tenants"] });
      setEditOpen(false);
      toast({ title: "Tenant updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    },
  });

  async function lookupCompany(regNumber: string) {
    if (!regNumber || regNumber.length < 6) return;
    setLookingUp(true);
    try {
      const res = await fetch(`/api/companies-house/lookup/${regNumber}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Lookup failed", description: err.message, variant: "destructive" });
        return;
      }
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        name: data.companyName || prev.name,
        companyStatus: data.companyStatus || "",
        addressLine1: data.addressLine1 || prev.addressLine1,
        addressLine2: data.addressLine2 || prev.addressLine2,
        city: data.city || prev.city,
        county: data.county || prev.county,
        postcode: data.postcode || prev.postcode,
      }));
      toast({ title: "Company found", description: `${data.companyName} — ${data.companyStatus}` });
    } catch {
      toast({ title: "Lookup error", description: "Could not reach Companies House API", variant: "destructive" });
    } finally {
      setLookingUp(false);
    }
  }

  function generateSlug(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function openCreate() {
    setForm(emptyTenantForm);
    setCreateOpen(true);
  }

  function openEdit(tenant: Tenant) {
    setSelectedTenant(tenant);
    setForm({
      name: tenant.name || "",
      tradingName: tenant.tradingName || "",
      slug: tenant.slug || "",
      industry: tenant.industry || "security",
      addressLine1: tenant.addressLine1 || "",
      addressLine2: tenant.addressLine2 || "",
      city: tenant.city || "",
      county: tenant.county || "",
      postcode: tenant.postcode || "",
      phone: tenant.phone || "",
      email: tenant.email || "",
      website: tenant.website || "",
      vatNumber: tenant.vatNumber || "",
      companyRegNumber: tenant.companyRegNumber || "",
      companyStatus: tenant.companyStatus || "",
      siaAcsNumber: tenant.siaAcsNumber || "",
    });
    setEditOpen(true);
  }

  function openDetail(tenant: Tenant) {
    setSelectedTenant(tenant);
    setDetailOpen(true);
  }

  const filteredTenants = tenants.filter((t) =>
    [t.name, t.tradingName, t.companyRegNumber, t.email, t.slug]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function TenantForm({ mode }: { mode: "create" | "edit" }) {
    const isCreate = mode === "create";
    return (
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-2">
            <Label>Company Registration Number</Label>
            <div className="flex gap-2">
              <Input
                value={form.companyRegNumber}
                onChange={(e) => {
                  setForm((p) => ({ ...p, companyRegNumber: e.target.value }));
                }}
                placeholder="e.g. 12345678"
                data-testid="input-company-reg"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => lookupCompany(form.companyRegNumber)}
                disabled={lookingUp || form.companyRegNumber.length < 6}
                data-testid="btn-lookup-company"
              >
                {lookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
            {form.companyStatus && (
              <p className="text-xs text-muted-foreground">
                Status: <span className={form.companyStatus === "active" ? "text-green-600 font-medium" : "text-red-600 font-medium"}>{form.companyStatus}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Company Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => {
                setForm((p) => ({
                  ...p,
                  name: e.target.value,
                  slug: isCreate ? generateSlug(e.target.value) : p.slug,
                }));
              }}
              placeholder="Registered company name"
              data-testid="input-company-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Trading Name</Label>
            <Input value={form.tradingName} onChange={(e) => setForm((p) => ({ ...p, tradingName: e.target.value }))} placeholder="Trading as..." data-testid="input-trading-name" />
          </div>

          {isCreate && (
            <div className="col-span-2 space-y-2">
              <Label>Slug *</Label>
              <Input value={form.slug} onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))} placeholder="company-slug" data-testid="input-slug" />
              <p className="text-xs text-muted-foreground">Unique identifier used in URLs</p>
            </div>
          )}

          <div className="col-span-2 space-y-2">
            <Label>Industry</Label>
            <Select value={form.industry} onValueChange={(v) => setForm((p) => ({ ...p, industry: v }))}>
              <SelectTrigger data-testid="select-industry"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="cleaning">Cleaning</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="engineering">Engineering</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-3">Registered Address</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Address Line 1</Label>
              <Input value={form.addressLine1} onChange={(e) => setForm((p) => ({ ...p, addressLine1: e.target.value }))} data-testid="input-address1" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Address Line 2</Label>
              <Input value={form.addressLine2} onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))} data-testid="input-address2" />
            </div>
            <div className="space-y-2">
              <Label>City</Label>
              <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} data-testid="input-city" />
            </div>
            <div className="space-y-2">
              <Label>County</Label>
              <Input value={form.county} onChange={(e) => setForm((p) => ({ ...p, county: e.target.value }))} data-testid="input-county" />
            </div>
            <div className="space-y-2">
              <Label>Postcode</Label>
              <Input value={form.postcode} onChange={(e) => setForm((p) => ({ ...p, postcode: e.target.value }))} data-testid="input-postcode" />
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-3">Contact Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} placeholder="+44..." data-testid="input-phone" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} data-testid="input-email" />
            </div>
            <div className="col-span-2 space-y-2">
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))} placeholder="https://..." data-testid="input-website" />
            </div>
          </div>
        </div>

        <div className="border-t pt-3">
          <p className="text-sm font-medium mb-3">Regulatory Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>VAT Number</Label>
              <Input value={form.vatNumber} onChange={(e) => setForm((p) => ({ ...p, vatNumber: e.target.value }))} placeholder="GB..." data-testid="input-vat" />
            </div>
            <div className="space-y-2">
              <Label>SIA ACS Number</Label>
              <Input value={form.siaAcsNumber} onChange={(e) => setForm((p) => ({ ...p, siaAcsNumber: e.target.value }))} data-testid="input-sia-acs" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="tenant-management-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Tenant Management</h1>
            <p className="text-sm text-muted-foreground">Manage all companies on the platform</p>
          </div>
        </div>
        <Button onClick={openCreate} data-testid="btn-create-tenant">
          <Plus className="w-4 h-4 mr-1" />
          Add Company
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-tenants"
          />
        </div>
        <Badge variant="outline" data-testid="text-tenant-count">{tenants.length} compan{tenants.length !== 1 ? "ies" : "y"}</Badge>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTenants.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{searchQuery ? "No companies match your search." : "No companies yet. Click 'Add Company' to get started."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredTenants.map((tenant) => (
            <Card key={tenant.id} className="hover-elevate cursor-pointer" data-testid={`tenant-card-${tenant.id}`} onClick={() => openDetail(tenant)}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      {tenant.logoUrl ? (
                        <img src={tenant.logoUrl.startsWith("/objects") ? tenant.logoUrl : `/objects/${tenant.logoUrl}`} alt="" className="w-10 h-10 rounded-md object-cover" />
                      ) : (
                        <Building2 className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" data-testid={`tenant-name-${tenant.id}`}>{tenant.name}</p>
                        {tenant.tradingName && tenant.tradingName !== tenant.name && (
                          <span className="text-xs text-muted-foreground">t/a {tenant.tradingName}</span>
                        )}
                        <Badge variant={tenant.isActive ? "default" : "outline"} className={tenant.isActive ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" : "bg-red-100 text-red-800"} data-testid={`tenant-status-${tenant.id}`}>
                          {tenant.isActive ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline" className="capitalize">{tenant.industry || "security"}</Badge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1 flex-wrap">
                        {tenant.companyRegNumber && (
                          <span>Reg: {tenant.companyRegNumber}</span>
                        )}
                        {tenant.email && (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{tenant.email}</span>
                        )}
                        {tenant.phone && (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{tenant.phone}</span>
                        )}
                        {(tenant.city || tenant.postcode) && (
                          <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{[tenant.city, tenant.postcode].filter(Boolean).join(", ")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); openEdit(tenant); }} data-testid={`btn-edit-tenant-${tenant.id}`}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Company</DialogTitle>
          </DialogHeader>
          <TenantForm mode="create" />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={createMutation.isPending || !form.name || !form.slug}
              data-testid="btn-submit-create"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Create Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
          </DialogHeader>
          <TenantForm mode="edit" />
          {selectedTenant && (
            <div className="flex items-center gap-3 border-t pt-3">
              <Label>Status</Label>
              <Button
                size="sm"
                variant={selectedTenant.isActive ? "destructive" : "default"}
                onClick={() => {
                  updateMutation.mutate({ id: selectedTenant.id, data: { isActive: !selectedTenant.isActive } });
                }}
                data-testid="btn-toggle-active"
              >
                {selectedTenant.isActive ? (
                  <><XCircle className="w-3 h-3 mr-1" />Deactivate</>
                ) : (
                  <><CheckCircle2 className="w-3 h-3 mr-1" />Activate</>
                )}
              </Button>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button
              onClick={() => {
                if (selectedTenant) {
                  const { slug, ...updates } = form;
                  updateMutation.mutate({ id: selectedTenant.id, data: updates });
                }
              }}
              disabled={updateMutation.isPending || !form.name}
              data-testid="btn-submit-edit"
            >
              {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Company Details</DialogTitle>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-md bg-primary/10 flex items-center justify-center">
                  {selectedTenant.logoUrl ? (
                    <img src={selectedTenant.logoUrl.startsWith("/objects") ? selectedTenant.logoUrl : `/objects/${selectedTenant.logoUrl}`} alt="" className="w-14 h-14 rounded-md object-cover" />
                  ) : (
                    <Building2 className="w-7 h-7 text-primary" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold" data-testid="detail-company-name">{selectedTenant.name}</p>
                  {selectedTenant.tradingName && selectedTenant.tradingName !== selectedTenant.name && (
                    <p className="text-sm text-muted-foreground">Trading as: {selectedTenant.tradingName}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedTenant.isActive ? "default" : "outline"} className={selectedTenant.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {selectedTenant.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Industry</p>
                  <p className="capitalize">{selectedTenant.industry || "Security"}</p>
                </div>
                {selectedTenant.companyRegNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">Company Reg. Number</p>
                    <p>{selectedTenant.companyRegNumber}</p>
                  </div>
                )}
                {selectedTenant.companyStatus && (
                  <div>
                    <p className="text-xs text-muted-foreground">Companies House Status</p>
                    <p className="capitalize">{selectedTenant.companyStatus}</p>
                  </div>
                )}
                {selectedTenant.vatNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">VAT Number</p>
                    <p>{selectedTenant.vatNumber}</p>
                  </div>
                )}
                {selectedTenant.siaAcsNumber && (
                  <div>
                    <p className="text-xs text-muted-foreground">SIA ACS Number</p>
                    <p>{selectedTenant.siaAcsNumber}</p>
                  </div>
                )}
              </div>

              {(selectedTenant.addressLine1 || selectedTenant.city || selectedTenant.postcode) && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground mb-1">Registered Address</p>
                  <p className="text-sm">
                    {[selectedTenant.addressLine1, selectedTenant.addressLine2, selectedTenant.city, selectedTenant.county, selectedTenant.postcode].filter(Boolean).join(", ")}
                  </p>
                </div>
              )}

              <div className="border-t pt-3 grid grid-cols-2 gap-3 text-sm">
                {selectedTenant.phone && (
                  <div>
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="flex items-center gap-1"><Phone className="w-3 h-3" />{selectedTenant.phone}</p>
                  </div>
                )}
                {selectedTenant.email && (
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="flex items-center gap-1"><Mail className="w-3 h-3" />{selectedTenant.email}</p>
                  </div>
                )}
                {selectedTenant.website && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Website</p>
                    <p className="flex items-center gap-1"><Globe className="w-3 h-3" />{selectedTenant.website}</p>
                  </div>
                )}
              </div>

              {selectedTenant.createdAt && (
                <div className="border-t pt-3">
                  <p className="text-xs text-muted-foreground">Created</p>
                  <p className="text-sm">{new Date(selectedTenant.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setDetailOpen(false); openEdit(selectedTenant); }} data-testid="btn-detail-edit">
                  <Pencil className="w-4 h-4 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
