import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  PAYMENT_RULES, PAYROLL_SOURCES, NI_USED_STEPS, currentPayrollMonth,
  canControlApprove, canHrApprove, canAccountsApprove, canHrHold,
  canControllerRemarks, canAccountsRemarks, isFinanceRole, ruleLabel, sourceLabel,
} from "@shared/payrollControl";
import { Loader2, RefreshCw, Play } from "lucide-react";

type OfficerRow = {
  employeeId: number;
  monthId: number | null;
  wid: string;
  name: string;
  bank: string;
  empType: string;
  agent: string;
  hrStatus: string;
  rulesOfPayment: string;
  payrollSource: string;
  niUsed: number;
  first4Hours: number;
  first4Wages: number;
  first4Paid: boolean;
  gfmHours: number;
  gfmWages: number;
  gfmPaid: boolean;
  selfHours: number;
  selfWages: number;
  selfPaid: boolean;
  remarks: string | null;
  accountsRemarks: string | null;
  request: {
    id: number;
    fromRule: string;
    fromSource: string;
    toRule: string;
    toSource: string;
    controlStatus: string;
    hrStatus: string;
    accountsStatus: string;
  } | null;
};

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

export default function PayrollSummaryPage() {
  const { user } = useAuth();
  const role = user?.role;
  const { toast } = useToast();
  const [month, setMonth] = useState(currentPayrollMonth());
  const [search, setSearch] = useState("");
  const [rule, setRule] = useState("ALL");
  const [source, setSource] = useState("ALL");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [approveRow, setApproveRow] = useState<OfficerRow | null>(null);
  const [shiftRow, setShiftRow] = useState<OfficerRow | null>(null);

  const queryKey = ["/api/payroll-control/summary", month, search, rule, source];
  const { data, isLoading, refetch } = useQuery<{ officers: OfficerRow[]; kpis: any; month: string }>({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({ month, search, rule, source });
      const res = await fetch(`/api/payroll-control/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
  });

  const officers = data?.officers || [];

  const { data: shifts, isLoading: shiftsLoading } = useQuery<any[]>({
    queryKey: ["/api/payroll-control/months", shiftRow?.monthId, "shifts"],
    enabled: !!shiftRow?.monthId,
    queryFn: async () => {
      const res = await fetch(`/api/payroll-control/months/${shiftRow!.monthId}/shifts`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
  });

  async function ensureMonth(employeeId: number) {
    const res = await apiRequest("POST", "/api/payroll-control/months/ensure", { employeeId, month });
    return res.json();
  }

  const applyMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payroll-control/apply-rules", {
        month, employeeIds: Array.from(selected),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-control/summary"] });
      toast({ title: "Rules applied" });
      setSelected(new Set());
    },
    onError: (err: Error) => toast({ title: "Apply Rules failed", description: err.message, variant: "destructive" }),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/payroll-control/months/${id}`, data);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/payroll-control/summary"] }),
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const requestMutation = useMutation({
    mutationFn: async ({ monthId, toRule, toSource }: { monthId: number; toRule: string; toSource: string }) => {
      const res = await apiRequest("POST", "/api/payroll-control/rule-requests", { monthId, toRule, toSource });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-control/summary"] });
      toast({ title: "Approval requested" });
    },
    onError: (err: Error) => toast({ title: "Request failed", description: err.message, variant: "destructive" }),
  });

  const decideMutation = useMutation({
    mutationFn: async ({ id, column, decision }: { id: number; column: string; decision: string }) => {
      const res = await apiRequest("POST", `/api/payroll-control/rule-requests/${id}/decide`, { column, decision });
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-control/summary"] });
      toast({ title: result.outcome === "approved" ? "New rule is live" : result.outcome === "denied" ? "Request denied — old rule stays" : "Decision saved" });
    },
    onError: (err: Error) => toast({ title: "Decision failed", description: err.message, variant: "destructive" }),
  });

  const allIds = useMemo(() => officers.map((o) => o.employeeId), [officers]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  async function changeRule(row: OfficerRow, toRule: string, toSource: string) {
    let monthId = row.monthId;
    if (!monthId) {
      const created = await ensureMonth(row.employeeId);
      monthId = created.id;
    }
    requestMutation.mutate({ monthId: monthId!, toRule, toSource });
  }

  return (
    <div className="p-6 space-y-4" data-testid="payroll-summary-page">
      <div>
        <h1 className="text-2xl font-bold">Payroll Summary</h1>
        <p className="text-sm text-muted-foreground">Approve live rules, Apply Rules, then mark wage buckets. Bank payments are on Pending Payment.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Full Self %", data?.kpis?.fullSelfPct],
          ["Partial Self %", data?.kpis?.partialSelfPct],
          ["NI Hours %", data?.kpis?.niHoursPct],
          ["Total Pay Status %", data?.kpis?.totalPayStatusPct],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl p-4 bg-slate-800 text-white">
            <p className="text-xs text-white/70">{label}</p>
            <p className="text-2xl font-bold mt-1">{value ?? 0}%</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <Label>Month</Label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} data-testid="filter-month" />
        </div>
        <div>
          <Label>Search</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or WID" data-testid="filter-search" />
        </div>
        <div>
          <Label>Rules</Label>
          <Select value={rule} onValueChange={setRule}>
            <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {PAYMENT_RULES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Payroll source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {PAYROLL_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-1" />Refresh</Button>
        {isFinanceRole(role) && (
          <Button
            onClick={() => applyMutation.mutate()}
            disabled={applyMutation.isPending || selected.size === 0}
            data-testid="btn-apply-rules"
          >
            {applyMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            Apply Rules
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-auto max-h-[70vh]">
        <table className="w-full text-xs">
          <thead className="bg-muted sticky top-0 z-10">
            <tr>
              <th className="p-2"><Checkbox checked={allSelected} onCheckedChange={(v) => setSelected(v ? new Set(allIds) : new Set())} /></th>
              <th className="p-2 text-left">WID</th>
              <th className="p-2 text-left">Name</th>
              <th className="p-2 text-left">Bank</th>
              <th className="p-2 text-left">Emp type</th>
              <th className="p-2 text-left">Agent</th>
              <th className="p-2 text-left">Hold/Approved</th>
              <th className="p-2 text-left">Rules of Payment</th>
              <th className="p-2 text-left">Payroll Source</th>
              <th className="p-2">NI used</th>
              <th className="p-2">1st4 PAYE</th>
              <th className="p-2">GFM PAYE</th>
              <th className="p-2">Self-employed</th>
              <th className="p-2">Total</th>
              <th className="p-2">Remarks</th>
              <th className="p-2">Accounts remarks</th>
              <th className="p-2">Shifts</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={17} className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : officers.length === 0 ? (
              <tr><td colSpan={17} className="p-6 text-center text-muted-foreground">No officers for this month.</td></tr>
            ) : officers.map((row) => {
              const totalH = row.first4Hours + row.gfmHours + row.selfHours;
              const totalW = row.first4Wages + row.gfmWages + row.selfWages;
              return (
                <tr key={row.employeeId} className="border-t align-top">
                  <td className="p-2">
                    <Checkbox
                      checked={selected.has(row.employeeId)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(row.employeeId); else next.delete(row.employeeId);
                        setSelected(next);
                      }}
                    />
                  </td>
                  <td className="p-2 font-mono">{row.wid}</td>
                  <td className="p-2 font-medium">{row.name}</td>
                  <td className="p-2 max-w-[140px] truncate">{row.bank}</td>
                  <td className="p-2">{row.empType}</td>
                  <td className="p-2">{row.agent}</td>
                  <td className="p-2">
                    <Select
                      value={row.hrStatus}
                      disabled={!canHrHold(role) || !row.monthId}
                      onValueChange={(v) => row.monthId && patchMutation.mutate({ id: row.monthId, data: { hrStatus: v } })}
                    >
                      <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="hold">Hold</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select value={row.rulesOfPayment} onValueChange={(v) => changeRule(row, v, row.payrollSource)}>
                      <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_RULES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {row.request && (
                      <button className="block mt-1 text-[10px] text-amber-700 underline" onClick={() => setApproveRow(row)}>
                        From {ruleLabel(row.request.fromRule)} → {ruleLabel(row.request.toRule)}
                      </button>
                    )}
                  </td>
                  <td className="p-2">
                    <Select value={row.payrollSource} onValueChange={(v) => changeRule(row, row.rulesOfPayment, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYROLL_SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-2">
                    <Select
                      value={String(row.niUsed)}
                      disabled={!row.monthId}
                      onValueChange={(v) => row.monthId && patchMutation.mutate({ id: row.monthId, data: { niUsed: Number(v) } })}
                    >
                      <SelectTrigger className="h-8 w-16"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NI_USED_STEPS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  {[
                    ["first4Paid", row.first4Hours, row.first4Wages, row.first4Paid],
                    ["gfmPaid", row.gfmHours, row.gfmWages, row.gfmPaid],
                    ["selfPaid", row.selfHours, row.selfWages, row.selfPaid],
                  ].map(([key, h, w, paid]) => (
                    <td key={String(key)} className="p-2 text-center">
                      <div>{Number(h)}h</div>
                      <div>{gbp(Number(w))}</div>
                      {isFinanceRole(role) && row.monthId && (
                        <Checkbox
                          className="mt-1"
                          checked={!!paid}
                          onCheckedChange={(v) => patchMutation.mutate({ id: row.monthId!, data: { [key as string]: !!v } })}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2 text-right">{Number(totalH)}h<br />{gbp(totalW)}</td>
                  <td className="p-2 w-32">
                    <Textarea
                      className="h-16 text-xs"
                      defaultValue={row.remarks || ""}
                      disabled={!canControllerRemarks(role) || !row.monthId}
                      onBlur={(e) => row.monthId && e.target.value !== (row.remarks || "") && patchMutation.mutate({ id: row.monthId, data: { remarks: e.target.value } })}
                    />
                  </td>
                  <td className="p-2 w-32">
                    <Textarea
                      className="h-16 text-xs"
                      defaultValue={row.accountsRemarks || ""}
                      disabled={!canAccountsRemarks(role) || !row.monthId}
                      onBlur={(e) => row.monthId && e.target.value !== (row.accountsRemarks || "") && patchMutation.mutate({ id: row.monthId, data: { accountsRemarks: e.target.value } })}
                    />
                  </td>
                  <td className="p-2">
                    <Button size="sm" variant="outline" onClick={() => setShiftRow(row)} disabled={!row.monthId}>Details</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!approveRow} onOpenChange={() => setApproveRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve rule change</DialogTitle>
          </DialogHeader>
          {approveRow?.request && (
            <div className="space-y-3 text-sm">
              <p>From {ruleLabel(approveRow.request.fromRule)} / {sourceLabel(approveRow.request.fromSource)} → {ruleLabel(approveRow.request.toRule)} / {sourceLabel(approveRow.request.toSource)}</p>
              <p>Apply Rules still uses the live (old) rule until all three columns approve.</p>
              {(["control", "hr", "accounts"] as const).map((col) => {
                const status = col === "control" ? approveRow.request!.controlStatus : col === "hr" ? approveRow.request!.hrStatus : approveRow.request!.accountsStatus;
                const allowed = col === "control" ? canControlApprove(role) : col === "hr" ? canHrApprove(role) : canAccountsApprove(role);
                return (
                  <div key={col} className="flex items-center justify-between border rounded-md p-2">
                    <div>
                      <p className="font-medium capitalize">{col}</p>
                      <Badge variant="secondary">{status}</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={!allowed || decideMutation.isPending} onClick={() => decideMutation.mutate({ id: approveRow.request!.id, column: col, decision: "approved" })}>Approve</Button>
                      <Button size="sm" variant="destructive" disabled={!allowed || decideMutation.isPending} onClick={() => decideMutation.mutate({ id: approveRow.request!.id, column: col, decision: "denied" })}>Deny</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!shiftRow} onOpenChange={() => setShiftRow(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Shift details — {shiftRow?.name}</DialogTitle></DialogHeader>
          {shiftsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left border-b">
                  <th className="p-1">Date</th><th className="p-1">Site</th><th className="p-1">In</th><th className="p-1">Out</th><th className="p-1">Hours</th><th className="p-1">Rate</th><th className="p-1">Wages</th><th className="p-1">Bucket</th>
                </tr>
              </thead>
              <tbody>
                {(shifts || []).map((s: any) => (
                  <tr key={`${s.id}-${s.bucket || "raw"}`} className="border-b">
                    <td className="p-1">{String(s.date).slice(0, 10)}</td>
                    <td className="p-1">{s.site_name || s.title}</td>
                    <td className="p-1">{s.start_time}</td>
                    <td className="p-1">{s.end_time}</td>
                    <td className="p-1">{s.hours || "—"}</td>
                    <td className="p-1">{s.rate || "—"}</td>
                    <td className="p-1">{s.wages ? gbp(Number(s.wages)) : "—"}</td>
                    <td className="p-1">{s.bucket || s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftRow(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
