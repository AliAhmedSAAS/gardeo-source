import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { DEFAULT_OFFICER_TYPES } from "@shared/defaultOfficerTypes";
import { Loader2, Plus, Shield, Trash2 } from "lucide-react";

type OfficerTypeRow = {
  id: number;
  tenantId?: number;
  name: string;
  sortOrder?: number;
};

function normalizeOfficerTypes(data: unknown): OfficerTypeRow[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const id = item.id;
      const name = item.name;
      if (typeof id !== "number" || typeof name !== "string") return null;
      return { id, name, tenantId: item.tenantId as number | undefined, sortOrder: item.sortOrder as number | undefined };
    })
    .filter((row): row is OfficerTypeRow => row !== null);
}

export function TenantOfficerTypesSettingsCard() {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");

  const { data, isLoading, isError, refetch } = useQuery<unknown>({
    queryKey: ["/api/tenant/officer-types"],
    refetchOnMount: "always",
  });

  const officerTypes = normalizeOfficerTypes(data);

  const addMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await apiRequest("POST", "/api/tenant/officer-types", { name });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/officer-types"] });
      setNewName("");
      toast({ title: "Officer type added" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/tenant/officer-types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/officer-types"] });
      toast({ title: "Officer type removed" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Officer Types</h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Define officer types for your organisation. These appear when assigning an employee&apos;s officer type.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading officer types...
          </div>
        ) : isError ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">Could not load officer types. Restart the server if you recently added this feature.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-officer-types">
              Retry
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-md border divide-y">
              {officerTypes.length === 0 ? (
                <div className="p-3 space-y-2">
                  <p className="text-sm text-muted-foreground">No officer types configured.</p>
                  <p className="text-xs text-muted-foreground">
                    Defaults include: {DEFAULT_OFFICER_TYPES.slice(0, 3).join(", ")}, and more.
                  </p>
                </div>
              ) : (
                officerTypes.map((type) => (
                  <div key={type.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-sm">{type.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteMutation.mutate(type.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-officer-type-${type.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="newOfficerType" className="text-xs">Add officer type</Label>
                <Input
                  id="newOfficerType"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Event Steward"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newName.trim()) {
                      e.preventDefault();
                      addMutation.mutate(newName.trim());
                    }
                  }}
                  data-testid="input-new-officer-type"
                />
              </div>
              <Button
                size="sm"
                onClick={() => addMutation.mutate(newName.trim())}
                disabled={!newName.trim() || addMutation.isPending}
                data-testid="button-add-officer-type"
              >
                {addMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                Add
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
