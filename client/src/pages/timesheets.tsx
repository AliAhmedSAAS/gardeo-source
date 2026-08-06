import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Clock, Download, FileSpreadsheet, Search, ChevronLeft, ChevronRight,
  MapPin, ExternalLink, Copy, CalendarDays,
} from "lucide-react";

type TimesheetRow = {
  id: number;
  date: string;
  siteName: string;
  sitePostcode: string;
  officerName: string;
  startTime: string;
  endTime: string;
  bookedOnAt: string | null;
  bookedOffAt: string | null;
  hoursWorked: number | null;
  lateMinutes: number;
  lat: string | null;
  lng: string | null;
  checkInAddress: string | null;
  breakMinutes: number;
};

type TimesheetResponse = {
  timesheets: TimesheetRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split("T")[0],
    end: sunday.toISOString().split("T")[0],
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function formatTime(timeStr: string | null): string {
  if (!timeStr) return "—";
  if (timeStr.length >= 5) return timeStr.substring(0, 5);
  return timeStr;
}

function formatTimestamp(ts: string | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function LateBadge({ minutes }: { minutes: number }) {
  if (minutes === 0) {
    return <Badge data-testid="badge-late-ontime" variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 text-xs">On Time</Badge>;
  }
  if (minutes <= 5) {
    return <Badge data-testid="badge-late-amber" variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800 text-xs">{minutes}m late</Badge>;
  }
  return <Badge data-testid="badge-late-red" variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 text-xs">{minutes}m late</Badge>;
}

export default function TimesheetsPage() {
  const { toast } = useToast();
  const weekRange = getWeekRange();
  const [startDate, setStartDate] = useState(weekRange.start);
  const [endDate, setEndDate] = useState(weekRange.end);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const queryParams = new URLSearchParams();
  queryParams.set("page", String(page));
  queryParams.set("limit", String(limit));
  if (startDate) queryParams.set("startDate", startDate);
  if (endDate) queryParams.set("endDate", endDate);
  if (search) queryParams.set("search", search);

  const { data, isLoading, isFetching } = useQuery<TimesheetResponse>({
    queryKey: ["/api/admin/timesheets", page, limit, startDate, endDate, search],
    queryFn: async () => {
      const res = await fetch(`/api/admin/timesheets?${queryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch timesheets");
      return res.json();
    },
  });

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
  };

  const handleExportCSV = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search) params.set("search", search);
    window.open(`/api/admin/timesheets/export-csv?${params.toString()}`, "_blank");
  };

  const handleExportPDF = () => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (search) params.set("search", search);
    window.open(`/api/admin/timesheets/export-pdf?${params.toString()}`, "_blank");
  };

  const copyCoords = (lat: string, lng: string) => {
    navigator.clipboard.writeText(`${lat}, ${lng}`);
    toast({ title: "Copied", description: "Coordinates copied to clipboard" });
  };

  const totalPages = data?.totalPages || 1;

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto" data-testid="page-timesheets">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">Timesheets</h1>
          <p className="text-muted-foreground text-sm mt-1">View completed shift records with book-on/off times and GPS coordinates</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV} data-testid="button-export-csv">
            <FileSpreadsheet className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} data-testid="button-export-pdf">
            <Download className="h-4 w-4 mr-1" /> Export PDF
          </Button>
        </div>
      </div>

      <Card data-testid="card-filters">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Start Date</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="w-[160px]"
                data-testid="input-start-date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">End Date</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="w-[160px]"
                data-testid="input-end-date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Search (site or officer)</label>
              <div className="flex gap-1">
                <Input
                  placeholder="Search..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-[200px]"
                  data-testid="input-search"
                />
                <Button size="sm" variant="secondary" onClick={handleSearch} data-testid="button-search">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Per page</label>
              <Select value={String(limit)} onValueChange={(v) => { setLimit(parseInt(v)); setPage(1); }}>
                <SelectTrigger className="w-[90px]" data-testid="select-page-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 ml-auto text-sm text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span data-testid="text-total-records">{data?.total?.toLocaleString() || 0} records</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-timesheets-table">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[90px]">Date</TableHead>
                    <TableHead className="min-w-[180px]">Site Name</TableHead>
                    <TableHead className="min-w-[140px]">Officer</TableHead>
                    <TableHead className="w-[70px] text-center">Start</TableHead>
                    <TableHead className="w-[70px] text-center">End</TableHead>
                    <TableHead className="w-[100px] text-center">Book-On</TableHead>
                    <TableHead className="w-[100px] text-center">Book-Off</TableHead>
                    <TableHead className="w-[70px] text-right">Hours</TableHead>
                    <TableHead className="w-[90px] text-center">Late</TableHead>
                    <TableHead className="min-w-[160px]">Coordinates</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.timesheets.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        No timesheet records found for the selected period
                      </TableCell>
                    </TableRow>
                  )}
                  {data?.timesheets.map((row) => (
                    <TableRow key={row.id} data-testid={`row-timesheet-${row.id}`} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs" data-testid={`text-date-${row.id}`}>
                        {formatDate(row.date)}
                      </TableCell>
                      <TableCell data-testid={`text-site-${row.id}`}>
                        <div className="font-medium text-sm truncate max-w-[220px]" title={row.siteName}>{row.siteName}</div>
                        {row.sitePostcode && (
                          <span className="text-xs text-muted-foreground">{row.sitePostcode}</span>
                        )}
                      </TableCell>
                      <TableCell data-testid={`text-officer-${row.id}`}>
                        <span className="text-sm">{row.officerName}</span>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs" data-testid={`text-start-${row.id}`}>
                        {formatTime(row.startTime)}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs" data-testid={`text-end-${row.id}`}>
                        {formatTime(row.endTime)}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs" data-testid={`text-bookon-${row.id}`}>
                        {formatTimestamp(row.bookedOnAt)}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs" data-testid={`text-bookoff-${row.id}`}>
                        {formatTimestamp(row.bookedOffAt)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium" data-testid={`text-hours-${row.id}`}>
                        {row.hoursWorked !== null ? row.hoursWorked.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className="text-center" data-testid={`text-late-${row.id}`}>
                        <LateBadge minutes={row.lateMinutes} />
                      </TableCell>
                      <TableCell data-testid={`text-coords-${row.id}`}>
                        {row.lat && row.lng ? (
                          <div className="flex items-center gap-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              {parseFloat(row.lat).toFixed(4)}, {parseFloat(row.lng).toFixed(4)}
                            </span>
                            <button
                              onClick={() => copyCoords(row.lat!, row.lng!)}
                              className="p-0.5 rounded hover:bg-muted"
                              title="Copy coordinates"
                              data-testid={`button-copy-coords-${row.id}`}
                            >
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            </button>
                            <a
                              href={`https://www.google.com/maps?q=${row.lat},${row.lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-0.5 rounded hover:bg-muted"
                              title="View on Google Maps"
                              data-testid={`link-maps-${row.id}`}
                            >
                              <ExternalLink className="h-3 w-3 text-muted-foreground" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between" data-testid="pagination-controls">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({data?.total?.toLocaleString()} total)
          </p>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let p: number;
              if (totalPages <= 5) {
                p = i + 1;
              } else if (page <= 3) {
                p = i + 1;
              } else if (page >= totalPages - 2) {
                p = totalPages - 4 + i;
              } else {
                p = page - 2 + i;
              }
              return (
                <Button
                  key={p}
                  variant={p === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPage(p)}
                  data-testid={`button-page-${p}`}
                  className="w-9"
                >
                  {p}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              data-testid="button-next-page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
