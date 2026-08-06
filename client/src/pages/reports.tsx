import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, Users, Calendar, ShieldCheck, PoundSterling,
  TrendingUp, AlertTriangle, Building2, Clock, FileText, CheckCircle,
  Download, ArrowUpDown, ChevronUp, ChevronDown, MapPin, UserCheck,
} from "lucide-react";

interface ReportSummary {
  workforce: {
    totalEmployees: number;
    activeUsers: number;
    totalSites: number;
    activeSites: number;
  };
  scheduling: {
    totalShifts: number;
    completedShifts: number;
    scheduledShifts: number;
    noShows: number;
    totalHoursWorked: number;
  };
  compliance: {
    siaExpiringSoon: number;
    incidentsTotal: number;
    openIncidents: number;
    resolvedIncidents: number;
  };
  financial: {
    totalRevenue: string;
    outstandingAmount: string;
    totalInvoices: number;
    paidInvoices: number;
    activeSuppliers: number;
  };
}

interface SupplierBreakdown {
  supplier_id: number;
  supplier_name: string;
  total_shifts: number;
  employee_count: number;
  site_count: number;
  total_hours: string;
  total_amount: string;
}

interface SiteActivity {
  site_id: number;
  site_name: string;
  postcode: string | null;
  total_shifts: number;
  unique_employees: number;
  unique_suppliers: number;
  total_hours: string;
}

interface EmployeePerformance {
  employee_name: string;
  supplier_name: string | null;
  total_shifts: number;
  completed_shifts: number;
  no_shows: number;
  completion_rate: string;
  total_hours: string;
}

function MetricCard({
  label,
  value,
  icon: Icon,
  variant = "default",
  testId,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  testId: string;
}) {
  const variantStyles = {
    default: "text-muted-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-orange-500 dark:text-orange-400",
    danger: "text-red-600 dark:text-red-400",
  };

  const iconBgStyles = {
    default: "bg-muted",
    success: "bg-green-100 dark:bg-green-900/30",
    warning: "bg-orange-100 dark:bg-orange-900/30",
    danger: "bg-red-100 dark:bg-red-900/30",
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-md bg-muted/30" data-testid={testId}>
      <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${iconBgStyles[variant]}`}>
        <Icon className={`w-5 h-5 ${variantStyles[variant]}`} />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-lg font-bold" data-testid={`${testId}-value`}>{value}</p>
      </div>
    </div>
  );
}

function SectionSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-md bg-muted/30">
              <Skeleton className="w-10 h-10 rounded-md flex-shrink-0" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-12" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

type SortDir = "asc" | "desc";

function SortHeader({ label, active, dir, onClick, testId }: { label: string; active: boolean; dir: SortDir; onClick: () => void; testId: string }) {
  return (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground select-none whitespace-nowrap"
      onClick={onClick}
      data-testid={testId}
    >
      <span className="flex items-center gap-1">
        {label}
        {active ? (dir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </span>
    </th>
  );
}

function useSortable<T>(data: T[] | undefined, defaultKey: keyof T, defaultDir: SortDir = "desc") {
  const [sortKey, setSortKey] = useState<keyof T>(defaultKey);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const an = typeof av === "string" ? parseFloat(av) || 0 : (av as number);
      const bn = typeof bv === "string" ? parseFloat(bv) || 0 : (bv as number);
      if (typeof av === "string" && isNaN(parseFloat(av as string))) {
        return sortDir === "asc" ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
      }
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [data, sortKey, sortDir]);

  const toggle = (key: keyof T) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  return { sorted, sortKey, sortDir, toggle };
}

function exportCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers.join(","), ...rows.map(r => r.map(c => `"${(c ?? "").replace(/"/g, '""')}"`).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

type ReportTab = "supplier" | "site" | "employee";

