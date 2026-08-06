import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText, Search, Clock, Filter, Activity,
  ChevronDown, ChevronUp, Users, Hash,
} from "lucide-react";
import type { AuditLog } from "@shared/schema";

const ENTITY_TYPES = [
  "user", "employee", "supplier", "invoice",
  "vetting_record", "job_posting", "shift", "incident", "site",
] as const;

const ENTITY_BADGE_COLORS: Record<string, string> = {
  user: "bg-blue-500 border-blue-500",
  employee: "bg-green-500 border-green-500",
  supplier: "bg-purple-500 border-purple-500",
  invoice: "bg-orange-500 border-orange-500",
  vetting_record: "bg-yellow-500 border-yellow-500 text-black",
  job_posting: "bg-teal-500 border-teal-500",
  shift: "bg-indigo-500 border-indigo-500",
  incident: "bg-red-500 border-red-500",
  site: "bg-gray-500 border-gray-500",
};

const ITEMS_PER_PAGE = 20;

function formatSnakeCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year}, ${hours}:${minutes}`;
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function DetailsView({ details }: { details: unknown }) {
  if (!details || typeof details !== "object") {
    return <span className="text-muted-foreground text-xs">No details</span>;
  }
  const entries = Object.entries(details as Record<string, unknown>);
  if (entries.length === 0) {
    return <span className="text-muted-foreground text-xs">No details</span>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-start gap-2 text-xs">
          <span className="font-medium text-muted-foreground min-w-[100px]">{formatSnakeCase(key)}:</span>
          <span className="break-all">
            {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AuditTrailPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);

  const { data: logs = [], isLoading } = useQuery<AuditLog[]>({
    queryKey: ["/api/admin/audit-logs"],
  });

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (searchTerm && !log.action.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      if (entityTypeFilter !== "all" && log.entityType !== entityTypeFilter) {
        return false;
      }
      if (actionFilter && !log.action.toLowerCase().includes(actionFilter.toLowerCase())) {
        return false;
      }
      if (dateFrom) {
        const logDate = new Date(log.createdAt!).toISOString().slice(0, 10);
        if (logDate < dateFrom) return false;
      }
      if (dateTo) {
        const logDate = new Date(log.createdAt!).toISOString().slice(0, 10);
        if (logDate > dateTo) return false;
      }
      return true;
    });
  }, [logs, searchTerm, entityTypeFilter, actionFilter, dateFrom, dateTo]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const stats = useMemo(() => {
    const uniqueUsers = new Set(logs.map((l) => l.userId).filter(Boolean));
    const uniqueEntityTypes = new Set(logs.map((l) => l.entityType));
    const todayCount = logs.filter((l) => l.createdAt && isToday(String(l.createdAt))).length;
    return {
      total: logs.length,
      today: todayCount,
      uniqueUsers: uniqueUsers.size,
      entityTypes: uniqueEntityTypes.size,
    };
  }, [logs]);

  const toggleExpanded = (id: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const statCards = [
    { label: "Total Actions", value: stats.total, icon: FileText, testId: "text-total-actions" },
    { label: "Today's Actions", value: stats.today, icon: Clock, testId: "text-today-actions" },
    { label: "Unique Users", value: stats.uniqueUsers, icon: Users, testId: "text-unique-users" },
    { label: "Entity Types Tracked", value: stats.entityTypes, icon: Activity, testId: "text-entity-types" },
  ];

  return (
    <div className="p-6 space-y-6" data-testid="audit-trail-page">
      <div>
        <h1 className="text-2xl font-bold">Audit Trail</h1>
        <p className="text-muted-foreground text-sm">Comprehensive log of all system actions and changes.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="p-4 text-center">
                <Icon className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                <div className="text-2xl font-bold" data-testid={card.testId}>{card.value}</div>
                <div className="text-xs text-muted-foreground">{card.label}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 flex-wrap pb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                data-testid="input-search-audit"
                placeholder="Search by action..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
                className="pl-9"
              />
            </div>
            <div className="min-w-[180px]">
              <Input
                data-testid="input-action-filter"
                placeholder="Filter by action type..."
                value={actionFilter}
                onChange={(e) => { setActionFilter(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
              />
            </div>
            <div className="min-w-[180px]">
              <Select
                value={entityTypeFilter}
                onValueChange={(val) => { setEntityTypeFilter(val); setVisibleCount(ITEMS_PER_PAGE); }}
              >
                <SelectTrigger data-testid="select-entity-type">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entity Types</SelectItem>
                  {ENTITY_TYPES.map((et) => (
                    <SelectItem key={et} value={et}>{formatSnakeCase(et)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">From:</span>
              <Input
                data-testid="input-date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
                className="w-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">To:</span>
              <Input
                data-testid="input-date-to"
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setVisibleCount(ITEMS_PER_PAGE); }}
                className="w-auto"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No audit logs found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm || actionFilter || entityTypeFilter !== "all" || dateFrom || dateTo
                ? "Try adjusting your filters."
                : "Audit log entries will appear here as actions are performed."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {visible.map((log) => {
            const isExpanded = expandedRows.has(log.id);
            const badgeColor = ENTITY_BADGE_COLORS[log.entityType] || "bg-gray-500 border-gray-500";
            return (
              <Card key={log.id} data-testid={`card-audit-${log.id}`}>
                <CardContent className="p-4">
                  <div className="flex flex-wrap items-start gap-3 justify-between">
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium" data-testid={`text-action-${log.id}`}>
                          {formatSnakeCase(log.action)}
                        </span>
                        <Badge
                          variant="default"
                          className={badgeColor}
                          data-testid={`badge-entity-type-${log.id}`}
                        >
                          {formatSnakeCase(log.entityType)}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span data-testid={`text-timestamp-${log.id}`}>
                            {log.createdAt ? formatTimestamp(String(log.createdAt)) : "—"}
                          </span>
                        </span>
                        {log.entityId && (
                          <span className="flex items-center gap-1">
                            <Hash className="w-3 h-3" />
                            <span data-testid={`text-entity-id-${log.id}`}>Entity: {log.entityId}</span>
                          </span>
                        )}
                        {log.userId && (
                          <span data-testid={`text-user-id-${log.id}`}>User: {log.userId}</span>
                        )}
                        {log.ipAddress && (
                          <span>IP: {log.ipAddress}</span>
                        )}
                      </div>
                    </div>
                    {log.details && (
                      <Button
                        size="icon"
                        variant="ghost"
                        data-testid={`button-expand-${log.id}`}
                        onClick={() => toggleExpanded(log.id)}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    )}
                  </div>
                  {isExpanded && log.details && (
                    <div className="mt-3 pt-3 border-t" data-testid={`details-${log.id}`}>
                      <DetailsView details={log.details} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {hasMore && (
            <div className="text-center pt-2">
              <Button
                variant="outline"
                data-testid="button-load-more"
                onClick={() => setVisibleCount((prev) => prev + ITEMS_PER_PAGE)}
              >
                Load More ({filtered.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
