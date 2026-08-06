import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Plus, Trash2, Loader2, Wand2 } from "lucide-react";
import type { FmSupplier } from "@shared/schema";

const SERVICE_LINES = ["cleaning", "maintenance", "engineering"];
const FREQUENCIES = ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"];

interface PpmForm {
  siteId: string;
  name: string;
  description: string;
  serviceLine: string;
  frequency: string;
  intervalDays: string;
  defaultStartTime: string;
  defaultEndTime: string;
  estimatedHours: string;
  nextDueDate: string;
  defaultSupplierId: string;
  isActive: boolean;
}

const empty: PpmForm = { siteId: "", name: "", description: "", serviceLine: "cleaning", frequency: "monthly", intervalDays: "", defaultStartTime: "", defaultEndTime: "", estimatedHours: "", nextDueDate: "", defaultSupplierId: "", isActive: true };

export default function FmPpmPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PpmForm>(empty);

  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/fm/ppm"] });
  const { data: sites } = useQuery<any[]>({ queryKey: ["/api/sites"] });
  const { data: suppliers } = useQuery<FmSupplier[]>({ queryKey: ["/api/fm/suppliers"] });

  const create = useMutation({
    mutationFn: async (d: PpmForm) => {
      const payload: any = {
        ...d,
        siteId: d.siteId ? parseInt(d.siteId) : null,
        defaultSupplierId: d.defaultSupplierId ? parseInt(d.defaultSupplierId) : null,
        intervalDays: d.intervalDays ? parseInt(d.intervalDays) : null,
        estimatedHours: d.estimatedHours || null,
        nextDueDate: d.nextDueDate || null,
      };
      const r = await apiRequest("POST", "/api/fm/ppm", payload); return r.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fm/ppm"] }); setOpen(false); setForm(empty); toast({ title: "PPM created" }); },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const generate = useMutation({
    mutationFn: async (id: number) => { const r = await apiRequest("POST", `/api/fm/ppm/${id}/generate-job`, {}); return r.json(); },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fm/ppm"] }); queryClient.invalidateQueries({ queryKey: ["/api/fm/jobs"] }); toast({ title: "Job generated" }); },
  });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fm/ppm/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fm/ppm"] }); toast({ title: "Deleted" }); },
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-[#FF8C42]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-ppm-title">Planned Preventative Maintenance</h1>
            <p className="text-sm text-gray-500">Recurring jobs by site and service line</p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild><Button className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-add-ppm"><Plus className="h-4 w-4 mr-1" />New PPM</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New PPM Schedule</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-name" /></div>
              <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-description" /></div>
              <div>
                <Label>Site</Label>
                <Select value={form.siteId} onValueChange={(v) => setForm({ ...form, siteId: v })}>
                  <SelectTrigger data-testid="select-site"><SelectValue placeholder="Site" /></SelectTrigger>
                  <SelectContent>{(sites || []).map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Service Line</Label>
                <Select value={form.serviceLine} onValueChange={(v) => setForm({ ...form, serviceLine: v })}>
                  <SelectTrigger data-testid="select-service"><SelectValue /></SelectTrigger>
                  <SelectContent>{SERVICE_LINES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequency</Label>
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                  <SelectTrigger data-testid="select-frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.frequency === "custom" && (
                <div><Label>Interval (days)</Label><Input type="number" value={form.intervalDays} onChange={(e) => setForm({ ...form, intervalDays: e.target.value })} data-testid="input-interval" /></div>
              )}
              <div><Label>Next Due Date</Label><Input type="date" value={form.nextDueDate} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} data-testid="input-due" /></div>
              <div><Label>Default Start</Label><Input type="time" value={form.defaultStartTime} onChange={(e) => setForm({ ...form, defaultStartTime: e.target.value })} data-testid="input-start" /></div>
              <div><Label>Default End</Label><Input type="time" value={form.defaultEndTime} onChange={(e) => setForm({ ...form, defaultEndTime: e.target.value })} data-testid="input-end" /></div>
              <div><Label>Estimated Hours</Label><Input type="number" step="0.5" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} data-testid="input-hours" /></div>
              <div>
                <Label>Default Supplier</Label>
                <Select value={form.defaultSupplierId} onValueChange={(v) => setForm({ ...form, defaultSupplierId: v })}>
                  <SelectTrigger data-testid="select-supplier"><SelectValue placeholder="In-house" /></SelectTrigger>
                  <SelectContent>{(suppliers || []).map(s => <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate(form)} disabled={!form.name || create.isPending} className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-save-ppm">
                {create.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div> :
        data?.length === 0 ? <div className="p-6 text-center text-gray-400">No PPM schedules yet.</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Site</TableHead><TableHead>Service</TableHead>
              <TableHead>Frequency</TableHead><TableHead>Next Due</TableHead><TableHead>Last Generated</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map((p) => (
                <TableRow key={p.id} data-testid={`row-ppm-${p.id}`}>
                  <TableCell className="font-medium">{p.name}<div className="text-xs text-gray-500">{p.description}</div></TableCell>
                  <TableCell className="text-xs">{p.site_name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize">{p.service_line}</Badge></TableCell>
                  <TableCell className="capitalize">{p.frequency}{p.interval_days ? ` (${p.interval_days}d)` : ""}</TableCell>
                  <TableCell className="text-xs">{p.next_due_date || "—"}</TableCell>
                  <TableCell className="text-xs">{p.last_generated_date || "—"}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => generate.mutate(p.id)} disabled={generate.isPending} className="mr-1" data-testid={`button-generate-${p.id}`}>
                      <Wand2 className="h-3 w-3 mr-1" />Generate Job
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) del.mutate(p.id); }} data-testid={`button-delete-${p.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
