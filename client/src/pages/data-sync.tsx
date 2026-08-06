import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw, Plus, Trash2, TestTube, Play, Settings2, ChevronDown, Eye,
  CheckCircle2, XCircle, Clock, Loader2, Users, MapPin, Building, Truck, CalendarDays, AlertTriangle, Wifi, WifiOff, ArrowRight, Globe, Code2,
  Link2, ChevronUp, ChevronsUpDown,
} from "lucide-react";

type SyncConfiguration = {
  id: number;
  tenantId: number;
  name: string;
  apiBaseUrl: string;
  apiKeyEncrypted: string;
  connectionType: string;
  syncEntities: string[] | null;
  lastSyncAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type EntitySyncBreakdown = {
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: string[];
};

type SyncLog = {
  id: number;
  tenantId: number;
  configId: number;
  syncType: string;
  status: string;
  recordsCreated: number;
  recordsUpdated: number;
  recordsSkipped: number;
  recordsFailed: number;
  errors: string[] | null;
  entityBreakdown: Record<string, EntitySyncBreakdown> | null;
  startedAt: string;
  completedAt: string | null;
};

type PotentialDuplicateMatch = {
  matchedId: number;
  matchedName: string;
  matchReason: string;
  score: number;
};

type DryRunRecord = {
  action: "create" | "update" | "skip";
  entity: string;
  externalId: string;
  name: string;
  fieldsToUpdate?: string[];
  reason?: string;
  potentialDuplicates?: PotentialDuplicateMatch[];
};

type DryRunResult = {
  entityType: string;
  totalFetched: number;
  toCreate: number;
  toUpdate: number;
  toSkip: number;
  records: DryRunRecord[];
};

type BackfillSiteMatch = {
  localSiteId: number;
  localSiteName: string;
  localExternalId: string | null;
  externalSiteId: string;
  externalSiteName: string;
  matchScore: number;
  matchReason: string;
};

type BackfillSiteResult = {
  matched: BackfillSiteMatch[];
  unmatched: Array<{ localSiteId: number; localSiteName: string }>;
  totalLocal: number;
  totalExternal: number;
};

const ENTITY_TYPES = [
  { key: "employees", label: "Employees", icon: Users },
  { key: "sites", label: "Sites", icon: MapPin },
  { key: "clients", label: "Clients", icon: Building },
  { key: "suppliers", label: "Suppliers", icon: Truck },
  { key: "shifts", label: "Shifts", icon: CalendarDays },
];

export default function DataSyncPage() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<SyncConfiguration | null>(null);
  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formApiKey, setFormApiKey] = useState("");
  const [formType, setFormType] = useState<"rest" | "php" | "rest_php" | "php_employees">("rest");
  const [formEntities, setFormEntities] = useState<string[]>(["employees", "sites", "clients", "suppliers", "shifts"]);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [syncingType, setSyncingType] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [previewData, setPreviewData] = useState<DryRunResult[] | null>(null);
  const [previewConfigId, setPreviewConfigId] = useState<number | null>(null);
  const [previewingId, setPreviewingId] = useState<number | null>(null);
  const [previewFilter, setPreviewFilter] = useState<"all" | "create" | "update" | "skip">("all");
  const [previewSiteDecisions, setPreviewSiteDecisions] = useState<Record<string, { action: "use_existing" | "create_new"; siteId?: number }>>({});
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [pageFrom, setPageFrom] = useState("1");
  const [pageTo, setPageTo] = useState("10");
  const [backfillConfigId, setBackfillConfigId] = useState<number | null>(null);
  const [backfillMinScore, setBackfillMinScore] = useState("70");
  const [backfillResult, setBackfillResult] = useState<BackfillSiteResult | null>(null);
  const [backfillFilter, setBackfillFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [backfillSortCol, setBackfillSortCol] = useState<"localSiteName" | "externalSiteName" | "matchScore" | "matchReason">("matchScore");
  const [backfillSortDir, setBackfillSortDir] = useState<"asc" | "desc">("desc");
  const [backfillSearch, setBackfillSearch] = useState("");
  const [backfillApplied, setBackfillApplied] = useState(false);

  const { data: configs = [], isLoading: configsLoading } = useQuery<SyncConfiguration[]>({
    queryKey: ["/api/sync/configurations"],
  });

  const { data: suppliersList = [] } = useQuery<{ id: number; company_name: string; external_id: string | null }[]>({
    queryKey: ["/api/suppliers-for-sync"],
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<SyncLog[]>({
    queryKey: ["/api/sync/logs"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; apiBaseUrl: string; apiKey: string; syncEntities: string[] }) => {
      const res = await apiRequest("POST", "/api/sync/configurations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/configurations"] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Connection created", description: "Your external system connection has been saved." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/sync/configurations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/configurations"] });
      setEditingConfig(null);
      resetForm();
      toast({ title: "Connection updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sync/configurations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sync/configurations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/logs"] });
      toast({ title: "Connection deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (id: number) => {
      setTestingId(id);
      const res = await apiRequest("POST", `/api/sync/configurations/${id}/test`);
      return res.json();
    },
    onSuccess: (data: { success: boolean; message: string }) => {
      setTestingId(null);
      if (data.success) {
        toast({ title: "Connection successful", description: data.message });
      } else {
        toast({ title: "Connection failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      setTestingId(null);
      toast({ title: "Test failed", description: err.message, variant: "destructive" });
    },
  });

  const previewMutation = useMutation({
    mutationFn: async ({ id, dateFrom: df, dateTo: dt, supplierId: sid, pageFrom: pf, pageTo: pt }: { id: number; dateFrom?: string; dateTo?: string; supplierId?: string; pageFrom?: number; pageTo?: number }) => {
      setPreviewingId(id);
      const body: any = {};
      if (df) body.dateFrom = df;
      if (dt) body.dateTo = dt;
      if (sid) body.supplierId = sid;
      if (pf) body.pageFrom = pf;
      if (pt) body.pageTo = pt;
      const res = await apiRequest("POST", `/api/sync/configurations/${id}/preview`, body);
      return res.json();
    },
    onSuccess: (data: DryRunResult[], variables: { id: number; dateFrom?: string; dateTo?: string }) => {
      setPreviewingId(null);
      setPreviewData(data);
      setPreviewConfigId(variables.id);
      setPreviewFilter("all");
      const defaultDecisions: Record<string, { action: "use_existing" | "create_new"; siteId?: number }> = {};
      for (const result of data) {
        for (const rec of result.records) {
          if (rec.potentialDuplicates && rec.potentialDuplicates.length > 0) {
            defaultDecisions[rec.name] = { action: "use_existing", siteId: rec.potentialDuplicates[0].matchedId };
          }
        }
      }
      setPreviewSiteDecisions(defaultDecisions);
    },
    onError: (err: any) => {
      setPreviewingId(null);
      toast({ title: "Preview failed", description: err.message, variant: "destructive" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async ({ id, type, dateFrom: df, dateTo: dt, supplierId: sid, siteDecisions, pageFrom: pf, pageTo: pt }: { id: number; type?: string; dateFrom?: string; dateTo?: string; supplierId?: string; siteDecisions?: Record<string, { action: "use_existing" | "create_new"; siteId?: number }>; pageFrom?: number; pageTo?: number }) => {
      setSyncingId(id);
      setSyncingType(type || "all");
      const url = type ? `/api/sync/configurations/${id}/run?type=${type}` : `/api/sync/configurations/${id}/run`;
      const body: any = {};
      if (df) body.dateFrom = df;
      if (dt) body.dateTo = dt;
      if (sid) body.supplierId = sid;
      if (siteDecisions && Object.keys(siteDecisions).length > 0) body.siteDecisions = siteDecisions;
      if (pf) body.pageFrom = pf;
      if (pt) body.pageTo = pt;
      const res = await apiRequest("POST", url, body);
      return res.json();
    },
    onSuccess: (data: SyncLog) => {
      setSyncingId(null);
      setSyncingType(null);
      queryClient.invalidateQueries({ queryKey: ["/api/sync/configurations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sync/logs"] });
      const total = (data.recordsCreated || 0) + (data.recordsUpdated || 0);
      let desc = `Created: ${data.recordsCreated}, Updated: ${data.recordsUpdated}, Skipped: ${data.recordsSkipped}, Failed: ${data.recordsFailed}`;
      if (data.entityBreakdown) {
        const parts = ["clients", "sites", "suppliers", "employees", "shifts"]
          .filter(t => data.entityBreakdown?.[t])
          .map(t => {
            const b = data.entityBreakdown![t];
            const counts = [];
            if (b.created > 0) counts.push(`+${b.created}`);
            if (b.updated > 0) counts.push(`~${b.updated}`);
            if (b.skipped > 0) counts.push(`⊘${b.skipped}`);
            if (b.failed > 0) counts.push(`✗${b.failed}`);
            return counts.length > 0 ? `${t}: ${counts.join("/")}` : null;
          })
          .filter(Boolean);
        if (parts.length > 0) desc += ` | ${parts.join(", ")}`;
      }
      toast({
        title: data.status === "completed" ? "Sync completed" : "Sync finished with errors",
        description: desc,
        variant: data.status === "failed" ? "destructive" : "default",
      });
    },
    onError: (err: any) => {
      setSyncingId(null);
      setSyncingType(null);
      toast({ title: "Sync failed", description: err.message, variant: "destructive" });
    },
  });

  const backfillPreviewMutation = useMutation({
    mutationFn: async ({ configId, minScore }: { configId: number; minScore: number }) => {
      const res = await apiRequest("POST", "/api/admin/backfill-site-external-ids/preview", { configId, minScore });
      return res.json() as Promise<BackfillSiteResult>;
    },
    onSuccess: (data) => {
      setBackfillResult(data);
      setBackfillFilter("all");
      setBackfillSearch("");
      setBackfillSortCol("matchScore");
      setBackfillSortDir("desc");
      setBackfillApplied(false);
    },
    onError: (err: any) => {
      toast({ title: "Backfill preview failed", description: err.message, variant: "destructive" });
    },
  });

  const backfillApplyMutation = useMutation({
    mutationFn: async ({ configId, minScore }: { configId: number; minScore: number }) => {
      const res = await apiRequest("POST", "/api/admin/backfill-site-external-ids/apply", { configId, minScore });
      return res.json() as Promise<BackfillSiteResult>;
    },
    onSuccess: (data) => {
      setBackfillResult(data);
      setBackfillApplied(true);
      toast({ title: "Backfill applied", description: `${data.matched.length} sites linked to external IDs.` });
    },
    onError: (err: any) => {
      toast({ title: "Backfill failed", description: err.message, variant: "destructive" });
    },
  });

  function toggleBackfillSort(col: typeof backfillSortCol) {
    if (backfillSortCol === col) {
      setBackfillSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setBackfillSortCol(col);
      setBackfillSortDir(col === "matchScore" ? "desc" : "asc");
    }
  }

  function resetForm() {
    setFormName("");
    setFormUrl("");
    setFormApiKey("");
    setFormType("rest");
    setFormEntities(["employees", "sites", "clients", "suppliers", "shifts"]);
  }

  function openEditDialog(config: SyncConfiguration) {
    setEditingConfig(config);
    setFormName(config.name);
    setFormUrl(config.apiBaseUrl);
    setFormApiKey("");
    setFormType((config.connectionType === "php" ? "php" : config.connectionType === "rest_php" ? "rest_php" : config.connectionType === "php_employees" ? "php_employees" : "rest") as "rest" | "php" | "rest_php" | "php_employees");
    setFormEntities(config.syncEntities || ["employees", "sites", "clients", "suppliers", "shifts"]);
  }

  function needsDateRangeType(type: string) {
    return type === "php" || type === "rest_php";
  }

  function isPhpEmployeesType(type: string) {
    return type === "php_employees";
  }

  function handleSave() {
    const syncEntities = formType === "rest" ? formEntities
      : formType === "php_employees" ? ["employees"]
      : ["shifts"];
    if (editingConfig) {
      const data: any = { name: formName, apiBaseUrl: formUrl, connectionType: formType, syncEntities };
      if (formApiKey) data.apiKey = formApiKey;
      updateMutation.mutate({ id: editingConfig.id, data });
    } else {
      createMutation.mutate({ name: formName, apiBaseUrl: formUrl, apiKey: formApiKey, connectionType: formType, syncEntities });
    }
  }

  function toggleEntity(entity: string) {
    setFormEntities(prev =>
      prev.includes(entity) ? prev.filter(e => e !== entity) : [...prev, entity]
    );
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  function getDuration(start: string, end: string | null) {
    if (!end) return "—";
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  const isSyncing = syncingId !== null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-page-title">Data Sync</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect to your external staff management system and sync data automatically
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={(open) => { setShowAddDialog(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-connection" className="bg-[#1F3A5F] hover:bg-[#2a4f7f]">
              <Plus className="w-4 h-4 mr-2" /> Add Connection
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add External System Connection</DialogTitle>
              <DialogDescription>
                Configure the API connection to your other staff management system.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-2 block">Connection Type</Label>
                <Select value={formType} onValueChange={(v: "rest" | "php" | "rest_php" | "php_employees") => setFormType(v)} data-testid="select-connection-type">
                  <SelectTrigger data-testid="select-trigger-connection-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rest" data-testid="select-item-rest">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        REST API — Standard multi-entity sync
                      </div>
                    </SelectItem>
                    <SelectItem value="php_employees" data-testid="select-item-php-employees">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        PHP API — Employees only
                      </div>
                    </SelectItem>
                    <SelectItem value="php" data-testid="select-item-php">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4" />
                        PHP API — Flat shifts endpoint
                      </div>
                    </SelectItem>
                    <SelectItem value="rest_php" data-testid="select-item-rest-php">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        REST API (Paginated) — Shifts with date range
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {formType === "rest"
                    ? "Standard REST API with separate endpoints for employees, sites, clients, suppliers, and shifts."
                    : formType === "php_employees"
                    ? "PHP employees endpoint with api_key param. Syncs all employee data including bank details, documents, employment history, and passport data."
                    : formType === "php"
                    ? "Single PHP shifts endpoint with flat response. Suppliers, clients, sites, and employees are auto-created from shift data."
                    : "Paginated REST shifts endpoint with date range parameters. Entities are auto-created from shift external IDs."}
                </p>
              </div>
              <div>
                <Label htmlFor="conn-name">Connection Name</Label>
                <Input id="conn-name" data-testid="input-connection-name" placeholder={formType === "rest" ? "e.g. Main Staff System" : "e.g. Cloudways Shifts"} value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="conn-url">{formType === "rest" ? "API Base URL" : "Endpoint URL"}</Label>
                <Input id="conn-url" data-testid="input-api-url" placeholder={formType === "rest" ? "https://your-system.example.com" : formType === "php_employees" ? "https://your-server.com/RESTAPI1/api/employees.php" : formType === "php" ? "https://your-server.com/RestAPI/shifts.php" : "https://your-server.com/RESTAPI1/api/shifts.php"} value={formUrl} onChange={e => setFormUrl(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="conn-key">API Key</Label>
                <Input id="conn-key" data-testid="input-api-key" type="password" placeholder="Enter your API key" value={formApiKey} onChange={e => setFormApiKey(e.target.value)} />
              </div>
              {formType === "rest" && (
                <div>
                  <Label className="mb-2 block">Entities to Sync</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ENTITY_TYPES.map(et => (
                      <label key={et.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          data-testid={`checkbox-entity-${et.key}`}
                          checked={formEntities.includes(et.key)}
                          onCheckedChange={() => toggleEntity(et.key)}
                        />
                        <et.icon className="w-4 h-4 text-muted-foreground" />
                        {et.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }} data-testid="button-cancel-add">Cancel</Button>
              <Button onClick={handleSave} disabled={!formName || !formUrl || !formApiKey || createMutation.isPending} className="bg-[#1F3A5F] hover:bg-[#2a4f7f]" data-testid="button-save-connection">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Save Connection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {configsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <WifiOff className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Connections Configured</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Add a connection to your external staff management system to start syncing employees, sites, clients, suppliers, and shifts.
            </p>
            <Button onClick={() => setShowAddDialog(true)} className="bg-[#1F3A5F] hover:bg-[#2a4f7f]" data-testid="button-add-first-connection">
              <Plus className="w-4 h-4 mr-2" /> Add Your First Connection
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {configs.map(config => (
            <Card key={config.id} data-testid={`card-connection-${config.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${config.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg" data-testid={`text-connection-name-${config.id}`}>{config.name}</CardTitle>
                        {config.connectionType === "php_employees" ? (
                          <Badge className="bg-orange-100 text-orange-800 text-xs" data-testid={`badge-type-${config.id}`}>
                            <Users className="w-3 h-3 mr-1" /> PHP Employees
                          </Badge>
                        ) : config.connectionType === "php" ? (
                          <Badge className="bg-purple-100 text-purple-800 text-xs" data-testid={`badge-type-${config.id}`}>
                            <Code2 className="w-3 h-3 mr-1" /> PHP API
                          </Badge>
                        ) : config.connectionType === "rest_php" ? (
                          <Badge className="bg-green-100 text-green-800 text-xs" data-testid={`badge-type-${config.id}`}>
                            <Globe className="w-3 h-3 mr-1" /> REST Shifts
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-100 text-blue-800 text-xs" data-testid={`badge-type-${config.id}`}>
                            <Globe className="w-3 h-3 mr-1" /> REST API
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs mt-0.5" data-testid={`text-connection-url-${config.id}`}>{config.apiBaseUrl}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => testMutation.mutate(config.id)}
                      disabled={testingId === config.id}
                      data-testid={`button-test-${config.id}`}
                    >
                      {testingId === config.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <TestTube className="w-4 h-4 mr-1" />}
                      Test
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => openEditDialog(config)}
                      data-testid={`button-edit-${config.id}`}
                    >
                      <Settings2 className="w-4 h-4 mr-1" /> Edit
                    </Button>
                    <Button
                      variant="outline" size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        if (confirm("Delete this connection and all its sync history?")) {
                          deleteMutation.mutate(config.id);
                        }
                      }}
                      data-testid={`button-delete-${config.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Last synced: <strong>{formatDate(config.lastSyncAt)}</strong></span>
                    <span>Entities: {needsDateRangeType(config.connectionType) ? (
                      <Badge variant="secondary" className="mr-1 text-xs">Shifts (auto-creates suppliers, clients, sites, employees)</Badge>
                    ) : (config.syncEntities || []).map(e => (
                      <Badge key={e} variant="secondary" className="mr-1 text-xs">{e}</Badge>
                    ))}</span>
                  </div>
                </div>

                {needsDateRangeType(config.connectionType) && (
                  <div className="flex flex-wrap items-end gap-3 mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <div className="flex-1 min-w-[140px]">
                      <Label htmlFor={`date-from-${config.id}`} className="text-xs font-medium text-blue-800 mb-1 block">Date From</Label>
                      <Input
                        id={`date-from-${config.id}`}
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="h-9"
                        data-testid={`input-date-from-${config.id}`}
                      />
                    </div>
                    <div className="flex-1 min-w-[140px]">
                      <Label htmlFor={`date-to-${config.id}`} className="text-xs font-medium text-blue-800 mb-1 block">Date To</Label>
                      <Input
                        id={`date-to-${config.id}`}
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="h-9"
                        data-testid={`input-date-to-${config.id}`}
                      />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs font-medium text-blue-800 mb-1 block">Supplier (optional)</Label>
                      <Select value={selectedSupplierId} onValueChange={setSelectedSupplierId} data-testid={`select-supplier-${config.id}`}>
                        <SelectTrigger className="h-9" data-testid={`select-trigger-supplier-${config.id}`}>
                          <SelectValue placeholder="All suppliers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all" data-testid="select-supplier-all">All suppliers</SelectItem>
                          {suppliersList.filter(s => s.external_id).map(s => (
                            <SelectItem key={s.id} value={s.external_id!} data-testid={`select-supplier-${s.id}`}>
                              {s.company_name} ({s.external_id})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {isPhpEmployeesType(config.connectionType) && (
                  <div className="flex flex-wrap items-end gap-3 mb-3 p-3 bg-blue-50 rounded-md border border-blue-200">
                    <div className="min-w-[120px]">
                      <Label htmlFor={`page-from-${config.id}`} className="text-xs font-medium text-blue-800 mb-1 block">Page From</Label>
                      <Input
                        id={`page-from-${config.id}`}
                        type="number"
                        min="1"
                        value={pageFrom}
                        onChange={e => setPageFrom(e.target.value)}
                        className="h-9"
                        data-testid={`input-page-from-${config.id}`}
                      />
                    </div>
                    <div className="min-w-[120px]">
                      <Label htmlFor={`page-to-${config.id}`} className="text-xs font-medium text-blue-800 mb-1 block">Page To</Label>
                      <Input
                        id={`page-to-${config.id}`}
                        type="number"
                        min="1"
                        value={pageTo}
                        onChange={e => setPageTo(e.target.value)}
                        className="h-9"
                        data-testid={`input-page-to-${config.id}`}
                      />
                    </div>
                    <div className="text-xs text-blue-700 self-center">
                      200 employees per page &middot; Records {((parseInt(pageFrom) || 1) - 1) * 200 + 1} – {(parseInt(pageTo) || 10) * 200} of ~11,696
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => previewMutation.mutate({
                      id: config.id,
                      dateFrom: dateFrom || undefined,
                      dateTo: dateTo || undefined,
                      supplierId: selectedSupplierId && selectedSupplierId !== "all" ? selectedSupplierId : undefined,
                      pageFrom: isPhpEmployeesType(config.connectionType) ? parseInt(pageFrom) || 1 : undefined,
                      pageTo: isPhpEmployeesType(config.connectionType) ? parseInt(pageTo) || 10 : undefined,
                    })}
                    disabled={isSyncing || previewingId === config.id || (needsDateRangeType(config.connectionType) && (!dateFrom || !dateTo))}
                    data-testid={`button-preview-${config.id}`}
                  >
                    {previewingId === config.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    Preview Changes
                  </Button>
                  <Button
                    onClick={() => syncMutation.mutate({
                      id: config.id,
                      dateFrom: dateFrom || undefined,
                      dateTo: dateTo || undefined,
                      supplierId: selectedSupplierId && selectedSupplierId !== "all" ? selectedSupplierId : undefined,
                      pageFrom: isPhpEmployeesType(config.connectionType) ? parseInt(pageFrom) || 1 : undefined,
                      pageTo: isPhpEmployeesType(config.connectionType) ? parseInt(pageTo) || 10 : undefined,
                    })}
                    disabled={isSyncing || (needsDateRangeType(config.connectionType) && (!dateFrom || !dateTo))}
                    className="bg-[#FF8C42] hover:bg-[#e67a35] text-white"
                    data-testid={`button-sync-all-${config.id}`}
                  >
                    {syncingId === config.id && syncingType === "all" ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Sync {isPhpEmployeesType(config.connectionType) ? `Pages ${pageFrom}–${pageTo}` : "All"}
                  </Button>
                  {!needsDateRangeType(config.connectionType) && ENTITY_TYPES.filter(et => (config.syncEntities || []).includes(et.key)).map(et => (
                    <Button
                      key={et.key}
                      variant="outline"
                      size="sm"
                      onClick={() => syncMutation.mutate({
                        id: config.id,
                        type: et.key,
                        pageFrom: isPhpEmployeesType(config.connectionType) ? parseInt(pageFrom) || 1 : undefined,
                        pageTo: isPhpEmployeesType(config.connectionType) ? parseInt(pageTo) || 10 : undefined,
                      })}
                      disabled={isSyncing}
                      data-testid={`button-sync-${et.key}-${config.id}`}
                    >
                      {syncingId === config.id && syncingType === et.key ? (
                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      ) : (
                        <et.icon className="w-4 h-4 mr-1" />
                      )}
                      {et.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editingConfig && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setEditingConfig(null); resetForm(); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Connection</DialogTitle>
              <DialogDescription>Update the connection settings for {editingConfig.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-2 block">Connection Type</Label>
                <Select value={formType} onValueChange={(v: "rest" | "php" | "rest_php" | "php_employees") => setFormType(v)} data-testid="select-edit-connection-type">
                  <SelectTrigger data-testid="select-trigger-edit-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rest" data-testid="select-edit-item-rest">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        REST API — Standard multi-entity sync
                      </div>
                    </SelectItem>
                    <SelectItem value="php_employees" data-testid="select-edit-item-php-employees">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        PHP API — Employees only
                      </div>
                    </SelectItem>
                    <SelectItem value="php" data-testid="select-edit-item-php">
                      <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4" />
                        PHP API — Flat shifts endpoint
                      </div>
                    </SelectItem>
                    <SelectItem value="rest_php" data-testid="select-edit-item-rest-php">
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        REST API (Paginated) — Shifts with date range
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-name">Connection Name</Label>
                <Input id="edit-name" data-testid="input-edit-name" value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-url">{formType === "rest" ? "API Base URL" : "Endpoint URL"}</Label>
                <Input id="edit-url" data-testid="input-edit-url" value={formUrl} onChange={e => setFormUrl(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="edit-key">API Key (leave blank to keep current)</Label>
                <Input id="edit-key" data-testid="input-edit-key" type="password" placeholder="••••••••" value={formApiKey} onChange={e => setFormApiKey(e.target.value)} />
              </div>
              {formType === "rest" && (
                <div>
                  <Label className="mb-2 block">Entities to Sync</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {ENTITY_TYPES.map(et => (
                      <label key={et.key} className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox
                          data-testid={`checkbox-edit-entity-${et.key}`}
                          checked={formEntities.includes(et.key)}
                          onCheckedChange={() => toggleEntity(et.key)}
                        />
                        <et.icon className="w-4 h-4 text-muted-foreground" />
                        {et.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditingConfig(null); resetForm(); }} data-testid="button-cancel-edit">Cancel</Button>
              <Button onClick={handleSave} disabled={!formName || !formUrl || updateMutation.isPending} className="bg-[#1F3A5F] hover:bg-[#2a4f7f]" data-testid="button-update-connection">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Update Connection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {previewData && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) { setPreviewData(null); setPreviewConfigId(null); } }}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle data-testid="text-preview-title">Sync Preview — What Will Change</DialogTitle>
              <DialogDescription>
                This is a dry run. No data has been changed yet. Review the changes below and click "Confirm & Sync" to proceed.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 py-2 border-b">
              {previewData.map(r => (
                <div key={r.entityType} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gray-50 text-sm">
                  <span className="font-medium capitalize">{r.entityType}</span>
                  <span className="text-xs text-muted-foreground">({r.totalFetched} found)</span>
                  {r.toCreate > 0 && <Badge className="bg-green-100 text-green-800 text-xs">{r.toCreate} new</Badge>}
                  {r.toUpdate > 0 && <Badge className="bg-blue-100 text-blue-800 text-xs">{r.toUpdate} update</Badge>}
                  {r.toSkip > 0 && <Badge variant="secondary" className="text-xs">{r.toSkip} skip</Badge>}
                </div>
              ))}
            </div>

            <div className="flex gap-2 py-2">
              {(["all", "create", "update", "skip"] as const).map(f => (
                <Button
                  key={f}
                  variant={previewFilter === f ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreviewFilter(f)}
                  className={previewFilter === f ? "bg-[#1F3A5F]" : ""}
                  data-testid={`button-filter-${f}`}
                >
                  {f === "all" ? "All" : f === "create" ? "New Records" : f === "update" ? "Updates" : "No Changes"}
                </Button>
              ))}
            </div>

            <div className="overflow-auto flex-1 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24">Action</TableHead>
                    <TableHead className="w-24">Type</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="w-32">External ID</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.flatMap(r =>
                    r.records
                      .filter(rec => previewFilter === "all" || rec.action === previewFilter)
                      .map((rec, i) => (
                        <TableRow key={`${r.entityType}-${i}`} data-testid={`row-preview-${r.entityType}-${i}`}>
                          <TableCell>
                            {rec.action === "create" && (
                              <Badge className="bg-green-100 text-green-800">
                                <Plus className="w-3 h-3 mr-1" /> New
                              </Badge>
                            )}
                            {rec.action === "update" && (
                              <Badge className="bg-blue-100 text-blue-800">
                                <ArrowRight className="w-3 h-3 mr-1" /> Update
                              </Badge>
                            )}
                            {rec.action === "skip" && (
                              <Badge variant="secondary">Skip</Badge>
                            )}
                          </TableCell>
                          <TableCell className="capitalize text-sm">{rec.entity}</TableCell>
                          <TableCell className="font-medium text-sm">{rec.name}</TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">{rec.externalId}</TableCell>
                          <TableCell className="text-xs">
                            {rec.action === "update" && rec.fieldsToUpdate && (
                              <span className="text-blue-700">
                                Will fill: {rec.fieldsToUpdate.join(", ")}
                              </span>
                            )}
                            {rec.action === "skip" && rec.reason && (
                              <span className="text-muted-foreground">{rec.reason}</span>
                            )}
                            {rec.action === "create" && (
                              <span className="text-green-700">New record will be created</span>
                            )}
                            {rec.potentialDuplicates && rec.potentialDuplicates.length > 0 && (
                              <div className="mt-1 border rounded p-2 bg-amber-50 dark:bg-amber-950/20">
                                <span className="text-amber-600 font-medium flex items-center gap-1 mb-1">
                                  <AlertTriangle className="w-3 h-3" /> Potential duplicate — choose action:
                                </span>
                                <div className="flex flex-wrap gap-1 mb-1">
                                  <Button
                                    size="sm"
                                    variant={previewSiteDecisions[rec.name]?.action === "use_existing" ? "default" : "outline"}
                                    className="h-6 text-xs"
                                    onClick={() => setPreviewSiteDecisions(prev => ({ ...prev, [rec.name]: { action: "use_existing", siteId: rec.potentialDuplicates![0].matchedId } }))}
                                    data-testid={`button-merge-${rec.externalId}`}
                                  >
                                    Merge with existing
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant={previewSiteDecisions[rec.name]?.action === "create_new" ? "default" : "outline"}
                                    className="h-6 text-xs"
                                    onClick={() => setPreviewSiteDecisions(prev => ({ ...prev, [rec.name]: { action: "create_new" } }))}
                                    data-testid={`button-create-new-sync-${rec.externalId}`}
                                  >
                                    Create new
                                  </Button>
                                </div>
                                {rec.potentialDuplicates.slice(0, 2).map((dup, di) => (
                                  <div key={di} className="text-xs text-amber-700 pl-1">
                                    "{dup.matchedName}" — {dup.matchReason} (score: {dup.score})
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                  {previewData.every(r => r.records.filter(rec => previewFilter === "all" || rec.action === previewFilter).length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-sm text-muted-foreground">
                        No records match this filter.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="pt-2">
              <div className="flex items-center gap-4 w-full justify-between">
                <div className="text-sm text-muted-foreground">
                  Total: {previewData.reduce((s, r) => s + r.toCreate, 0)} new, {previewData.reduce((s, r) => s + r.toUpdate, 0)} updates, {previewData.reduce((s, r) => s + r.toSkip, 0)} unchanged
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setPreviewData(null); setPreviewConfigId(null); }} data-testid="button-cancel-preview">
                    Cancel
                  </Button>
                  <Button
                    className="bg-[#FF8C42] hover:bg-[#e67a35] text-white"
                    disabled={isSyncing || (previewData.every(r => r.toCreate === 0 && r.toUpdate === 0) && !previewData.some(r => r.records.some(rec => rec.potentialDuplicates && rec.potentialDuplicates.length > 0)))}
                    onClick={() => {
                      if (previewConfigId) {
                        syncMutation.mutate({ id: previewConfigId, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, supplierId: selectedSupplierId && selectedSupplierId !== "all" ? selectedSupplierId : undefined, siteDecisions: previewSiteDecisions });
                        setPreviewData(null);
                        setPreviewConfigId(null);
                        setPreviewSiteDecisions({});
                      }
                    }}
                    data-testid="button-confirm-sync"
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Confirm & Sync ({previewData.reduce((s, r) => s + r.toCreate + r.toUpdate, 0)} records)
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {configs.filter(c => c.connectionType === "rest").length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2" data-testid="text-backfill-title">
                  <Link2 className="w-5 h-5 text-[#1F3A5F]" />
                  Backfill Site External IDs
                </CardTitle>
                <CardDescription>
                  Match local sites that have no external ID to their counterparts in the external system using fuzzy name matching.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 p-3 bg-blue-50 rounded-md border border-blue-200">
              <div className="flex-1 min-w-[200px]">
                <Label className="text-xs font-medium text-blue-800 mb-1 block">Connection</Label>
                <Select
                  value={backfillConfigId ? String(backfillConfigId) : ""}
                  onValueChange={(v) => setBackfillConfigId(parseInt(v))}
                  data-testid="select-backfill-config"
                >
                  <SelectTrigger data-testid="select-trigger-backfill-config">
                    <SelectValue placeholder="Select connection..." />
                  </SelectTrigger>
                  <SelectContent>
                    {configs.filter(c => c.connectionType === "rest").map(c => (
                      <SelectItem key={c.id} value={String(c.id)} data-testid={`select-backfill-config-${c.id}`}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs font-medium text-blue-800 mb-1 block">Min Match Score (0-100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={backfillMinScore}
                  onChange={e => setBackfillMinScore(e.target.value)}
                  className="h-9"
                  data-testid="input-backfill-min-score"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  if (backfillConfigId) {
                    const parsed = parseInt(backfillMinScore);
                    const score = !isNaN(parsed) ? Math.max(0, Math.min(100, parsed)) : 70;
                    backfillPreviewMutation.mutate({ configId: backfillConfigId, minScore: score });
                  }
                }}
                disabled={!backfillConfigId || backfillPreviewMutation.isPending}
                data-testid="button-backfill-preview"
              >
                {backfillPreviewMutation.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Eye className="w-4 h-4 mr-2" />
                )}
                Preview Matches
              </Button>
            </div>

            {backfillResult && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3" data-testid="text-backfill-summary">
                  <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
                    {backfillResult.matched.length} matched
                  </Badge>
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    {backfillResult.unmatched.length} unmatched
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {backfillResult.totalLocal} local sites without external ID · {backfillResult.totalExternal} external sites fetched
                  </span>
                  {backfillApplied && (
                    <Badge className="bg-blue-100 text-blue-800 text-sm px-3 py-1 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Applied
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {(["all", "matched", "unmatched"] as const).map(f => (
                    <Button
                      key={f}
                      size="sm"
                      variant={backfillFilter === f ? "default" : "outline"}
                      onClick={() => setBackfillFilter(f)}
                      className={backfillFilter === f ? "bg-[#1F3A5F]" : ""}
                      data-testid={`button-backfill-filter-${f}`}
                    >
                      {f === "all" ? "All" : f === "matched" ? `Matched (${backfillResult.matched.length})` : `Unmatched (${backfillResult.unmatched.length})`}
                    </Button>
                  ))}
                  <Input
                    placeholder="Filter by name..."
                    value={backfillSearch}
                    onChange={e => setBackfillSearch(e.target.value)}
                    className="h-8 w-48 text-sm"
                    data-testid="input-backfill-search"
                  />
                </div>

                <div className="border rounded-md overflow-auto max-h-[420px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className="cursor-pointer select-none hover:bg-muted/50 whitespace-nowrap"
                          onClick={() => toggleBackfillSort("localSiteName")}
                          data-testid="th-local-site-name"
                        >
                          <div className="flex items-center gap-1">
                            Our Site Name
                            {backfillSortCol === "localSiteName" ? (
                              backfillSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:bg-muted/50 whitespace-nowrap"
                          onClick={() => toggleBackfillSort("externalSiteName")}
                          data-testid="th-external-site-name"
                        >
                          <div className="flex items-center gap-1">
                            Their Site Name
                            {backfillSortCol === "externalSiteName" ? (
                              backfillSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Our External ID</TableHead>
                        <TableHead className="whitespace-nowrap text-xs">Their External ID</TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:bg-muted/50 whitespace-nowrap text-right"
                          onClick={() => toggleBackfillSort("matchScore")}
                          data-testid="th-match-score"
                        >
                          <div className="flex items-center gap-1 justify-end">
                            Score
                            {backfillSortCol === "matchScore" ? (
                              backfillSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                        <TableHead
                          className="cursor-pointer select-none hover:bg-muted/50 whitespace-nowrap"
                          onClick={() => toggleBackfillSort("matchReason")}
                          data-testid="th-match-reason"
                        >
                          <div className="flex items-center gap-1">
                            Match Reason
                            {backfillSortCol === "matchReason" ? (
                              backfillSortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const search = backfillSearch.toLowerCase();

                        const matchedRows: BackfillSiteMatch[] = backfillResult.matched
                          .filter(m =>
                            !search ||
                            m.localSiteName.toLowerCase().includes(search) ||
                            m.externalSiteName.toLowerCase().includes(search)
                          )
                          .sort((a, b) => {
                            const dir = backfillSortDir === "asc" ? 1 : -1;
                            if (backfillSortCol === "matchScore") return (a.matchScore - b.matchScore) * dir;
                            if (backfillSortCol === "localSiteName") return a.localSiteName.localeCompare(b.localSiteName) * dir;
                            if (backfillSortCol === "externalSiteName") return a.externalSiteName.localeCompare(b.externalSiteName) * dir;
                            if (backfillSortCol === "matchReason") return a.matchReason.localeCompare(b.matchReason) * dir;
                            return 0;
                          });

                        const unmatchedRows = backfillResult.unmatched.filter(u =>
                          !search || u.localSiteName.toLowerCase().includes(search)
                        );

                        const showMatched = backfillFilter === "all" || backfillFilter === "matched";
                        const showUnmatched = backfillFilter === "all" || backfillFilter === "unmatched";

                        const hasMatched = showMatched && matchedRows.length > 0;
                        const hasUnmatched = showUnmatched && unmatchedRows.length > 0;

                        if (!hasMatched && !hasUnmatched) {
                          return (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">
                                No results match this filter.
                              </TableCell>
                            </TableRow>
                          );
                        }

                        return (
                          <>
                            {showMatched && matchedRows.map(m => (
                              <TableRow key={`matched-${m.localSiteId}`} data-testid={`row-backfill-matched-${m.localSiteId}`}>
                                <TableCell className="text-sm font-medium">{m.localSiteName}</TableCell>
                                <TableCell className="text-sm">{m.externalSiteName}</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">{m.localExternalId ?? <span className="italic text-gray-400">null</span>}</TableCell>
                                <TableCell className="text-xs font-mono text-green-700">{m.externalSiteId}</TableCell>
                                <TableCell className="text-right">
                                  <Badge
                                    className={
                                      m.matchScore >= 95 ? "bg-green-100 text-green-800" :
                                      m.matchScore >= 80 ? "bg-blue-100 text-blue-800" :
                                      "bg-amber-100 text-amber-800"
                                    }
                                    data-testid={`badge-score-${m.localSiteId}`}
                                  >
                                    {m.matchScore}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">{m.matchReason}</TableCell>
                              </TableRow>
                            ))}
                            {showUnmatched && unmatchedRows.map(u => (
                              <TableRow key={`unmatched-${u.localSiteId}`} className="bg-red-50/40" data-testid={`row-backfill-unmatched-${u.localSiteId}`}>
                                <TableCell className="text-sm text-muted-foreground">{u.localSiteName}</TableCell>
                                <TableCell className="text-xs text-muted-foreground italic">No match found</TableCell>
                                <TableCell className="text-xs text-muted-foreground font-mono">—</TableCell>
                                <TableCell className="text-xs text-muted-foreground">—</TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="secondary" className="text-xs">—</Badge>
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">—</TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })()}
                    </TableBody>
                  </Table>
                </div>

                {!backfillApplied && backfillResult.matched.length > 0 && (
                  <div className="flex justify-end pt-2">
                    <Button
                      className="bg-[#FF8C42] hover:bg-[#e67a35] text-white"
                      disabled={backfillApplyMutation.isPending}
                      onClick={() => {
                        if (backfillConfigId && confirm(`Apply ${backfillResult.matched.length} site external ID matches? This will update your database.`)) {
                          const parsed = parseInt(backfillMinScore);
                          const score = !isNaN(parsed) ? Math.max(0, Math.min(100, parsed)) : 70;
                          backfillApplyMutation.mutate({ configId: backfillConfigId, minScore: score });
                        }
                      }}
                      data-testid="button-backfill-apply"
                    >
                      {backfillApplyMutation.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                      )}
                      Apply {backfillResult.matched.length} Matches
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg" data-testid="text-sync-history-title">Sync History</CardTitle>
              <CardDescription>Recent synchronisation activity</CardDescription>
            </div>
            <Button
              variant="outline" size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/sync/logs"] })}
              data-testid="button-refresh-logs"
            >
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No sync history yet. Run your first sync to see results here.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                  <TableHead className="text-right">Skipped</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => {
                  const hasErrors = log.errors && (log.errors as string[]).length > 0;
                  const isExpanded = expandedLogs.has(log.id);
                  return (
                    <>{/* key handled by fragment */}
                      <TableRow key={`row-${log.id}`} data-testid={`row-sync-log-${log.id}`}>
                        <TableCell className="text-sm">{formatDate(log.startedAt)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="capitalize">{log.syncType}</Badge>
                        </TableCell>
                        <TableCell>
                          {log.status === "completed" && (
                            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                              <CheckCircle2 className="w-3 h-3 mr-1" /> Completed
                            </Badge>
                          )}
                          {log.status === "completed_with_errors" && (
                            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
                              <AlertTriangle className="w-3 h-3 mr-1" /> Partial
                            </Badge>
                          )}
                          {log.status === "failed" && (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" /> Failed
                            </Badge>
                          )}
                          {log.status === "running" && (
                            <div className="flex items-center gap-2">
                              <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running
                              </Badge>
                              <Button
                                variant="ghost" size="sm"
                                className="h-6 px-2 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                                data-testid={`button-cancel-sync-${log.id}`}
                                onClick={async () => {
                                  try {
                                    await apiRequest("POST", `/api/sync/logs/${log.id}/cancel`);
                                    queryClient.invalidateQueries({ queryKey: ["/api/sync/logs"] });
                                    toast({ title: "Sync cancelled" });
                                  } catch (err: any) {
                                    toast({ title: "Failed to cancel", description: err.message, variant: "destructive" });
                                  }
                                }}
                              >
                                <XCircle className="w-3 h-3 mr-1" /> Cancel
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{log.recordsCreated || 0}</TableCell>
                        <TableCell className="text-right font-mono">{log.recordsUpdated || 0}</TableCell>
                        <TableCell className="text-right font-mono">{log.recordsSkipped || 0}</TableCell>
                        <TableCell className="text-right font-mono">
                          {(log.recordsFailed || 0) > 0 ? (
                            <span className="text-red-600 font-semibold">{log.recordsFailed}</span>
                          ) : (
                            "0"
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {getDuration(log.startedAt, log.completedAt)}
                        </TableCell>
                        <TableCell>
                          {(hasErrors || log.entityBreakdown) && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => {
                                const next = new Set(expandedLogs);
                                if (isExpanded) next.delete(log.id); else next.add(log.id);
                                setExpandedLogs(next);
                              }}
                              data-testid={`button-details-${log.id}`}
                            >
                              {hasErrors && <AlertTriangle className="w-4 h-4 text-amber-500 mr-1" />}
                              <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`details-${log.id}`}>
                          <TableCell colSpan={9} className="bg-muted/30 border-t-0">
                            <div className="py-2 px-3 space-y-3">
                              {log.entityBreakdown && (
                                <div data-testid={`breakdown-${log.id}`}>
                                  <p className="text-xs font-semibold text-muted-foreground mb-2">Per-Entity Breakdown:</p>
                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {["clients", "sites", "suppliers", "employees", "shifts"].map((entityType) => {
                                      const b = (log.entityBreakdown as Record<string, EntitySyncBreakdown>)?.[entityType];
                                      if (!b) return null;
                                      const total = b.created + b.updated + b.skipped + b.failed;
                                      return (
                                        <div key={entityType} className="border rounded-md p-2 bg-background" data-testid={`breakdown-${entityType}-${log.id}`}>
                                          <p className="text-xs font-medium capitalize mb-1">{entityType}</p>
                                          <div className="text-xs text-muted-foreground space-y-0.5">
                                            {b.created > 0 && <p className="text-green-600">+{b.created} created</p>}
                                            {b.updated > 0 && <p className="text-blue-600">{b.updated} updated</p>}
                                            {b.skipped > 0 && <p>{b.skipped} skipped</p>}
                                            {b.failed > 0 && <p className="text-red-600">{b.failed} failed</p>}
                                            {total === 0 && <p>No records</p>}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              {hasErrors && (
                                <div>
                                  <p className="text-xs font-semibold text-red-700 mb-1">Errors ({(log.errors as string[]).length}):</p>
                                  {(log.errors as string[]).slice(0, 20).map((err, i) => (
                                    <p key={i} className="text-xs text-red-600 font-mono">{err}</p>
                                  ))}
                                  {(log.errors as string[]).length > 20 && (
                                    <p className="text-xs text-red-500 italic">... and {(log.errors as string[]).length - 20} more</p>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
