import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Check, X, Clock, Eye, Users, ClipboardCheck, AlertCircle,
  CheckCircle2, XCircle, Search, AlertTriangle, TrendingUp, Settings2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";

type EnrichedOnboarding = {
  id: number;
  userId: string | null;
  status: string | null;
  currentStep: number | null;
  totalSteps: number | null;
  personalDetailsComplete: boolean | null;
  contactDetailsComplete: boolean | null;
  emergencyContactComplete: boolean | null;
  bankDetailsComplete: boolean | null;
  documentsComplete: boolean | null;
  vettingComplete: boolean | null;
  uniformComplete: boolean | null;
  termsAccepted: boolean | null;
  submittedAt: string | null;
  reviewNotes: string | null;
  createdAt: string | null;
  completedAt: string | null;
  deadline: string | null;
  daysUntilDeadline: number | null;
  urgency: "on_track" | "approaching" | "overdue";
  employeeName: string;
  employeeEmail: string;
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: any }> = {
  invited: { label: "Invited", variant: "secondary", icon: Clock },
  in_progress: { label: "In Progress", variant: "secondary", icon: Clock },
  submitted: { label: "Submitted", variant: "default", icon: ClipboardCheck },
  under_review: { label: "Under Review", variant: "default", icon: Eye },
  approved: { label: "Approved", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejected", variant: "destructive", icon: XCircle },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
};

function UrgencyBadge({ urgency, daysUntilDeadline, showOnTrack = false }: { urgency: string; daysUntilDeadline: number | null; showOnTrack?: boolean }) {
  if (urgency === "overdue") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400" data-testid="badge-urgency-overdue">
        <AlertTriangle className="w-3 h-3 mr-1" /> Overdue
      </Badge>
    );
  }
  if (urgency === "approaching") {
    return (
      <Badge className="bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400" data-testid="badge-urgency-approaching">
        <AlertCircle className="w-3 h-3 mr-1" /> {daysUntilDeadline === 1 ? "Due tomorrow" : `${daysUntilDeadline} days left`}
      </Badge>
    );
  }
  if (showOnTrack && urgency === "on_track") {
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400" data-testid="badge-urgency-on-track">
        <CheckCircle2 className="w-3 h-3 mr-1" /> On track
      </Badge>
    );
  }
  return null;
}

