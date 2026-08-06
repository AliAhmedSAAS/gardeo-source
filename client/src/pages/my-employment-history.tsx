import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase, Building2, Calendar, CheckCircle2, Clock,
  XCircle, HelpCircle, Users,
} from "lucide-react";

type EmploymentRecord = {
  id: number;
  employerName: string;
  jobTitle: string;
  dateFrom: string;
  dateTo: string | null;
  isCurrent: boolean | null;
  reasonForLeaving: string | null;
  duties: string | null;
};

type ReferenceRecord = {
  id: number;
  refereeName: string;
  company: string;
  jobTitle: string | null;
  relationship: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  status: string | null;
  responseReceived: boolean | null;
  verificationStatus: string | null;
};

type HistoryData = {
  employmentHistory: EmploymentRecord[];
  references: ReferenceRecord[];
};

function ReferenceStatusBadge({ status, responseReceived, verificationStatus }: { status: string | null; responseReceived: boolean | null; verificationStatus: string | null }) {
  if (verificationStatus === "verified" || status === "passed" || responseReceived) {
    return (
      <Badge className="bg-green-600 border-green-600 text-white" data-testid="badge-ref-verified">
        <CheckCircle2 className="w-3 h-3 mr-1" /> Verified
      </Badge>
    );
  }
  if (verificationStatus === "failed" || status === "failed") {
    return (
      <Badge variant="destructive" data-testid="badge-ref-failed">
        <XCircle className="w-3 h-3 mr-1" /> Failed
      </Badge>
    );
  }
  if (verificationStatus === "pending" || status === "in_progress" || status === "pending") {
    return (
      <Badge className="bg-amber-500 border-amber-500 text-white" data-testid="badge-ref-pending">
        <Clock className="w-3 h-3 mr-1" /> Pending
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" data-testid="badge-ref-not-started">
      <HelpCircle className="w-3 h-3 mr-1" /> Not Started
    </Badge>
  );
}

function formatDateRange(from: string, to: string | null, isCurrent: boolean | null): string {
  const fromDate = new Date(from).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  if (isCurrent || !to) return `${fromDate} — Present`;
  const toDate = new Date(to).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  return `${fromDate} — ${toDate}`;
}

function calculateDuration(from: string, to: string | null): string {
  const start = new Date(from);
  const end = to ? new Date(to) : new Date();
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months < 1) return "Less than a month";
  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} year${years > 1 ? "s" : ""}`);
  if (remainingMonths > 0) parts.push(`${remainingMonths} month${remainingMonths > 1 ? "s" : ""}`);
  return parts.join(", ");
}

export default function MyEmploymentHistoryPage() {
  const { data, isLoading } = useQuery<HistoryData>({
    queryKey: ["/api/employee/employment-history"],
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const history = data?.employmentHistory ?? [];
  const references = data?.references ?? [];

  const sortedHistory = [...history].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return new Date(b.dateFrom).getTime() - new Date(a.dateFrom).getTime();
  });

  return (
    <div className="p-4 pb-20 space-y-5 max-w-2xl mx-auto" data-testid="my-employment-history-page">
      <div>
        <h1 className="text-2xl font-bold">Employment History</h1>
        <p className="text-muted-foreground text-sm">Your previous employment and reference verification status.</p>
      </div>

      <Card data-testid="card-employment-history">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Briefcase className="w-5 h-5 text-primary" />
          <span className="font-semibold">Previous Employment</span>
          {history.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{history.length} record{history.length !== 1 ? "s" : ""}</Badge>
          )}
        </CardHeader>
        <CardContent>
          {sortedHistory.length === 0 ? (
            <div className="text-center py-6">
              <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No employment history recorded.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedHistory.map((record, index) => (
                <div
                  key={record.id}
                  className={`relative pl-6 pb-4 ${index < sortedHistory.length - 1 ? "border-l-2 border-muted ml-2" : "ml-2"}`}
                  data-testid={`card-employment-${record.id}`}
                >
                  <div className="absolute -left-[5px] top-1 w-3 h-3 rounded-full border-2 border-primary bg-background" />
                  <div className="p-3 rounded-lg border">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-medium text-sm" data-testid={`text-job-title-${record.id}`}>
                          {record.jobTitle}
                        </h3>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                          <Building2 className="w-3.5 h-3.5" />
                          <span data-testid={`text-employer-${record.id}`}>{record.employerName}</span>
                        </div>
                      </div>
                      {record.isCurrent && (
                        <Badge className="bg-green-600 border-green-600 text-white shrink-0" data-testid={`badge-current-${record.id}`}>
                          Current
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatDateRange(record.dateFrom, record.dateTo, record.isCurrent)}</span>
                      <span className="text-muted-foreground/60">·</span>
                      <span>{calculateDuration(record.dateFrom, record.dateTo)}</span>
                    </div>
                    {record.duties && (
                      <p className="text-xs text-muted-foreground mt-2">{record.duties}</p>
                    )}
                    {record.reasonForLeaving && (
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-medium">Reason for leaving:</span> {record.reasonForLeaving}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-references">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Users className="w-5 h-5 text-primary" />
          <span className="font-semibold">References</span>
          {references.length > 0 && (
            <Badge variant="secondary" className="ml-auto">{references.length} reference{references.length !== 1 ? "s" : ""}</Badge>
          )}
        </CardHeader>
        <CardContent>
          {references.length === 0 ? (
            <div className="text-center py-6">
              <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No references on file.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {references.map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-start justify-between gap-3 p-3 rounded-lg border"
                  data-testid={`card-reference-${ref.id}`}
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-medium text-sm" data-testid={`text-referee-name-${ref.id}`}>
                      {ref.refereeName}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{ref.company}</span>
                      {ref.jobTitle && <span>· {ref.jobTitle}</span>}
                    </div>
                    {ref.relationship && (
                      <p className="text-xs text-muted-foreground capitalize">{ref.relationship}</p>
                    )}
                    {ref.dateFrom && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(ref.dateFrom).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                        {ref.dateTo && ` — ${new Date(ref.dateTo).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0">
                    <ReferenceStatusBadge status={ref.status} responseReceived={ref.responseReceived} verificationStatus={ref.verificationStatus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
