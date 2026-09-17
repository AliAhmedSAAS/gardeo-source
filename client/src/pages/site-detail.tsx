import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { SiteAddressFields } from "@/components/SiteAddressFields";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Building2,
  FileText,
  History,
  Loader2,
  MapPinned,
  PhoneCall,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  Pencil,
  X,
} from "lucide-react";

type SiteDetail = {
  id: number;
  name: string;
  address: string;
  city: string | null;
  county: string | null;
  postcode: string | null;
  latitude: string | null;
  longitude: string | null;
  clientId: number | null;
  clientName: string | null;
  clientContact: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  managerName: string | null;
  managerEmail: string | null;
  bookOnEmail: string | null;
  bookOnEmailEnabled: boolean | null;
  checkCallEnabled: boolean | null;
  checkCallIntervalMinutes: number | null;
  checkCallScheduleMode: string | null;
  contractRef: string | null;
  isActive: boolean | null;
  notes: string | null;
  siteCode: string | null;
  geofenceRadiusMetres: number | null;
  shiftPatterns: { period: string; hours: number }[] | null;
};

type DutyType = { id: number; name: string; requiresLicense: boolean };
type ChargeRate = {
  id: number;
  dutyTypeId: number;
  dutyTypeName?: string | null;
  hourlyChargeRate: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
};
type SiteDoc = {
  id: number;
  documentType: string;
  displayName: string | null;
  fileName: string;
  fileUrl: string;
  createdAt: string;
};
type SiteNoteRow = {
  id: number;
  body: string;
  authorName?: string;
  createdAt: string;
};
type HistoryRow = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  officerName: string;
  hours: number;
  dutyTypeName: string | null;
  siaLicenseNumber: string | null;
  supplierName: string | null;
  title: string;
};

type ClientOption = { id: number; company_name: string };

async function uploadFile(file: File): Promise<string> {
  const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  });
  const data = await urlRes.json();
  if (data.useDirectUpload || !data.uploadURL) {
    const directRes = await fetch("/api/uploads/upload", {
      method: "POST",
      headers: {
        "X-File-Name": file.name,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
      credentials: "include",
    });
    const direct = await directRes.json();
    if (!directRes.ok) throw new Error(direct.error || direct.message || "Upload failed");
    return direct.objectPath as string;
  }
  const uploadRes = await fetch(data.uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!uploadRes.ok) throw new Error("Failed to upload file");
  return data.objectPath as string;
}

