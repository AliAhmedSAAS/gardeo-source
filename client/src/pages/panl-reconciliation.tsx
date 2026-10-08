import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Download, FileText, PoundSterling, Search, RefreshCw } from "lucide-react";

type GroupBy = "account" | "customer" | "location" | "officer";

type ShiftRow = {
  id: number;
  dutyWindow: string;
  customerId: number | null;
  customerName: string;
  officerId: number | null;
  officerName: string;
  locationId: number | null;
  locationName: string;
  accountName: string;
  hours: number;
  payRate: number;
  gWages: number;
  expense: number;
  nWages: number;
  sellRate: number;
  selling: number;
  pnl: number;
  isLoss: boolean;
};

type GridRow =
  | { kind: "shift"; rowNo: number; shift: ShiftRow }
  | {
      kind: "subtotal";
      label: string;
      locationId: number | null;
      customerId: number | null;
      hours: number;
      gWages: number;
      expense: number;
      nWages: number;
      selling: number;
      pnl: number;
    };

type Totals = {
  hours: number;
  gWages: number;
  expense: number;
  nWages: number;
  selling: number;
  pnl: number;
  count: number;
};

function defaultDates() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-07-31` };
}

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n || 0);
}

function fmt(n: number) {
  return (Number(n) || 0).toFixed(2);
}

export default function PanlReconciliationPage() {
  const { toast } = useToast();
  const defaults = defaultDates();

  const [dueFrom, setDueFrom] = useState(defaults.from);
  const [dueTo, setDueTo] = useState(defaults.to);
  const [appliedFrom, setAppliedFrom] = useState(defaults.from);
  const [appliedTo, setAppliedTo] = useState(defaults.to);
  const [groupBy, setGroupBy] = useState<GroupBy>("account");
  const [account, setAccount] = useState("all");
  const [branch, setBranch] = useState("all");
  const [customerId, setCustomerId] = useState("all");
  const [officerId, setOfficerId] = useState("all");
  const [locationId, setLocationId] = useState("all");
  const [showPaid, setShowPaid] = useState(false);
  const [showZeroRates, setShowZeroRates] = useState(false);
  const [viewToken, setViewToken] = useState(0);
  const [hasViewed, setHasViewed] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [locationTicks, setLocationTicks] = useState<
    Map<number, { locationId: number; customerId: number | null; label: string }>
  >(new Map());

  const [bulkHours, setBulkHours] = useState("");
  const [bulkPay, setBulkPay] = useState("");
  const [bulkExpense, setBulkExpense] = useState("");
  const [bulkSell, setBulkSell] = useState("");

  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfAccount, setPdfAccount] = useState("all");
  const [pdfStatus, setPdfStatus] = useState<"UNPAID" | "PAID">("UNPAID");
  const [pdfFrom, setPdfFrom] = useState(defaults.from);
  const [pdfTo, setPdfTo] = useState(defaults.to);

  const [chargeOpen, setChargeOpen] = useState(false);
  const [chargeDutyTypeId, setChargeDutyTypeId] = useState("");
  const [chargeRate, setChargeRate] = useState("");
  const [chargeFrom, setChargeFrom] = useState(defaults.from);
  const [chargeTo, setChargeTo] = useState(defaults.to);
  const [applyToShifts, setApplyToShifts] = useState(false);

  const filterParams = useMemo(() => {
    const p = new URLSearchParams();
    p.set("from", appliedFrom);
    p.set("to", appliedTo);
    p.set("groupBy", groupBy);
    if (account !== "all") p.set("account", account);
    if (branch !== "all") p.set("branch", branch);
    if (customerId !== "all") p.set("customerId", customerId);
    if (officerId !== "all") p.set("officerId", officerId);
    if (locationId !== "all") p.set("locationId", locationId);
    p.set("showPaid", showPaid ? "true" : "false");
    p.set("showZeroRates", showZeroRates ? "true" : "false");
    return p;
  }, [appliedFrom, appliedTo, groupBy, account, branch, customerId, officerId, locationId, showPaid, showZeroRates]);

  const { data: options } = useQuery<{
    accounts: string[];
    branches: string[];
    customers: Array<{ id: number; name: string }>;
    officers: Array<{ id: number; name: string }>;
    locations: Array<{ id: number; name: string; customerId: number | null }>;
    dutyTypes: Array<{ id: number; name: string }>;
  }>({
    queryKey: ["/api/panl/filter-options", appliedFrom, appliedTo],
    queryFn: async () => {
      const res = await fetch(`/api/panl/filter-options?from=${appliedFrom}&to=${appliedTo}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load filter options");
      return res.json();
    },
  });

  const {
    data,
    isFetching,
    refetch,
  } = useQuery<{ rows: GridRow[]; totals: Totals }>({
    queryKey: ["/api/panl", filterParams.toString(), viewToken],
    queryFn: async () => {
      const res = await fetch(`/api/panl?${filterParams}`, { credentials: "include" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to load P&L");
      }
      return res.json();
    },
    enabled: hasViewed,
  });

  const reload = () => {
    setAppliedFrom(dueFrom);
    setAppliedTo(dueTo);
    setSelectedIds(new Set());
    setViewToken((t) => t + 1);
    setHasViewed(true);
  };

  const rows = data?.rows || [];
  const totals = data?.totals || {
    hours: 0,
    gWages: 0,
    expense: 0,
    nWages: 0,
    selling: 0,
    pnl: 0,
    count: 0,
  };

  const shiftIds = useMemo(
    () => rows.filter((r): r is Extract<GridRow, { kind: "shift" }> => r.kind === "shift").map((r) => r.shift.id),
    [rows],
  );

  const allSelected = shiftIds.length > 0 && shiftIds.every((id) => selectedIds.has(id));

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(shiftIds) : new Set());
  };

  const toggleShift = (id: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleLocationTick = (
    loc: { locationId: number; customerId: number | null; label: string },
    checked: boolean,
  ) => {
    setLocationTicks((prev) => {
      const next = new Map(prev);
      if (checked) next.set(loc.locationId, loc);
      else next.delete(loc.locationId);
      return next;
    });
  };

  const bulkMutation = useMutation({
    mutationFn: async (payload: { field: string; value: string }) => {
      const res = await apiRequest("POST", "/api/panl/bulk-edit", {
        shiftIds: Array.from(selectedIds),
        field: payload.field,
        value: payload.value,
      });
      return res.json();
    },
    onSuccess: (result) => {
      toast({ title: "Updated", description: `${result.updated} shift(s) updated.` });
      setBulkHours("");
      setBulkPay("");
      setBulkExpense("");
      setBulkSell("");
      queryClient.invalidateQueries({ queryKey: ["/api/panl"] });
      reload();
    },
    onError: (err: any) => toast({ title: "Bulk edit failed", description: err.message, variant: "destructive" }),
  });

  const applyBulk = (field: string, value: string) => {
    if (!value.trim()) return;
    if (selectedIds.size === 0) {
      toast({ title: "No rows selected", description: "Tick shift rows first.", variant: "destructive" });
      return;
    }
    bulkMutation.mutate({ field, value });
  };

  const chargeCustomerId = useMemo(() => {
    const ticks = Array.from(locationTicks.values());
    if (ticks.length === 0) return null;
    const first = ticks[0].customerId;
    if (ticks.every((t) => t.customerId === first)) return first;
    return first;
  }, [locationTicks]);

  const { data: chargeRates, isFetching: ratesLoading } = useQuery<{
    rates: Array<{ rate: number; label: string }>;
  }>({
    queryKey: [
      "/api/panl/charge-rates",
      chargeDutyTypeId,
      chargeCustomerId,
      Array.from(locationTicks.keys()).join(","),
    ],
    queryFn: async () => {
      const p = new URLSearchParams();
      p.set("dutyTypeId", chargeDutyTypeId);
      if (chargeCustomerId != null) p.set("customerId", String(chargeCustomerId));
      p.set("locationIds", Array.from(locationTicks.keys()).join(","));
      const res = await fetch(`/api/panl/charge-rates?${p}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load rates");
      return res.json();
    },
    enabled: chargeOpen && !!chargeDutyTypeId && locationTicks.size > 0,
  });

  const chargeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/panl/charge-rate", {
        locations: Array.from(locationTicks.values()).map((t) => ({
          locationId: t.locationId,
          customerId: t.customerId,
        })),
        dutyTypeId: parseInt(chargeDutyTypeId, 10),
        rate: parseFloat(chargeRate),
        dateFrom: chargeFrom,
        dateTo: chargeTo,
        applyToShifts,
      });
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Charge rate saved",
        description: `${result.locationsUpdated} location(s)${result.shiftsUpdated ? `, ${result.shiftsUpdated} shift(s)` : ""}.`,
      });
      setChargeOpen(false);
      setLocationTicks(new Map());
      queryClient.invalidateQueries({ queryKey: ["/api/panl"] });
      reload();
    },
    onError: (err: any) => toast({ title: "Save failed", description: err.message, variant: "destructive" }),
  });

  const openChargeRate = () => {
    if (groupBy !== "location") {
      toast({
        title: "Group by Location",
        description: "Charge Rate needs location subtotal ticks.",
        variant: "destructive",
      });
      return;
    }
    if (locationTicks.size === 0) {
      toast({ title: "No locations ticked", description: "Tick location subtotal rows first.", variant: "destructive" });
      return;
    }
    const preferred =
      options?.dutyTypes.find((d) => /cleaners|duty|construction|lft|mobile/i.test(d.name))?.id ||
      options?.dutyTypes[0]?.id;
    setChargeDutyTypeId(preferred ? String(preferred) : "");
    setChargeRate("");
    setChargeFrom(dueFrom);
    setChargeTo(dueTo);
    setApplyToShifts(false);
    setChargeOpen(true);
  };

  const exportCsv = () => {
    window.open(`/api/panl/export.csv?${filterParams}`, "_blank");
  };

  const openPdfStatement = () => {
    const p = new URLSearchParams();
    if (pdfAccount !== "all") p.set("account", pdfAccount);
    p.set("status", pdfStatus);
    p.set("from", pdfFrom);
    p.set("to", pdfTo);
    window.open(`/api/panl/statement?${p}`, "_blank");
    setPdfOpen(false);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 md:p-6 space-y-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
              <PoundSterling className="w-6 h-6" />
              Profit &amp; Loss Reconciliation
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Confirmed shifts only. Load with View — filters reload the grid.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!hasViewed}>
              <Download className="w-4 h-4 mr-1" /> CSV Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPdfAccount(account);
                setPdfFrom(dueFrom);
                setPdfTo(dueTo);
                setPdfOpen(true);
              }}
            >
              <FileText className="w-4 h-4 mr-1" /> Export PDF
            </Button>
            <Button variant="outline" size="sm" onClick={openChargeRate}>
              Charge Rate
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Controls</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 items-end">
              <div>
                <Label>Due from</Label>
                <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} />
              </div>
              <div>
                <Label>Due to</Label>
                <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} />
              </div>
              <div>
                <Label>Group by</Label>
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="account">Account</SelectItem>
                    <SelectItem value="customer">Customer</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="officer">Officer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Select account</Label>
                <Select value={account} onValueChange={setAccount}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All accounts</SelectItem>
                    {(options?.accounts || []).map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={showPaid} onCheckedChange={setShowPaid} id="show-paid" />
                <Label htmlFor="show-paid">Show Paid</Label>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={showZeroRates} onCheckedChange={setShowZeroRates} id="show-zero" />
                <Label htmlFor="show-zero">Show Zero Rates</Label>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <Label>Branch</Label>
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(options?.branches || []).map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Customer</Label>
                <Select value={customerId} onValueChange={setCustomerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(options?.customers || []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Officer</Label>
                <Select value={officerId} onValueChange={setOfficerId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(options?.officers || []).map((o) => (
                      <SelectItem key={o.id} value={String(o.id)}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Location</Label>
                <Select value={locationId} onValueChange={setLocationId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {(options?.locations || []).map((l) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button onClick={reload} disabled={isFetching}>
                {isFetching ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                View
              </Button>
              {hasViewed && (
                <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  <RefreshCw className="w-4 h-4 mr-1" /> Refresh
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                Bulk edit: tick rows, type in a header box, press Enter
              </span>
            </div>
          </CardContent>
        </Card>

        {!hasViewed ? (
          <Card>
            <CardContent className="py-16 text-center text-muted-foreground">
              Set Due from / Due to, then click <strong>View</strong> to load confirmed shifts.
            </CardContent>
          </Card>
        ) : (
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
              <div className="overflow-auto flex-1 min-h-0">
                <table className="w-full text-sm border-collapse min-w-[1100px]">
                  <thead className="sticky top-0 z-10 bg-background border-b shadow-sm">
                    <tr className="text-left">
                      <th className="p-2 w-10">
                        <Checkbox checked={allSelected} onCheckedChange={(c) => toggleAll(!!c)} />
                      </th>
                      <th className="p-2 w-12">#</th>
                      <th className="p-2">Duty window</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Officer</th>
                      <th className="p-2">Location</th>
                      <th className="p-2 text-right">
                        <div>Hours</div>
                        <Input
                          className="h-7 mt-1 text-right"
                          value={bulkHours}
                          onChange={(e) => setBulkHours(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && applyBulk("hours", bulkHours)}
                          placeholder="…"
                        />
                      </th>
                      <th className="p-2 text-right">
                        <div>Pay rate</div>
                        <Input
                          className="h-7 mt-1 text-right"
                          value={bulkPay}
                          onChange={(e) => setBulkPay(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && applyBulk("payRate", bulkPay)}
                          placeholder="…"
                        />
                      </th>
                      <th className="p-2 text-right">G.Wages</th>
                      <th className="p-2 text-right">
                        <div>Expense</div>
                        <Input
                          className="h-7 mt-1 text-right"
                          value={bulkExpense}
                          onChange={(e) => setBulkExpense(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && applyBulk("expense", bulkExpense)}
                          placeholder="…"
                        />
                      </th>
                      <th className="p-2 text-right">N.Wages</th>
                      <th className="p-2 text-right">
                        <div>Sell rate</div>
                        <Input
                          className="h-7 mt-1 text-right"
                          value={bulkSell}
                          onChange={(e) => setBulkSell(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && applyBulk("sellRate", bulkSell)}
                          placeholder="…"
                        />
                      </th>
                      <th className="p-2 text-right">Selling</th>
                      <th className="p-2 text-right">P&amp;L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isFetching && rows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-8 text-center text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                          Loading…
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={14} className="p-8 text-center text-muted-foreground">
                          No confirmed shifts match these filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => {
                        if (row.kind === "subtotal") {
                          const ticked =
                            row.locationId != null && locationTicks.has(row.locationId);
                          return (
                            <tr key={`st-${idx}`} className="bg-muted/50 font-medium border-t">
                              <td className="p-2">
                                {groupBy === "location" && row.locationId != null && (
                                  <Checkbox
                                    checked={ticked}
                                    onCheckedChange={(c) =>
                                      toggleLocationTick(
                                        {
                                          locationId: row.locationId!,
                                          customerId: row.customerId,
                                          label: row.label,
                                        },
                                        !!c,
                                      )
                                    }
                                  />
                                )}
                              </td>
                              <td className="p-2" colSpan={5}>
                                Subtotal — {row.label}
                              </td>
                              <td className="p-2 text-right">{fmt(row.hours)}</td>
                              <td className="p-2" />
                              <td className="p-2 text-right">{gbp(row.gWages)}</td>
                              <td className="p-2 text-right">{gbp(row.expense)}</td>
                              <td className="p-2 text-right">{gbp(row.nWages)}</td>
                              <td className="p-2" />
                              <td className="p-2 text-right">{gbp(row.selling)}</td>
                              <td className={`p-2 text-right ${row.pnl < 0 ? "text-red-600" : ""}`}>
                                {gbp(row.pnl)}
                              </td>
                            </tr>
                          );
                        }
                        const s = row.shift;
                        return (
                          <tr
                            key={s.id}
                            className={`border-b ${s.isLoss ? "bg-red-50 dark:bg-red-950/30" : ""}`}
                          >
                            <td className="p-2">
                              <Checkbox
                                checked={selectedIds.has(s.id)}
                                onCheckedChange={(c) => toggleShift(s.id, !!c)}
                              />
                            </td>
                            <td className="p-2 text-muted-foreground">{row.rowNo}</td>
                            <td className="p-2 whitespace-nowrap">{s.dutyWindow}</td>
                            <td className="p-2">{s.customerName}</td>
                            <td className="p-2">{s.officerName}</td>
                            <td className="p-2">{s.locationName}</td>
                            <td className="p-2 text-right">{fmt(s.hours)}</td>
                            <td className="p-2 text-right">{fmt(s.payRate)}</td>
                            <td className="p-2 text-right">{gbp(s.gWages)}</td>
                            <td className="p-2 text-right">{gbp(s.expense)}</td>
                            <td className="p-2 text-right">{gbp(s.nWages)}</td>
                            <td className="p-2 text-right">{fmt(s.sellRate)}</td>
                            <td className="p-2 text-right">{gbp(s.selling)}</td>
                            <td className={`p-2 text-right font-medium ${s.isLoss ? "text-red-600" : ""}`}>
                              {gbp(s.pnl)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 font-semibold bg-muted/40">
                      <td className="p-2" colSpan={6}>
                        Grand total ({totals.count} shifts)
                      </td>
                      <td className="p-2 text-right">{fmt(totals.hours)}</td>
                      <td className="p-2" />
                      <td className="p-2 text-right">{gbp(totals.gWages)}</td>
                      <td className="p-2 text-right">{gbp(totals.expense)}</td>
                      <td className="p-2 text-right">{gbp(totals.nWages)}</td>
                      <td className="p-2" />
                      <td className="p-2 text-right">{gbp(totals.selling)}</td>
                      <td className={`p-2 text-right ${totals.pnl < 0 ? "text-red-600" : ""}`}>
                        {gbp(totals.pnl)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="sticky bottom-0 border-t bg-background px-3 py-2 flex flex-wrap gap-4 text-sm font-medium justify-end">
                <span>Hours {fmt(totals.hours)}</span>
                <span>G.Wages {gbp(totals.gWages)}</span>
                <span>Expense {gbp(totals.expense)}</span>
                <span>N.Wages {gbp(totals.nWages)}</span>
                <span>Selling {gbp(totals.selling)}</span>
                <span className={totals.pnl < 0 ? "text-red-600" : ""}>P&amp;L {gbp(totals.pnl)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export PDF statement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Account</Label>
              <Select value={pdfAccount} onValueChange={setPdfAccount}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {(options?.accounts || []).map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={pdfStatus} onValueChange={(v) => setPdfStatus(v as "PAID" | "UNPAID")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UNPAID">UNPAID</SelectItem>
                  <SelectItem value="PAID">PAID</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>From</Label>
                <Input type="date" value={pdfFrom} onChange={(e) => setPdfFrom(e.target.value)} />
              </div>
              <div>
                <Label>To</Label>
                <Input type="date" value={pdfTo} onChange={(e) => setPdfTo(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPdfOpen(false)}>
              Cancel
            </Button>
            <Button onClick={openPdfStatement}>Open statement</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={chargeOpen} onOpenChange={setChargeOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Charge Rate</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <p className="text-sm text-muted-foreground">
              Locations:{" "}
              {Array.from(locationTicks.values())
                .map((t) => t.label)
                .join(", ")}
            </p>
            <div>
              <Label>Duty type</Label>
              <Select
                value={chargeDutyTypeId}
                onValueChange={(v) => {
                  setChargeDutyTypeId(v);
                  setChargeRate("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select duty type" />
                </SelectTrigger>
                <SelectContent>
                  {(options?.dutyTypes || []).map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rate</Label>
              {ratesLoading ? (
                <div className="text-sm text-muted-foreground py-2">Loading rates…</div>
              ) : (
                <Select value={chargeRate} onValueChange={setChargeRate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {(chargeRates?.rates || []).map((r) => (
                      <SelectItem key={r.rate} value={String(r.rate)}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                className="mt-2"
                type="number"
                step="0.01"
                placeholder="Or type a rate"
                value={chargeRate}
                onChange={(e) => setChargeRate(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date from</Label>
                <Input type="date" value={chargeFrom} onChange={(e) => setChargeFrom(e.target.value)} />
              </div>
              <div>
                <Label>Date to</Label>
                <Input type="date" value={chargeTo} onChange={(e) => setChargeTo(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={applyToShifts}
                onCheckedChange={(c) => setApplyToShifts(!!c)}
                id="apply-shifts"
              />
              <Label htmlFor="apply-shifts">Apply this rate to all shifts in the date range</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChargeOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                chargeMutation.isPending ||
                locationTicks.size === 0 ||
                !chargeDutyTypeId ||
                !chargeRate ||
                num(chargeRate) <= 0
              }
              onClick={() => chargeMutation.mutate()}
            >
              {chargeMutation.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function num(v: string) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
