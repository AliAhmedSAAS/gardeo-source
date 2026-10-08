import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEFAULT_DUTY_TYPES } from "@shared/defaultDutyTypes";
import { Briefcase, Loader2, Plus, Trash2 } from "lucide-react";

type DutyTypeRow = {
  id: number;
  tenantId?: number;
  name: string;
  requiresLicense: boolean;
  sortOrder?: number;
};

function normalizeDutyTypes(data: unknown): DutyTypeRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const id = item.id;
      const name = item.name;
      if (typeof id !== "number" || typeof name !== "string") return null;
      return {
        id,
        name,
        requiresLicense: Boolean(item.requiresLicense),
        tenantId: item.tenantId as number | undefined,
        sortOrder: item.sortOrder as number | undefined,
      };
    })
    .filter((row): row is DutyTypeRow => row !== null);
}

export function TenantDutyTypesSettingsCard() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newRequiresLicense, setNewRequiresLicense] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<unknown>({
    queryKey: ["/api/tenant/duty-types"],
    refetchOnMount: "always",
  });

  const dutyTypes = normalizeDutyTypes(data);

  const addMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tenant/duty-types", {
        name: newName.trim(),
        requiresLicense: newRequiresLicense,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/duty-types"] });
      setNewName("");
      setNewRequiresLicense(false);
      toast({ title: "Duty type added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, requiresLicense }: { id: number; requiresLicense: boolean }) => {
      const res = await apiRequest("PATCH", `/api/tenant/duty-types/${id}`, { requiresLicense });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/duty-types"] });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tenant/duty-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/duty-types"] });
      toast({ title: "Duty type removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card data-testid="card-duty-types-settings">
      <CardContent className="p-4">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Briefcase className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Duty Types</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Define duty types for shifts. Licence (SIA) validation only runs when the selected duty type requires a licence.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading duty types...
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Could not load duty types. Restart the server if you recently added this feature.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-duty-types">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border divide-y">
              {dutyTypes.length === 0 ? (
                <div className="p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">No duty types configured.</p>
                  <p className="text-xs text-muted-foreground">
                    Defaults include: {DEFAULT_DUTY_TYPES.slice(0, 3).map((t) => t.name).join(", ")}, and more.
                  </p>
                </div>
              ) : (
                dutyTypes.map((type) => (
                  <div key={type.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="text-sm truncate">{type.name}</span>
                      {type.requiresLicense ? (
                        <Badge variant="secondary" className="text-[10px] shrink-0">Licence required</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] shrink-0">No licence</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Label htmlFor={`duty-license-${type.id}`} className="text-[11px] text-muted-foreground whitespace-nowrap">
                          Licence
                        </Label>
                        <Switch
                          id={`duty-license-${type.id}`}
                          checked={type.requiresLicense}
                          disabled={toggleMutation.isPending}
                          onCheckedChange={(checked) => toggleMutation.mutate({ id: type.id, requiresLicense: checked })}
                          data-testid={`switch-duty-requires-license-${type.id}`}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(type.id)}
                        disabled={deleteMutation.isPending}
                        data-testid={`button-delete-duty-type-${type.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newDutyType" className="text-xs">Add duty type</Label>
              <div className="flex items-end gap-2">
                <Input
                  id="newDutyType"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Event Steward"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      e.preventDefault();
                      addMutation.mutate();
                    }
                  }}
                  data-testid="input-new-duty-type"
                />
                <Button
                  size="sm"
                  onClick={() => addMutation.mutate()}
                  disabled={!newName.trim() || addMutation.isPending}
                  data-testid="button-add-duty-type"
                >
                  {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                  Add
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="new-duty-requires-license"
                  checked={newRequiresLicense}
                  onCheckedChange={setNewRequiresLicense}
                  data-testid="switch-new-duty-requires-license"
                />
                <Label htmlFor="new-duty-requires-license" className="text-xs text-muted-foreground">
                  Requires SIA licence
                </Label>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
