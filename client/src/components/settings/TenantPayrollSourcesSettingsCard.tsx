import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Banknote, Loader2, Plus, Trash2 } from "lucide-react";

type PayrollSourceRow = {
  id: number;
  value: string;
  label: string;
  wageBucket: string;
  isSystem: boolean;
  sortOrder?: number;
};

function normalizeSources(data: unknown): PayrollSourceRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      if (typeof item.id !== "number" || typeof item.value !== "string" || typeof item.label !== "string") return null;
      return {
        id: item.id,
        value: item.value,
        label: item.label,
        wageBucket: String(item.wageBucket || "first4_paye"),
        isSystem: Boolean(item.isSystem),
        sortOrder: item.sortOrder as number | undefined,
      };
    })
    .filter((row): row is PayrollSourceRow => row !== null);
}

export function TenantPayrollSourcesSettingsCard() {
  const { toast } = useToast();
  const [newLabel, setNewLabel] = useState("");
  const [newBucket, setNewBucket] = useState("first4_paye");

  const { data, isLoading, isError, refetch } = useQuery<unknown>({
    queryKey: ["/api/tenant/payroll-sources"],
    refetchOnMount: "always",
  });

  const sources = normalizeSources(data);

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tenant/payroll-sources", {
        label: newLabel.trim(),
        wageBucket: newBucket,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/payroll-sources"] });
      setNewLabel("");
      setNewBucket("first4_paye");
      toast({ title: "Payroll source added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tenant/payroll-sources/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/payroll-sources"] });
      toast({ title: "Source removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-payroll-sources-settings">
      <CardContent className="p-4">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Banknote className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Payroll sources</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Providers for NI (PAYE) and Self-employed on Payroll Summary / Bill Section. Only when custom payroll is enabled.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading sources...
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Could not load payroll sources. Restart the server if you recently added this feature.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ul className="space-y-2">
              {sources.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{s.value}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-[10px]">
                      {s.wageBucket === "gfm_paye" ? "GFM bucket" : "1st4 bucket"}
                    </Badge>
                    {s.isSystem ? (
                      <Badge variant="outline" className="text-[10px]">Default</Badge>
                    ) : (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(s.id)}
                        title="Remove source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto] items-end pt-2 border-t">
              <div>
                <Label className="text-xs">New source label</Label>
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="e.g. Acme PAYE"
                  data-testid="input-new-payroll-source"
                />
              </div>
              <div>
                <Label className="text-xs">Wage bucket</Label>
                <Select value={newBucket} onValueChange={setNewBucket}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first4_paye">1st4 totals</SelectItem>
                    <SelectItem value="gfm_paye">GFM totals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                size="sm"
                disabled={!newLabel.trim() || addMutation.isPending}
                onClick={() => addMutation.mutate()}
                data-testid="button-add-payroll-source"
              >
                {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                Add
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
