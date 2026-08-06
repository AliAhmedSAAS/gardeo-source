import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertCircle, CheckCircle2, Loader2, Mail, Save, Send,
} from "lucide-react";

type EmailSettings = {
  enabled: boolean;
  provider: string;
  fromName: string | null;
  fromEmail: string | null;
  replyToEmail: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  hasSmtpPassword: boolean;
  hasResendApiKey: boolean;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastError: string | null;
  configured: boolean;
};

export function TenantEmailSettingsCard() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [form, setForm] = useState({
    enabled: false,
    provider: "smtp",
    fromName: "",
    fromEmail: "",
    replyToEmail: "",
    smtpHost: "",
    smtpPort: "587",
    smtpSecure: false,
    smtpUser: "",
    smtpPassword: "",
    resendApiKey: "",
    testTo: "",
  });

  const { data, isLoading } = useQuery<EmailSettings>({
    queryKey: ["/api/tenant/email-settings"],
  });

  useEffect(() => {
    if (!data) return;
    setForm((f) => ({
      ...f,
      enabled: !!data.enabled,
      provider: data.provider || "smtp",
      fromName: data.fromName || "",
      fromEmail: data.fromEmail || "",
      replyToEmail: data.replyToEmail || "",
      smtpHost: data.smtpHost || "",
      smtpPort: String(data.smtpPort ?? 587),
      smtpSecure: !!data.smtpSecure,
      smtpUser: data.smtpUser || "",
      smtpPassword: "",
      resendApiKey: "",
      testTo: f.testTo || user?.email || "",
    }));
  }, [data, user?.email]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        enabled: form.enabled,
        provider: form.provider,
        fromName: form.fromName || null,
        fromEmail: form.fromEmail || null,
        replyToEmail: form.replyToEmail || null,
        smtpHost: form.smtpHost || null,
        smtpPort: parseInt(form.smtpPort, 10) || 587,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser || null,
      };
      if (form.smtpPassword.trim()) body.smtpPassword = form.smtpPassword.trim();
      if (form.resendApiKey.trim()) body.resendApiKey = form.resendApiKey.trim();
      const res = await apiRequest("PATCH", "/api/tenant/email-settings", body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/email-settings"] });
      setForm((f) => ({ ...f, smtpPassword: "", resendApiKey: "" }));
      toast({ title: "Email settings saved" });
    },
    onError: (err: Error) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const testMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/tenant/email-settings/test", {
        to: form.testTo.trim() || user?.email,
      });
      return res.json();
    },
    onSuccess: (result: { to?: string; via?: string }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/email-settings"] });
      toast({
        title: "Test email sent",
        description: `Sent to ${result.to || form.testTo}${result.via ? ` via ${result.via}` : ""}`,
      });
    },
    onError: (err: Error) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Card data-testid="card-tenant-email-settings">
      <CardContent className="p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-base">Email / SMTP</h3>
              <p className="text-sm text-muted-foreground">
                Per-tenant outgoing mail for employment references and other system emails.
              </p>
            </div>
          </div>
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mt-1" />
          ) : data?.configured && data.enabled ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 shrink-0">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Configured
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-muted-foreground">Not configured</Badge>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select
              value={form.provider}
              onValueChange={(v) => setForm((f) => ({ ...f, provider: v }))}
            >
              <SelectTrigger data-testid="select-email-provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="smtp">SMTP</SelectItem>
                <SelectItem value="resend">Resend API</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm h-10">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                data-testid="checkbox-email-enabled"
              />
              Enable for this tenant
            </label>
          </div>
          <div className="space-y-1.5">
            <Label>From name</Label>
            <Input
              value={form.fromName}
              onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
              placeholder="Guardian FM Vetting"
              data-testid="input-email-from-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>From email *</Label>
            <Input
              type="email"
              value={form.fromEmail}
              onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))}
              placeholder="vetting@yourcompany.co.uk"
              data-testid="input-email-from-email"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reply-To (optional)</Label>
            <Input
              type="email"
              value={form.replyToEmail}
              onChange={(e) => setForm((f) => ({ ...f, replyToEmail: e.target.value }))}
              placeholder="hr@yourcompany.co.uk"
              data-testid="input-email-reply-to"
            />
          </div>
        </div>

        {form.provider === "smtp" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border p-4">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>SMTP host *</Label>
              <Input
                value={form.smtpHost}
                onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                placeholder="smtp.office365.com"
                data-testid="input-smtp-host"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Port</Label>
              <Input
                value={form.smtpPort}
                onChange={(e) => setForm((f) => ({ ...f, smtpPort: e.target.value }))}
                placeholder="587"
                data-testid="input-smtp-port"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm h-10">
                <input
                  type="checkbox"
                  checked={form.smtpSecure}
                  onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
                  data-testid="checkbox-smtp-secure"
                />
                Use TLS/SSL (port 465)
              </label>
            </div>
            <div className="space-y-1.5">
              <Label>SMTP username</Label>
              <Input
                value={form.smtpUser}
                onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))}
                placeholder="user@yourcompany.co.uk"
                data-testid="input-smtp-user"
              />
            </div>
            <div className="space-y-1.5">
              <Label>SMTP password {data?.hasSmtpPassword ? "(saved — leave blank to keep)" : "*"}</Label>
              <Input
                type="password"
                value={form.smtpPassword}
                onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))}
                placeholder={data?.hasSmtpPassword ? "••••••••" : "App password / SMTP password"}
                data-testid="input-smtp-password"
                autoComplete="new-password"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-1.5 rounded-lg border p-4">
            <Label>Resend API key {data?.hasResendApiKey ? "(saved — leave blank to keep)" : "*"}</Label>
            <Input
              type="password"
              value={form.resendApiKey}
              onChange={(e) => setForm((f) => ({ ...f, resendApiKey: e.target.value }))}
              placeholder={data?.hasResendApiKey ? "••••••••" : "re_..."}
              data-testid="input-resend-api-key"
              autoComplete="new-password"
            />
          </div>
        )}

        {data?.lastError && (
          <div className="flex items-start gap-2 text-red-600 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{data.lastError}</span>
          </div>
        )}

        {data?.lastTestedAt && (
          <p className="text-xs text-muted-foreground">
            Last test: {data.lastTestStatus || "—"} · {new Date(data.lastTestedAt).toLocaleString("en-GB")}
          </p>
        )}

        <div className="flex flex-wrap gap-2 items-end">
          <Button
            size="sm"
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            data-testid="button-save-email-settings"
          >
            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            Save
          </Button>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Test to</Label>
              <Input
                className="w-56"
                type="email"
                value={form.testTo}
                onChange={(e) => setForm((f) => ({ ...f, testTo: e.target.value }))}
                placeholder="you@company.com"
                data-testid="input-email-test-to"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending || !form.enabled}
              data-testid="button-test-email-settings"
            >
              {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Send className="w-4 h-4 mr-1" />}
              Send test
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
