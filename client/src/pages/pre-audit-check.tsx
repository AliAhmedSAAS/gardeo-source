import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, Download, FileText, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface CheckDetail {
  [key: string]: any;
}

interface AuditCheck {
  name: string;
  description: string;
  status: "pass" | "warning" | "fail";
  count: number;
  details: CheckDetail[];
}

interface AuditCategory {
  name: string;
  checks: AuditCheck[];
}

interface AuditResult {
  categories: AuditCategory[];
  summary: { pass: number; warning: number; fail: number };
  checkedAt: string;
  supplierNames: string[];
}

export default function PreAuditCheckPage() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [repairFirst, setRepairFirst] = useState(false);
  const [results, setResults] = useState<AuditResult | null>(null);
  const [resultsSupplierIds, setResultsSupplierIds] = useState<number[]>([]);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(new Set());

  const { data: suppliers = [], isLoading: loadingSuppliers } = useQuery<any[]>({
    queryKey: ["/api/suppliers"],
  });

  const runMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await apiRequest("POST", "/api/admin/pre-audit-check", { supplierIds: ids, repairFirst });
      return res.json();
    },
    onSuccess: (data: any, ids: number[]) => {
      setResults(data);
      setResultsSupplierIds(ids);
      setExpandedChecks(new Set());
      const parts = [`${data.summary.pass} passed, ${data.summary.warning} warnings, ${data.summary.fail} failures`];
      if (data.repairSummary) {
        const r = data.repairSummary;
        const repairParts = [];
        if (r.bankTransactionsFixed > 0) repairParts.push(`${r.bankTransactionsFixed} bank transactions fixed`);
        if (r.invoicesMarkedPaid > 0) repairParts.push(`${r.invoicesMarkedPaid} invoices marked paid`);
        if (r.invoicesUnmarkedPaid > 0) repairParts.push(`${r.invoicesUnmarkedPaid} invoices reverted to approved`);
        if (repairParts.length > 0) parts.push("Repairs: " + repairParts.join(", "));
      }
      toast({ title: "Pre-Audit Check Complete", description: parts.join(". ") });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSelectAll = () => {
    if (selectedIds.size === suppliers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(suppliers.map((s: any) => s.id)));
    }
  };

  const toggleSupplier = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleExpand = (key: string) => {
    const next = new Set(expandedChecks);
    if (next.has(key)) next.delete(key); else next.add(key);
    setExpandedChecks(next);
  };

  const handleRun = () => {
    runMutation.mutate(Array.from(selectedIds));
  };

  const handleExportCsv = () => {
    if (!results) return;
    const rows = [["Category", "Check", "Status", "Supplier", "Detail", "Amount"]];
    for (const cat of results.categories) {
      for (const check of cat.checks) {
        if (check.details.length === 0) {
          rows.push([cat.name, check.name, check.status.toUpperCase(), "", "", ""]);
        } else {
          for (const d of check.details) {
            const supplier = d.supplier || d.supplierName || "";
            const amount = d.total || d.amount || d.txAmount || d.allocated || "";
            const detailParts = Object.entries(d).filter(([k]) => !["supplier", "supplierName", "total", "amount", "txAmount", "allocated"].includes(k)).map(([k, v]) => `${k}: ${v}`);
            rows.push([cat.name, check.name, check.status.toUpperCase(), supplier, detailParts.join("; "), String(amount)]);
          }
        }
      }
    }
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const csvSupplierPrefix = results.supplierNames.length === 1
      ? results.supplierNames[0].replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") + "_"
      : results.supplierNames.length + "_suppliers_";
    a.download = `${csvSupplierPrefix}pre_audit_check_${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleExportPdf = async () => {
    try {
      const res = await apiRequest("POST", "/api/admin/pre-audit-check/pdf", { supplierIds: resultsSupplierIds });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const pdfSupplierPrefix = results!.supplierNames.length === 1
        ? results!.supplierNames[0].replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") + "_"
        : results!.supplierNames.length + "_suppliers_";
      a.download = `${pdfSupplierPrefix}pre_audit_check_${new Date().toISOString().split("T")[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toast({ title: "PDF Error", description: err.message, variant: "destructive" });
    }
  };

  const statusIcon = (status: string) => {
    if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    if (status === "warning") return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    return <XCircle className="h-4 w-4 text-red-500" />;
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, string> = {
      pass: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      warning: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
      fail: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${variants[status] || ""}`}>{status.toUpperCase()}</span>;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" data-testid="pre-audit-check-page">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-[#1F3A5F]" />
          <div>
            <h1 className="text-2xl font-bold text-[#1F3A5F] dark:text-white" data-testid="text-page-title">Pre-Audit Check</h1>
            <p className="text-sm text-muted-foreground">Run compliance and data integrity checks before HMRC audit</p>
          </div>
        </div>
        {results && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCsv} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportPdf} data-testid="button-export-pdf">
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center justify-between">
              Select Suppliers
              <Button variant="ghost" size="sm" onClick={handleSelectAll} data-testid="button-select-all" className="text-xs h-7">
                {selectedIds.size === suppliers.length ? "Deselect All" : "Select All"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingSuppliers ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : (
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {suppliers.map((s: any) => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 rounded px-2 py-1.5 text-sm" data-testid={`checkbox-supplier-${s.id}`}>
                    <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleSupplier(s.id)} />
                    <span className="truncate">{s.companyName || s.company_name}</span>
                  </label>
                ))}
              </div>
            )}
            <label className="flex items-center gap-2 mt-4 cursor-pointer" data-testid="checkbox-repair-reconciliation">
              <Checkbox checked={repairFirst} onCheckedChange={(v) => setRepairFirst(!!v)} />
              <div className="flex items-center gap-1.5">
                <Wrench className="h-3.5 w-3.5 text-orange-600" />
                <span className="text-sm">Repair reconciliation first</span>
              </div>
            </label>
            <p className="text-xs text-muted-foreground mt-1 ml-7">Fixes stale bank allocation totals and corrects invoice payment statuses before running checks</p>
            <Button
              className="w-full mt-3 bg-[#1F3A5F] hover:bg-[#162d4a]"
              disabled={selectedIds.size === 0 || runMutation.isPending}
              onClick={handleRun}
              data-testid="button-run-check"
            >
              {runMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {repairFirst ? "Repairing & Running..." : "Running..."}</> : repairFirst ? "Repair & Run Pre-Audit Check" : "Run Pre-Audit Check"}
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-3 space-y-4">
          {runMutation.isPending && (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-[#1F3A5F] mx-auto mb-3" />
                  <p className="text-muted-foreground">Running pre-audit checks across {selectedIds.size} supplier(s)...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {results && !runMutation.isPending && (
            <>
              <div className="grid grid-cols-3 gap-4">
                <Card className="border-green-200 dark:border-green-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-green-700 dark:text-green-400" data-testid="text-pass-count">{results.summary.pass}</div>
                    <div className="text-xs text-muted-foreground">Passed</div>
                  </CardContent>
                </Card>
                <Card className="border-amber-200 dark:border-amber-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <AlertTriangle className="h-6 w-6 text-amber-500 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-amber-600 dark:text-amber-400" data-testid="text-warning-count">{results.summary.warning}</div>
                    <div className="text-xs text-muted-foreground">Warnings</div>
                  </CardContent>
                </Card>
                <Card className="border-red-200 dark:border-red-800">
                  <CardContent className="pt-4 pb-3 text-center">
                    <XCircle className="h-6 w-6 text-red-500 mx-auto mb-1" />
                    <div className="text-2xl font-bold text-red-600 dark:text-red-400" data-testid="text-fail-count">{results.summary.fail}</div>
                    <div className="text-xs text-muted-foreground">Failures</div>
                  </CardContent>
                </Card>
              </div>

              {results.categories.map((cat, ci) => (
                <Card key={ci}>
                  <CardHeader className="pb-2 bg-[#1F3A5F]/5 dark:bg-[#1F3A5F]/20 rounded-t-lg">
                    <CardTitle className="text-sm font-semibold text-[#1F3A5F] dark:text-blue-300" data-testid={`text-category-${ci}`}>{cat.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-3 space-y-1">
                    {cat.checks.map((check, ki) => {
                      const checkKey = `${ci}-${ki}`;
                      const isExpanded = expandedChecks.has(checkKey);
                      const hasDetails = check.details.length > 0 && check.status !== "pass";

                      return (
                        <div key={ki} className="border rounded-md" data-testid={`check-${ci}-${ki}`}>
                          <button
                            className="flex items-center w-full px-3 py-2.5 text-left hover:bg-accent/30 rounded-md transition-colors"
                            onClick={() => hasDetails && toggleExpand(checkKey)}
                            data-testid={`button-expand-${ci}-${ki}`}
                          >
                            {hasDetails ? (
                              isExpanded ? <ChevronDown className="h-4 w-4 mr-2 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 mr-2 text-muted-foreground shrink-0" />
                            ) : (
                              <span className="w-4 mr-2 shrink-0" />
                            )}
                            {statusIcon(check.status)}
                            <div className="ml-2 flex-1">
                              <span className="text-sm">{check.name}</span>
                              {check.description && <p className="text-xs text-muted-foreground mt-0.5">{check.description}</p>}
                            </div>
                            <span className="ml-2 shrink-0">{statusBadge(check.status)}</span>
                            {check.count > 0 && <Badge variant="secondary" className="ml-2 text-xs shrink-0">{check.count}</Badge>}
                          </button>

                          {isExpanded && hasDetails && (
                            <div className="px-3 pb-3 overflow-x-auto">
                              <table className="w-full text-xs border-collapse" data-testid={`table-details-${ci}-${ki}`}>
                                <thead>
                                  <tr className="border-b">
                                    {Object.keys(check.details[0]).map(key => (
                                      <th key={key} className="text-left py-1.5 px-2 font-medium text-muted-foreground capitalize">
                                        {key.replace(/([A-Z])/g, " $1")}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {check.details.map((row, ri) => (
                                    <tr key={ri} className="border-b last:border-0 hover:bg-accent/20">
                                      {Object.values(row).map((val, vi) => (
                                        <td key={vi} className="py-1.5 px-2">{String(val ?? "")}</td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              ))}

              <div className="text-xs text-muted-foreground text-center pt-2" data-testid="text-checked-at">
                Checked at: {new Date(results.checkedAt).toLocaleString("en-GB")}
              </div>
            </>
          )}

          {!results && !runMutation.isPending && (
            <Card>
              <CardContent className="flex items-center justify-center py-20">
                <div className="text-center text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Select suppliers and run the pre-audit check</p>
                  <p className="text-sm mt-1">Results will appear here with pass/fail status for each check</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
