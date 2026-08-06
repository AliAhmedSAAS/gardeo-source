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
import { Users, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type { FmWorker } from "@shared/schema";

const SERVICE_LINES = ["cleaning", "maintenance", "engineering"];

interface WorkerForm {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  trade: string;
  serviceLine: string;
  hourlyRate: string;
  postcode: string;
  isActive: boolean;
}

const empty: WorkerForm = { firstName: "", lastName: "", email: "", phone: "", trade: "", serviceLine: "cleaning", hourlyRate: "", postcode: "", isActive: true };

export default function FmWorkersPage() {
  const { toast } = useToast();
  const [serviceFilter, setServiceFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<WorkerForm>(empty);

  const { data: workers, isLoading } = useQuery<FmWorker[]>({
    queryKey: ["/api/fm/workers", serviceFilter],
    queryFn: async () => {
      const url = serviceFilter === "all" ? "/api/fm/workers" : `/api/fm/workers?serviceLine=${serviceFilter}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: WorkerForm) => {
      const payload = { ...data, hourlyRate: data.hourlyRate ? data.hourlyRate : null };
      if (data.id) {
        const res = await apiRequest("PATCH", `/api/fm/workers/${data.id}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", "/api/fm/workers", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fm/workers"] });
      setDialogOpen(false);
      setForm(empty);
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fm/workers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fm/workers"] });
      toast({ title: "Deleted" });
    },
  });

  const openEdit = (w: FmWorker) => {
    setForm({
      id: w.id,
      firstName: w.firstName,
      lastName: w.lastName,
      email: w.email || "",
      phone: w.phone || "",
      trade: w.trade,
      serviceLine: w.serviceLine,
      hourlyRate: w.hourlyRate || "",
      postcode: w.postcode || "",
      isActive: w.isActive ?? true,
    });
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-[#FF8C42]" />
          <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-workers-title">FM Workers</h1>
        </div>
        <div className="flex gap-2">
          <Select value={serviceFilter} onValueChange={setServiceFilter}>
            <SelectTrigger className="w-40" data-testid="select-service-filter"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All services</SelectItem>
              {SERVICE_LINES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-add-worker">
                <Plus className="h-4 w-4 mr-1" /> Add Worker
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "Add"} FM Worker</DialogTitle></DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} data-testid="input-first-name" /></div>
                <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} data-testid="input-last-name" /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-email" /></div>
                <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" /></div>
                <div><Label>Trade</Label><Input value={form.trade} placeholder="e.g. Cleaner, Electrician" onChange={(e) => setForm({ ...form, trade: e.target.value })} data-testid="input-trade" /></div>
                <div>
                  <Label>Service Line</Label>
                  <Select value={form.serviceLine} onValueChange={(v) => setForm({ ...form, serviceLine: v })}>
                    <SelectTrigger data-testid="select-service-line"><SelectValue /></SelectTrigger>
                    <SelectContent>{SERVICE_LINES.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Hourly Rate (£)</Label><Input type="number" step="0.01" value={form.hourlyRate} onChange={(e) => setForm({ ...form, hourlyRate: e.target.value })} data-testid="input-hourly-rate" /></div>
                <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} data-testid="input-postcode" /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => saveMutation.mutate(form)} disabled={!form.firstName || !form.lastName || !form.trade || saveMutation.isPending} className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-save-worker">
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div>
          ) : (workers?.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No FM workers yet. Add your first one above.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Trade</TableHead><TableHead>Service</TableHead>
                <TableHead>Contact</TableHead><TableHead>Rate</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {workers?.map((w) => (
                  <TableRow key={w.id} data-testid={`row-worker-${w.id}`}>
                    <TableCell className="font-medium">{w.firstName} {w.lastName}</TableCell>
                    <TableCell>{w.trade}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{w.serviceLine}</Badge></TableCell>
                    <TableCell className="text-xs">{w.email}<br />{w.phone}</TableCell>
                    <TableCell>{w.hourlyRate ? `£${w.hourlyRate}/h` : "—"}</TableCell>
                    <TableCell>{w.isActive ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(w)} data-testid={`button-edit-${w.id}`}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this worker?")) deleteMutation.mutate(w.id); }} data-testid={`button-delete-${w.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
