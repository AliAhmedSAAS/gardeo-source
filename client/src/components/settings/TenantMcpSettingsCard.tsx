import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Copy, Key, Loader2, Plus, Plug, Trash2 } from "lucide-react";

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

export function TenantMcpSettingsCard() {
  const { toast } = useToast();
  const [name, setName] = useState("Cursor / AI agent");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<McpStatus>({
    queryKey: ["/api/admin/mcp/status"],
  });

  const enabled = !!status?.enabled;

  const { data, isLoading } = useQuery<{ clients: McpClient[] }>({
    queryKey: ["/api/admin/mcp/clients"],
    enabled,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/mcp/clients", {
        name: name.trim() || "MCP client",
        scopes: ["ops.read"],
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

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast({ title: "Copied" });
  };

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
                Secure Phase 1 read-only tools for Cursor and other MCP clients.
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
            Set <code className="text-xs">MCP_ENABLED=true</code> on the server, apply migration{" "}
            <code className="text-xs">0044_mcp_phase1.sql</code>, then refresh.
          </p>
        )}

        {enabled && (
          <>
            <div className="rounded-md border p-3 text-sm space-y-1">
              <div>
                Endpoint: <code className="text-xs">{status?.endpoint || "/mcp"}</code>
              </div>
              <div>
                Scopes: {(status?.scopes || []).join(", ") || "ops.read"}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mcp-client-name">New client name</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="mcp-client-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cursor / AI agent"
                  data-testid="input-mcp-client-name"
                />
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
