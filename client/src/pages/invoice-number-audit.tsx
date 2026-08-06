import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowRight, FileText, Hash, Clock, Filter } from "lucide-react";

interface AuditEntry {
  id: number;
  invoiceId: number;
  oldNumber: string;
  newNumber: string;
  series: string;
  reason: string;
  changedAt: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimestamp(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export default function InvoiceNumberAuditPage() {
  const [seriesFilter, setSeriesFilter] = useState<string>("all");

  const { data, isLoading } = useQuery<{ entries: AuditEntry[]; totalCount: number }>({
    queryKey: ["/api/admin/invoice-number-audit-log", seriesFilter !== "all" ? seriesFilter : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (seriesFilter !== "all") params.set("series", seriesFilter);
      const res = await fetch(`/api/admin/invoice-number-audit-log?${params.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit log");
      return res.json();
    },
  });

  const entries = data?.entries || [];
  const changedEntries = entries.filter(e => e.oldNumber !== e.newNumber);
  const movedEntries = entries.filter(e => e.reason?.includes("Moved from"));

  return (
    <div className="p-6 space-y-6" data-testid="invoice-number-audit-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Invoice Number Audit Log</h1>
          <p className="text-muted-foreground mt-1">
            Track all invoice number changes from series migrations and renumbering operations
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Changes</p>
                <p className="text-2xl font-bold" data-testid="text-total-changes">{entries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900">
                <Hash className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Renumbered</p>
                <p className="text-2xl font-bold" data-testid="text-renumbered-count">{changedEntries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <ArrowRight className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Moved Between Series</p>
                <p className="text-2xl font-bold" data-testid="text-moved-count">{movedEntries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="font-semibold">Change History</span>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={seriesFilter} onValueChange={setSeriesFilter}>
                <SelectTrigger className="w-[160px]" data-testid="select-series-filter">
                  <SelectValue placeholder="All Series" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Series</SelectItem>
                  <SelectItem value="SBI-NV">SBI-NV (Non-VAT)</SelectItem>
                  <SelectItem value="SBI-GUA">SBI-GUA (VAT)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Loading audit entries...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <FileText className="h-10 w-10 mb-2 opacity-40" />
              <p>No invoice number changes recorded yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice ID</TableHead>
                    <TableHead>Old Number</TableHead>
                    <TableHead></TableHead>
                    <TableHead>New Number</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Series</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Changed At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id} data-testid={`row-audit-${entry.id}`}>
                      <TableCell className="font-mono text-sm" data-testid={`text-invoice-id-${entry.id}`}>
                        #{entry.invoiceId}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-1 rounded" data-testid={`text-old-number-${entry.id}`}>
                          {entry.oldNumber}
                        </code>
                      </TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded" data-testid={`text-new-number-${entry.id}`}>
                          {entry.newNumber}
                        </code>
                      </TableCell>
                      <TableCell className="text-sm" data-testid={`text-supplier-${entry.id}`}>
                        {entry.supplierName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-period-${entry.id}`}>
                        {formatDate(entry.periodStart)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs" data-testid={`badge-series-${entry.id}`}>
                          {entry.series}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={entry.reason} data-testid={`text-reason-${entry.id}`}>
                        {entry.reason}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap" data-testid={`text-changed-at-${entry.id}`}>
                        {formatTimestamp(entry.changedAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
