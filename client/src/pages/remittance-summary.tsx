import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet, Loader2, Search, PoundSterling, FileDown,
  Building2, Archive,
} from "lucide-react";

interface Supplier {
  id: number;
  companyName: string;
  supplierCode: string;
}

interface PaymentMapping {
  bankRef: string;
  amountPaid: string;
  datePaid: string;
}

interface RemittanceInvoice {
  invoiceId: number;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  invoiceAmount: string;
  subtotal: string;
  vatAmount: string;
  status: string;
  paymentStatus: string;
  amountPaid: string;
  payments: PaymentMapping[];
}

interface RemittanceSummaryData {
  supplier: { id: number; companyName: string; vatNumber: string; companyRegNumber: string };
  periodFrom: string;
  periodTo: string;
  invoices: RemittanceInvoice[];
  totals: { totalInvoiced: string; totalPaid: string; outstanding: string };
}

type PeriodMode = "month" | "quarter" | "range";

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatGBP(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "£0.00";
  return `£${num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function InvoiceTable({ data, showSupplier }: { data: RemittanceSummaryData; showSupplier?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {showSupplier && <TableHead>Supplier</TableHead>}
            <TableHead>Invoice No</TableHead>
            <TableHead>Period</TableHead>
            <TableHead className="text-right">Invoice Amount</TableHead>
            <TableHead>Bank Reference</TableHead>
            <TableHead className="text-right">Amount Paid</TableHead>
            <TableHead>Date Paid</TableHead>
            <TableHead className="text-center">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.invoices.map((inv, idx) => (
            <TableRow key={`${data.supplier.id}-${inv.invoiceId}-${idx}`} data-testid={`row-invoice-${data.supplier.id}-${idx}`}>
              {showSupplier && (
                <TableCell className="text-sm font-medium">{idx === 0 ? data.supplier.companyName : ""}</TableCell>
              )}
              <TableCell className="font-medium text-sm">{inv.invoiceNumber}</TableCell>
              <TableCell className="text-sm">
                {formatDate(inv.periodStart)} — {formatDate(inv.periodEnd)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">{formatGBP(inv.invoiceAmount)}</TableCell>
              <TableCell className="text-sm max-w-[220px]">
                {inv.payments.length > 0
                  ? inv.payments.map((p, i) => (
                      <div key={i} className="text-xs truncate" title={p.bankRef || "—"}>{p.bankRef || "—"}</div>
                    ))
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">{formatGBP(inv.amountPaid)}</TableCell>
              <TableCell className="text-sm">
                {inv.payments.length > 0
                  ? inv.payments.map((p, i) => (
                      <div key={i} className="text-xs">{formatDate(p.datePaid)}</div>
                    ))
                  : <span className="text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-center">
                {inv.paymentStatus === "Paid" ? (
                  <Badge variant="default" className="bg-green-600 text-xs" data-testid={`badge-status-${data.supplier.id}-${idx}`}>Paid</Badge>
                ) : inv.paymentStatus === "Partial" ? (
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs" data-testid={`badge-status-${data.supplier.id}-${idx}`}>Partial</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs" data-testid={`badge-status-${data.supplier.id}-${idx}`}>Unpaid</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function RemittanceSummaryPage() {
  const { user } = useAuth();
  const [supplierId, setSupplierId] = useState<string>("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");
  const [queryParams, setQueryParams] = useState<{ supplierId: string; from: string; to: string } | null>(null);

  const isAllMode = queryParams?.supplierId === "all";

  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  function getDateRange(): { from: string; to: string } | null {
    if (periodMode === "month" && selectedMonth) {
      const [y, m] = selectedMonth.split("-").map(Number);
      const lastDay = new Date(y, m, 0).getDate();
      return { from: `${selectedMonth}-01`, to: `${selectedMonth}-${lastDay}` };
    }
    if (periodMode === "quarter" && selectedQuarter && selectedYear) {
      const q = parseInt(selectedQuarter);
      const y = parseInt(selectedYear);
      let startMonth: number, startYear: number, endMonth: number, endYear: number;
      if (q === 1) { startMonth = 11; startYear = y - 1; endMonth = 1; endYear = y; }
      else if (q === 2) { startMonth = 2; startYear = y; endMonth = 4; endYear = y; }
      else if (q === 3) { startMonth = 5; startYear = y; endMonth = 7; endYear = y; }
      else { startMonth = 8; startYear = y; endMonth = 10; endYear = y; }
      const lastDay = new Date(endYear, endMonth, 0).getDate();
      return {
        from: `${startYear}-${String(startMonth).padStart(2, "0")}-01`,
        to: `${endYear}-${String(endMonth).padStart(2, "0")}-${lastDay}`,
      };
    }
    if (periodMode === "range" && rangeFrom && rangeTo) {
      return { from: rangeFrom, to: rangeTo };
    }
    return null;
  }

  function handleGenerate() {
    const range = getDateRange();
    if (!supplierId || !range) return;
    setQueryParams({ supplierId, from: range.from, to: range.to });
  }

  const canGenerate = !!supplierId && !!getDateRange();

  const { data: rawData, isLoading: summaryLoading, isFetching } = useQuery<RemittanceSummaryData | RemittanceSummaryData[]>({
    queryKey: ["/api/remittance-summary", queryParams],
    queryFn: async () => {
      if (!queryParams) throw new Error("No params");
      const res = await fetch(`/api/remittance-summary?supplierId=${queryParams.supplierId}&from=${queryParams.from}&to=${queryParams.to}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!queryParams,
  });

  const summaryList: RemittanceSummaryData[] = useMemo(() => {
    if (!rawData) return [];
    return Array.isArray(rawData) ? rawData : [rawData];
  }, [rawData]);

  const grandTotals = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let totalInvoices = 0;
    for (const d of summaryList) {
      totalInvoiced += parseFloat(d.totals.totalInvoiced) || 0;
      totalPaid += parseFloat(d.totals.totalPaid) || 0;
      totalInvoices += d.invoices.length;
    }
    return {
      totalInvoiced: totalInvoiced.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      outstanding: (totalInvoiced - totalPaid).toFixed(2),
      totalInvoices,
      supplierCount: summaryList.length,
    };
  }, [summaryList]);

  function handleDownloadPdf() {
    if (!queryParams) return;
    window.open(
      `/api/remittance-summary/pdf?supplierId=${queryParams.supplierId}&from=${queryParams.from}&to=${queryParams.to}`,
      "_blank"
    );
  }

  function handleDownloadCsv() {
    if (!queryParams) return;
    window.open(
      `/api/remittance-summary/csv?supplierId=${queryParams.supplierId}&from=${queryParams.from}&to=${queryParams.to}`,
      "_blank"
    );
  }

  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let y = now.getFullYear(); y >= 2021; y--) {
    const endMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12;
    for (let m = endMonth; m >= 1; m--) {
      const val = `${y}-${String(m).padStart(2, "0")}`;
      const label = new Date(y, m - 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      months.push({ value: val, label });
    }
  }

  const years: string[] = [];
  for (let y = now.getFullYear(); y >= 2021; y--) {
    years.push(String(y));
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <FileSpreadsheet className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Remittance Summary</h1>
          <p className="text-sm text-muted-foreground">View invoice-to-payment mappings for a supplier over a selected period</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Search className="h-4 w-4" />
            Select Supplier & Period
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label className="text-sm font-medium mb-1 block">Supplier</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="select-supplier"
              >
                <option value="">Select a supplier...</option>
                <option value="all">── All Suppliers ──</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={String(s.id)}>{s.companyName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Period Type</label>
              <select
                value={periodMode}
                onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                data-testid="select-period-mode"
              >
                <option value="month">Single Month</option>
                <option value="quarter">Quarter</option>
                <option value="range">Date Range</option>
              </select>
            </div>

            {periodMode === "month" && (
              <div>
                <label className="text-sm font-medium mb-1 block">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="select-month"
                >
                  <option value="">Select month...</option>
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === "quarter" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Quarter</label>
                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="select-quarter"
                  >
                    <option value="">Quarter...</option>
                    <option value="1">Q1 (Nov–Jan)</option>
                    <option value="2">Q2 (Feb–Apr)</option>
                    <option value="3">Q3 (May–Jul)</option>
                    <option value="4">Q4 (Aug–Oct)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="select-year"
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {periodMode === "range" && (
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">From</label>
                  <input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="input-range-from"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-1 block">To</label>
                  <input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    data-testid="input-range-to"
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!canGenerate || isFetching}
              data-testid="button-generate-summary"
            >
              {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
              Generate Summary
            </Button>
          </div>
        </CardContent>
      </Card>

      {summaryLoading && queryParams && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading remittance data...</span>
          </CardContent>
        </Card>
      )}

      {rawData && summaryList.length === 0 && (
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-muted-foreground" data-testid="text-no-invoices">
              No invoices found for any supplier in the selected period.
            </p>
          </CardContent>
        </Card>
      )}

      {summaryList.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Building2 className="h-4 w-4" />
                  {isAllMode ? "Suppliers" : "Supplier"}
                </div>
                <p className="font-semibold text-sm" data-testid="text-supplier-name">
                  {isAllMode ? `${grandTotals.supplierCount} suppliers` : summaryList[0]?.supplier.companyName}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <PoundSterling className="h-4 w-4" />
                  Total Invoiced
                </div>
                <p className="text-xl font-bold" data-testid="text-total-invoiced">{formatGBP(grandTotals.totalInvoiced)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <PoundSterling className="h-4 w-4" />
                  Total Paid
                </div>
                <p className="text-xl font-bold text-green-600" data-testid="text-total-paid">{formatGBP(grandTotals.totalPaid)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <PoundSterling className="h-4 w-4" />
                  Outstanding
                </div>
                <p className="text-xl font-bold text-orange-600" data-testid="text-outstanding">{formatGBP(grandTotals.outstanding)}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Invoice to Payment Mapping</CardTitle>
                <CardDescription>
                  {summaryList.length > 0 && formatDate(summaryList[0].periodFrom)} — {summaryList.length > 0 && formatDate(summaryList[0].periodTo)} · {grandTotals.totalInvoices} invoice{grandTotals.totalInvoices !== 1 ? "s" : ""}
                  {isAllMode && ` across ${grandTotals.supplierCount} suppliers`}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadCsv}
                  data-testid="button-download-csv"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Download CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPdf}
                  data-testid="button-download-pdf"
                >
                  {isAllMode ? <Archive className="h-4 w-4 mr-2" /> : <FileDown className="h-4 w-4 mr-2" />}
                  {isAllMode ? "Download All PDFs (ZIP)" : "Download PDF"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {grandTotals.totalInvoices === 0 ? (
                <p className="text-center text-muted-foreground py-8" data-testid="text-no-invoices">
                  No invoices found for the selected period.
                </p>
              ) : isAllMode ? (
                summaryList.map((data) => (
                  <div key={data.supplier.id} className="mb-6 last:mb-0">
                    <div className="flex items-center gap-2 mb-2 pb-1 border-b">
                      <Building2 className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm" data-testid={`text-supplier-header-${data.supplier.id}`}>{data.supplier.companyName}</span>
                      <Badge variant="outline" className="text-xs ml-auto">{data.invoices.length} invoice{data.invoices.length !== 1 ? "s" : ""}</Badge>
                      <span className="text-xs text-muted-foreground">Invoiced: {formatGBP(data.totals.totalInvoiced)} · Paid: {formatGBP(data.totals.totalPaid)}</span>
                    </div>
                    <InvoiceTable data={data} />
                  </div>
                ))
              ) : (
                <InvoiceTable data={summaryList[0]} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
