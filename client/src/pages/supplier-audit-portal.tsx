import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, FileText, Receipt, CheckCircle2, AlertTriangle, Clock, Filter, Loader2,
} from "lucide-react";

type AuditEvent = {
  id: number;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  summary: string;
  createdAt: string;
  metadata: any;
};

const EVENT_TYPE_CONFIG: Record<string, { label: string; className: string; icon: typeof Shield }> = {
  agreement: { label: "Agreement", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300 dark:border-green-700", icon: CheckCircle2 },
  invoice: { label: "Invoice", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:border-blue-700", icon: FileText },
  vat: { label: "VAT", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300 dark:border-orange-700", icon: Receipt },
  rate_card: { label: "Rate Card", className: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300 dark:border-purple-700", icon: FileText },
  dispute: { label: "Dispute", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300 dark:border-red-700", icon: AlertTriangle },
};

const TIMELINE_DOT_COLORS: Record<string, string> = {
  agreement: "bg-green-500",
  invoice: "bg-blue-500",
  vat: "bg-orange-500",
  rate_card: "bg-purple-500",
  dispute: "bg-red-500",
};

const EVENT_FILTER_OPTIONS = [
  { value: "all", label: "All Events" },
  { value: "agreement", label: "Agreement Events" },
  { value: "invoice", label: "Invoice Events" },
  { value: "vat", label: "VAT Events" },
  { value: "rate_card", label: "Rate Card Events" },
  { value: "dispute", label: "Dispute Events" },
];

function getEventTypeKey(eventType: string): string {
  const lower = eventType.toLowerCase();
  if (lower.includes("agreement")) return "agreement";
  if (lower.includes("invoice")) return "invoice";
  if (lower.includes("vat")) return "vat";
  if (lower.includes("rate") || lower.includes("card")) return "rate_card";
  if (lower.includes("dispute")) return "dispute";
  return "agreement";
}

function formatTimestamp(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, "0");
  const minutes = d.getMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

export default function SupplierAuditPortalPage() {
  const [eventTypeFilter, setEventTypeFilter] = useState("all");

  const { data: auditEvents = [], isLoading } = useQuery<AuditEvent[]>({
    queryKey: ["/api/supplier-portal/my-audit-trail"],
  });

  const filteredEvents = useMemo(() => {
    return auditEvents.filter((event) => {
      if (eventTypeFilter !== "all") {
        const key = getEventTypeKey(event.eventType);
        if (key !== eventTypeFilter) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [auditEvents, eventTypeFilter]);

  const totalEvents = auditEvents.length;
  const agreementCount = auditEvents.filter((e) => getEventTypeKey(e.eventType) === "agreement").length;
  const invoiceCount = auditEvents.filter((e) => getEventTypeKey(e.eventType) === "invoice").length;
  const vatCount = auditEvents.filter((e) => getEventTypeKey(e.eventType) === "vat").length;

  return (
    <div className="p-6 space-y-6" data-testid="supplier-audit-portal-page">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}
          >
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">My HMRC Audit Trail</h1>
            <p className="text-muted-foreground text-sm" data-testid="text-page-subtitle">Your complete self-billing transaction and compliance history</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={eventTypeFilter} onValueChange={setEventTypeFilter}>
            <SelectTrigger className="w-[180px]" data-testid="select-event-type-filter">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_FILTER_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="audit-summary-stats">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-total-events">{totalEvents}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-agreement-events">{agreementCount}</p>
                <p className="text-xs text-muted-foreground">Agreement Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-invoice-events">{invoiceCount}</p>
                <p className="text-xs text-muted-foreground">Invoice Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-vat-events">{vatCount}</p>
                <p className="text-xs text-muted-foreground">VAT Events</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading your audit trail...</span>
          </CardContent>
        </Card>
      ) : filteredEvents.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold" data-testid="text-empty-title">No audit events found</h3>
            <p className="text-sm text-muted-foreground" data-testid="text-empty-description">
              {eventTypeFilter !== "all"
                ? "Try adjusting your filter to see more events."
                : "Your audit trail will appear here as transactions and compliance actions occur."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="relative pl-6 space-y-0" data-testid="audit-timeline">
          <div className="absolute left-[11px] top-4 bottom-4 w-px bg-border" />
          {filteredEvents.map((event) => {
            const typeKey = getEventTypeKey(event.eventType);
            const config = EVENT_TYPE_CONFIG[typeKey] || EVENT_TYPE_CONFIG.agreement;
            const dotColor = TIMELINE_DOT_COLORS[typeKey] || "bg-gray-500";

            return (
              <div key={event.id} className="relative pb-4" data-testid={`timeline-event-${event.id}`}>
                <div className={`absolute -left-6 top-4 w-3 h-3 rounded-full ${dotColor} ring-2 ring-background z-10`} />
                <Card>
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={`no-default-hover-elevate no-default-active-elevate ${config.className}`}
                          data-testid={`badge-event-type-${event.id}`}
                        >
                          {config.label}
                        </Badge>
                        {event.entityType && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-entity-type-${event.id}`}>
                            {event.entityType}{event.entityId ? ` #${event.entityId}` : ""}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium" data-testid={`text-summary-${event.id}`}>
                        {event.summary}
                      </p>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span data-testid={`text-timestamp-${event.id}`}>
                          {formatTimestamp(event.createdAt)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