export default function AdminOnboardingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [reviewDialog, setReviewDialog] = useState<EnrichedOnboarding | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [reviewAction, setReviewAction] = useState<"approved" | "rejected" | null>(null);
  const [deadlineDaysInput, setDeadlineDaysInput] = useState<string>("");

  // Support ?open=<onboardingId> to auto-open a specific record (e.g. after hire-to-onboard)
  const openIdParam = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("open")
    : null;

  const { data: onboardings = [], isLoading } = useQuery<EnrichedOnboarding[]>({
    queryKey: ["/api/admin/onboardings"],
  });

  // Auto-open the onboarding record if ?open=<id> is in the URL
  useEffect(() => {
    if (!openIdParam || onboardings.length === 0) return;
    const target = onboardings.find(o => String(o.id) === openIdParam);
    if (target) {
      setReviewDialog(target);
    }
  }, [openIdParam, onboardings.length]);

  const { data: onboardingSettings } = useQuery<{ onboardingDeadlineDays: number }>({
    queryKey: ["/api/tenant/onboarding-settings"],
  });

  const updateDeadlineMutation = useMutation({
    mutationFn: async (days: number) => {
      const res = await apiRequest("PATCH", "/api/tenant/onboarding-settings", { onboardingDeadlineDays: days });
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/onboarding-settings"] });
      setDeadlineDaysInput("");
      toast({ title: "Setting saved", description: `Default onboarding deadline set to ${data.onboardingDeadlineDays} days.` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update deadline setting.", variant: "destructive" });
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: number; status: string; reviewNotes: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/onboardings/${id}/review`, { status, reviewNotes });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/onboardings"] });
      toast({
        title: "Review saved",
        description: reviewAction === "approved"
          ? "Onboarding approved. Standard policy pack has been issued to the employee."
          : `Onboarding has been ${reviewAction}.`,
      });
      setReviewDialog(null);
      setReviewNotes("");
      setReviewAction(null);
    },
  });

  const filtered = onboardings.filter(
    (o) =>
      o.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.employeeEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const overdue = onboardings.filter((o) => o.urgency === "overdue").length;
  const approaching = onboardings.filter((o) => o.urgency === "approaching").length;
  const inProgress = onboardings.filter((o) => ["invited", "in_progress"].includes(o.status || "")).length;
  const completed = onboardings.filter((o) => o.status === "completed").length;
  const completionRate = onboardings.length > 0
    ? Math.round((completed / onboardings.length) * 100)
    : 0;

  const avgCompletionMs = (() => {
    const completedRecords = onboardings.filter(o => o.status === "completed" && o.createdAt && o.completedAt);
    if (completedRecords.length === 0) return null;
    const totalMs = completedRecords.reduce((sum, o) => {
      return sum + (new Date(o.completedAt!).getTime() - new Date(o.createdAt!).getTime());
    }, 0);
    return Math.round(totalMs / completedRecords.length / (1000 * 60 * 60 * 24));
  })();

  return (
    <div className="p-6 space-y-6" data-testid="admin-onboarding-page">
      <div>
        <h1 className="text-2xl font-bold">Onboarding Management</h1>
        <p className="text-muted-foreground text-sm">Review and manage employee onboarding applications.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={overdue > 0 ? "border-red-300 dark:border-red-700" : ""}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600" data-testid="text-overdue-count">{overdue}</div>
            <div className="text-xs text-muted-foreground">Overdue</div>
          </CardContent>
        </Card>
        <Card className={approaching > 0 ? "border-amber-300 dark:border-amber-700" : ""}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-600" data-testid="text-approaching-count">{approaching}</div>
            <div className="text-xs text-muted-foreground">Approaching Deadline</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold" data-testid="text-in-progress-count">{inProgress}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600" data-testid="text-completion-rate">{completionRate}%</div>
            <div className="text-xs text-muted-foreground">Completion Rate</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {avgCompletionMs !== null && (
          <Card className="border-dashed flex-1">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                Average completion time: <strong className="text-foreground">{avgCompletionMs} day{avgCompletionMs !== 1 ? "s" : ""}</strong>
                {" "}· {completed} completed total
              </span>
            </CardContent>
          </Card>
        )}

        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center gap-3 flex-wrap">
            <Settings2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              Default deadline: <strong className="text-foreground">{onboardingSettings?.onboardingDeadlineDays ?? 7} days</strong>
            </span>
            <div className="flex items-center gap-2">
              <Input
                data-testid="input-deadline-days"
                type="number"
                min={1}
                max={365}
                placeholder="Days"
                value={deadlineDaysInput}
                onChange={(e) => setDeadlineDaysInput(e.target.value)}
                className="w-20 h-8 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!deadlineDaysInput || updateDeadlineMutation.isPending}
                onClick={() => {
                  const d = parseInt(deadlineDaysInput);
                  if (d > 0) updateDeadlineMutation.mutate(d);
                }}
                data-testid="button-save-deadline-setting"
              >
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search-onboardings"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No onboarding records found</h3>
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "Try adjusting your search." : "Onboarding records will appear here when employees register."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((record) => {
            const statusConf = STATUS_CONFIG[record.status || ""] || STATUS_CONFIG.in_progress;
            const StatusIcon = statusConf.icon;
            const completedSteps = [
              record.personalDetailsComplete,
              record.contactDetailsComplete,
              record.emergencyContactComplete,
              record.bankDetailsComplete,
              record.documentsComplete,
              record.vettingComplete,
              record.uniformComplete,
              record.termsAccepted,
            ].filter(Boolean).length;
            const progressVal = Math.round((completedSteps / 8) * 100);

            return (
              <Card
                key={record.id}
                data-testid={`card-onboarding-${record.id}`}
                className={
                  record.urgency === "overdue"
                    ? "border-red-300 dark:border-red-700 bg-red-50/30 dark:bg-red-950/10"
                    : record.urgency === "approaching"
                    ? "border-amber-300 dark:border-amber-700 bg-amber-50/30 dark:bg-amber-950/10"
                    : ""
                }
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        record.urgency === "overdue" ? "bg-red-100 dark:bg-red-900/40" :
                        record.urgency === "approaching" ? "bg-amber-100 dark:bg-amber-900/40" :
                        "bg-primary/10"
                      }`}>
                        <span className={`text-sm font-semibold ${
                          record.urgency === "overdue" ? "text-red-700 dark:text-red-400" :
                          record.urgency === "approaching" ? "text-amber-700 dark:text-amber-400" :
                          "text-primary"
                        }`}>
                          {record.employeeName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate" data-testid={`text-employee-name-${record.id}`}>
                          {record.employeeName}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">{record.employeeEmail}</div>
                        {record.deadline && ["invited", "in_progress"].includes(record.status || "") && (
                          <div className="text-xs text-muted-foreground mt-0.5" data-testid={`text-deadline-${record.id}`}>
                            Deadline: {new Date(record.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-32">
                        <div className="text-xs text-muted-foreground mb-1">{completedSteps}/8 sections ({progressVal}%)</div>
                        <Progress
                          value={progressVal}
                          className="h-1.5"
                          data-testid={`progress-onboarding-${record.id}`}
                        />
                      </div>
                      {record.deadline && ["invited", "in_progress"].includes(record.status || "") && (
                        <UrgencyBadge
                          urgency={record.urgency}
                          daysUntilDeadline={record.daysUntilDeadline}
                          showOnTrack={true}
                        />
                      )}
                      <Badge variant={statusConf.variant} data-testid={`badge-status-${record.id}`}>
                        <StatusIcon className="w-3 h-3 mr-1" /> {statusConf.label}
                      </Badge>
                      {record.status === "submitted" && (
                        <Button
                          size="sm"
                          onClick={() => { setReviewDialog(record); setReviewNotes(""); setReviewAction(null); }}
                          data-testid={`button-review-${record.id}`}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Review
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Review Onboarding: {reviewDialog?.employeeName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {reviewDialog && (
                <div className="space-y-1">
                  {[
                    { label: "Personal Details", v: reviewDialog.personalDetailsComplete },
                    { label: "Contact & Address", v: reviewDialog.contactDetailsComplete },
                    { label: "Emergency Contacts", v: reviewDialog.emergencyContactComplete },
                    { label: "Bank Details", v: reviewDialog.bankDetailsComplete },
                    { label: "Documents", v: reviewDialog.documentsComplete },
                    { label: "Vetting", v: reviewDialog.vettingComplete },
                    { label: "Uniform", v: reviewDialog.uniformComplete },
                    { label: "Terms Accepted", v: reviewDialog.termsAccepted },
                  ].map((c) => (
                    <div key={c.label} className="flex items-center justify-between text-sm py-1">
                      <span>{c.label}</span>
                      {c.v ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              <strong>Note:</strong> Approving will automatically issue the standard new starter policy pack (Lone Worker, GDPR, Company Handbook) to this employee.
            </div>
            <div className="space-y-2">
              <Label>Review Notes</Label>
              <Textarea
                data-testid="input-review-notes"
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Add notes about this onboarding review..."
                className="resize-none"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                if (reviewDialog) {
                  setReviewAction("rejected");
                  reviewMutation.mutate({ id: reviewDialog.id, status: "rejected", reviewNotes });
                }
              }}
              disabled={reviewMutation.isPending}
              data-testid="button-reject-onboarding"
            >
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
            <Button
              onClick={() => {
                if (reviewDialog) {
                  setReviewAction("approved");
                  reviewMutation.mutate({ id: reviewDialog.id, status: "completed", reviewNotes });
                }
              }}
              disabled={reviewMutation.isPending}
              data-testid="button-approve-onboarding"
            >
              <Check className="w-4 h-4 mr-1" /> Approve & Issue Policies
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
