import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Plus, Trash2, Loader2, MapPin, AlertTriangle } from "lucide-react";
import type { FmSupplier, FmWorker } from "@shared/schema";

const SERVICE_LINES = ["cleaning", "maintenance", "engineering"];
const PRIORITIES = ["low", "normal", "high", "urgent"];
const STATUSES = ["scheduled", "in_progress", "completed", "cancelled", "on_hold"];
const TYPES = ["reactive", "ppm", "project"];

interface JobForm {
  siteId: string;
  title: string;
  description: string;
  jobType: string;
  serviceLine: string;
  priority: string;
  scheduledDate: string;
  scheduledStartTime: string;
  scheduledEndTime: string;
  estimatedHours: string;
  supplierId: string;
  workerIds: number[];
}

const empty: JobForm = { siteId: "", title: "", description: "", jobType: "reactive", serviceLine: "cleaning", priority: "normal", scheduledDate: "", scheduledStartTime: "", scheduledEndTime: "", estimatedHours: "", supplierId: "", workerIds: [] };

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-500", in_progress: "bg-[#FF8C42]", completed: "bg-green-600",
  cancelled: "bg-gray-400", on_hold: "bg-yellow-500",
};

export default function FmJobsPage() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({ status: "all", service: "all" });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<JobForm>(empty);

  const queryParams = new URLSearchParams();
  if (filters.status !== "all") queryParams.set("status", filters.status);
  if (filters.service !== "all") queryParams.set("serviceLine", filters.service);
  const qstr = queryParams.toString();

  const { data: jobs, isLoading } = useQuery<any[]>({
    queryKey: ["/api/fm/jobs", filters.status, filters.service],
    queryFn: async () => {
      const r = await fetch(`/api/fm/jobs${qstr ? "?" + qstr : ""}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
  });
  const { data: sites } = useQuery<any[]>({ queryKey: ["/api/sites"] });
  const { data: workers } = useQuery<FmWorker[]>({ queryKey: ["/api/fm/workers"] });
  const { data: suppliers } = useQuery<FmSupplier[]>({ queryKey: ["/api/fm/suppliers"] });

  const filteredWorkers = (workers || []).filter(w => w.serviceLine === form.serviceLine && w.isActive);

  const create = useMutation({
    mutationFn: async (d: JobForm) => {
      const payload: any = {
        ...d,
        siteId: d.siteId ? parseInt(d.siteId) : null,
        supplierId: d.supplierId ? parseInt(d.supplierId) : null,
        estimatedHours: d.estimatedHours || null,
        scheduledDate: d.scheduledDate || null,
      };
      const r = await apiRequest("POST", "/api/fm/jobs", payload); return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fm/jobs"] });
      setOpen(false); setForm(empty);
      toast({ title: "Job created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const r = await apiRequest("PATCH", `/api/fm/jobs/${id}`, { status }); return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/fm/jobs"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fm/jobs/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fm/jobs"] }); toast({ title: "Deleted" }); },
  });

  const toggleWorker = (id: number) => {
    setForm(f => ({ ...f, workerIds: f.workerIds.includes(id) ? f.workerIds.filter(w => w !== id) : [...f.workerIds, id] }));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-7 w-7 text-[#FF8C42]" />
          <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-jobs-title">FM Jobs</h1>
        </div>
        <div className="flex gap-2">
          <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
            <SelectTrigger className="w-36" data-testid="select-status-filter"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filters.service} onValueChange={(v) => setFilters({ ...filters, service: v })}>
            <SelectTrigger className="w-36" data-testid="select-service-filter"><SelectValue placeholder="Service" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {SERVICE_LINES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild><Button className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-add-job"><Plus className="h-4 w-4 mr-1" />New Job</Button></DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>New FM Job</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="input-title" /></div>
                <div className="col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-description" /></div>
                <div>
                  <Label>Site</Label>
                  <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v })}>
                    <SelectTrigger data-testid="select-site"><SelectValue placeholder="Pick site" /></SelectTrigger>
                    <SelectContent>{(sites || []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service Line</Label>
                  <Select value={form.serviceLine} onValueChange={(v) => setForm({ ...form, serviceLine: v, workerIds: [] })}>
                    <SelectTrigger data-testid="select-service"><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICE_LINES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.jobType} onValueChange={(v) => setForm({ ...form, jobType: v })}>
                    <SelectTrigger data-testid="select-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger data-testid="select-priority"><SelectValue /></SelectTrigger>
                    <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Scheduled Date</Label><Input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} data-testid="input-date" /></div>
                <div><Label>Start Time</Label><Input type="time" value={form.scheduledStartTime} onChange={(e) => setForm({ ...form, scheduledStartTime: e.target.value })} data-testid="input-start" /></div>
                <div><Label>End Time</Label><Input type="time" value={form.scheduledEndTime} onChange={(e) => setForm({ ...form, scheduledEndTime: e.target.value })} data-testid="input-end" /></div>
                <div><Label>Estimated Hours</Label><Input type="number" step="0.5" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} data-testid="input-hours" /></div>
                <div>
                  <Label>Supplier (optional)</Label>
                  <Select value={form.supplierId} onValueChange={(v) => setForm({ ...form, supplierId: v })}>
                    <SelectTrigger data-testid="select-supplier"><SelectValue placeholder="In-house" /></SelectTrigger>
                    <SelectContent>{(suppliers || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Assign Workers ({form.serviceLine})</Label>
                  <div className="flex flex-wrap gap-2 mt-2 max-h-32 overflow-y-auto">
                    {filteredWorkers.length === 0 && <span className="text-xs text-gray-400">No {form.serviceLine} workers available</span>}
                    {filteredWorkers.map(w => (
                      <Button key={w.id} type="button" variant={form.workerIds.includes(w.id) ? "default" : "outline"} size="sm" onClick={() => toggleWorker(w.id)} className={form.workerIds.includes(w.id) ? "bg-[#FF8C42] hover:bg-[#e67a35]" : ""} data-testid={`button-toggle-worker-${w.id}`}>
                        {w.firstName} {w.lastName}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate(form)} disabled={!form.title || create.isPending} className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-save-job">
                  {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div> :
        jobs?.length === 0 ? <div className="p-6 text-center text-gray-400">No FM jobs yet.</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Job</TableHead><TableHead>Site</TableHead><TableHead>Service</TableHead>
              <TableHead>Scheduled</TableHead><TableHead>Assigned</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {jobs?.map((j) => (
                <TableRow key={j.id} data-testid={`row-job-${j.id}`}>
                  <TableCell>
                    <div className="font-medium">{j.title}</div>
                    <div className="text-xs text-gray-500">{j.job_number} · {j.priority} · {j.job_type}</div>
                  </TableCell>
                  <TableCell className="text-xs">{j.site_name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{j.service_line}</Badge></TableCell>
                  <TableCell className="text-xs">{j.scheduled_date || "—"}<br />{j.scheduled_start_time}{j.scheduled_end_time ? `–${j.scheduled_end_time}` : ""}</TableCell>
                  <TableCell className="text-xs">
                    {j.supplier_name && <div className="text-purple-700">{j.supplier_name}</div>}
                    {(j.assignments || []).map((a: any) => {
                      const dist = a.checkOutDistanceMetres ?? a.checkInDistanceMetres;
                      const within = a.checkOutDistanceMetres != null ? a.checkOutWithinRange : a.checkInWithinRange;
                      const hasGps = a.checkInAt || a.checkOutAt;
                      return (
                        <div key={a.id} className="flex items-center gap-1" data-testid={`assignment-${a.id}`}>
                          <span>{a.workerName}</span>
                          {hasGps && dist != null && (
                            within === false ? (
                              <span className="inline-flex items-center gap-0.5 text-red-600" title={`Off-site: ${Math.round(dist)}m from site`} data-testid={`gps-flag-${a.id}`}>
                                <AlertTriangle className="h-3 w-3" />{Math.round(dist)}m
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-green-600" title={`On-site: ${Math.round(dist)}m from site`} data-testid={`gps-ok-${a.id}`}>
                                <MapPin className="h-3 w-3" />{Math.round(dist)}m
                              </span>
                            )
                          )}
                          {hasGps && dist == null && (
                            <span title="Checked in (no site coordinates to compare)" className="inline-flex">
                              <MapPin className="h-3 w-3 text-gray-400" />
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {(!j.supplier_name && (!j.assignments || j.assignments.length === 0)) && <span className="text-gray-400">Unassigned</span>}
                  </TableCell>
                  <TableCell>
                    <Select value={j.status} onValueChange={(v) => updateStatus.mutate({ id: j.id, status: v })}>
                      <SelectTrigger className="h-8 w-32" data-testid={`select-status-${j.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this job?")) del.mutate(j.id); }} data-testid={`button-delete-${j.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent></Card>
    </div>
  );
}
