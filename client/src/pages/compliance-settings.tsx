import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield, ShieldCheck, Lock, FileCheck, Users, AlertTriangle,
  CheckCircle2, XCircle, Clock, Eye, Database, Key,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export default function ComplianceSettingsPage() {
  const { toast } = useToast();
  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | "completed">("approved");
  const [reviewNotes, setReviewNotes] = useState("");

  const { data: settings, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/compliance-settings"],
  });

  const { data: erasureRequests = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/erasure-requests"],
  });

  const reviewErasureMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: number; status: string; reviewNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/erasure-requests/${id}`, { status, reviewNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/erasure-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/compliance-settings"] });
      setReviewDialog(null);
      setReviewNotes("");
      toast({ title: "Request updated", description: "The erasure request has been processed." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to process request.", variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-32">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const gdpr = settings?.gdpr || {};
  const security = settings?.security || {};
  const compliance = settings?.compliance || {};
  const retention = settings?.dataRetention || {};

  const pendingErasure = erasureRequests.filter((r: any) => r.status === "pending");

  return (
    <div className="p-6 space-y-6" data-testid="compliance-settings-page">
      <div>
        <h1 className="text-2xl font-bold">Compliance & Security</h1>
        <p className="text-muted-foreground text-sm">Monitor compliance status across GDPR, ISO 27001, BS 7858, SIA ACS, and Cyber Essentials standards.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card data-testid="card-gdpr-status">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(216, 52%, 25%, 0.08)" }}>
                <Shield className="w-5 h-5" style={{ color: "hsl(216, 52%, 35%)" }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">GDPR</h3>
                <Badge variant={gdpr.pendingErasureRequests > 0 ? "destructive" : "default"} className="text-xs mt-0.5">
                  {gdpr.pendingErasureRequests > 0 ? "Action Required" : "Compliant"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Users with consent</span><span className="font-medium text-foreground">{gdpr.usersWithConsent}/{gdpr.totalUsers}</span></div>
              <div className="flex justify-between"><span>Pending erasure</span><span className="font-medium text-foreground">{gdpr.pendingErasureRequests}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-security-status">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(145, 60%, 40%, 0.08)" }}>
                <Lock className="w-5 h-5" style={{ color: "hsl(145, 60%, 40%)" }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">ISO 27001 / CE</h3>
                <Badge variant="default" className="text-xs mt-0.5">Active</Badge>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Password policy</span><span className="font-medium text-foreground">{security.passwordPolicyEnforced ? "Enforced" : "Off"}</span></div>
              <div className="flex justify-between"><span>Session timeout</span><span className="font-medium text-foreground">{security.sessionTimeoutMinutes} min</span></div>
              <div className="flex justify-between"><span>Locked accounts</span><span className="font-medium text-foreground">{security.lockedAccounts}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-vetting-status">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(27, 100%, 55%, 0.08)" }}>
                <FileCheck className="w-5 h-5" style={{ color: "hsl(27, 100%, 55%)" }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">BS 7858</h3>
                <Badge variant={compliance.pendingVettingChecks > 0 ? "secondary" : "default"} className="text-xs mt-0.5">
                  {compliance.pendingVettingChecks > 0 ? `${compliance.pendingVettingChecks} Pending` : "Up to Date"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Pending checks</span><span className="font-medium text-foreground">{compliance.pendingVettingChecks}</span></div>
              <div className="flex justify-between"><span>Expired checks</span><span className="font-medium text-foreground">{compliance.expiredVettingChecks}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-sia-status">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ backgroundColor: "hsl(0, 70%, 50%, 0.08)" }}>
                <ShieldCheck className="w-5 h-5" style={{ color: "hsl(0, 70%, 50%)" }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">SIA ACS</h3>
                <Badge variant={compliance.siaExpiring > 0 ? "destructive" : "default"} className="text-xs mt-0.5">
                  {compliance.siaExpiring > 0 ? `${compliance.siaExpiring} Expiring` : "Compliant"}
                </Badge>
              </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div className="flex justify-between"><span>Total employees</span><span className="font-medium text-foreground">{compliance.totalEmployees}</span></div>
              <div className="flex justify-between"><span>SIA expiring (30d)</span><span className="font-medium text-foreground">{compliance.siaExpiring}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card data-testid="card-security-policies">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Key className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">Security Policies</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Password Complexity</p>
                    <p className="text-xs text-muted-foreground">Minimum 8 characters, uppercase, lowercase, number</p>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Account Lockout</p>
                    <p className="text-xs text-muted-foreground">{security.maxFailedAttempts} failed attempts, {security.lockoutDurationMinutes} minute lockout</p>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Session Timeout</p>
                    <p className="text-xs text-muted-foreground">Auto-logout after {security.sessionTimeoutMinutes} minutes of inactivity</p>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">HTTP-Only Cookies</p>
                    <p className="text-xs text-muted-foreground">Session cookies are not accessible via JavaScript</p>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium">Password Hashing</p>
                    <p className="text-xs text-muted-foreground">bcrypt with 10 rounds salt</p>
                  </div>
                </div>
                <Badge variant="default">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-data-retention">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-muted-foreground" />
              <h3 className="font-semibold">Data Retention Policies</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Audit Logs</p>
                  <p className="text-xs text-muted-foreground">System activity and access logs</p>
                </div>
                <Badge variant="secondary">{retention.auditLogRetentionDays ? Math.round(retention.auditLogRetentionDays / 365) : 7} years</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Employee Documents</p>
                  <p className="text-xs text-muted-foreground">ID documents, certificates, contracts</p>
                </div>
                <Badge variant="secondary">{retention.documentRetentionDays ? Math.round(retention.documentRetentionDays / 365) : 5} years</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Session Data</p>
                  <p className="text-xs text-muted-foreground">Login sessions and tokens</p>
                </div>
                <Badge variant="secondary">{retention.sessionRetentionDays || 1} day</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Vetting Records</p>
                  <p className="text-xs text-muted-foreground">BS 7858 screening records</p>
                </div>
                <Badge variant="secondary">7 years</Badge>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border">
                <div>
                  <p className="text-sm font-medium">Financial Records</p>
                  <p className="text-xs text-muted-foreground">Invoices and payroll data (HMRC)</p>
                </div>
                <Badge variant="secondary">7 years</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {pendingErasure.length > 0 && (
        <Card data-testid="card-erasure-requests">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <h3 className="font-semibold">Pending Erasure Requests</h3>
                <p className="text-xs text-muted-foreground">{pendingErasure.length} request{pendingErasure.length !== 1 ? "s" : ""} awaiting review</p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingErasure.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-4 rounded-lg border" data-testid={`erasure-request-${req.id}`}>
                  <div>
                    <p className="text-sm font-medium">{req.userName}</p>
                    <p className="text-xs text-muted-foreground">{req.userEmail}</p>
                    {req.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {req.reason}</p>}
                    <p className="text-xs text-muted-foreground">Submitted {new Date(req.createdAt).toLocaleDateString("en-GB")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setReviewDialog(req); setReviewAction("rejected"); }} data-testid={`button-reject-erasure-${req.id}`}>
                      <XCircle className="w-3 h-3 mr-1" /> Reject
                    </Button>
                    <Button size="sm" onClick={() => { setReviewDialog(req); setReviewAction("approved"); }} data-testid={`button-approve-erasure-${req.id}`}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-all-erasure-requests">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Eye className="w-5 h-5 text-muted-foreground" />
            <div>
              <h3 className="font-semibold">All Erasure Requests</h3>
              <p className="text-xs text-muted-foreground">Complete history of data erasure requests</p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {erasureRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No erasure requests have been submitted.</p>
          ) : (
            <div className="space-y-2">
              {erasureRequests.map((req: any) => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                  <div className="flex items-center gap-3">
                    {req.status === "pending" && <Clock className="w-4 h-4 text-yellow-600" />}
                    {req.status === "approved" && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                    {req.status === "rejected" && <XCircle className="w-4 h-4 text-red-600" />}
                    {req.status === "completed" && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
                    <div>
                      <span className="font-medium">{req.userName}</span>
                      <span className="text-muted-foreground ml-2">{req.userEmail}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{new Date(req.createdAt).toLocaleDateString("en-GB")}</span>
                    <Badge variant={req.status === "pending" ? "secondary" : req.status === "approved" || req.status === "completed" ? "default" : "destructive"}>
                      {req.status}
                    </Badge>
                    {req.status === "approved" && (
                      <Button size="sm" variant="outline" onClick={() => { setReviewDialog(req); setReviewAction("completed"); }} data-testid={`button-complete-erasure-${req.id}`}>
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!reviewDialog} onOpenChange={(open) => { if (!open) setReviewDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approved" ? "Approve" : reviewAction === "rejected" ? "Reject" : "Complete"} Erasure Request
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approved"
                ? "Approving will mark this request for data anonymisation. You will need to complete the erasure separately."
                : reviewAction === "completed"
                ? "This will permanently anonymise the user's personal data. This action cannot be undone."
                : "Provide a reason for rejecting this request."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder={reviewAction === "rejected" ? "Reason for rejection..." : "Additional notes..."}
              data-testid="input-review-notes"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialog(null)}>Cancel</Button>
            <Button
              variant={reviewAction === "rejected" ? "destructive" : "default"}
              onClick={() => reviewErasureMutation.mutate({ id: reviewDialog.id, status: reviewAction, reviewNotes })}
              disabled={reviewErasureMutation.isPending}
              data-testid="button-confirm-review"
            >
              {reviewErasureMutation.isPending ? "Processing..." : reviewAction === "approved" ? "Approve" : reviewAction === "completed" ? "Complete Erasure" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