export default function SiteDetailPage() {
  const [, params] = useRoute("/sites/:id");
  const [, setLocation] = useLocation();
  const siteId = params?.id ? parseInt(params.id, 10) : NaN;
  const { toast } = useToast();
  const [tab, setTab] = useState("basic");

  const { data: site, isLoading } = useQuery<SiteDetail>({
    queryKey: ["/api/sites", siteId],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Site not found");
      return res.json();
    },
    enabled: Number.isFinite(siteId),
  });

  const { data: clients = [] } = useQuery<ClientOption[]>({ queryKey: ["/api/clients"] });
  const { data: dutyTypes = [] } = useQuery<DutyType[]>({
    queryKey: ["/api/tenant/duty-types"],
  });

  const { data: rates = [], refetch: refetchRates } = useQuery<ChargeRate[]>({
    queryKey: ["/api/sites", siteId, "charge-rates"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/charge-rates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load rates");
      return res.json();
    },
    enabled: Number.isFinite(siteId) && tab === "rates",
  });

  const { data: documents = [], refetch: refetchDocs } = useQuery<SiteDoc[]>({
    queryKey: ["/api/sites", siteId, "documents"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/documents`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load documents");
      return res.json();
    },
    enabled: Number.isFinite(siteId) && tab === "documents",
  });

  const { data: notes = [], refetch: refetchNotes } = useQuery<SiteNoteRow[]>({
    queryKey: ["/api/sites", siteId, "notes"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/notes`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load notes");
      return res.json();
    },
    enabled: Number.isFinite(siteId) && tab === "notes",
  });

  const { data: history = [] } = useQuery<HistoryRow[]>({
    queryKey: ["/api/sites", siteId, "history"],
    queryFn: async () => {
      const res = await fetch(`/api/sites/${siteId}/history`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load history");
      return res.json();
    },
    enabled: Number.isFinite(siteId) && tab === "history",
  });

  const [basicForm, setBasicForm] = useState({
    name: "",
    address: "",
    city: "",
    county: "",
    postcode: "",
    latitude: "",
    longitude: "",
    clientId: "",
    managerName: "",
    managerEmail: "",
    bookOnEmail: "",
    contractRef: "",
    geofenceRadiusMetres: "",
    isActive: true,
    notes: "",
  });

  const [checkForm, setCheckForm] = useState({
    checkCallEnabled: true,
    checkCallIntervalMinutes: 60,
    checkCallScheduleMode: "full_day",
    bookOnEmailEnabled: true,
  });

  useEffect(() => {
    if (!site) return;
    setBasicForm({
      name: site.name || "",
      address: site.address || "",
      city: site.city || "",
      county: site.county || "",
      postcode: site.postcode || "",
      latitude: site.latitude || "",
      longitude: site.longitude || "",
      clientId: site.clientId ? String(site.clientId) : "none",
      managerName: site.managerName || "",
      managerEmail: site.managerEmail || "",
      bookOnEmail: site.bookOnEmail || "",
      contractRef: site.contractRef || "",
      geofenceRadiusMetres: site.geofenceRadiusMetres != null ? String(site.geofenceRadiusMetres) : "",
      isActive: site.isActive !== false,
      notes: site.notes || "",
    });
    setCheckForm({
      checkCallEnabled: site.checkCallEnabled !== false,
      checkCallIntervalMinutes: site.checkCallIntervalMinutes ?? 60,
      checkCallScheduleMode: site.checkCallScheduleMode || "full_day",
      bookOnEmailEnabled: site.bookOnEmailEnabled !== false,
    });
  }, [site]);

  const saveBasicMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/sites/${siteId}`, {
        name: basicForm.name.trim(),
        address: basicForm.address.trim(),
        city: basicForm.city.trim() || null,
        county: basicForm.county.trim() || null,
        postcode: basicForm.postcode.trim() || null,
        latitude: basicForm.latitude.trim() || null,
        longitude: basicForm.longitude.trim() || null,
        clientId: basicForm.clientId && basicForm.clientId !== "none" ? parseInt(basicForm.clientId, 10) : null,
        managerName: basicForm.managerName.trim() || null,
        managerEmail: basicForm.managerEmail.trim() || null,
        bookOnEmail: basicForm.bookOnEmail.trim() || null,
        contractRef: basicForm.contractRef.trim() || null,
        geofenceRadiusMetres: basicForm.geofenceRadiusMetres ? parseInt(basicForm.geofenceRadiusMetres, 10) : null,
        isActive: basicForm.isActive,
        notes: basicForm.notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({ title: "Site updated" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const saveCheckMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/sites/${siteId}`, {
        checkCallEnabled: checkForm.checkCallEnabled,
        checkCallIntervalMinutes: Math.max(15, Number(checkForm.checkCallIntervalMinutes) || 60),
        checkCallScheduleMode: checkForm.checkCallScheduleMode,
        bookOnEmailEnabled: checkForm.bookOnEmailEnabled,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites", siteId] });
      toast({ title: "Check-call settings saved" });
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const emptyRateForm = {
    dutyTypeId: "",
    hourlyChargeRate: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: "",
    notes: "",
  };
  const [rateForm, setRateForm] = useState(emptyRateForm);
  const [editingRateId, setEditingRateId] = useState<number | null>(null);

  const resetRateForm = () => {
    setEditingRateId(null);
    setRateForm({
      ...emptyRateForm,
      effectiveFrom: new Date().toISOString().slice(0, 10),
    });
  };

  const startEditRate = (r: ChargeRate) => {
    setEditingRateId(r.id);
    setRateForm({
      dutyTypeId: String(r.dutyTypeId),
      hourlyChargeRate: String(r.hourlyChargeRate),
      effectiveFrom: String(r.effectiveFrom).slice(0, 10),
      effectiveTo: r.effectiveTo ? String(r.effectiveTo).slice(0, 10) : "",
      notes: r.notes || "",
    });
  };

  const addRateMut = useMutation({
    mutationFn: async () => {
      const payload = {
        dutyTypeId: parseInt(rateForm.dutyTypeId, 10),
        hourlyChargeRate: rateForm.hourlyChargeRate,
        effectiveFrom: rateForm.effectiveFrom,
        effectiveTo: rateForm.effectiveTo || null,
        notes: rateForm.notes || null,
      };
      if (editingRateId) {
        const res = await apiRequest("PATCH", `/api/sites/${siteId}/charge-rates/${editingRateId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/sites/${siteId}/charge-rates`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editingRateId ? "Charge rate updated" : "Charge rate added" });
      resetRateForm();
      refetchRates();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteRateMut = useMutation({
    mutationFn: async (rateId: number) => {
      await apiRequest("DELETE", `/api/sites/${siteId}/charge-rates/${rateId}`);
    },
    onSuccess: () => {
      toast({ title: "Rate removed" });
      if (editingRateId) resetRateForm();
      refetchRates();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const [docType, setDocType] = useState("contract");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const uploadDoc = async () => {
    if (!docFile) {
      toast({ title: "Choose a file", variant: "destructive" });
      return;
    }
    try {
      setUploading(true);
      const fileUrl = await uploadFile(docFile);
      await apiRequest("POST", `/api/sites/${siteId}/documents`, {
        documentType: docType,
        displayName: docFile.name,
        fileName: docFile.name,
        fileUrl,
        fileSize: docFile.size,
        mimeType: docFile.type || null,
      });
      toast({ title: "Document uploaded" });
      setDocFile(null);
      refetchDocs();
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const deleteDocMut = useMutation({
    mutationFn: async (docId: number) => {
      await apiRequest("DELETE", `/api/sites/${siteId}/documents/${docId}`);
    },
    onSuccess: () => {
      toast({ title: "Document deleted" });
      refetchDocs();
    },
  });

  const [noteBody, setNoteBody] = useState("");
  const addNoteMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/sites/${siteId}/notes`, { body: noteBody });
      return res.json();
    },
    onSuccess: () => {
      setNoteBody("");
      toast({ title: "Note added" });
      refetchNotes();
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  if (!Number.isFinite(siteId)) {
    return <div className="p-6">Invalid site</div>;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!site) {
    return (
      <div className="p-6 space-y-4">
        <p>Site not found.</p>
        <Button variant="outline" onClick={() => setLocation("/sites")}>
          Back to sites
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="site-detail-page">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="px-0 h-auto mb-1" asChild>
            <Link href="/sites">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Sites
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
              <MapPinned className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {site.siteCode && <span className="text-xs font-mono text-muted-foreground">{site.siteCode}</span>}
                <h1 className="text-2xl font-bold" data-testid="text-site-detail-name">{site.name}</h1>
                <Badge variant={site.isActive !== false ? "default" : "destructive"}>
                  {site.isActive !== false ? "Active" : "Inactive"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {[site.address, site.city, site.county, site.postcode].filter(Boolean).join(", ")}
              </p>
              {site.clientName && (
                <p className="text-xs text-blue-600 flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3 h-3" /> {site.clientName}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto">
          <TabsTrigger value="basic" data-testid="tab-site-basic">Basic info</TabsTrigger>
          <TabsTrigger value="rates" data-testid="tab-site-rates">Charge rates</TabsTrigger>
          <TabsTrigger value="documents" data-testid="tab-site-documents">Documents</TabsTrigger>
          <TabsTrigger value="checkcall" data-testid="tab-site-checkcall">
            <PhoneCall className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
            Check-call
          </TabsTrigger>
          <TabsTrigger value="history" data-testid="tab-site-history">History</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-site-notes">Notes</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Basic information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Name</Label>
                  <Input value={basicForm.name} onChange={(e) => setBasicForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <SiteAddressFields
                    value={{
                      address: basicForm.address,
                      county: basicForm.county,
                      city: basicForm.city,
                      postcode: basicForm.postcode,
                      latitude: basicForm.latitude,
                      longitude: basicForm.longitude,
                    }}
                    onChange={(patch) => setBasicForm((f) => ({ ...f, ...patch }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <SearchableSelect
                    value={basicForm.clientId}
                    onValueChange={(v) => setBasicForm((f) => ({ ...f, clientId: v }))}
                    options={clients.map((c) => ({
                      value: String(c.id),
                      label: c.company_name,
                    }))}
                    noneValue="none"
                    noneLabel="Unassigned"
                    placeholder="Select client"
                    searchPlaceholder="Search clients…"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contract ref</Label>
                  <Input value={basicForm.contractRef} onChange={(e) => setBasicForm((f) => ({ ...f, contractRef: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Manager name</Label>
                  <Input value={basicForm.managerName} onChange={(e) => setBasicForm((f) => ({ ...f, managerName: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Manager email</Label>
                  <Input value={basicForm.managerEmail} onChange={(e) => setBasicForm((f) => ({ ...f, managerEmail: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Book-on email</Label>
                  <Input value={basicForm.bookOnEmail} onChange={(e) => setBasicForm((f) => ({ ...f, bookOnEmail: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Geofence radius (m)</Label>
                  <Input value={basicForm.geofenceRadiusMetres} onChange={(e) => setBasicForm((f) => ({ ...f, geofenceRadiusMetres: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={basicForm.isActive} onCheckedChange={(v) => setBasicForm((f) => ({ ...f, isActive: v }))} />
                  <Label>Active</Label>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Site summary notes</Label>
                  <Textarea value={basicForm.notes} onChange={(e) => setBasicForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
                </div>
              </div>
              <Button onClick={() => saveBasicMut.mutate()} disabled={saveBasicMut.isPending} data-testid="btn-save-site-basic">
                {saveBasicMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Save basic info
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rates" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Charge rates by duty type</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label>Duty type</Label>
                  <Select value={rateForm.dutyTypeId} onValueChange={(v) => setRateForm((f) => ({ ...f, dutyTypeId: v }))}>
                    <SelectTrigger data-testid="select-site-duty-type">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {dutyTypes.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Hourly rate (£)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={rateForm.hourlyChargeRate}
                    onChange={(e) => setRateForm((f) => ({ ...f, hourlyChargeRate: e.target.value }))}
                    data-testid="input-site-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective from</Label>
                  <Input
                    type="date"
                    value={rateForm.effectiveFrom}
                    onChange={(e) => setRateForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                    data-testid="input-site-rate-from"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Effective to</Label>
                  <Input
                    type="date"
                    value={rateForm.effectiveTo}
                    onChange={(e) => setRateForm((f) => ({ ...f, effectiveTo: e.target.value }))}
                    data-testid="input-site-rate-to"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    className="flex-1"
                    disabled={addRateMut.isPending || !rateForm.dutyTypeId || !rateForm.hourlyChargeRate || !rateForm.effectiveFrom}
                    onClick={() => addRateMut.mutate()}
                    data-testid="btn-add-site-rate"
                  >
                    {editingRateId ? (
                      <>Save changes</>
                    ) : (
                      <><Plus className="w-4 h-4 mr-1" /> Add rate</>
                    )}
                  </Button>
                  {editingRateId && (
                    <Button type="button" variant="outline" onClick={resetRateForm} data-testid="btn-cancel-edit-rate">
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              {editingRateId && (
                <p className="text-xs text-muted-foreground">Editing rate #{editingRateId}. Change fields and save, or cancel.</p>
              )}
              {rates.length === 0 ? (
                <p className="text-sm text-muted-foreground">No charge rates yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Duty type</TableHead>
                      <TableHead>Hourly rate</TableHead>
                      <TableHead>Effective from</TableHead>
                      <TableHead>Effective to</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rates.map((r) => (
                      <TableRow key={r.id} className={editingRateId === r.id ? "bg-muted/40" : undefined}>
                        <TableCell>{r.dutyTypeName || `Duty #${r.dutyTypeId}`}</TableCell>
                        <TableCell>£{Number(r.hourlyChargeRate).toFixed(2)}</TableCell>
                        <TableCell>{String(r.effectiveFrom).slice(0, 10)}</TableCell>
                        <TableCell>{r.effectiveTo ? String(r.effectiveTo).slice(0, 10) : "—"}</TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => startEditRate(r)} data-testid={`btn-edit-rate-${r.id}`}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => deleteRateMut.mutate(r.id)} data-testid={`btn-delete-rate-${r.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="w-4 h-4" /> Documents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contract">Contract</SelectItem>
                      <SelectItem value="risk_assessment">Risk assessment</SelectItem>
                      <SelectItem value="assignment_instructions">Assignment instructions</SelectItem>
                      <SelectItem value="site_plan">Site plan</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>File</Label>
                  <Input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                </div>
                <div className="flex items-end">
                  <Button className="w-full" disabled={uploading || !docFile} onClick={uploadDoc}>
                    {uploading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                    Upload
                  </Button>
                </div>
              </div>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No documents uploaded.</p>
              ) : (
                <div className="space-y-2">
                  {documents.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{d.displayName || d.fileName}</div>
                        <div className="text-xs text-muted-foreground">
                          {d.documentType} · {new Date(d.createdAt).toLocaleDateString("en-GB")}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={d.fileUrl} target="_blank" rel="noreferrer">Open</a>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteDocMut.mutate(d.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="checkcall" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Check-call & book-on email settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <div className="font-medium">Enable check-calls</div>
                  <p className="text-xs text-muted-foreground">When off, no check-calls are generated for this site.</p>
                </div>
                <Switch
                  checked={checkForm.checkCallEnabled}
                  onCheckedChange={(v) => setCheckForm((f) => ({ ...f, checkCallEnabled: v }))}
                  data-testid="switch-checkcall-enabled"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Check-call interval (minutes)</Label>
                  <Input
                    type="number"
                    min={15}
                    value={checkForm.checkCallIntervalMinutes}
                    onChange={(e) =>
                      setCheckForm((f) => ({ ...f, checkCallIntervalMinutes: parseInt(e.target.value, 10) || 60 }))
                    }
                    disabled={!checkForm.checkCallEnabled}
                    data-testid="input-checkcall-interval"
                  />
                  <p className="text-xs text-muted-foreground">Default 60 minutes.</p>
                </div>
                <div className="space-y-2">
                  <Label>Schedule window</Label>
                  <Select
                    value={checkForm.checkCallScheduleMode}
                    onValueChange={(v) => setCheckForm((f) => ({ ...f, checkCallScheduleMode: v }))}
                    disabled={!checkForm.checkCallEnabled}
                  >
                    <SelectTrigger data-testid="select-checkcall-schedule">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_day">Full day</SelectItem>
                      <SelectItem value="day">Day time (6am–6pm)</SelectItem>
                      <SelectItem value="night">Night time (6pm–6am)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                <div>
                  <div className="font-medium">Send book-on email</div>
                  <p className="text-xs text-muted-foreground">
                    When off, manual/app book-on will not email the client for this site.
                  </p>
                </div>
                <Switch
                  checked={checkForm.bookOnEmailEnabled}
                  onCheckedChange={(v) => setCheckForm((f) => ({ ...f, bookOnEmailEnabled: v }))}
                  data-testid="switch-bookon-email"
                />
              </div>
              <Button onClick={() => saveCheckMut.mutate()} disabled={saveCheckMut.isPending} data-testid="btn-save-checkcall-settings">
                {saveCheckMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Save settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <History className="w-4 h-4" /> Officer / hours history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No shifts recorded for this site yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Officer</TableHead>
                      <TableHead>Duty</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Supplier</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{String(h.date).slice(0, 10)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-sm">{h.officerName}</div>
                          {h.siaLicenseNumber && (
                            <div className="text-xs text-muted-foreground">SIA {h.siaLicenseNumber}</div>
                          )}
                        </TableCell>
                        <TableCell>{h.dutyTypeName || "—"}</TableCell>
                        <TableCell className="text-sm">
                          {h.startTime?.slice(0, 5)}–{h.endTime?.slice(0, 5)}
                        </TableCell>
                        <TableCell>{Number(h.hours ?? 0).toFixed(1)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{h.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{h.supplierName || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <StickyNote className="w-4 h-4" /> Notes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Add note</Label>
                <Textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  rows={3}
                  placeholder="Write a site note…"
                  data-testid="input-site-note"
                />
                <Button
                  disabled={!noteBody.trim() || addNoteMut.isPending}
                  onClick={() => addNoteMut.mutate()}
                  data-testid="btn-add-site-note"
                >
                  {addNoteMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                  Add note
                </Button>
              </div>
              {notes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <div key={n.id} className="rounded-lg border p-3">
                      <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {n.authorName || "Unknown"} · {new Date(n.createdAt).toLocaleString("en-GB")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
