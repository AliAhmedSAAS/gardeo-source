import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { canApplyRules, PAYROLL_SOURCES, sourceLabel, selfShiftPayDisplay } from "@shared/payrollControl";
import { Loader2 } from "lucide-react";

type Payee = {
  employeeId: number;
  payeeName: string;
  shiftCount: number;
  amount: number;
  source: string;
  branchType: string;
  accountTitle: string | null;
  lines: any[];
};

type PayrollSourceOption = { value: string; label: string };

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 27);
  return d.toISOString().slice(0, 10);
}

export default function PayrollBillsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [claimFrom, setClaimFrom] = useState(monthAgo());
  const [claimTo, setClaimTo] = useState(today());
  const [dueDate, setDueDate] = useState(today());
  const [payeeType, setPayeeType] = useState<"PAYE" | "Self-employed">("PAYE");
  const [branch, setBranch] = useState("ALL");
  const [provider, setProvider] = useState("ALL");
  const [viewed, setViewed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [activePayee, setActivePayee] = useState<number | null>(null);

  const { data: sourcesData } = useQuery<any[]>({
    queryKey: ["/api/tenant/payroll-sources"],
  });
  const sources: PayrollSourceOption[] = (sourcesData || []).map((s) => ({
    value: s.value,
    label: s.label,
  }));
  const sourceOptions = sources.length > 0 ? sources : PAYROLL_SOURCES.map((s) => ({ value: s.value, label: s.label }));
  const labelFor = (value: string) => sourceOptions.find((s) => s.value === value)?.label || sourceLabel(value);

  const params = new URLSearchParams({ claimFrom, claimTo, dueDate, payeeType, branch, provider });
  const { data, isFetching, refetch } = useQuery<{ payees: Payee[]; total: number }>({
    queryKey: ["/api/payroll-control/claimable", params.toString()],
    enabled: viewed,
    queryFn: async () => {
      const res = await fetch(`/api/payroll-control/claimable?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
  });

  const payees = data?.payees || [];
  const allIds = payees.map((p) => p.employeeId);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const active = payees.find((p) => p.employeeId === activePayee);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/payroll-control/bills", {
        employeeIds: Array.from(selected),
        claimFrom,
        claimTo,
        dueDate,
        payeeType,
        branch,
        provider,
      });
      return res.json();
    },
    onSuccess: (result: any) => {
      toast({ title: "Bills created", description: `${result.bills?.length || 0} BILLED bill(s)` });
      setSelected(new Set());
      refetch();
    },
    onError: (err: Error) => toast({ title: "Create Bill failed", description: err.message, variant: "destructive" }),
  });

  const changeSourceMutation = useMutation({
    mutationFn: async ({ employeeId, toSource }: { employeeId: number; toSource: string }) => {
      const res = await apiRequest("POST", "/api/payroll-control/claimable/change-source", {
        employeeId,
        claimFrom,
        claimTo,
        payeeType,
        toSource,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Source updated" });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-control/claimable"] });
      refetch();
    },
    onError: (err: Error) => toast({ title: "Source change failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 space-y-4" data-testid="payroll-bills-page">
      <div>
        <h1 className="text-2xl font-bold">Bill Section</h1>
        <p className="text-sm text-muted-foreground">View claimable unpaid shifts, then Create Bill. View never creates a bill.</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div><Label>Claim from</Label><Input type="date" value={claimFrom} onChange={(e) => { setClaimFrom(e.target.value); setViewed(false); }} /></div>
        <div><Label>Claim to (bill date)</Label><Input type="date" value={claimTo} onChange={(e) => { setClaimTo(e.target.value); setViewed(false); }} /></div>
        <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
        <div>
          <Label>Payee type</Label>
          <Select value={payeeType} onValueChange={(v) => { setPayeeType(v as any); setViewed(false); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PAYE">PAYE</SelectItem>
              <SelectItem value="Self-employed">Self-employed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Branch</Label>
          <Select value={branch} onValueChange={(v) => { setBranch(v); setViewed(false); }}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              <SelectItem value="MAIN">MAIN</SelectItem>
              <SelectItem value="Contractor">Contractor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Payroll provider</Label>
          <Select value={provider} onValueChange={(v) => { setProvider(v); setViewed(false); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {sourceOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setViewed(true); refetch(); }} data-testid="btn-view-claimable">
          {isFetching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          View
        </Button>
        {canApplyRules(user?.role) && (
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || selected.size === 0 || !viewed}
            data-testid="btn-create-bill"
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
            Create Bill
          </Button>
        )}
      </div>
      {canApplyRules(user?.role) && viewed && selected.size === 0 && payees.length > 0 && (
        <p className="text-sm text-amber-800">Tick one or more payees, then click Create Bill.</p>
      )}

      {!viewed ? (
        <p className="text-sm text-muted-foreground">Set filters and click View. Bills are not created until you press Create Bill.</p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-lg overflow-auto max-h-[70vh]">
            <div className="p-3 border-b font-medium flex justify-between items-center gap-2">
              <span>Payees</span>
              <span className="flex items-center gap-2">
                <span>Total {gbp(data?.total || 0)}</span>
                {canApplyRules(user?.role) && (
                  <Button
                    size="sm"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || selected.size === 0}
                    data-testid="btn-create-bill-list"
                  >
                    {createMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                    Create Bill{selected.size > 0 ? ` (${selected.size})` : ""}
                  </Button>
                )}
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left bg-muted">
                  <th className="p-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => setSelected(v ? new Set(allIds) : new Set())}
                      data-testid="checkbox-select-all-payees"
                      aria-label="Select all payees"
                    />
                  </th>
                  <th className="p-2">Payee</th>
                  <th className="p-2">Shifts</th>
                  <th className="p-2">Amount</th>
                  <th className="p-2">{payeeType === "PAYE" ? "NI source" : "Self source"}</th>
                </tr>
              </thead>
              <tbody>
                {payees.map((p) => (
                  <tr
                    key={p.employeeId}
                    className={`border-t cursor-pointer ${activePayee === p.employeeId ? "bg-primary/5" : ""}`}
                    onClick={() => setActivePayee(p.employeeId)}
                  >
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(p.employeeId)}
                        onCheckedChange={(v) => {
                          const next = new Set(selected);
                          if (v) next.add(p.employeeId); else next.delete(p.employeeId);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="p-2">{p.payeeName}</td>
                    <td className="p-2">{p.shiftCount}</td>
                    <td className="p-2">{gbp(p.amount)}</td>
                    <td className="p-2" onClick={(e) => e.stopPropagation()}>
                      {canApplyRules(user?.role) ? (
                        <Select
                          value={p.source}
                          disabled={changeSourceMutation.isPending}
                          onValueChange={(v) => {
                            if (v === p.source) return;
                            changeSourceMutation.mutate({ employeeId: p.employeeId, toSource: v });
                          }}
                        >
                          <SelectTrigger className="h-8 w-36 text-xs">
                            <SelectValue>{labelFor(p.source)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {sourceOptions.map((s) => (
                              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        labelFor(p.source)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-lg overflow-auto max-h-[70vh]">
            <div className="p-3 border-b font-medium">{active ? active.payeeName : "Select a payee"}</div>
            {active ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left bg-muted">
                    <th className="p-2">Date</th>
                    <th className="p-2">Site</th>
                    <th className="p-2">Hours</th>
                    <th className="p-2">Rate</th>
                    <th className="p-2">Wages</th>
                    <th className="p-2">Deduction</th>
                    <th className="p-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {active.lines.map((l: any) => {
                    const pay = selfShiftPayDisplay({
                      hours: Number(l.hours) || 0,
                      rate: Number(l.rate) || 0,
                      wages: Number(l.wages) || 0,
                      bucket: l.bucket,
                    });
                    return (
                      <tr key={l.id} className="border-t">
                        <td className="p-2">{String(l.shift_date || l.date || "").slice(0, 10)}</td>
                        <td className="p-2">{l.site_name || "—"}</td>
                        <td className="p-2">{l.hours}</td>
                        <td className="p-2">{gbp(pay.rate)}</td>
                        <td className="p-2">{gbp(pay.wages)}</td>
                        <td className={`p-2 ${pay.deduction > 0 ? "text-red-600" : ""}`}>
                          {pay.deduction > 0 ? gbp(pay.deduction) : "—"}
                        </td>
                        <td className="p-2">{pay.deduction > 0 ? gbp(pay.net) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="p-4 text-sm text-muted-foreground">Select a payee to see shift lines.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