function CustomReports() {
  const [tab, setTab] = useState<ReportTab>("supplier");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [supplierId, setSupplierId] = useState("all");

  const buildUrl = (base: string, extra?: Record<string, string>) => {
    const p = new URLSearchParams();
    if (startDate) p.set("startDate", startDate);
    if (endDate) p.set("endDate", endDate);
    if (extra) Object.entries(extra).forEach(([k, v]) => { if (v && v !== "all") p.set(k, v); });
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const supplierQuery = useQuery<SupplierBreakdown[]>({
    queryKey: [buildUrl("/api/reports/supplier-breakdown")],
  });

  const siteQuery = useQuery<SiteActivity[]>({
    queryKey: [buildUrl("/api/reports/site-activity", { supplierId: supplierId === "all" ? "" : supplierId })],
    enabled: tab === "site",
  });

  const empQuery = useQuery<EmployeePerformance[]>({
    queryKey: [buildUrl("/api/reports/employee-performance", { supplierId: supplierId === "all" ? "" : supplierId })],
    enabled: tab === "employee",
  });

  const supplierSort = useSortable<SupplierBreakdown>(supplierQuery.data, "total_shifts");
  const siteSort = useSortable<SiteActivity>(siteQuery.data, "total_shifts");
  const empSort = useSortable<EmployeePerformance>(empQuery.data, "total_shifts");

  const supplierList = supplierQuery.data?.filter(s => s.total_shifts > 0) || [];

  const tabs: { key: ReportTab; label: string; icon: React.ElementType }[] = [
    { key: "supplier", label: "Supplier Breakdown", icon: Building2 },
    { key: "site", label: "Site Activity", icon: MapPin },
    { key: "employee", label: "Employee Performance", icon: UserCheck },
  ];

  const isLoading = tab === "supplier" ? supplierQuery.isLoading : tab === "site" ? siteQuery.isLoading : empQuery.isLoading;

  const handleExport = () => {
    if (tab === "supplier") {
      exportCSV("supplier_breakdown.csv",
        ["Supplier", "Shifts", "Hours", "Amount (£)", "Employees", "Sites"],
        supplierSort.sorted.map(r => [r.supplier_name, String(r.total_shifts), r.total_hours, r.total_amount, String(r.employee_count), String(r.site_count)])
      );
    } else if (tab === "site") {
      exportCSV("site_activity.csv",
        ["Site", "Postcode", "Shifts", "Hours", "Employees", "Suppliers"],
        siteSort.sorted.map(r => [r.site_name, r.postcode || "", String(r.total_shifts), r.total_hours, String(r.unique_employees), String(r.unique_suppliers)])
      );
    } else {
      exportCSV("employee_performance.csv",
        ["Employee", "Supplier", "Shifts", "Completed", "No Shows", "Completion %", "Hours"],
        empSort.sorted.map(r => [r.employee_name, r.supplier_name || "", String(r.total_shifts), String(r.completed_shifts), String(r.no_shows), r.completion_rate, r.total_hours])
      );
    }
  };

  const fmt = (v: string) => parseFloat(v).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <Card data-testid="section-custom-reports">
      <CardHeader className="flex flex-col gap-4 space-y-0 pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold">Custom Reports</h2>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={isLoading} data-testid="button-export-csv">
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {tabs.map(t => (
            <Button
              key={t.key}
              variant={tab === t.key ? "default" : "outline"}
              size="sm"
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
            >
              <t.icon className="w-4 h-4 mr-1" /> {t.label}
            </Button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Start Date</Label>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-40 text-sm" data-testid="input-report-start-date" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">End Date</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-40 text-sm" data-testid="input-report-end-date" />
          </div>
          {(tab === "site" || tab === "employee") && (
            <div className="space-y-1">
              <Label className="text-xs">Supplier</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="w-48 text-sm" data-testid="select-report-supplier">
                  <SelectValue placeholder="All Suppliers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Suppliers</SelectItem>
                  {supplierList.map(s => (
                    <SelectItem key={s.supplier_id} value={String(s.supplier_id)}>{s.supplier_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {(startDate || endDate || supplierId !== "all") && (
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(""); setEndDate(""); setSupplierId("all"); }} data-testid="button-clear-filters">
              Clear
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : tab === "supplier" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-supplier-breakdown">
              <thead className="border-b">
                <tr>
                  <SortHeader label="Supplier" active={supplierSort.sortKey === "supplier_name"} dir={supplierSort.sortDir} onClick={() => supplierSort.toggle("supplier_name")} testId="sort-supplier-name" />
                  <SortHeader label="Shifts" active={supplierSort.sortKey === "total_shifts"} dir={supplierSort.sortDir} onClick={() => supplierSort.toggle("total_shifts")} testId="sort-supplier-shifts" />
                  <SortHeader label="Hours" active={supplierSort.sortKey === "total_hours"} dir={supplierSort.sortDir} onClick={() => supplierSort.toggle("total_hours")} testId="sort-supplier-hours" />
                  <SortHeader label="Amount (£)" active={supplierSort.sortKey === "total_amount"} dir={supplierSort.sortDir} onClick={() => supplierSort.toggle("total_amount")} testId="sort-supplier-amount" />
                  <SortHeader label="Employees" active={supplierSort.sortKey === "employee_count"} dir={supplierSort.sortDir} onClick={() => supplierSort.toggle("employee_count")} testId="sort-supplier-employees" />
                  <SortHeader label="Sites" active={supplierSort.sortKey === "site_count"} dir={supplierSort.sortDir} onClick={() => supplierSort.toggle("site_count")} testId="sort-supplier-sites" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {supplierSort.sorted.map(r => (
                  <tr key={r.supplier_id} className="hover:bg-muted/30" data-testid={`row-supplier-${r.supplier_id}`}>
                    <td className="px-3 py-2 font-medium">{r.supplier_name}</td>
                    <td className="px-3 py-2">{r.total_shifts.toLocaleString()}</td>
                    <td className="px-3 py-2">{fmt(r.total_hours)}</td>
                    <td className="px-3 py-2">£{fmt(r.total_amount)}</td>
                    <td className="px-3 py-2">{r.employee_count}</td>
                    <td className="px-3 py-2">{r.site_count}</td>
                  </tr>
                ))}
                {supplierSort.sorted.length > 0 && (
                  <tr className="font-bold bg-muted/50 border-t-2">
                    <td className="px-3 py-2">TOTAL</td>
                    <td className="px-3 py-2">{supplierSort.sorted.reduce((s, r) => s + r.total_shifts, 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{fmt(String(supplierSort.sorted.reduce((s, r) => s + parseFloat(r.total_hours), 0)))}</td>
                    <td className="px-3 py-2">£{fmt(String(supplierSort.sorted.reduce((s, r) => s + parseFloat(r.total_amount), 0)))}</td>
                    <td className="px-3 py-2">{supplierSort.sorted.reduce((s, r) => s + r.employee_count, 0)}</td>
                    <td className="px-3 py-2">{supplierSort.sorted.reduce((s, r) => s + r.site_count, 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {supplierSort.sorted.length === 0 && <p className="text-center text-muted-foreground py-8">No data for the selected period.</p>}
          </div>
        ) : tab === "site" ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-site-activity">
              <thead className="border-b">
                <tr>
                  <SortHeader label="Site" active={siteSort.sortKey === "site_name"} dir={siteSort.sortDir} onClick={() => siteSort.toggle("site_name")} testId="sort-site-name" />
                  <SortHeader label="Postcode" active={siteSort.sortKey === "postcode"} dir={siteSort.sortDir} onClick={() => siteSort.toggle("postcode")} testId="sort-site-postcode" />
                  <SortHeader label="Shifts" active={siteSort.sortKey === "total_shifts"} dir={siteSort.sortDir} onClick={() => siteSort.toggle("total_shifts")} testId="sort-site-shifts" />
                  <SortHeader label="Hours" active={siteSort.sortKey === "total_hours"} dir={siteSort.sortDir} onClick={() => siteSort.toggle("total_hours")} testId="sort-site-hours" />
                  <SortHeader label="Employees" active={siteSort.sortKey === "unique_employees"} dir={siteSort.sortDir} onClick={() => siteSort.toggle("unique_employees")} testId="sort-site-employees" />
                  <SortHeader label="Suppliers" active={siteSort.sortKey === "unique_suppliers"} dir={siteSort.sortDir} onClick={() => siteSort.toggle("unique_suppliers")} testId="sort-site-suppliers" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {siteSort.sorted.map(r => (
                  <tr key={r.site_id} className="hover:bg-muted/30" data-testid={`row-site-${r.site_id}`}>
                    <td className="px-3 py-2 font-medium max-w-[300px] truncate">{r.site_name}</td>
                    <td className="px-3 py-2">{r.postcode || "-"}</td>
                    <td className="px-3 py-2">{r.total_shifts.toLocaleString()}</td>
                    <td className="px-3 py-2">{fmt(r.total_hours)}</td>
                    <td className="px-3 py-2">{r.unique_employees}</td>
                    <td className="px-3 py-2">{r.unique_suppliers}</td>
                  </tr>
                ))}
                {siteSort.sorted.length > 0 && (
                  <tr className="font-bold bg-muted/50 border-t-2">
                    <td className="px-3 py-2">TOTAL ({siteSort.sorted.length} sites)</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">{siteSort.sorted.reduce((s, r) => s + r.total_shifts, 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{fmt(String(siteSort.sorted.reduce((s, r) => s + parseFloat(r.total_hours), 0)))}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                  </tr>
                )}
              </tbody>
            </table>
            {siteSort.sorted.length === 0 && <p className="text-center text-muted-foreground py-8">No data for the selected period.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="table-employee-performance">
              <thead className="border-b">
                <tr>
                  <SortHeader label="Employee" active={empSort.sortKey === "employee_name"} dir={empSort.sortDir} onClick={() => empSort.toggle("employee_name")} testId="sort-emp-name" />
                  <SortHeader label="Supplier" active={empSort.sortKey === "supplier_name"} dir={empSort.sortDir} onClick={() => empSort.toggle("supplier_name")} testId="sort-emp-supplier" />
                  <SortHeader label="Shifts" active={empSort.sortKey === "total_shifts"} dir={empSort.sortDir} onClick={() => empSort.toggle("total_shifts")} testId="sort-emp-shifts" />
                  <SortHeader label="Completed" active={empSort.sortKey === "completed_shifts"} dir={empSort.sortDir} onClick={() => empSort.toggle("completed_shifts")} testId="sort-emp-completed" />
                  <SortHeader label="No Shows" active={empSort.sortKey === "no_shows"} dir={empSort.sortDir} onClick={() => empSort.toggle("no_shows")} testId="sort-emp-noshows" />
                  <SortHeader label="Rate %" active={empSort.sortKey === "completion_rate"} dir={empSort.sortDir} onClick={() => empSort.toggle("completion_rate")} testId="sort-emp-rate" />
                  <SortHeader label="Hours" active={empSort.sortKey === "total_hours"} dir={empSort.sortDir} onClick={() => empSort.toggle("total_hours")} testId="sort-emp-hours" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {empSort.sorted.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30" data-testid={`row-employee-${i}`}>
                    <td className="px-3 py-2 font-medium">{r.employee_name}</td>
                    <td className="px-3 py-2 text-muted-foreground">{r.supplier_name || "-"}</td>
                    <td className="px-3 py-2">{r.total_shifts.toLocaleString()}</td>
                    <td className="px-3 py-2">{r.completed_shifts.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {r.no_shows > 0 ? <span className="text-red-600 dark:text-red-400 font-medium">{r.no_shows}</span> : "0"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={parseFloat(r.completion_rate) >= 95 ? "default" : parseFloat(r.completion_rate) >= 80 ? "secondary" : "destructive"} className="text-xs">
                        {r.completion_rate}%
                      </Badge>
                    </td>
                    <td className="px-3 py-2">{fmt(r.total_hours)}</td>
                  </tr>
                ))}
                {empSort.sorted.length > 0 && (
                  <tr className="font-bold bg-muted/50 border-t-2">
                    <td className="px-3 py-2">TOTAL ({empSort.sorted.length} employees)</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">{empSort.sorted.reduce((s, r) => s + r.total_shifts, 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{empSort.sorted.reduce((s, r) => s + r.completed_shifts, 0).toLocaleString()}</td>
                    <td className="px-3 py-2">{empSort.sorted.reduce((s, r) => s + r.no_shows, 0)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">{fmt(String(empSort.sorted.reduce((s, r) => s + parseFloat(r.total_hours), 0)))}</td>
                  </tr>
                )}
              </tbody>
            </table>
            {empSort.sorted.length === 0 && <p className="text-center text-muted-foreground py-8">No data for the selected period.</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const { data, isLoading } = useQuery<ReportSummary>({
    queryKey: ["/api/reports/summary"],
  });

  const completionRate = data?.scheduling
    ? data.scheduling.totalShifts > 0
      ? Math.round((data.scheduling.completedShifts / data.scheduling.totalShifts) * 100)
      : 0
    : 0;

  const formatCurrency = (val: string) => {
    const num = parseFloat(val);
    return `£${num.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="reports-page-loading">
        <div>
          <Skeleton className="h-7 w-56 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="reports-page">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-reports-title">
          <BarChart3 className="w-6 h-6" />
          Reports & Analytics
        </h1>
        <p className="text-muted-foreground">
          Comprehensive overview of platform performance and key metrics.
        </p>
      </div>

      <Card data-testid="section-workforce">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
          <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-semibold">Workforce Overview</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Total Employees" value={data?.workforce.totalEmployees ?? 0} icon={Users} variant="default" testId="metric-total-employees" />
            <MetricCard label="Active Users" value={data?.workforce.activeUsers ?? 0} icon={CheckCircle} variant="success" testId="metric-active-users" />
            <MetricCard label="Total Sites" value={data?.workforce.totalSites ?? 0} icon={Building2} variant="default" testId="metric-total-sites" />
            <MetricCard label="Active Sites" value={data?.workforce.activeSites ?? 0} icon={Building2} variant="success" testId="metric-active-sites" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-scheduling">
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-semibold">Scheduling Performance</h2>
          </div>
          <Badge variant="secondary" data-testid="badge-completion-rate">
            {completionRate}% completion
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard label="Total Shifts" value={data?.scheduling.totalShifts ?? 0} icon={Calendar} variant="default" testId="metric-total-shifts" />
            <MetricCard label="Completed" value={data?.scheduling.completedShifts ?? 0} icon={CheckCircle} variant="success" testId="metric-completed-shifts" />
            <MetricCard label="Scheduled" value={data?.scheduling.scheduledShifts ?? 0} icon={Clock} variant="default" testId="metric-scheduled-shifts" />
            <MetricCard label="No Shows" value={data?.scheduling.noShows ?? 0} icon={AlertTriangle} variant={(data?.scheduling.noShows ?? 0) > 0 ? "danger" : "default"} testId="metric-no-shows" />
            <MetricCard label="Total Hours Worked" value={data?.scheduling.totalHoursWorked ?? 0} icon={TrendingUp} variant="success" testId="metric-hours-worked" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-compliance">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-semibold">Compliance & Safety</h2>
          {((data?.compliance.openIncidents ?? 0) > 0 || (data?.compliance.siaExpiringSoon ?? 0) > 0) && (
            <Badge variant="destructive" data-testid="badge-compliance-alert">
              <AlertTriangle className="w-3 h-3 mr-1" />
              Attention Required
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="SIA Expiring (30 days)" value={data?.compliance.siaExpiringSoon ?? 0} icon={ShieldCheck} variant={(data?.compliance.siaExpiringSoon ?? 0) > 0 ? "warning" : "success"} testId="metric-sia-expiring" />
            <MetricCard label="Total Incidents" value={data?.compliance.incidentsTotal ?? 0} icon={FileText} variant="default" testId="metric-total-incidents" />
            <MetricCard label="Open Incidents" value={data?.compliance.openIncidents ?? 0} icon={AlertTriangle} variant={(data?.compliance.openIncidents ?? 0) > 0 ? "danger" : "success"} testId="metric-open-incidents" />
            <MetricCard label="Resolved Incidents" value={data?.compliance.resolvedIncidents ?? 0} icon={CheckCircle} variant="success" testId="metric-resolved-incidents" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="section-financial">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
          <PoundSterling className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <h2 className="text-base font-semibold">Financial Summary</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <MetricCard label="Total Revenue" value={formatCurrency(data?.financial.totalRevenue ?? "0")} icon={PoundSterling} variant="success" testId="metric-total-revenue" />
            <MetricCard label="Outstanding Amount" value={formatCurrency(data?.financial.outstandingAmount ?? "0")} icon={PoundSterling} variant={parseFloat(data?.financial.outstandingAmount ?? "0") > 0 ? "warning" : "default"} testId="metric-outstanding-amount" />
            <MetricCard label="Total Invoices" value={data?.financial.totalInvoices ?? 0} icon={FileText} variant="default" testId="metric-total-invoices" />
            <MetricCard label="Paid Invoices" value={data?.financial.paidInvoices ?? 0} icon={CheckCircle} variant="success" testId="metric-paid-invoices" />
            <MetricCard label="Active Suppliers" value={data?.financial.activeSuppliers ?? 0} icon={TrendingUp} variant="default" testId="metric-active-suppliers" />
          </div>
        </CardContent>
      </Card>

      <CustomReports />
    </div>
  );
}
