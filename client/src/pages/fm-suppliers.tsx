import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Truck, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import type { FmSupplier } from "@shared/schema";

const SERVICE_LINES = ["cleaning", "maintenance", "engineering"];

interface SupplierForm {
  id?: number;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  postcode: string;
  vatNumber: string;
  companyNumber: string;
  defaultHourlyRate: string;
  serviceLines: string[];
  isActive: boolean;
}

const empty: SupplierForm = { companyName: "", contactName: "", email: "", phone: "", postcode: "", vatNumber: "", companyNumber: "", defaultHourlyRate: "", serviceLines: [], isActive: true };

export default function FmSuppliersPage() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SupplierForm>(empty);

  const { data, isLoading } = useQuery<FmSupplier[]>({ queryKey: ["/api/fm/suppliers"] });

  const saveMutation = useMutation({
    mutationFn: async (d: SupplierForm) => {
      const payload = { ...d, defaultHourlyRate: d.defaultHourlyRate || null };
      if (d.id) { const r = await apiRequest("PATCH", `/api/fm/suppliers/${d.id}`, payload); return r.json(); }
      const r = await apiRequest("POST", "/api/fm/suppliers", payload); return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fm/suppliers"] });
      setOpen(false); setForm(empty);
      toast({ title: "Saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/fm/suppliers/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/fm/suppliers"] }); toast({ title: "Deleted" }); },
  });

  const openEdit = (s: FmSupplier) => {
    setForm({
      id: s.id, companyName: s.companyName, contactName: s.contactName || "", email: s.email || "",
      phone: s.phone || "", postcode: s.postcode || "", vatNumber: s.vatNumber || "",
      companyNumber: s.companyNumber || "", defaultHourlyRate: s.defaultHourlyRate || "",
      serviceLines: s.serviceLines || [], isActive: s.isActive ?? true,
    });
    setOpen(true);
  };

  const toggleService = (v: string) => {
    setForm(f => ({ ...f, serviceLines: f.serviceLines.includes(v) ? f.serviceLines.filter(x => x !== v) : [...f.serviceLines, v] }));
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Truck className="h-7 w-7 text-[#FF8C42]" />
          <h1 className="text-2xl font-bold text-[#1F3A5F]" data-testid="text-fm-suppliers-title">FM Suppliers</h1>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-add-supplier"><Plus className="h-4 w-4 mr-1" />Add Supplier</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{form.id ? "Edit" : "Add"} FM Supplier</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><Label>Company Name</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} data-testid="input-company-name" /></div>
              <div><Label>Contact</Label><Input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} data-testid="input-contact-name" /></div>
              <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-email" /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" /></div>
              <div><Label>Postcode</Label><Input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} data-testid="input-postcode" /></div>
              <div><Label>VAT Number</Label><Input value={form.vatNumber} onChange={(e) => setForm({ ...form, vatNumber: e.target.value })} data-testid="input-vat" /></div>
              <div><Label>Company Number</Label><Input value={form.companyNumber} onChange={(e) => setForm({ ...form, companyNumber: e.target.value })} data-testid="input-company-number" /></div>
              <div><Label>Default Rate (£/h)</Label><Input type="number" step="0.01" value={form.defaultHourlyRate} onChange={(e) => setForm({ ...form, defaultHourlyRate: e.target.value })} data-testid="input-rate" /></div>
              <div className="col-span-2">
                <Label>Service Lines</Label>
                <div className="flex gap-2 mt-2">
                  {SERVICE_LINES.map(s => (
                    <Button key={s} type="button" variant={form.serviceLines.includes(s) ? "default" : "outline"} size="sm" onClick={() => toggleService(s)} className={`capitalize ${form.serviceLines.includes(s) ? "bg-[#FF8C42] hover:bg-[#e67a35]" : ""}`} data-testid={`button-toggle-${s}`}>{s}</Button>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => saveMutation.mutate(form)} disabled={!form.companyName || saveMutation.isPending} className="bg-[#FF8C42] hover:bg-[#e67a35]" data-testid="button-save-supplier">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? <div className="p-6 text-center"><Loader2 className="h-6 w-6 animate-spin inline" /></div> :
        data?.length === 0 ? <div className="p-6 text-center text-gray-400">No FM suppliers yet.</div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Company</TableHead><TableHead>Contact</TableHead><TableHead>Services</TableHead>
              <TableHead>Rate</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data?.map(s => (
                <TableRow key={s.id} data-testid={`row-supplier-${s.id}`}>
                  <TableCell className="font-medium">{s.companyName}</TableCell>
                  <TableCell className="text-xs">{s.contactName}<br />{s.email}<br />{s.phone}</TableCell>
                  <TableCell><div className="flex gap-1 flex-wrap">{(s.serviceLines || []).map(sl => <Badge key={sl} variant="outline" className="capitalize">{sl}</Badge>)}</div></TableCell>
                  <TableCell>{s.defaultHourlyRate ? `£${s.defaultHourlyRate}/h` : "—"}</TableCell>
                  <TableCell>{s.isActive ? <Badge className="bg-green-600">Active</Badge> : <Badge variant="outline">Inactive</Badge>}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(s)} data-testid={`button-edit-${s.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) deleteMutation.mutate(s.id); }} data-testid={`button-delete-${s.id}`}><Trash2 className="h-4 w-4 text-red-500" /></Button>
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
