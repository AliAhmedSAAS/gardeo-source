import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Download, Shield, FileCheck, Trash2, CheckCircle2, XCircle, Clock,
  AlertTriangle, Lock, Eye,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const CONSENT_TYPES = [
  { key: "data_processing", label: "Data Processing", description: "Allow processing of your personal data for employment purposes including payroll, scheduling, and compliance." },
  { key: "communications", label: "Communications", description: "Receive system notifications, shift updates, and important operational communications." },
  { key: "analytics", label: "Analytics & Reporting", description: "Include your anonymised data in workforce analytics and reporting dashboards." },
  { key: "document_storage", label: "Document Storage", description: "Store your uploaded documents (ID, certificates, DBS) securely for compliance verification." },
  { key: "third_party_sharing", label: "Third Party Sharing", description: "Share relevant employment data with authorised third parties such as HMRC, SIA, and pension providers." },
];

export default function PrivacySettingsPage() {
  const { toast } = useToast();
  const [showErasureDialog, setShowErasureDialog] = useState(false);
  const [erasureReason, setErasureReason] = useState("");
  const [showExportDialog, setShowExportDialog] = useState(false);

  const { data: consents = [], isLoading: consentsLoading } = useQuery<any[]>({
    queryKey: ["/api/gdpr/consents"],
  });

  const { data: erasureRequest } = useQuery<any>({
    queryKey: ["/api/gdpr/erasure-request"],
  });

  const grantConsentMutation = useMutation({
    mutationFn: async (consentType: string) => {
      const res = await apiRequest("POST", "/api/gdpr/consents", { consentType, status: "granted" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/consents"] });
      toast({ title: "Consent granted", description: "Your consent preference has been saved." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update consent.", variant: "destructive" });
    },
  });

  const withdrawConsentMutation = useMutation({
    mutationFn: async (consentId: number) => {
      const res = await apiRequest("PATCH", `/api/gdpr/consents/${consentId}/withdraw`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/consents"] });
      toast({ title: "Consent withdrawn", description: "Your consent has been withdrawn." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to withdraw consent.", variant: "destructive" });
    },
  });

  const erasureMutation = useMutation({
    mutationFn: async (reason: string) => {
      const res = await apiRequest("POST", "/api/gdpr/erasure-request", { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/gdpr/erasure-request"] });
      setShowErasureDialog(false);
      setErasureReason("");
      toast({ title: "Request submitted", description: "Your data erasure request has been submitted for review." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to submit erasure request.", variant: "destructive" });
    },
  });

  const handleExportData = async () => {
    try {
      const res = await fetch("/api/gdpr/data-export", { credentials: "include" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gdpr-data-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setShowExportDialog(false);
      toast({ title: "Data exported", description: "Your personal data has been downloaded." });
    } catch {
      toast({ title: "Error", description: "Failed to export data.", variant: "destructive" });
    }
  };

  const getConsentStatus = (consentType: string) => {
    const matching = consents.filter((c: any) => c.consentType === consentType);
    if (matching.length === 0) return null;
    const latest = matching[0];
    return latest;
  };

  if (consentsLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="privacy-settings-page">
      <div>
        <h1 className="text-2xl font-bold">Privacy & Data</h1>
        <p className="text-muted-foreground text-sm">Manage your personal data, consent preferences, and privacy rights under GDPR.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-data-export">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(216, 52%, 25%, 0.08)" }}>
                <Download className="w-5 h-5" style={{ color: "hsl(216, 52%, 35%)" }} />
              </div>
              <div>
                <h3 className="font-semibold">Export Your Data</h3>
                <p className="text-xs text-muted-foreground">Subject Access Request (SAR)</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Download a copy of all personal data we hold about you, including your profile, employment records, shift history, documents, and consent records.
            </p>
            <Button onClick={() => setShowExportDialog(true)} data-testid="button-export-data">
              <Download className="w-4 h-4 mr-2" /> Request Data Export
            </Button>
          </CardContent>
        </Card>

        <Card data-testid="card-erasure-request">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(0, 70%, 50%, 0.08)" }}>
                <Trash2 className="w-5 h-5" style={{ color: "hsl(0, 70%, 50%)" }} />
              </div>
              <div>
                <h3 className="font-semibold">Right to Erasure</h3>
                <p className="text-xs text-muted-foreground">Request account deletion</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {erasureRequest ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={erasureRequest.status === "pending" ? "secondary" : erasureRequest.status === "approved" ? "default" : "destructive"}>
                    {erasureRequest.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                    {erasureRequest.status === "approved" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                    {erasureRequest.status === "rejected" && <XCircle className="w-3 h-3 mr-1" />}
                    {erasureRequest.status.charAt(0).toUpperCase() + erasureRequest.status.slice(1)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {erasureRequest.status === "pending"
                    ? "Your erasure request is being reviewed by an administrator."
                    : erasureRequest.status === "approved"
                    ? "Your request has been approved and your data will be anonymised."
                    : erasureRequest.status === "rejected"
                    ? `Request rejected${erasureRequest.reviewNotes ? ": " + erasureRequest.reviewNotes : ""}`
                    : "Your data has been anonymised."}
                </p>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-4">
                  Request permanent deletion of your personal data. This action requires admin approval and cannot be undone.
                </p>
                <Button variant="destructive" onClick={() => setShowErasureDialog(true)} data-testid="button-request-erasure">
                  <Trash2 className="w-4 h-4 mr-2" /> Request Data Erasure
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-consent-management">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(145, 60%, 40%, 0.08)" }}>
              <FileCheck className="w-5 h-5" style={{ color: "hsl(145, 60%, 40%)" }} />
            </div>
            <div>
              <h3 className="font-semibold">Consent Preferences</h3>
              <p className="text-xs text-muted-foreground">Manage how your data is processed</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {CONSENT_TYPES.map((ct) => {
              const consent = getConsentStatus(ct.key);
              const isGranted = consent?.status === "granted";
              return (
                <div key={ct.key} className="flex items-start justify-between gap-4 p-4 rounded-lg border" data-testid={`consent-${ct.key}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-semibold">{ct.label}</h4>
                      {consent && (
                        <Badge variant={isGranted ? "default" : "secondary"} className="text-xs">
                          {isGranted ? "Granted" : "Withdrawn"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{ct.description}</p>
                    {consent?.grantedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {isGranted ? "Granted" : "Withdrawn"} on {new Date(isGranted ? consent.grantedAt : consent.withdrawnAt).toLocaleDateString("en-GB")}
                      </p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    {isGranted ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => withdrawConsentMutation.mutate(consent.id)}
                        disabled={withdrawConsentMutation.isPending}
                        data-testid={`button-withdraw-${ct.key}`}
                      >
                        Withdraw
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => grantConsentMutation.mutate(ct.key)}
                        disabled={grantConsentMutation.isPending}
                        data-testid={`button-grant-${ct.key}`}
                      >
                        Grant
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-security-info">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(216, 52%, 25%, 0.08)" }}>
              <Lock className="w-5 h-5" style={{ color: "hsl(216, 52%, 35%)" }} />
            </div>
            <div>
              <h3 className="font-semibold">Security Information</h3>
              <p className="text-xs text-muted-foreground">How we protect your data</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold">Encrypted Storage</h4>
                <p className="text-xs text-muted-foreground">All personal data is encrypted at rest and in transit using industry-standard protocols.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Eye className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold">Access Controls</h4>
                <p className="text-xs text-muted-foreground">Role-based access ensures only authorised personnel can view your data.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <Lock className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold">Session Security</h4>
                <p className="text-xs text-muted-foreground">Automatic session timeout after 30 minutes of inactivity. Account lockout after 5 failed login attempts.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg border">
              <FileCheck className="w-5 h-5 text-muted-foreground mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold">Audit Logging</h4>
                <p className="text-xs text-muted-foreground">All access to your data is logged for regulatory accountability and transparency.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Export Your Data</DialogTitle>
            <DialogDescription>
              This will download a JSON file containing all personal data we hold about you, including your profile, employment records, shift history, and consent records. Bank details will be partially masked for security.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportDialog(false)}>Cancel</Button>
            <Button onClick={handleExportData} data-testid="button-confirm-export">
              <Download className="w-4 h-4 mr-2" /> Download Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showErasureDialog} onOpenChange={setShowErasureDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Request Data Erasure
            </DialogTitle>
            <DialogDescription>
              This will submit a request to permanently delete all your personal data. This action requires admin approval and cannot be undone. Your account will be deactivated and your data anonymised.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Reason (optional)</label>
            <Textarea
              value={erasureReason}
              onChange={(e) => setErasureReason(e.target.value)}
              placeholder="Please provide a reason for your data erasure request..."
              data-testid="input-erasure-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowErasureDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => erasureMutation.mutate(erasureReason)}
              disabled={erasureMutation.isPending}
              data-testid="button-confirm-erasure"
            >
              {erasureMutation.isPending ? "Submitting..." : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
