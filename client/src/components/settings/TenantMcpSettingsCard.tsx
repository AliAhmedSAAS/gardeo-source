import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Check, Copy, Key, Loader2, Plus, Plug, Trash2, X } from "lucide-react";

type McpStatus = {
  enabled: boolean;
  endpoint: string;
  scopes: string[];
  phase: number;
};

type McpKey = {
  id: number;
  clientId: number;
  keyPrefix: string;
  label: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

type McpClient = {
  id: number;
  name: string;
  scopes: string[];
  status: string;
  createdAt: string;
  keys: McpKey[];
};

type McpProposal = {
  id: number;
  proposalType: string;
  summary: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

export function TenantMcpSettingsCard() {
  const { toast } = useToast();
  const [name, setName] = useState("Cursor / AI agent");
  const [allowWrite, setAllowWrite] = useState(false);
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<McpStatus>({
    queryKey: ["/api/admin/mcp/status"],
  });

  const enabled = !!status?.enabled;

  const { data, isLoading } = useQuery<{ clients: McpClient[] }>({
    queryKey: ["/api/admin/mcp/clients"],
    enabled,
  });

  const { data: proposalsData, isLoading: proposalsLoading } = useQuery<{ data: McpProposal[] }>({
    queryKey: ["/api/admin/mcp/proposals", { status: "pending" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/mcp/proposals?status=pending");
      return res.json();
    },
    enabled,
    refetchInterval: enabled ? 15000 : false,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const scopes = allowWrite ? ["ops.read", "ops.write"] : ["ops.read"];
      const res = await apiRequest("POST", "/api/admin/mcp/clients", {
        name: name.trim() || "MCP client",
        scopes,
        label: "default",
      });
      return res.json() as Promise<{ apiKey: string; client: McpClient }>;
    },
    onSuccess: (result) => {
      setRevealedKey(result.apiKey);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mcp/clients"] });
      toast({ title: "MCP client created", description: "Copy the API key now — it is shown once." });
    },
    onError: (err: Error) =>
      toast({ title: "Create failed", description: err.message, variant: "destructive" }),
  });

  const revokeMut = useMutation({
    mutationFn: async (keyId: number) => {
      const res = await apiRequest("POST", `/api/admin/mcp/keys/${keyId}/revoke`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mcp/clients"] });
      toast({ title: "API key revoked" });
    },
    onError: (err: Error) =>
      toast({ title: "Revoke failed", description: err.message, variant: "destructive" }),
  });

  const confirmMut = useMutation({
    mutationFn: async (proposalId: number) => {
      const res = await apiRequest("POST", `/api/admin/mcp/proposals/${proposalId}/confirm`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mcp/proposals"] });
      toast({ title: "Proposal confirmed" });
    },
    onError: (err: Error) =>
      toast({ title: "Confirm failed", description: err.message, variant: "destructive" }),
  });

  const rejectMut = useMutation({
    mutationFn: async (proposalId: number) => {
      const res = await apiRequest("POST", `/api/admin/mcp/proposals/${proposalId}/reject`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/mcp/proposals"] });
      toast({ title: "Proposal rejected" });
    },
    onError: (err: Error) =>
      toast({ title: "Reject failed", description: err.message, variant: "destructive" }),
  });

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Copied" });
  };

  const pending = proposalsData?.data || [];

  return (
    <Card data-testid="card-mcp-integration">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Plug className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Gardeo MCP (AI)</h3>
              <p className="text-sm text-muted-foreground">
                Phase {status?.phase ?? 3}: reads, write proposals, deny-list, Claude OAuth.
              </p>
            </div>
          </div>
          {statusLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <Badge variant={enabled ? "default" : "secondary"}>
              {enabled ? "Enabled" : "Disabled"}
            </Badge>
          )}
        </div>

        {!enabled && (
          <p className="text-sm text-muted-foreground">
            Set <code className="text-xs">MCP_ENABLED=true</code> on the server, apply migrations{" "}
            <code className="text-xs">0044</code>/<code className="text-xs">0045</code>, then refresh.
          </p>
        )}

        {enabled && (
          <>
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div>
                Endpoint: <code className="text-xs">{status?.endpoint || "/mcp"}</code>
              </div>
              <div>
                Scopes: {(status?.scopes || []).join(", ") || "ops.read, ops.write"}
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="mcp-client-name">New client name</Label>
              <Input
                id="mcp-client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cursor / AI agent"
                data-testid="input-mcp-client-name"
              />
              <div className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Allow ops.write</div>
                  <div className="text-xs text-muted-foreground">
                    Enables propose_* tools. Changes still need confirm.
                  </div>
                </div>
                <Switch
                  checked={allowWrite}
                  onCheckedChange={setAllowWrite}
                  data-testid="switch-mcp-ops-write"
                />
              </div>
              <Button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending}
                data-testid="button-mcp-create-client"
              >
                {createMut.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Create key
              </Button>
            </div>

            {revealedKey && (
              <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Key className="w-4 h-4" />
                  API key (copy now — not shown again)
                </div>
                <div className="flex gap-2">
                  <code className="text-xs break-all flex-1">{revealedKey}</code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => copy(revealedKey)}
                    data-testid="button-mcp-copy-key"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Pending proposals</h4>
                <Badge variant="secondary">{pending.length}</Badge>
              </div>
              {proposalsLoading ? (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : pending.length === 0 ? (
                <p className="text-sm text-muted-foreground">No pending write proposals.</p>
              ) : (
                <div className="space-y-2">
                  {pending.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-md border p-3 space-y-2"
                      data-testid={`mcp-proposal-${p.id}`}
                    >
                      <div className="text-sm font-medium">{p.summary}</div>
                      <div className="text-xs text-muted-foreground">
                        #{p.id} · {p.proposalType} · expires {new Date(p.expiresAt).toLocaleString("en-GB")}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => confirmMut.mutate(p.id)}
                          disabled={confirmMut.isPending || rejectMut.isPending}
                          data-testid={`button-mcp-confirm-${p.id}`}
                        >
                          <Check className="w-3.5 h-3.5 mr-1" />
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => rejectMut.mutate(p.id)}
                          disabled={confirmMut.isPending || rejectMut.isPending}
                          data-testid={`button-mcp-reject-${p.id}`}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {(data?.clients || []).length === 0 && (
                  <p className="text-sm text-muted-foreground">No MCP clients yet.</p>
                )}
                {(data?.clients || []).map((client) => (
                  <div key={client.id} className="rounded-md border p-3 space-y-2" data-testid={`mcp-client-${client.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium text-sm">{client.name}</div>
                        <div className="text-xs text-muted-foreground">
                          scopes: {(client.scopes || []).join(", ")} · {client.status}
                        </div>
                      </div>
                      <Badge variant={client.status === "active" ? "default" : "secondary"}>
                        {client.status}
                      </Badge>
                    </div>
                    <ul className="space-y-2">
                      {client.keys.map((key) => (
                        <li
                          key={key.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-mono">
                            {key.keyPrefix}… {key.label ? `(${key.label})` : ""}
                            {key.revokedAt ? " · revoked" : ""}
                          </span>
                          {!key.revokedAt && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              disabled={revokeMut.isPending}
                              onClick={() => revokeMut.mutate(key.id)}
                              data-testid={`button-mcp-revoke-${key.id}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
