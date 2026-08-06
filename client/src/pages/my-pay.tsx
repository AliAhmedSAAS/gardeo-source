import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PoundSterling, Calendar, TrendingUp, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

type PayHistoryItem = {
  id: number;
  shiftId: number;
  payrollRunId: number;
  employeeId: number;
  hours: string;
  hourlyRate: string;
  grossAmount: string;
  deductions: string;
  netAmount: string;
  shiftDate: string | null;
  siteName: string;
  payrollRunCode: string | null;
  paidAt: string | null;
  createdAt: string;
};

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "\u00A30.00";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(num);
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMonthKey(dateStr: string | null): string {
  if (!dateStr) return "Unknown";
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(monthKey: string): string {
  if (monthKey === "Unknown") return "Unknown";
  const [year, month] = monthKey.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function MonthlyGroup({ monthKey, items }: { monthKey: string; items: PayHistoryItem[] }) {
  const [expanded, setExpanded] = useState(false);
  const total = items.reduce((sum, item) => sum + parseFloat(item.grossAmount || "0"), 0);
  const totalHours = items.reduce((sum, item) => sum + parseFloat(item.hours || "0"), 0);
  const totalDeductions = items.reduce((sum, item) => sum + parseFloat(item.deductions || "0"), 0);
  const totalNet = items.reduce((sum, item) => sum + parseFloat(item.netAmount || "0"), 0);

  return (
    <div className="border rounded-lg overflow-hidden" data-testid={`group-month-${monthKey}`}>
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
        data-testid={`button-expand-month-${monthKey}`}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          <span className="font-medium">{getMonthLabel(monthKey)}</span>
          <Badge variant="secondary" className="text-xs">{items.length} shift{items.length !== 1 ? "s" : ""}</Badge>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <span className="text-muted-foreground hidden sm:inline">{totalHours.toFixed(1)} hrs</span>
          <span className="font-semibold text-green-700 dark:text-green-400" data-testid={`text-month-total-${monthKey}`}>{formatCurrency(total)}</span>
        </div>
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shift Date</TableHead>
                <TableHead>Site</TableHead>
                <TableHead className="text-right">Hours</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Deductions</TableHead>
                <TableHead className="text-right hidden sm:table-cell">Net</TableHead>
                <TableHead>Payroll Ref</TableHead>
                <TableHead>Paid Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} data-testid={`row-pay-${item.id}`}>
                  <TableCell data-testid={`text-shift-date-${item.id}`}>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      {formatDate(item.shiftDate)}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-site-name-${item.id}`}>{item.siteName}</TableCell>
                  <TableCell className="text-right" data-testid={`text-hours-${item.id}`}>
                    {parseFloat(item.hours || "0").toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right" data-testid={`text-rate-${item.id}`}>
                    {formatCurrency(item.hourlyRate)}
                  </TableCell>
                  <TableCell className="text-right font-medium" data-testid={`text-gross-${item.id}`}>
                    {formatCurrency(item.grossAmount)}
                  </TableCell>
                  <TableCell className="text-right text-red-600 hidden sm:table-cell" data-testid={`text-deductions-${item.id}`}>
                    {parseFloat(item.deductions || "0") > 0 ? `-${formatCurrency(item.deductions)}` : "-"}
                  </TableCell>
                  <TableCell className="text-right font-semibold hidden sm:table-cell" data-testid={`text-net-${item.id}`}>
                    {formatCurrency(item.netAmount)}
                  </TableCell>
                  <TableCell data-testid={`text-payroll-ref-${item.id}`}>
                    {item.payrollRunCode ? (
                      <Badge variant="outline" className="text-xs">{item.payrollRunCode}</Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell data-testid={`text-paid-date-${item.id}`}>
                    {formatDate(item.paidAt)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/20 font-semibold">
                <TableCell colSpan={2} className="text-sm">Month Total</TableCell>
                <TableCell className="text-right text-sm">{totalHours.toFixed(1)}</TableCell>
                <TableCell />
                <TableCell className="text-right text-sm">{formatCurrency(total)}</TableCell>
                <TableCell className="text-right text-sm text-red-600 hidden sm:table-cell">{totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : "-"}</TableCell>
                <TableCell className="text-right text-sm hidden sm:table-cell">{formatCurrency(totalNet)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export default function MyPayPage() {
  const { data: payHistory = [], isLoading } = useQuery<PayHistoryItem[]>({
    queryKey: ["/api/payroll/employee-history"],
  });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthItems = payHistory.filter((item) => {
    const paidDate = item.paidAt ? new Date(item.paidAt) : null;
    if (!paidDate) return false;
    return paidDate.getMonth() === currentMonth && paidDate.getFullYear() === currentYear;
  });

  const thisYearItems = payHistory.filter((item) => {
    const paidDate = item.paidAt ? new Date(item.paidAt) : null;
    if (!paidDate) return false;
    return paidDate.getFullYear() === currentYear;
  });

  const totalThisMonth = thisMonthItems.reduce((sum, item) => sum + parseFloat(item.grossAmount || "0"), 0);
  const totalThisYear = thisYearItems.reduce((sum, item) => sum + parseFloat(item.grossAmount || "0"), 0);
  const totalYTDNet = thisYearItems.reduce((sum, item) => sum + parseFloat(item.netAmount || "0"), 0);
  const totalYTDHours = thisYearItems.reduce((sum, item) => sum + parseFloat(item.hours || "0"), 0);

  const monthlyGroups: Record<string, PayHistoryItem[]> = {};
  for (const item of payHistory) {
    const key = getMonthKey(item.paidAt);
    if (!monthlyGroups[key]) monthlyGroups[key] = [];
    monthlyGroups[key].push(item);
  }
  const sortedMonthKeys = Object.keys(monthlyGroups).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6" data-testid="my-pay-page">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold" data-testid="text-page-title">My Pay</h1>
        <p className="text-muted-foreground text-sm">View your pay history and earnings.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-lg"
          data-testid="card-total-this-month"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white/80">Earned This Month</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalThisMonth)}</p>
              <p className="text-xs text-white/60 mt-1">{thisMonthItems.length} paid shift{thisMonthItems.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <PoundSterling className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-[#1F3A5F] to-[#2a5a8f] text-white shadow-lg"
          data-testid="card-total-this-year"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white/80">Gross YTD</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalThisYear)}</p>
              <p className="text-xs text-white/60 mt-1">{thisYearItems.length} paid shift{thisYearItems.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-lg"
          data-testid="card-net-this-year"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white/80">Net YTD</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(totalYTDNet)}</p>
              <p className="text-xs text-white/60 mt-1">After deductions</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <PoundSterling className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div
          className="relative overflow-hidden rounded-xl p-5 bg-gradient-to-br from-slate-600 to-slate-800 text-white shadow-lg"
          data-testid="card-hours-this-year"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-white/80">Hours YTD</p>
              <p className="text-2xl font-bold mt-1">{totalYTDHours.toFixed(1)}</p>
              <p className="text-xs text-white/60 mt-1">Total hours worked</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : payHistory.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <PoundSterling className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No pay records yet</h3>
            <p className="text-sm text-muted-foreground">Your pay history will appear here once shifts have been processed through payroll.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="w-5 h-5" /> Pay History by Month
          </h2>
          {sortedMonthKeys.map((monthKey) => (
            <MonthlyGroup key={monthKey} monthKey={monthKey} items={monthlyGroups[monthKey]} />
          ))}
        </div>
      )}
    </div>
  );
}
