import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck, FileCheck, Heart, AlertTriangle, Clock,
  Globe, FileText, CheckCircle2, XCircle, GraduationCap, ExternalLink,
} from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

type ImmigrationDoc = {
  id: number;
  documentType: string;
  fileName: string;
  fileUrl: string;
  expiryDate: string | null;
  isVerified: boolean | null;
  notes: string | null;
  createdAt: string | null;
};

type ImmigrationRecord = {
  passportDocNo: string | null;
  passportCountry: string | null;
  passportIssueDate: string | null;
  passportExpiryDate: string | null;
  visaNeeded: boolean | null;
  visaType: string | null;
  visaIssueDate: string | null;
  visaExpiryDate: string | null;
  visaDateOfEntry: string | null;
  shareCode: string | null;
  shareCodeExpiry: string | null;
  brpNeeded: boolean | null;
  brpNumber: string | null;
  brpExpiry: string | null;
};

type TrainingRecord = {
  id: number;
  trainingType: string;
  trainingName: string;
  provider: string | null;
  completedDate: string | null;
  expiryDate: string | null;
  certificateUrl: string | null;
  status: string;
  notes: string | null;
};

type ComplianceData = {
  siaLicenseNumber: string | null;
  siaLicenseType: string | null;
  siaExpiryDate: string | null;
  dbsCertificateNumber: string | null;
  dbsIssueDate: string | null;
  hasFirstAid: boolean | null;
  firstAidExpiry: string | null;
  immigration: ImmigrationRecord | null;
  immigrationDocuments: ImmigrationDoc[];
};

function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ expiryDate, label }: { expiryDate: string | null; label?: string }) {
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) {
    return <Badge variant="secondary" data-testid="badge-no-expiry">No expiry set</Badge>;
  }
  if (days < 0) {
    return (
      <Badge variant="destructive" data-testid="badge-expired">
        <XCircle className="w-3 h-3 mr-1" />
        Expired {Math.abs(days)}d ago
      </Badge>
    );
  }
  if (days < 30) {
    return (
      <Badge className="bg-red-500 border-red-500 text-white" data-testid="badge-expiry-critical">
        <AlertTriangle className="w-3 h-3 mr-1" />
        {days}d remaining
      </Badge>
    );
  }
  if (days <= 90) {
    return (
      <Badge className="bg-amber-500 border-amber-500 text-white" data-testid="badge-expiry-warning">
        <Clock className="w-3 h-3 mr-1" />
        {days}d remaining
      </Badge>
    );
  }
  return (
    <Badge className="bg-green-600 border-green-600 text-white" data-testid="badge-expiry-ok">
      <CheckCircle2 className="w-3 h-3 mr-1" />
      {days}d remaining
    </Badge>
  );
}

