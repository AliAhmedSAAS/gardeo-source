import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Download, FileText, Receipt, ScrollText, Loader2, CheckSquare, Square, Package, CalendarRange, Clock, ShieldCheck, User } from "lucide-react";

type Supplier = {
  id: number;
  companyName: string;
  supplierCode: string;
  selfBillingAgreementStatus: string;
  status: string;
};

type SupplierSelection = {
  agreement: boolean;
  invoices: boolean;
  timesheets: boolean;
  auditTrail: boolean;
  dueDiligence: boolean;
  supplierProfile: boolean;
};

type PeriodMode = "all" | "month" | "quarter" | "range";

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const startYear = 2021;
  const startMonth = 0;
  for (let y = now.getFullYear(); y >= startYear; y--) {
    const mEnd = y === now.getFullYear() ? now.getMonth() : 11;
    const mStart = y === startYear ? startMonth : 0;
    for (let m = mEnd; m >= mStart; m--) {
      const val = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = new Date(y, m).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      options.push({ value: val, label });
    }
  }
  return options;
}

function generateYearOptions(): string[] {
  const years: string[] = [];
  for (let y = new Date().getFullYear(); y >= 2021; y--) years.push(String(y));
  return years;
}

export default function DownloadAuditPackPage() {
  const { toast } = useToast();
  const [selections, setSelections] = useState<Record<number, SupplierSelection>>({});
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});
  const [bulkDownloading, setBulkDownloading] = useState(false);

  const [periodMode, setPeriodMode] = useState<PeriodMode>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [rangeFrom, setRangeFrom] = useState<string>("");
  const [rangeTo, setRangeTo] = useState<string>("");

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const { data: selfBilledIds = [] } = useQuery<number[]>({
    queryKey: ["/api/suppliers/self-billed-ids"],
  });

  const selfBilledIdSet = new Set(selfBilledIds);

  const activeSuppliers = suppliers.filter(
    (s) => s.selfBillingAgreementStatus === "active" || selfBilledIdSet.has(s.id)
  );

  const monthOptions = generateMonthOptions();
  const yearOptions = generateYearOptions();

  function getDateRange(): { from: string; to: string } | null {
    if (periodMode === "all") return null;
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

  function getPeriodLabel(): string {
    const range = getDateRange();
    if (!range) return "All Dates";
    const fmt = (d: string) => {
      const dt = new Date(d + "T00:00:00");
      return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    };
    return `${fmt(range.from)} – ${fmt(range.to)}`;
  }

  const getSelection = (id: number): SupplierSelection =>
    selections[id] || { agreement: false, invoices: false, timesheets: false, auditTrail: false, dueDiligence: false, supplierProfile: false };

  const toggleField = (id: number, field: keyof SupplierSelection) => {
    setSelections((prev) => ({
      ...prev,
      [id]: { ...getSelection(id), [field]: !getSelection(id)[field] },
    }));
  };

  const toggleAllColumn = (field: keyof SupplierSelection, value: boolean) => {
    setSelections((prev) => {
      const next = { ...prev };
      activeSuppliers.forEach((s) => {
        next[s.id] = { ...getSelection(s.id), [field]: value };
      });
      return next;
    });
  };

  const isColumnAllSelected = (field: keyof SupplierSelection) =>
    activeSuppliers.length > 0 && activeSuppliers.every((s) => getSelection(s.id)[field]);

  const selectAllForSupplier = (id: number) => {
    setSelections((prev) => ({
      ...prev,
      [id]: { agreement: true, invoices: true, timesheets: true, auditTrail: true, dueDiligence: true, supplierProfile: true },
    }));
  };

  const hasAnySelected = (id: number) => {
    const sel = getSelection(id);
    return sel.agreement || sel.invoices || sel.timesheets || sel.auditTrail || sel.dueDiligence || sel.supplierProfile;
  };

  const downloadBlob = async (url: string, fallbackFilename: string) => {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) throw new Error(`Failed to download ${fallbackFilename}`);
    const disposition = res.headers.get("Content-Disposition");
    let filename = fallbackFilename;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const downloadBlobPost = async (url: string, body: any, fallbackFilename: string) => {
    const res = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Failed to download ${fallbackFilename}`);
    const disposition = res.headers.get("Content-Disposition");
    let filename = fallbackFilename;
    if (disposition) {
      const match = disposition.match(/filename="?([^"]+)"?/);
      if (match) filename = match[1];
    }
    const blob = await res.blob();
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const suppliersWithSelections = activeSuppliers.filter((s) => hasAnySelected(s.id));

  const handleBulkDownload = async () => {
    if (suppliersWithSelections.length === 0) return;
    setBulkDownloading(true);
    try {
      const dateRange = getDateRange();
      const payload: any = {
        suppliers: suppliersWithSelections.map((s) => {
          const sel = getSelection(s.id);
          return { id: s.id, agreement: sel.agreement, invoices: sel.invoices, timesheets: sel.timesheets, auditTrail: sel.auditTrail, dueDiligence: sel.dueDiligence, supplierProfile: sel.supplierProfile };
        }),
      };
      if (dateRange) {
        payload.from = dateRange.from;
        payload.to = dateRange.to;
      }
      await downloadBlobPost("/api/admin/suppliers/bulk-audit-pack-zip", payload, "Audit_Pack.zip");
      toast({
        title: "Bulk audit pack downloaded",
        description: `ZIP containing documents for ${suppliersWithSelections.length} supplier${suppliersWithSelections.length > 1 ? "s" : ""}.`,
      });
    } catch (err) {
      toast({ title: "Download failed", description: "An error occurred while downloading the bulk audit pack.", variant: "destructive" });
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleDownload = async (supplier: Supplier) => {
    const sel = getSelection(supplier.id);
    if (!sel.agreement && !sel.invoices && !sel.timesheets && !sel.auditTrail && !sel.dueDiligence && !sel.supplierProfile) {
      toast({ title: "No documents selected", description: "Please select at least one document type to download.", variant: "destructive" });
      return;
    }

    setDownloading((prev) => ({ ...prev, [supplier.id]: true }));

    try {
      const params = new URLSearchParams();
      if (sel.agreement) params.set("agreement", "true");
      if (sel.invoices) params.set("invoices", "true");
      if (sel.timesheets) params.set("timesheets", "true");
      if (sel.auditTrail) params.set("auditTrail", "true");
      if (sel.dueDiligence) params.set("dueDiligence", "true");
      if (sel.supplierProfile) params.set("supplierProfile", "true");

      const dateRange = getDateRange();
      if (dateRange) {
        params.set("from", dateRange.from);
        params.set("to", dateRange.to);
      }

      const sanitizedName = supplier.companyName.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
      await downloadBlob(
        `/api/admin/suppliers/${supplier.id}/audit-pack-zip?${params.toString()}`,
        `${sanitizedName}.zip`
      );

      const includedTypes = [];
      if (sel.agreement && supplier.selfBillingAgreementStatus === "active") includedTypes.push("Agreement");
      if (sel.invoices) includedTypes.push("Invoices");
      if (sel.timesheets) includedTypes.push("Timesheets");
      if (sel.auditTrail) includedTypes.push("Audit Trail");
      if (sel.dueDiligence) includedTypes.push("Due Diligence");
      if (sel.supplierProfile) includedTypes.push("Supplier Profile");
      const skipped = sel.agreement && supplier.selfBillingAgreementStatus !== "active" ? " (Agreement skipped — not active)" : "";
      toast({ title: "Audit pack downloaded", description: `ZIP containing ${includedTypes.join(", ")} for ${supplier.companyName}.${skipped}` });
    } catch (err) {
      toast({ title: "Download failed", description: "An error occurred while downloading the audit pack.", variant: "destructive" });
    } finally {
      setDownloading((prev) => ({ ...prev, [supplier.id]: false }));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-page-title">Download Audit Pack</h1>
        <p className="text-muted-foreground mt-1">
          Download compliance documents for suppliers with an active self-billing agreement or any self-billed invoices. Select the document types you need for each supplier.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 mb-1">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Period Filter</span>
            <Badge variant="outline" className="text-xs" data-testid="badge-period-label">{getPeriodLabel()}</Badge>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Period Type</label>
              <select
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
                value={periodMode}
                onChange={(e) => setPeriodMode(e.target.value as PeriodMode)}
                data-testid="select-period-mode"
              >
                <option value="all">All Dates</option>
                <option value="month">Month</option>
                <option value="quarter">Quarter</option>
                <option value="range">Date Range</option>
              </select>
            </div>

            {periodMode === "month" && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Month</label>
                <select
                  className="border rounded-md px-3 py-1.5 text-sm bg-background"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  data-testid="select-month"
                >
                  <option value="">Select month…</option>
                  {monthOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {periodMode === "quarter" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Quarter</label>
                  <select
                    className="border rounded-md px-3 py-1.5 text-sm bg-background"
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    data-testid="select-quarter"
                  >
                    <option value="">Select…</option>
                    <option value="1">Q1 (Nov – Jan)</option>
                    <option value="2">Q2 (Feb – Apr)</option>
                    <option value="3">Q3 (May – Jul)</option>
                    <option value="4">Q4 (Aug – Oct)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Year</label>
                  <select
                    className="border rounded-md px-3 py-1.5 text-sm bg-background"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    data-testid="select-year"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {periodMode === "range" && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">From</label>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-1.5 text-sm bg-background"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    data-testid="input-range-from"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">To</label>
                  <input
                    type="date"
                    className="border rounded-md px-3 py-1.5 text-sm bg-background"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    data-testid="input-range-to"
                  />
                </div>
              </>
            )}
          </div>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Supplier Documents</CardTitle>
              <CardDescription>{activeSuppliers.length} suppliers with an active agreement or self-billed invoices</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => activeSuppliers.forEach((s) => selectAllForSupplier(s.id))}
                data-testid="button-select-all"
              >
                <CheckSquare className="h-4 w-4 mr-1" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelections({})}
                data-testid="button-deselect-all"
              >
                <Square className="h-4 w-4 mr-1" />
                Clear All
              </Button>
              <Button
                size="sm"
                onClick={handleBulkDownload}
                disabled={suppliersWithSelections.length === 0 || bulkDownloading}
                data-testid="button-bulk-download"
              >
                {bulkDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Package className="h-4 w-4 mr-1" />
                )}
                Download All Selected{suppliersWithSelections.length > 0 ? ` (${suppliersWithSelections.length})` : ""}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium">Supplier</th>
                  <th className="p-3 font-medium text-center w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> Agreement</span>
                      <Checkbox
                        checked={isColumnAllSelected("agreement")}
                        onCheckedChange={(checked) => toggleAllColumn("agreement", !!checked)}
                        data-testid="checkbox-all-agreement"
                      />
                    </div>
                  </th>
                  <th className="p-3 font-medium text-center w-[160px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1"><Receipt className="h-3.5 w-3.5" /> Invoices</span>
                      <Checkbox
                        checked={isColumnAllSelected("invoices")}
                        onCheckedChange={(checked) => toggleAllColumn("invoices", !!checked)}
                        data-testid="checkbox-all-invoices"
                      />
                    </div>
                  </th>
                  <th className="p-3 font-medium text-center w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Timesheets</span>
                      <Checkbox
                        checked={isColumnAllSelected("timesheets")}
                        onCheckedChange={(checked) => toggleAllColumn("timesheets", !!checked)}
                        data-testid="checkbox-all-timesheets"
                      />
                    </div>
                  </th>
                  <th className="p-3 font-medium text-center w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1"><ScrollText className="h-3.5 w-3.5" /> Audit Trail</span>
                      <Checkbox
                        checked={isColumnAllSelected("auditTrail")}
                        onCheckedChange={(checked) => toggleAllColumn("auditTrail", !!checked)}
                        data-testid="checkbox-all-audit-trail"
                      />
                    </div>
                  </th>
                  <th className="p-3 font-medium text-center w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Due Diligence</span>
                      <Checkbox
                        checked={isColumnAllSelected("dueDiligence")}
                        onCheckedChange={(checked) => toggleAllColumn("dueDiligence", !!checked)}
                        data-testid="checkbox-all-due-diligence"
                      />
                    </div>
                  </th>
                  <th className="p-3 font-medium text-center w-[140px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" /> Supplier Profile</span>
                      <Checkbox
                        checked={isColumnAllSelected("supplierProfile")}
                        onCheckedChange={(checked) => toggleAllColumn("supplierProfile", !!checked)}
                        data-testid="checkbox-all-supplier-profile"
                      />
                    </div>
                  </th>
                  <th className="p-3 font-medium text-center w-[120px]">Action</th>
                </tr>
              </thead>
              <tbody>
                {activeSuppliers.map((supplier) => {
                  const sel = getSelection(supplier.id);
                  const isDownloading = downloading[supplier.id];
                  return (
                    <tr key={supplier.id} className="border-b last:border-0 hover:bg-muted/30" data-testid={`row-supplier-${supplier.id}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium" data-testid={`text-supplier-name-${supplier.id}`}>{supplier.companyName}</span>
                          <Badge variant="secondary" className="text-xs font-mono" data-testid={`badge-supplier-code-${supplier.id}`}>
                            {supplier.supplierCode}
                          </Badge>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={sel.agreement}
                          onCheckedChange={() => toggleField(supplier.id, "agreement")}
                          data-testid={`checkbox-agreement-${supplier.id}`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={sel.invoices}
                          onCheckedChange={() => toggleField(supplier.id, "invoices")}
                          data-testid={`checkbox-invoices-${supplier.id}`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={sel.timesheets}
                          onCheckedChange={() => toggleField(supplier.id, "timesheets")}
                          data-testid={`checkbox-timesheets-${supplier.id}`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={sel.auditTrail}
                          onCheckedChange={() => toggleField(supplier.id, "auditTrail")}
                          data-testid={`checkbox-audit-trail-${supplier.id}`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={sel.dueDiligence}
                          onCheckedChange={() => toggleField(supplier.id, "dueDiligence")}
                          data-testid={`checkbox-due-diligence-${supplier.id}`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Checkbox
                          checked={sel.supplierProfile}
                          onCheckedChange={() => toggleField(supplier.id, "supplierProfile")}
                          data-testid={`checkbox-supplier-profile-${supplier.id}`}
                        />
                      </td>
                      <td className="p-3 text-center">
                        <Button
                          size="sm"
                          onClick={() => handleDownload(supplier)}
                          disabled={!hasAnySelected(supplier.id) || isDownloading}
                          data-testid={`button-download-${supplier.id}`}
                        >
                          {isDownloading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4 mr-1" />
                          )}
                          Download
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {activeSuppliers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      No suppliers with an active self-billing agreement or self-billed invoices found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
