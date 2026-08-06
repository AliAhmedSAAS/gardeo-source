import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Receipt, Building2 } from "lucide-react";
import type { FmSupplier } from "@shared/schema";

interface PreviewLine {
  jobId: number;
  jobNumber: string | null;
  description: string;
  hours: number;
  rate?: number;
  chargeRate?: number;
  subtotal: number;
  rateSource?: string;
}

interface PreviewResult {
  jobs: PreviewLine[];
  subtotal: number;
  jobCount: number;
}

function todayStartOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); }
function todayEndOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); }

function SelfBillingPanel() {
  const { toast } = useToast();
  const { data: suppliers = [] } = useQuery<FmSupplier[]>({ queryKey: ["/api/fm/suppliers"] });
  const [fmSupplierId, setFmSupplierId] = useState<string>("");
  const [periodStart, setPeriodStart] = useState(todayStartOfMonth());
  const [periodEnd, setPeriodEnd] = useState(todayEndOfMonth());
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/fm/billing/self-bill/preview", { fmSupplierId: parseInt(fmSupplierId), periodStart, periodEnd });
      return r.json();
    },
    onSuccess: (d: PreviewResult) => setPreview(d),
    onError: (e: any) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/fm/billing/self-bill/generate", { fmSupplierId: parseInt(fmSupplierId), periodStart, periodEnd });
      return r.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "Self-bill invoice created", description: `${d.invoiceNumber} — ${d.lineItemCount} job(s)` });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/fm/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
    },
    onError: (e: any) => toast({ title: "Generate failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label>FM Supplier</Label>
          <Select value={fmSupplierId} onValueChange={setFmSupplierId}>
            <SelectTrigger data-testid="select-fm-supplier"><SelectValue placeholder="Choose supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.companyName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Period start</Label>
          <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} data-testid="input-self-bill-period-start" />
        </div>
        <div>
          <Label>Period end</Label>
          <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} data-testid="input-self-bill-period-end" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => previewMutation.mutate()} disabled={!fmSupplierId || previewMutation.isPending} data-testid="button-preview-self-bill">
            {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
          </Button>
          <Button onClick={() => generateMutation.mutate()} disabled={!preview || preview.jobCount === 0 || generateMutation.isPending} data-testid="button-generate-self-bill">
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate self-bill"}
          </Button>
        </div>
      </div>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{preview.jobCount} job(s) — Subtotal £{preview.subtotal.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.jobs.map(j => (
                  <TableRow key={j.jobId} data-testid={`row-self-bill-job-${j.jobId}`}>
                    <TableCell>{j.description}</TableCell>
                    <TableCell className="text-right">{j.hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right">£{(j.rate ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">£{j.subtotal.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {preview.jobs.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No completed, un-invoiced FM jobs in this period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClientInvoicePanel() {
  const { toast } = useToast();
  const { data: clients = [] } = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const [clientId, setClientId] = useState<string>("");
  const [periodStart, setPeriodStart] = useState(todayStartOfMonth());
  const [periodEnd, setPeriodEnd] = useState(todayEndOfMonth());
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/fm/billing/client-invoice/preview", { clientId: parseInt(clientId), periodStart, periodEnd });
      return r.json();
    },
    onSuccess: (d: PreviewResult) => setPreview(d),
    onError: (e: any) => toast({ title: "Preview failed", description: e.message, variant: "destructive" }),
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/fm/billing/client-invoice/generate", { clientId: parseInt(clientId), periodStart, periodEnd });
      return r.json();
    },
    onSuccess: (d: any) => {
      toast({ title: "Client invoice created", description: `${d.invoiceNumber} — ${d.lineItemCount} job(s)` });
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["/api/fm/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/accounting/client-invoices"] });
    },
    onError: (e: any) => toast({ title: "Generate failed", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <div>
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger data-testid="select-client"><SelectValue placeholder="Choose client" /></SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.companyName || c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Period start</Label>
          <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} data-testid="input-client-period-start" />
        </div>
        <div>
          <Label>Period end</Label>
          <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} data-testid="input-client-period-end" />
        </div>
        <div className="flex gap-2">
          <Button onClick={() => previewMutation.mutate()} disabled={!clientId || previewMutation.isPending} data-testid="button-preview-client-invoice">
            {previewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Preview"}
          </Button>
          <Button onClick={() => generateMutation.mutate()} disabled={!preview || preview.jobCount === 0 || generateMutation.isPending} data-testid="button-generate-client-invoice">
            {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Generate client invoice"}
          </Button>
        </div>
      </div>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{preview.jobCount} job(s) — Subtotal £{preview.subtotal.toFixed(2)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                  <TableHead className="text-right">Charge rate</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                  <TableHead>Rate source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.jobs.map(j => (
                  <TableRow key={j.jobId} data-testid={`row-client-invoice-job-${j.jobId}`}>
                    <TableCell>{j.description}</TableCell>
                    <TableCell className="text-right">{j.hours.toFixed(2)}</TableCell>
                    <TableCell className="text-right">£{(j.chargeRate ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">£{j.subtotal.toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline">{j.rateSource}</Badge></TableCell>
                  </TableRow>
                ))}
                {preview.jobs.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No completed, un-invoiced FM jobs in this period.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function FmBillingPage() {
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">FM Billing</h1>
        <p className="text-sm text-muted-foreground">Generate client invoices and supplier self-bills from completed FM jobs.</p>
      </div>

      <Tabs defaultValue="client">
        <TabsList>
          <TabsTrigger value="client" data-testid="tab-client-invoicing"><Building2 className="h-4 w-4 mr-2" />Client invoicing</TabsTrigger>
          <TabsTrigger value="supplier" data-testid="tab-supplier-self-billing"><Receipt className="h-4 w-4 mr-2" />Supplier self-billing</TabsTrigger>
        </TabsList>
        <TabsContent value="client" className="mt-4"><ClientInvoicePanel /></TabsContent>
        <TabsContent value="supplier" className="mt-4"><SelfBillingPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