function formatDocType(type: string): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getTrainingBadge(record: TrainingRecord) {
  const days = record.expiryDate
    ? Math.ceil((new Date(record.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  if (record.status === "not_started") return <Badge variant="secondary" className="text-xs">Not Started</Badge>;
  if (record.status === "in_progress") return <Badge className="bg-blue-500 border-blue-500 text-white text-xs">In Progress</Badge>;
  if (record.status === "expired" || (days !== null && days < 0)) {
    return <Badge variant="destructive" className="text-xs">Expired</Badge>;
  }
  if (days !== null && days <= 30) return <Badge className="bg-red-500 border-red-500 text-white text-xs"><AlertTriangle className="w-3 h-3 mr-1" />{days}d left</Badge>;
  if (days !== null && days <= 90) return <Badge className="bg-amber-500 border-amber-500 text-white text-xs"><Clock className="w-3 h-3 mr-1" />{days}d left</Badge>;
  if (record.status === "completed") return <Badge className="bg-green-600 border-green-600 text-white text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
  return <Badge variant="secondary" className="text-xs">{record.status}</Badge>;
}

export default function MyCompliancePage() {
  const { data: compliance, isLoading } = useQuery<ComplianceData>({
    queryKey: ["/api/employee/compliance"],
  });

  const { data: trainingRecords = [] } = useQuery<TrainingRecord[]>({
    queryKey: ["/api/employee/training"],
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const siaExpDays = getDaysUntilExpiry(compliance?.siaExpiryDate ?? null);
  const firstAidDays = getDaysUntilExpiry(compliance?.firstAidExpiry ?? null);

  const imm = compliance?.immigration;

  const criticalItems: string[] = [];
  if (siaExpDays !== null && siaExpDays < 30) criticalItems.push("SIA Licence");
  if (firstAidDays !== null && firstAidDays < 30) criticalItems.push("First Aid");
  if (imm?.visaNeeded) {
    const d = getDaysUntilExpiry(imm.visaExpiryDate ?? null);
    if (d !== null && d < 30) criticalItems.push("Visa");
  }
  if (imm?.brpNeeded) {
    const d = getDaysUntilExpiry(imm.brpExpiry ?? null);
    if (d !== null && d < 30) criticalItems.push("BRP");
  }
  if (imm?.shareCode) {
    const d = getDaysUntilExpiry(imm.shareCodeExpiry ?? null);
    if (d !== null && d < 30) criticalItems.push("Share Code");
  }
  const passportDays = getDaysUntilExpiry(imm?.passportExpiryDate ?? null);
  if (passportDays !== null && passportDays < 30) criticalItems.push("Passport");
  compliance?.immigrationDocuments.forEach((doc) => {
    const d = getDaysUntilExpiry(doc.expiryDate);
    if (d !== null && d < 30) criticalItems.push(formatDocType(doc.documentType));
  });

  return (
    <div className="p-4 pb-20 space-y-5 max-w-2xl mx-auto" data-testid="my-compliance-page">
      <div>
        <h1 className="text-2xl font-bold">My Compliance</h1>
        <p className="text-muted-foreground text-sm">Track your licences, certifications, and immigration status.</p>
      </div>

      {criticalItems.length > 0 && (
        <Card className="border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-950/20" data-testid="card-critical-alerts">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <span className="font-semibold text-red-700 dark:text-red-300">Action Required</span>
            </div>
            <p className="text-sm text-red-600 dark:text-red-400">
              The following items need attention: {criticalItems.join(", ")}
            </p>
            <Link href="/my-documents">
              <Button variant="outline" size="sm" className="mt-3 text-red-600 border-red-300" data-testid="button-go-documents">
                View Documents
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-sia-licence">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-semibold">SIA Licence</span>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Licence Number</p>
              <p className="text-sm font-medium" data-testid="text-sia-number">
                {compliance?.siaLicenseNumber || "Not recorded"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Licence Type</p>
              <p className="text-sm font-medium capitalize" data-testid="text-sia-type">
                {compliance?.siaLicenseType?.replace(/_/g, " ") || "Not recorded"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="text-sm font-medium" data-testid="text-sia-expiry-date">
                {compliance?.siaExpiryDate
                  ? new Date(compliance.siaExpiryDate).toLocaleDateString("en-GB")
                  : "Not set"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <ExpiryBadge expiryDate={compliance?.siaExpiryDate ?? null} />
            </div>
          </div>
          {siaExpDays !== null && (
            <div className="mt-2">
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    siaExpDays < 0 ? "bg-red-500" : siaExpDays <= 30 ? "bg-red-500" : siaExpDays <= 90 ? "bg-amber-500" : "bg-green-500"
                  }`}
                  style={{ width: `${Math.max(0, Math.min(100, (siaExpDays / 365) * 100))}%` }}
                  data-testid="progress-sia-expiry"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {siaExpDays < 0 ? "Licence has expired" : `${siaExpDays} days until expiry`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card data-testid="card-dbs">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <FileCheck className="w-5 h-5 text-primary" />
            <span className="font-semibold">DBS Certificate</span>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Certificate Number</p>
              <p className="text-sm font-medium" data-testid="text-dbs-number">
                {compliance?.dbsCertificateNumber || "Not recorded"}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Issue Date</p>
              <p className="text-sm font-medium" data-testid="text-dbs-issue-date">
                {compliance?.dbsIssueDate
                  ? new Date(compliance.dbsIssueDate).toLocaleDateString("en-GB")
                  : "Not recorded"}
              </p>
            </div>
            {compliance?.dbsCertificateNumber ? (
              <Badge className="bg-green-600 border-green-600 text-white" data-testid="badge-dbs-status">
                <CheckCircle2 className="w-3 h-3 mr-1" /> On file
              </Badge>
            ) : (
              <Badge variant="secondary" data-testid="badge-dbs-status">Not provided</Badge>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-first-aid">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Heart className="w-5 h-5 text-primary" />
            <span className="font-semibold">First Aid</span>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              {compliance?.hasFirstAid ? (
                <Badge className="bg-green-600 border-green-600 text-white" data-testid="badge-first-aid-status">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Certified
                </Badge>
              ) : (
                <Badge variant="secondary" data-testid="badge-first-aid-status">Not Certified</Badge>
              )}
            </div>
            {compliance?.firstAidExpiry && (
              <div>
                <p className="text-xs text-muted-foreground">Expiry Date</p>
                <p className="text-sm font-medium" data-testid="text-first-aid-expiry">
                  {new Date(compliance.firstAidExpiry).toLocaleDateString("en-GB")}
                </p>
                <div className="mt-1">
                  <ExpiryBadge expiryDate={compliance.firstAidExpiry} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-immigration">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <Globe className="w-5 h-5 text-primary" />
          <span className="font-semibold">Visa / BRP / Right to Work</span>
        </CardHeader>
        <CardContent>
          {!imm && (!compliance?.immigrationDocuments || compliance.immigrationDocuments.length === 0) ? (
            <div className="text-center py-6">
              <Globe className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No immigration data on file.</p>
              <p className="text-xs text-muted-foreground mt-1">
                If applicable, data will appear here once synced or uploaded.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {imm?.passportDocNo && (
                <div className="p-3 rounded-lg border" data-testid="card-passport-details">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Passport</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Doc No: {imm.passportDocNo}</span>
                        <span>Country: {imm.passportCountry || "N/A"}</span>
                        {imm.passportIssueDate && <span>Issued: {new Date(imm.passportIssueDate).toLocaleDateString("en-GB")}</span>}
                        {imm.passportExpiryDate && <span>Expires: {new Date(imm.passportExpiryDate).toLocaleDateString("en-GB")}</span>}
                      </div>
                    </div>
                    <ExpiryBadge expiryDate={imm.passportExpiryDate} />
                  </div>
                </div>
              )}

              {imm?.visaNeeded && (
                <div className="p-3 rounded-lg border" data-testid="card-visa-details">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Visa</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>Type: {imm.visaType || "N/A"}</span>
                        {imm.visaDateOfEntry && <span>Entry: {new Date(imm.visaDateOfEntry).toLocaleDateString("en-GB")}</span>}
                        {imm.visaIssueDate && <span>Issued: {new Date(imm.visaIssueDate).toLocaleDateString("en-GB")}</span>}
                        {imm.visaExpiryDate && <span>Expires: {new Date(imm.visaExpiryDate).toLocaleDateString("en-GB")}</span>}
                      </div>
                    </div>
                    <ExpiryBadge expiryDate={imm.visaExpiryDate} />
                  </div>
                </div>
              )}

              {imm?.brpNeeded && (
                <div className="p-3 rounded-lg border" data-testid="card-brp-details">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Biometric Residence Permit (BRP)</p>
                      <div className="text-xs text-muted-foreground">
                        <span>BRP No: {imm.brpNumber || "N/A"}</span>
                        {imm.brpExpiry && <span className="ml-4">Expires: {new Date(imm.brpExpiry).toLocaleDateString("en-GB")}</span>}
                      </div>
                    </div>
                    <ExpiryBadge expiryDate={imm.brpExpiry} />
                  </div>
                </div>
              )}

              {imm?.shareCode && (
                <div className="p-3 rounded-lg border" data-testid="card-share-code-details">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Share Code</p>
                      <div className="text-xs text-muted-foreground">
                        <span>Code: {imm.shareCode}</span>
                        {imm.shareCodeExpiry && <span className="ml-4">Expires: {new Date(imm.shareCodeExpiry).toLocaleDateString("en-GB")}</span>}
                      </div>
                    </div>
                    <ExpiryBadge expiryDate={imm.shareCodeExpiry} />
                  </div>
                </div>
              )}

              {compliance?.immigrationDocuments && compliance.immigrationDocuments.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Supporting Documents</p>
                  {compliance.immigrationDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-start justify-between gap-3 p-3 rounded-lg border"
                      data-testid={`card-immigration-doc-${doc.id}`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="font-medium text-sm">{formatDocType(doc.documentType)}</span>
                          {doc.isVerified ? (
                            <Badge className="bg-green-600 border-green-600 text-white text-xs">Verified</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Pending</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                        {doc.expiryDate && (
                          <p className="text-xs text-muted-foreground">
                            Expires: {new Date(doc.expiryDate).toLocaleDateString("en-GB")}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <ExpiryBadge expiryDate={doc.expiryDate} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      {trainingRecords.length > 0 && (
        <Card data-testid="card-training-records">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="font-semibold">Training Records</span>
          </CardHeader>
          <CardContent className="space-y-3">
            {trainingRecords.map(record => (
              <div
                key={record.id}
                className="flex items-start justify-between gap-3 p-3 rounded-lg border"
                data-testid={`card-training-${record.id}`}
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{record.trainingName}</span>
                    {getTrainingBadge(record)}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                    <span className="capitalize">{record.trainingType.replace(/_/g, " ")}</span>
                    {record.provider && <span>· {record.provider}</span>}
                    {record.completedDate && <span>· Completed {new Date(record.completedDate).toLocaleDateString("en-GB")}</span>}
                    {record.expiryDate && <span>· Expires {new Date(record.expiryDate).toLocaleDateString("en-GB")}</span>}
                  </div>
                  {record.notes && <p className="text-xs text-muted-foreground italic">{record.notes}</p>}
                  {record.certificateUrl && (
                    <a
                      href={record.certificateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                      data-testid={`link-training-certificate-${record.id}`}
                    >
                      <ExternalLink className="w-3 h-3" /> View Certificate
                    </a>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
