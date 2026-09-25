import { useEffect, useMemo, useState } from "react";
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
  canControllerRemarks, canAccountsRemarks, isFinanceRole, canApplyRules, ruleLabel, sourceLabel,
  selfShiftPayDisplay,
} from "@shared/payrollControl";
import { Loader2, RefreshCw, Play, Download, FileSpreadsheet } from "lucide-react";

type ChangeRequest = {
  id: number;
  fromRule: string;
  fromSource: string;
  toRule: string;
  toSource: string;
  controlStatus: string;
  hrStatus: string;
  accountsStatus: string;
  sourceScope?: "ni" | "self";
  kind?: "rule" | "source" | "self_source" | "both";
};

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
  selfPayrollSource: string;
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
  requests?: ChangeRequest[];
  request: ChangeRequest | null;
};

function requestKind(req: ChangeRequest): "rule" | "source" | "self_source" | "both" {
  if (req.kind) return req.kind;
  if (req.sourceScope === "self") return "self_source";
  const ruleChanged = req.fromRule !== req.toRule;
  const sourceChanged = req.fromSource !== req.toSource;
  if (ruleChanged && sourceChanged) return "both";
  if (ruleChanged) return "rule";
  return "source";
}

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function escapeCsv(val: unknown): string {
  const s = String(val ?? "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function escapeXml(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

type SummaryExportRow = {
  wid: string;
  name: string;
  bank: string;
  empType: string;
  agent: string;
  hrStatus: string;
  rules: string;
  niSource: string;
  selfSource: string;
  niUsed: number;
  first4Hours: number;
  first4Wages: number;
  first4Paid: string;
  gfmHours: number;
  gfmWages: number;
  gfmPaid: string;
  selfHours: number;
  selfWages: number;
  selfPaid: string;
  totalHours: number;
  totalWages: number;
  remarks: string;
  accountsRemarks: string;
};

const SUMMARY_EXPORT_HEADERS = [
  "WID", "Name", "Bank", "Emp type", "Agent", "Hold/Approved", "Rules of Payment",
  "NI source", "Self source", "NI used",
  "1st4 hours", "1st4 wages", "1st4 paid",
  "GFM hours", "GFM wages", "GFM paid",
  "Self hours", "Self wages", "Self paid",
  "Total hours", "Total wages", "Remarks", "Accounts remarks",
] as const;

function summaryExportCells(row: SummaryExportRow): (string | number)[] {
  return [
    row.wid, row.name, row.bank, row.empType, row.agent, row.hrStatus, row.rules,
    row.niSource, row.selfSource, row.niUsed,
    row.first4Hours, row.first4Wages, row.first4Paid,
    row.gfmHours, row.gfmWages, row.gfmPaid,
    row.selfHours, row.selfWages, row.selfPaid,
    row.totalHours, row.totalWages, row.remarks, row.accountsRemarks,
  ];
}

/** Avoid timezone shifting DATE → previous calendar day in the UI. */
function displayDate(v: unknown): string {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const y = v.getFullYear();
    const m = String(v.getMonth() + 1).padStart(2, "0");
    const d = String(v.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const s = String(v ?? "");
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) {
    const parsed = new Date(s);
    if (!Number.isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, "0");
      const d = String(parsed.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }
  }
  return s.slice(0, 10);
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
  const [approveTarget, setApproveTarget] = useState<{ employeeId: number; request: ChangeRequest } | null>(null);

  const { data: sourcesData } = useQuery<any[]>({ queryKey: ["/api/tenant/payroll-sources"] });
  const sourceOptions = (sourcesData?.length
    ? sourcesData.map((s) => ({ value: s.value as string, label: s.label as string }))
    : PAYROLL_SOURCES.map((s) => ({ value: s.value, label: s.label })));
  const labelSource = (value: string) => sourceOptions.find((s) => s.value === value)?.label || sourceLabel(value);
  const [shiftView, setShiftView] = useState<{
    row: OfficerRow;
    /** null = all shifts (Details). Otherwise only that tagged bucket; "all_tagged" = any applied-line tag. */
    bucket: "first4_paye" | "gfm_paye" | "self" | "all_tagged" | null;
  } | null>(null);

  const queryKey = ["/api/payroll-control/summary", month];
  const { data, isLoading, refetch, isFetching } = useQuery<{ officers: OfficerRow[]; kpis: any; month: string }>({
    queryKey,
    staleTime: 30_000,
    queryFn: async () => {
      const params = new URLSearchParams({ month });
      const res = await fetch(`/api/payroll-control/summary?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
  });

  const allOfficers = data?.officers || [];

  const officers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allOfficers.filter((o) => {
      if (rule !== "ALL" && o.rulesOfPayment !== rule) return false;
      if (source !== "ALL" && o.payrollSource !== source && o.selfPayrollSource !== source) return false;
      if (!q) return true;
      return o.name.toLowerCase().includes(q) || o.wid.toLowerCase().includes(q);
    });
  }, [allOfficers, search, rule, source]);

  const kpis = useMemo(() => {
    const withHours = officers.filter((o) => o.first4Hours + o.gfmHours + o.selfHours > 0);
    const fullSelf = withHours.filter((o) => o.selfHours > 0 && o.first4Hours + o.gfmHours === 0).length;
    const partialSelf = withHours.filter((o) => o.selfHours > 0 && o.first4Hours + o.gfmHours > 0).length;
    const totalHours = withHours.reduce((s, o) => s + o.first4Hours + o.gfmHours + o.selfHours, 0);
    const niHours = withHours.reduce((s, o) => s + o.first4Hours + o.gfmHours, 0);
    const paidReady = withHours.filter((o) => {
      const buckets = [
        o.first4Hours > 0 ? o.first4Paid : true,
        o.gfmHours > 0 ? o.gfmPaid : true,
        o.selfHours > 0 ? o.selfPaid : true,
      ];
      return buckets.every(Boolean);
    }).length;
    const pct = (n: number, d: number) => (d ? Math.round((n / d) * 10000) / 100 : 0);
    return {
      fullSelfPct: pct(fullSelf, withHours.length),
      partialSelfPct: pct(partialSelf, withHours.length),
      niHoursPct: pct(niHours, totalHours),
      totalPayStatusPct: pct(paidReady, withHours.length),
    };
  }, [officers]);

  const { data: shifts, isLoading: shiftsLoading } = useQuery<any[]>({
    queryKey: ["/api/payroll-control/months", shiftView?.row.monthId, "shifts", shiftView?.bucket],
    enabled: !!shiftView?.row.monthId,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (shiftView!.bucket === "all_tagged") params.set("tagged", "1");
      else if (shiftView!.bucket) params.set("bucket", shiftView!.bucket);
      const qs = params.toString() ? `?${params}` : "";
      const res = await fetch(`/api/payroll-control/months/${shiftView!.row.monthId}/shifts${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error((await res.json()).message || "Failed");
      return res.json();
    },
  });

  async function ensureMonth(employeeId: number) {
    const res = await apiRequest("POST", "/api/payroll-control/months/ensure", { employeeId, month });
    return res.json();
  }

  async function openShifts(
    row: OfficerRow,
    bucket: "first4_paye" | "gfm_paye" | "self" | "all_tagged" | null,
  ) {
    let next = row;
    if (!row.monthId) {
      const created = await ensureMonth(row.employeeId);
      next = { ...row, monthId: created.id };
      queryClient.setQueriesData<{ officers: OfficerRow[]; kpis: any; month: string }>(
        { queryKey: ["/api/payroll-control/summary", month] },
        (old) => {
          if (!old?.officers) return old;
          return {
            ...old,
            officers: old.officers.map((o) =>
              o.employeeId === row.employeeId ? { ...o, monthId: created.id } : o,
            ),
          };
        },
      );
    }
    setShiftView({ row: next, bucket });
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
    onSuccess: (_row, vars) => {
      // Local patch — avoid full summary refetch for simple field edits.
      queryClient.setQueriesData<{ officers: OfficerRow[]; kpis: any; month: string }>(
        { queryKey: ["/api/payroll-control/summary", month] },
        (old) => {
          if (!old?.officers) return old;
          const mapKey: Record<string, string> = {
            hrStatus: "hrStatus",
            niUsed: "niUsed",
            remarks: "remarks",
            accountsRemarks: "accountsRemarks",
            first4Paid: "first4Paid",
            gfmPaid: "gfmPaid",
            selfPaid: "selfPaid",
          };
          return {
            ...old,
            officers: old.officers.map((o) => {
              if (o.monthId !== vars.id) return o;
              const next = { ...o };
              for (const [k, v] of Object.entries(vars.data)) {
                const field = mapKey[k] || k;
                (next as any)[field] = v;
              }
              return next;
            }),
          };
        },
      );
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const requestMutation = useMutation({
    mutationFn: async (body: {
      monthId: number;
      toRule?: string;
      toSource?: string;
      toSelfSource?: string;
      sourceScope?: "ni" | "self";
    }) => {
      const res = await apiRequest("POST", "/api/payroll-control/rule-requests", body);
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
      if (result.outcome === "approved" || result.outcome === "denied") {
        setApproveTarget(null);
      } else {
        setApproveTarget((prev) => {
          if (!prev || prev.request.id !== result.id) return prev;
          return {
            ...prev,
            request: {
              ...prev.request,
              controlStatus: result.control_status || prev.request.controlStatus,
              hrStatus: result.hr_status || prev.request.hrStatus,
              accountsStatus: result.accounts_status || prev.request.accountsStatus,
            },
          };
        });
      }
      toast({ title: result.outcome === "approved" ? "New rule is live" : result.outcome === "denied" ? "Request denied — old rule stays" : "Decision saved" });
    },
    onError: (err: Error) => toast({ title: "Decision failed", description: err.message, variant: "destructive" }),
  });

  // Keep the open approve dialog in sync with refreshed summary rows.
  useEffect(() => {
    if (!approveTarget) return;
    const live = officers.find((o) => o.employeeId === approveTarget.employeeId);
    if (!live) return;
    const reqs = live.requests?.length ? live.requests : (live.request ? [live.request] : []);
    const match = reqs.find((r) => r.id === approveTarget.request.id);
    if (!match) {
      setApproveTarget(null);
      return;
    }
    if (
      match.controlStatus !== approveTarget.request.controlStatus ||
      match.hrStatus !== approveTarget.request.hrStatus ||
      match.accountsStatus !== approveTarget.request.accountsStatus
    ) {
      setApproveTarget({ employeeId: live.employeeId, request: match });
    }
  }, [officers, approveTarget]);

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

  async function changeSelfSource(row: OfficerRow, toSelfSource: string) {
    let monthId = row.monthId;
    if (!monthId) {
      const created = await ensureMonth(row.employeeId);
      monthId = created.id;
    }
    requestMutation.mutate({ monthId: monthId!, sourceScope: "self", toSelfSource });
  }

  function buildExportRows(): SummaryExportRow[] {
    return officers.map((o) => {
      const totalHours = o.first4Hours + o.gfmHours + o.selfHours;
      const totalWages = o.first4Wages + o.gfmWages + o.selfWages;
      return {
        wid: o.wid,
        name: o.name,
        bank: o.bank || "",
        empType: o.empType || "",
        agent: o.agent || "",
        hrStatus: o.hrStatus || "",
        rules: ruleLabel(o.rulesOfPayment),
        niSource: labelSource(o.payrollSource),
        selfSource: labelSource(o.selfPayrollSource || o.payrollSource),
        niUsed: o.niUsed,
        first4Hours: o.first4Hours,
        first4Wages: o.first4Wages,
        first4Paid: o.first4Paid ? "Yes" : "No",
        gfmHours: o.gfmHours,
        gfmWages: o.gfmWages,
        gfmPaid: o.gfmPaid ? "Yes" : "No",
        selfHours: o.selfHours,
        selfWages: o.selfWages,
        selfPaid: o.selfPaid ? "Yes" : "No",
        totalHours,
        totalWages,
        remarks: o.remarks || "",
        accountsRemarks: o.accountsRemarks || "",
      };
    });
  }

  function exportCsv() {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No officers match the current filters.", variant: "destructive" });
      return;
    }
    const lines = [
      SUMMARY_EXPORT_HEADERS.map(escapeCsv).join(","),
      ...rows.map((r) => summaryExportCells(r).map(escapeCsv).join(",")),
    ];
    downloadBlob(`\uFEFF${lines.join("\n")}`, `payroll-summary-${month}.csv`, "text/csv;charset=utf-8;");
    toast({ title: "CSV downloaded", description: `${rows.length} row(s)` });
  }

  function exportExcel() {
    const rows = buildExportRows();
    if (rows.length === 0) {
      toast({ title: "Nothing to export", description: "No officers match the current filters.", variant: "destructive" });
      return;
    }
    const headerXml = SUMMARY_EXPORT_HEADERS.map((h) => `<Cell><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
    const bodyXml = rows.map((r) => {
      const cells = summaryExportCells(r).map((cell) => {
        const isNum = typeof cell === "number";
        return `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${escapeXml(cell)}</Data></Cell>`;
      }).join("");
      return `<Row>${cells}</Row>`;
    }).join("");
    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Payroll Summary">
  <Table>
   <Row>${headerXml}</Row>
   ${bodyXml}
  </Table>
 </Worksheet>
</Workbook>`;
    downloadBlob(xml, `payroll-summary-${month}.xls`, "application/vnd.ms-excel");
    toast({ title: "Excel downloaded", description: `${rows.length} row(s)` });
  }

  return (
    <div className="p-6 space-y-4" data-testid="payroll-summary-page">
      <div>
        <h1 className="text-2xl font-bold">Payroll Summary</h1>
        <p className="text-sm text-muted-foreground">Approve live rules, Apply Rules, then mark wage buckets. Bank payments are on Pending Payment.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Full Self %", kpis.fullSelfPct],
          ["Partial Self %", kpis.partialSelfPct],
          ["NI Hours %", kpis.niHoursPct],
          ["Total Pay Status %", kpis.totalPayStatusPct],
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
            <SelectTrigger className="w-80"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {PAYMENT_RULES.map((r) => <SelectItem key={r.value} value={r.value}>{ruleLabel(r.value)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Payroll source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ALL</SelectItem>
              {sourceOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Refresh
        </Button>
        <Button
          variant="outline"
          onClick={exportCsv}
          disabled={officers.length === 0}
          data-testid="btn-export-csv"
        >
          <Download className="w-4 h-4 mr-1" />
          CSV
        </Button>
        <Button
          variant="outline"
          onClick={exportExcel}
          disabled={officers.length === 0}
          data-testid="btn-export-excel"
        >
          <FileSpreadsheet className="w-4 h-4 mr-1" />
          Excel
        </Button>
        {canApplyRules(role) && (
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
              <th className="p-2 text-left">NI source</th>
              <th className="p-2 text-left">Self source</th>
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
              <tr><td colSpan={18} className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin inline" /></td></tr>
            ) : officers.length === 0 ? (
              <tr><td colSpan={18} className="p-6 text-center text-muted-foreground">No officers for this month.</td></tr>
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
                      <SelectTrigger className="h-8 w-72"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PAYMENT_RULES.map((r) => <SelectItem key={r.value} value={r.value}>{ruleLabel(r.value)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {(row.requests || (row.request ? [row.request] : []))
                      .filter((req) => requestKind(req) === "rule" || requestKind(req) === "both")
                      .map((req) => (
                        <button
                          key={req.id}
                          className="block mt-1 text-[10px] text-amber-700 underline"
                          onClick={() => setApproveTarget({ employeeId: row.employeeId, request: req })}
                        >
                          From {ruleLabel(req.fromRule)} → {ruleLabel(req.toRule)}
                        </button>
                      ))}
                  </td>
                  <td className="p-2">
                    <Select value={row.payrollSource} onValueChange={(v) => changeRule(row, row.rulesOfPayment, v)}>
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {(row.requests || (row.request ? [row.request] : []))
                      .filter((req) => requestKind(req) === "source" || requestKind(req) === "both")
                      .map((req) => (
                        <button
                          key={req.id}
                          className="block mt-1 text-[10px] text-amber-700 underline"
                          onClick={() => setApproveTarget({ employeeId: row.employeeId, request: req })}
                        >
                          From {labelSource(req.fromSource)} → {labelSource(req.toSource)}
                        </button>
                      ))}
                  </td>
                  <td className="p-2">
                    <Select
                      value={row.selfPayrollSource || "self_employed"}
                      onValueChange={(v) => {
                        if (v === (row.selfPayrollSource || "self_employed")) return;
                        changeSelfSource(row, v);
                      }}
                    >
                      <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {sourceOptions.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {(row.requests || (row.request ? [row.request] : []))
                      .filter((req) => requestKind(req) === "self_source")
                      .map((req) => (
                        <button
                          key={req.id}
                          className="block mt-1 text-[10px] text-amber-700 underline"
                          onClick={() => setApproveTarget({ employeeId: row.employeeId, request: req })}
                        >
                          From {labelSource(req.fromSource)} → {labelSource(req.toSource)}
                        </button>
                      ))}
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
                    ["first4Paid", "first4_paye", "1st4 PAYE", row.first4Hours, row.first4Wages, row.first4Paid],
                    ["gfmPaid", "gfm_paye", "GFM PAYE", row.gfmHours, row.gfmWages, row.gfmPaid],
                    ["selfPaid", "self", "Self-employed", row.selfHours, row.selfWages, row.selfPaid],
                  ].map(([key, bucket, label, h, w, paid]) => (
                    <td key={String(key)} className="p-2 text-center">
                      <button
                        type="button"
                        className="underline decoration-dotted underline-offset-2 hover:text-primary disabled:no-underline disabled:opacity-60"
                        title={`Show ${label} tagged shifts`}
                        onClick={() => openShifts(row, bucket as "first4_paye" | "gfm_paye" | "self")}
                      >
                        <div>{Number(h)}h</div>
                        <div>{gbp(Number(w))}</div>
                      </button>
                      {isFinanceRole(role) && row.monthId && (
                        <Checkbox
                          className="mt-1"
                          checked={!!paid}
                          onCheckedChange={(v) => patchMutation.mutate({ id: row.monthId!, data: { [key as string]: !!v } })}
                        />
                      )}
                    </td>
                  ))}
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      className="underline decoration-dotted underline-offset-2 hover:text-primary"
                      title="Show all tagged shifts"
                      onClick={() => openShifts(row, "all_tagged")}
                    >
                      {Number(totalH)}h<br />{gbp(totalW)}
                    </button>
                  </td>
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
                    <Button size="sm" variant="outline" onClick={() => openShifts(row, null)}>Details</Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={!!approveTarget} onOpenChange={() => setApproveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Approve {approveTarget
                ? (requestKind(approveTarget.request) === "self_source"
                  ? "self source"
                  : requestKind(approveTarget.request) === "source"
                    ? "NI source"
                    : requestKind(approveTarget.request) === "rule"
                      ? "rule"
                      : "rule/source")
                : ""} change
            </DialogTitle>
          </DialogHeader>
          {approveTarget?.request && (
            <div className="space-y-3 text-sm">
              <p>
                {requestKind(approveTarget.request) === "self_source" || requestKind(approveTarget.request) === "source"
                  ? <>From {labelSource(approveTarget.request.fromSource)} → {labelSource(approveTarget.request.toSource)}</>
                  : requestKind(approveTarget.request) === "rule"
                    ? <>From {ruleLabel(approveTarget.request.fromRule)} → {ruleLabel(approveTarget.request.toRule)}</>
                    : <>From {ruleLabel(approveTarget.request.fromRule)} / {labelSource(approveTarget.request.fromSource)} → {ruleLabel(approveTarget.request.toRule)} / {labelSource(approveTarget.request.toSource)}</>}
              </p>
              <p>
                {requestKind(approveTarget.request) === "self_source"
                  ? "Live self source stays on the old value until any 2 of Control / HR / Accounts approve."
                  : "Apply Rules still uses the live (old) values until any 2 of Control / HR / Accounts approve."}
              </p>
              {(["control", "hr", "accounts"] as const).map((col) => {
                const status = col === "control" ? approveTarget.request.controlStatus : col === "hr" ? approveTarget.request.hrStatus : approveTarget.request.accountsStatus;
                const allowed = col === "control" ? canControlApprove(role) : col === "hr" ? canHrApprove(role) : canAccountsApprove(role);
                const pending = status === "pending";
                return (
                  <div key={col} className="flex items-center justify-between border rounded-md p-2">
                    <div>
                      <p className="font-medium capitalize">{col}</p>
                      <Badge variant={status === "approved" ? "default" : status === "denied" ? "destructive" : "secondary"}>{status}</Badge>
                      {pending && !allowed && (
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {col === "control" ? "Needs controller or admin" : col === "hr" ? "Needs HR / admin" : "Needs accounts / admin"}
                        </p>
                      )}
                    </div>
                    {pending ? (
                      <div className="flex gap-2">
                        <Button size="sm" disabled={!allowed || decideMutation.isPending} onClick={() => decideMutation.mutate({ id: approveTarget.request.id, column: col, decision: "approved" })}>Approve</Button>
                        <Button size="sm" variant="destructive" disabled={!allowed || decideMutation.isPending} onClick={() => decideMutation.mutate({ id: approveTarget.request.id, column: col, decision: "denied" })}>Deny</Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!shiftView} onOpenChange={() => setShiftView(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {shiftView?.bucket === "first4_paye"
                ? "1st4 PAYE shifts"
                : shiftView?.bucket === "gfm_paye"
                  ? "GFM PAYE shifts"
                  : shiftView?.bucket === "self"
                    ? "Self-employed shifts"
                    : shiftView?.bucket === "all_tagged"
                      ? "Tagged shifts"
                      : "Shift details"}
              {" — "}
              {shiftView?.row.name}
            </DialogTitle>
          </DialogHeader>
          {shiftsLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
            (shifts || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {shiftView?.bucket
                  ? "No tagged shifts for this bucket yet. Run Apply Rules first."
                  : "No shifts found for this month."}
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-1">Date</th>
                    <th className="p-1">Site</th>
                    <th className="p-1">In</th>
                    <th className="p-1">Out</th>
                    <th className="p-1">Hours</th>
                    <th className="p-1">Rate</th>
                    <th className="p-1">Wages</th>
                    <th className="p-1">Deduction</th>
                    <th className="p-1">Net</th>
                    <th className="p-1">Bucket</th>
                  </tr>
                </thead>
                <tbody>
                  {(shifts || []).map((s: any) => {
                    const pay = selfShiftPayDisplay({
                      hours: Number(s.hours) || 0,
                      rate: Number(s.rate) || 0,
                      wages: Number(s.wages) || 0,
                      bucket: s.bucket,
                    });
                    return (
                      <tr key={`${s.id}-${s.bucket || "raw"}`} className="border-b">
                        <td className="p-1">{displayDate(s.date)}</td>
                        <td className="p-1">{s.site_name || s.title}</td>
                        <td className="p-1">{s.start_time}</td>
                        <td className="p-1">{s.end_time}</td>
                        <td className="p-1">{s.hours || "—"}</td>
                        <td className="p-1">{pay.rate ? pay.rate.toFixed(2) : "—"}</td>
                        <td className="p-1">{s.wages != null && s.wages !== "" ? gbp(pay.wages) : "—"}</td>
                        <td className={`p-1 ${pay.deduction > 0 ? "text-red-600" : ""}`}>
                          {pay.deduction > 0 ? gbp(pay.deduction) : "—"}
                        </td>
                        <td className="p-1">{pay.deduction > 0 ? gbp(pay.net) : "—"}</td>
                        <td className="p-1">{s.bucket || s.status}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShiftView(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
