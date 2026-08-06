import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Search, MapPinned, Plus, MapPin, Building, Loader2, Edit, Trash2, CheckCircle2, X,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

interface ShiftPattern { period: string; hours: number }

type SiteRow = {
  id: number;
  tenantId: number;
  name: string;
  address: string;
  city: string | null;
  postcode: string | null;
  latitude: string | null;
  longitude: string | null;
  clientId: number | null;
  clientName: string | null;
  clientContact: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  contractRef: string | null;
  isActive: boolean;
  notes: string | null;
  siteCode: string | null;
  shiftPatterns: ShiftPattern[] | null;
  geofenceRadiusMetres: number | null;
};

type ClientOption = { id: number; company_name: string };

type SitesResponse = {
  sites: SiteRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  stats: { total: number; filtered: number; active: number; withClient: number };
};

const emptyForm = {
  name: "", address: "", city: "", postcode: "",
  latitude: "", longitude: "", clientId: "",
  clientName: "", clientContact: "", clientEmail: "", clientPhone: "",
  contractRef: "", notes: "", geofenceRadiusMetres: "",
};

export default function SitesPage() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [shiftPatterns, setShiftPatterns] = useState<ShiftPattern[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const limit = 50;

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (clientFilter && clientFilter !== "all") params.set("clientId", clientFilter);
    return params.toString();
  }, [page, debouncedSearch, clientFilter]);

  const { data, isLoading } = useQuery<SitesResponse>({
    queryKey: ["/api/sites", page, debouncedSearch, clientFilter],
    queryFn: async () => {
      const res = await fetch(`/api/sites?${buildQueryString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch sites");
      return res.json();
    },
  });

  const sites = data?.sites || [];
  const pagination = data?.pagination || { page: 1, limit, total: 0, totalPages: 0 };
  const stats = data?.stats || { total: 0, filtered: 0, active: 0, withClient: 0 };

  const { data: clientOptions = [] } = useQuery<ClientOption[]>({ queryKey: ["/api/clients"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const payload = { ...data, clientId: data.clientId ? parseInt(data.clientId) : null };
      const res = await apiRequest("POST", "/api/sites", payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Site created" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setShowAdd(false);
      setForm(emptyForm);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const payload = { ...data, clientId: data.clientId ? parseInt(data.clientId) : null };
      const res = await apiRequest("PATCH", `/api/sites/${id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Site updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Site deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (siteIds: number[]) => {
      const res = await apiRequest("POST", "/api/sites/bulk-delete", { siteIds });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({ title: `${data.deleted} site(s) deleted` });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setSelectedIds(new Set());
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const selectionMode = selectedIds.size > 0;

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    if (sites.every(s => selectedIds.has(s.id))) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        sites.forEach(s => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        sites.forEach(s => next.add(s.id));
        return next;
      });
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`Delete ${selectedIds.size} selected site(s)? This cannot be undone.`)) {
      bulkDeleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const openEdit = (s: SiteRow) => {
    setForm({
      name: s.name || "", address: s.address || "", city: s.city || "", postcode: s.postcode || "",
      latitude: s.latitude || "", longitude: s.longitude || "",
      clientId: s.clientId ? String(s.clientId) : "",
      clientName: s.clientName || "", clientContact: s.clientContact || "",
      clientEmail: s.clientEmail || "", clientPhone: s.clientPhone || "",
      contractRef: s.contractRef || "", notes: s.notes || "",
      geofenceRadiusMetres: s.geofenceRadiusMetres != null ? String(s.geofenceRadiusMetres) : "",
    });
    setShiftPatterns(s.shiftPatterns || []);
    setEditId(s.id);
  };

  const getClientNameForSite = (s: SiteRow) => {
    if (s.clientId) {
      const client = clientOptions.find(c => c.id === s.clientId);
      return client?.company_name || s.clientName || "";
    }
    return s.clientName || "";
  };

  const renderForm = () => (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Site Name *</Label>
          <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Head Office Reception" data-testid="input-site-name" />
        </div>
        <div className="space-y-1.5 col-span-2">
          <Label className="text-xs">Address *</Label>
          <Input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} data-testid="input-site-address" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">City</Label>
          <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} data-testid="input-site-city" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Postcode</Label>
          <Input value={form.postcode} onChange={e => setForm(f => ({ ...f, postcode: e.target.value }))} placeholder="SW1A 1AA" data-testid="input-site-postcode" />
        </div>
      </div>

      <Separator />
      <h4 className="text-sm font-medium">Client Assignment</h4>
      <div className="space-y-1.5">
        <Label className="text-xs">Assign to Client</Label>
        <Select value={form.clientId} onValueChange={v => setForm(f => ({ ...f, clientId: v }))}>
          <SelectTrigger data-testid="select-site-client">
            <SelectValue placeholder="Select a client (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No client</SelectItem>
            {clientOptions.map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />
      <h4 className="text-sm font-medium">Location Coordinates (Optional)</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Latitude</Label>
          <Input value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} placeholder="51.5074" data-testid="input-site-lat" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Longitude</Label>
          <Input value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} placeholder="-0.1278" data-testid="input-site-lng" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Geofence Radius Override (metres)</Label>
        <Input type="number" min={50} max={5000} value={form.geofenceRadiusMetres} onChange={e => setForm(f => ({ ...f, geofenceRadiusMetres: e.target.value }))} placeholder="Leave blank to use tenant default" data-testid="input-site-geofence-radius" />
        <p className="text-[11px] text-muted-foreground">Optional. When set (50–5000m), this radius takes precedence over the tenant-wide default for check-in/out at this site.</p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Contract Reference</Label>
        <Input value={form.contractRef} onChange={e => setForm(f => ({ ...f, contractRef: e.target.value }))} data-testid="input-site-contract-ref" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Notes</Label>
        <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-site-notes" />
      </div>

      <Separator />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Shift Patterns</h4>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setShiftPatterns(prev => [...prev, { period: "day", hours: 12 }])}
            data-testid="button-add-shift-pattern"
          >
            <Plus className="w-3 h-3 mr-1" /> Add Pattern
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Define shift hour patterns for normalisation. Different patterns can apply for day and night shifts at this site.</p>
        {shiftPatterns.length === 0 && (
          <p className="text-xs text-muted-foreground italic" data-testid="text-no-patterns">No patterns defined — normalisation will use auto-detected majority pattern.</p>
        )}
        {shiftPatterns.map((sp, idx) => (
          <div key={idx} className="flex items-center gap-3" data-testid={`shift-pattern-row-${idx}`}>
            <Select
              value={sp.period}
              onValueChange={v => setShiftPatterns(prev => prev.map((p, i) => i === idx ? { ...p, period: v } : p))}
            >
              <SelectTrigger className="w-[120px] h-8 text-xs" data-testid={`select-pattern-period-${idx}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Day</SelectItem>
                <SelectItem value="night">Night</SelectItem>
                <SelectItem value="evening">Evening</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={String(sp.hours)}
              onValueChange={v => setShiftPatterns(prev => prev.map((p, i) => i === idx ? { ...p, hours: parseInt(v) } : p))}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs" data-testid={`select-pattern-hours-${idx}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="8">8 hours</SelectItem>
                <SelectItem value="10">10 hours</SelectItem>
                <SelectItem value="12">12 hours</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
              onClick={() => setShiftPatterns(prev => prev.filter((_, i) => i !== idx))}
              data-testid={`button-remove-pattern-${idx}`}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );

  const startItem = (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(pagination.page * pagination.limit, pagination.total);

  return (
    <div className="p-6 space-y-6" data-testid="sites-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sites / Locations</h1>
          <p className="text-muted-foreground text-sm">Manage deployment sites and locations where officers are assigned.</p>
        </div>
        <Button onClick={() => { setForm(emptyForm); setShiftPatterns([]); setShowAdd(true); }} className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" data-testid="button-add-site">
          <Plus className="w-4 h-4 mr-2" /> Add Site
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold" data-testid="stat-total">{stats.total.toLocaleString()}</div><div className="text-xs text-muted-foreground">Total Sites</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-green-600" data-testid="stat-active">{stats.active.toLocaleString()}</div><div className="text-xs text-muted-foreground">Active</div></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><div className="text-2xl font-bold text-blue-600" data-testid="stat-with-client">{stats.withClient.toLocaleString()}</div><div className="text-xs text-muted-foreground">Assigned to Client</div></CardContent></Card>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search sites..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" data-testid="input-search-sites" />
        </div>
        <Select value={clientFilter} onValueChange={v => { setClientFilter(v); setPage(1); setSelectedIds(new Set()); }}>
          <SelectTrigger className="w-56" data-testid="select-client-filter">
            <Building className="w-4 h-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Filter by client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Clients</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {clientOptions.sort((a, b) => a.company_name.localeCompare(b.company_name)).map(c => (
              <SelectItem key={c.id} value={String(c.id)}>{c.company_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sites.length > 0 && (
          <Button variant="outline" size="sm" onClick={selectAllOnPage} data-testid="button-select-all-sites">
            {sites.every(s => selectedIds.has(s.id)) ? "Deselect Page" : "Select Page"}
          </Button>
        )}
        {pagination.total > 0 && (
          <span className="text-xs text-muted-foreground ml-auto" data-testid="text-showing-count">
            Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {pagination.total.toLocaleString()}
            {stats.total !== pagination.total && ` (${stats.total.toLocaleString()} total)`}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Card key={i}><CardContent className="p-4"><div className="h-12 bg-muted animate-pulse rounded" /></CardContent></Card>)}</div>
      ) : sites.length === 0 ? (
        <Card><CardContent className="p-8 text-center"><MapPinned className="w-12 h-12 text-muted-foreground mx-auto mb-3" /><h3 className="font-semibold">No sites found</h3><p className="text-sm text-muted-foreground">{search || clientFilter !== "all" ? "Try adjusting your search or filter." : "Click 'Add Site' to create your first site."}</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {sites.map(s => {
            const clientLabel = getClientNameForSite(s);
            const isSelected = selectedIds.has(s.id);
            return (
              <Card key={s.id} className={`hover-elevate transition-all ${isSelected ? "ring-2 ring-[#1F3A5F] bg-blue-50/30" : ""}`} data-testid={`card-site-${s.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(s.id)}
                        className="flex-shrink-0"
                        data-testid={`checkbox-site-${s.id}`}
                      />
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <MapPinned className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {s.siteCode && <span className="text-xs text-muted-foreground font-mono" data-testid={`text-site-code-${s.id}`}>{s.siteCode}</span>}
                          <div className="font-medium text-sm truncate" data-testid={`text-site-name-${s.id}`}>{s.name}</div>
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {[s.address, s.city, s.postcode].filter(Boolean).join(", ")}
                        </div>
                        {clientLabel && (
                          <div className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                            <Building className="w-3 h-3" /> {clientLabel}
                          </div>
                        )}
                        {s.shiftPatterns && s.shiftPatterns.length > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            {s.shiftPatterns.map((sp, i) => (
                              <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0" data-testid={`badge-pattern-${s.id}-${i}`}>
                                {sp.period} {sp.hours}hr
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={s.isActive ? "default" : "destructive"}>{s.isActive ? "Active" : "Inactive"}</Badge>
                      <Button size="sm" variant="outline" className="h-7" onClick={() => openEdit(s)} data-testid={`button-edit-site-${s.id}`}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" className="h-7" onClick={() => { if (confirm("Delete this site?")) deleteMutation.mutate(s.id); }} data-testid={`button-delete-site-${s.id}`}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4" data-testid="pagination-controls">
          <Button
            variant="outline" size="sm"
            disabled={page === 1}
            onClick={() => setPage(1)}
            data-testid="button-first-page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
            data-testid="button-prev-page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1">
            {(() => {
              const pages: number[] = [];
              const start = Math.max(1, page - 2);
              const end = Math.min(pagination.totalPages, page + 2);
              for (let i = start; i <= end; i++) pages.push(i);
              return pages.map(p => (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  className={p === page ? "bg-[#1F3A5F]" : ""}
                  onClick={() => setPage(p)}
                  data-testid={`button-page-${p}`}
                >
                  {p}
                </Button>
              ));
            })()}
          </div>
          <Button
            variant="outline" size="sm"
            disabled={page === pagination.totalPages}
            onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
            data-testid="button-next-page"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline" size="sm"
            disabled={page === pagination.totalPages}
            onClick={() => setPage(pagination.totalPages)}
            data-testid="button-last-page"
          >
            <ChevronsRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {selectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1F3A5F] text-white rounded-lg shadow-xl px-6 py-3 flex items-center gap-4" data-testid="bulk-action-bar-sites">
          <span className="text-sm font-medium">{selectedIds.size} site(s) selected</span>
          <Button
            size="sm"
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            data-testid="button-bulk-delete-sites"
          >
            {bulkDeleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
            Delete Selected
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:text-white/80 hover:bg-white/10"
            onClick={() => setSelectedIds(new Set())}
            data-testid="button-clear-selection-sites"
          >
            <X className="w-4 h-4 mr-1" /> Clear
          </Button>
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5" /> Add New Site</DialogTitle></DialogHeader>
          {renderForm()}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={() => { const d = { ...form, clientId: form.clientId === "none" ? "" : form.clientId, shiftPatterns: shiftPatterns.length > 0 ? shiftPatterns : null }; createMutation.mutate(d); }} disabled={createMutation.isPending || !form.name || !form.address} className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" data-testid="button-submit-site">
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />} Add Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editId} onOpenChange={() => setEditId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Edit className="w-5 h-5" /> Edit Site</DialogTitle></DialogHeader>
          {renderForm()}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={() => { const d = { ...form, clientId: form.clientId === "none" ? "" : form.clientId, shiftPatterns: shiftPatterns.length > 0 ? shiftPatterns : null }; editId && updateMutation.mutate({ id: editId, data: d }); }} disabled={updateMutation.isPending || !form.name || !form.address} className="bg-[#1F3A5F] hover:bg-[#1F3A5F]/90" data-testid="button-update-site">
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
