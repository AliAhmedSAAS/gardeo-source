import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Loader2, Pencil, Plus, PoundSterling, Trash2, X } from "lucide-react";

type DutyType = { id: number; name: string };
type PayRate = {
  id: number;
  duty_type_id?: number | null;
  dutyTypeId?: number | null;
  duty_type_name?: string | null;
  dutyTypeName?: string | null;
  hourly_rate: string;
  effective_from: string;
  effective_to: string | null;
  reason: string | null;
};

const emptyForm = () => ({
  dutyTypeId: "",
  hourlyRate: "",
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: "",
  reason: "",
});

export function EmployeePayRatesTab({
  employeeId,
  currentHourlyRate,
}: {
  employeeId: number;
  currentHourlyRate?: string | null;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const { data: dutyTypes = [] } = useQuery<DutyType[]>({
    queryKey: ["/api/tenant/duty-types"],
  });

  const { data: rates = [], refetch } = useQuery<PayRate[]>({
    queryKey: ["/api/admin/employees", employeeId, "pay-rates"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/employees/${employeeId}/pay-rates`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pay rates");
      return res.json();
    },
  });

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm());
  };

  const startEdit = (r: PayRate) => {
    const dutyId = r.dutyTypeId ?? r.duty_type_id;
    setEditingId(r.id);
    setForm({
      dutyTypeId: dutyId ? String(dutyId) : "",
      hourlyRate: String(r.hourly_rate),
      effectiveFrom: String(r.effective_from).slice(0, 10),
      effectiveTo: r.effective_to ? String(r.effective_to).slice(0, 10) : "",
      reason: r.reason || "",
    });
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        dutyTypeId: form.dutyTypeId ? parseInt(form.dutyTypeId, 10) : null,
        hourlyRate: form.hourlyRate,
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        reason: form.reason || null,
      };
      if (editingId) {
        const res = await apiRequest("PATCH", `/api/employee-pay-rates/${editingId}`, payload);
        return res.json();
      }
      const res = await apiRequest("POST", `/api/admin/employees/${employeeId}/pay-rates`, payload);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editingId ? "Pay rate updated" : "Pay rate added" });
      reset();
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (rateId: number) => {
      await apiRequest("DELETE", `/api/employee-pay-rates/${rateId}`);
    },
    onSuccess: () => {
      toast({ title: "Pay rate deleted" });
      if (editingId) reset();
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/employees"] });
    },
    onError: (e: any) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4" data-testid="employee-pay-rates-tab">
      <div>
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <PoundSterling className="w-4 h-4 text-[#FF8C42]" />
          Pay rates by duty type
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Current rate: <strong>£{currentHourlyRate || "0.00"}/hr</strong> — set rates per duty type with effective dates.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1">
          <Label className="text-xs">Duty type</Label>
          <Select value={form.dutyTypeId} onValueChange={(v) => setForm((f) => ({ ...f, dutyTypeId: v }))}>
            <SelectTrigger data-testid="select-emp-pay-duty-type">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {dutyTypes.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Hourly rate (£) *</Label>
          <Input
            type="number"
            step="0.01"
            value={form.hourlyRate}
            onChange={(e) => setForm((f) => ({ ...f, hourlyRate: e.target.value }))}
            data-testid="input-pay-rate-hourly"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Effective from *</Label>
          <Input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => setForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
            data-testid="input-pay-rate-from"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Effective to</Label>
          <Input
            type="date"
            value={form.effectiveTo}
            onChange={(e) => setForm((f) => ({ ...f, effectiveTo: e.target.value }))}
            data-testid="input-pay-rate-to"
          />
        </div>
        <div className="flex items-end gap-2">
          <Button
            className="flex-1 bg-[#FF8C42] hover:bg-[#e87d38]"
            size="sm"
            disabled={saveMut.isPending || !form.dutyTypeId || !form.hourlyRate || !form.effectiveFrom}
            onClick={() => saveMut.mutate()}
            data-testid="button-save-pay-rate"
          >
            {saveMut.isPending && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            {editingId ? "Save changes" : <><Plus className="w-3 h-3 mr-1" /> Add rate</>}
          </Button>
          {editingId && (
            <Button type="button" size="sm" variant="outline" onClick={reset}>
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {rates.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <PoundSterling className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No pay rates yet</p>
          <p className="text-xs mt-1">Add a rate by duty type (same layout as site rates).</p>
        </div>
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
            {rates.map((r, idx) => {
              const dutyName = r.dutyTypeName || r.duty_type_name;
              const dutyId = r.dutyTypeId ?? r.duty_type_id;
              return (
                <TableRow key={r.id} className={editingId === r.id ? "bg-muted/40" : idx === 0 ? "bg-orange-50/50" : undefined}>
                  <TableCell>
                    {dutyName || (dutyId ? `Duty #${dutyId}` : "—")}
                    {idx === 0 && <Badge className="ml-2 bg-[#FF8C42] text-white text-[10px]">Current</Badge>}
                  </TableCell>
                  <TableCell>£{Number(r.hourly_rate ?? 0).toFixed(2)}</TableCell>
                  <TableCell>{String(r.effective_from).slice(0, 10)}</TableCell>
                  <TableCell>{r.effective_to ? String(r.effective_to).slice(0, 10) : "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(r)} data-testid={`button-edit-pay-rate-${r.id}`}>
                        <Pencil className="w-3 h-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteMut.mutate(r.id)} data-testid={`button-delete-pay-rate-${r.id}`}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
