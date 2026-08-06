import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import {
  Mail, Brain, CheckCircle, XCircle, Clock, AlertTriangle,
  ArrowRight, Settings, RefreshCw, Loader2, Inbox, Zap,
  Shield, UserMinus, MapPin, Calendar, Building2, Users,
  MailOpen, MailWarning, Sparkles, TrendingUp, ChevronRight,
  Link2, Unlink, Eye, EyeOff, TestTube, Wifi, WifiOff,
} from "lucide-react";

type EmailWithDetails = {
  id: number;
  outlookMessageId: string;
  fromAddress: string;
  fromName: string | null;
  subject: string | null;
  bodyPreview: string | null;
  bodyText: string | null;
  aiSummary: string | null;
  receivedAt: string;
  processingStatus: string;
  tenantId: number;
  classification: {
    id: number;
    category: string;
    confidence: number;
    extractedEntities: Record<string, any>;
    reasoning: string;
  } | null;
  proposedActions: ProposedAction[];
};

type ProposedAction = {
  id: number;
  emailId: number;
  actionType: string;
  actionLabel: string;
  actionParams: Record<string, any>;
  status: string;
  autoApproved: boolean;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  executionResult: Record<string, any> | null;
  learningEventId: number | null;
};

type EmailStats = {
  totalEmails: number;
  unprocessed: number;
  classified: number;
  pendingActions: number;
  approvedActions: number;
  rejectedActions: number;
  autoApprovedActions: number;
  failedActions: number;
};

type AutoApproveSetting = {
  id: number;
  tenantId: number;
  actionType: string;
  enabled: boolean;
};

type EmailConnectionStatus = {
  connected: boolean;
  connectionStatus?: string;
  provider?: string;
  connectedEmail?: string;
  pollingEnabled?: boolean;
  pollingIntervalMinutes?: number;
  pollingActive?: boolean;
  lastPolledAt?: string;
  lastError?: string;
  connectedBy?: string;
  createdAt?: string;
};

const CATEGORY_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  new_shift: { label: "New Shift", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Calendar },
  cancellation: { label: "Cancellation", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  lateness: { label: "Lateness", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  blowout: { label: "Blowout", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: AlertTriangle },
  new_client: { label: "New Client", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: Building2 },
  site_change: { label: "Site Change", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", icon: MapPin },
  officer_replacement: { label: "Officer Replacement", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", icon: UserMinus },
  schedule_change: { label: "Schedule Change", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300", icon: Calendar },
  general_enquiry: { label: "General Enquiry", color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300", icon: Mail },
};

const ACTION_TYPES = [
  { key: "create_shift", label: "Create Shift" },
  { key: "cancel_shift", label: "Cancel Shift" },
  { key: "update_shift", label: "Update Shift" },
  { key: "create_site", label: "Create Site" },
  { key: "create_client", label: "Create Client" },
  { key: "assign_employee", label: "Assign Employee" },
  { key: "notify_team", label: "Notify Team" },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  approved: { label: "Approved", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: CheckCircle },
  executed: { label: "Executed", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  failed: { label: "Failed", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: AlertTriangle },
};

function ConfidenceMeter({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? "bg-green-500" : confidence >= 60 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${confidence}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{confidence}%</span>
    </div>
  );
}

export default function EmailCommandCentre() {
  const { toast } = useToast();
  const [selectedEmail, setSelectedEmail] = useState<EmailWithDetails | null>(null);
  const [rejectingAction, setRejectingAction] = useState<ProposedAction | null>(null);
  const [rejectionText, setRejectionText] = useState("");
  const [correctedActionType, setCorrectedActionType] = useState("");
  const [activeTab, setActiveTab] = useState("inbox");
  const [connClientId, setConnClientId] = useState("");
  const [connClientSecret, setConnClientSecret] = useState("");
  const [connAzureTenantId, setConnAzureTenantId] = useState("");
  const [connEmail, setConnEmail] = useState("");
  const [connPollingInterval, setConnPollingInterval] = useState("2");
  const [showSecret, setShowSecret] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<EmailStats>({
    queryKey: ["/api/email-command/stats"],
    refetchInterval: 15000,
  });

  const { data: emails = [], isLoading: emailsLoading } = useQuery<EmailWithDetails[]>({
    queryKey: ["/api/email-command/inbox"],
    refetchInterval: 10000,
  });

  const { data: pendingActions = [] } = useQuery<ProposedAction[]>({
    queryKey: ["/api/email-command/actions", "pending"],
    queryFn: () => apiRequest("GET", "/api/email-command/actions?status=pending").then(r => r.json()),
  });

  const { data: autoApproveSettings = [] } = useQuery<AutoApproveSetting[]>({
    queryKey: ["/api/email-command/auto-approve"],
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/email-command/inbox"] });
    queryClient.invalidateQueries({ queryKey: ["/api/email-command/stats"] });
    queryClient.invalidateQueries({ queryKey: ["/api/email-command/actions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/email-command/auto-approve"] });
    queryClient.invalidateQueries({ queryKey: ["/api/ai-learning/events"] });
  };

  const loadDemoMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/email-command/demo-emails"),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Demo emails loaded", description: "5 sample emails have been created and classified by AI" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (actionId: number) => apiRequest("POST", `/api/email-command/actions/${actionId}/approve`),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Action approved", description: "The action has been approved and executed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ actionId, correction, correctedActionType }: { actionId: number; correction: string; correctedActionType?: string }) =>
      apiRequest("POST", `/api/email-command/actions/${actionId}/reject`, { correction, correctedActionType }),
    onSuccess: () => {
      invalidateAll();
      setRejectingAction(null);
      setRejectionText("");
      setCorrectedActionType("");
      toast({ title: "Action rejected", description: "Your feedback has been recorded for AI learning" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const autoApproveMutation = useMutation({
    mutationFn: ({ actionType, enabled }: { actionType: string; enabled: boolean }) =>
      apiRequest("PUT", "/api/email-command/auto-approve", { actionType, enabled }),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Setting updated" });
    },
  });

  const { data: connectionStatus, isLoading: connectionLoading } = useQuery<EmailConnectionStatus>({
    queryKey: ["/api/email-command/connection"],
  });

  const testConnectionMutation = useMutation({
    mutationFn: (data: { clientId: string; clientSecret: string; azureTenantId: string; connectedEmail?: string }) =>
      apiRequest("POST", "/api/email-command/connection/test", data).then(r => r.json()),
    onSuccess: (result: any) => {
      if (result.success) {
        toast({ title: "Connection test passed", description: result.email ? `Successfully connected to ${result.email}` : "Microsoft Graph API is accessible" });
      } else {
        toast({ title: "Connection test failed", description: result.error, variant: "destructive" });
      }
    },
    onError: (err: any) => toast({ title: "Test failed", description: err.message, variant: "destructive" }),
  });

  const connectEmailMutation = useMutation({
    mutationFn: (data: { clientId: string; clientSecret: string; azureTenantId: string; connectedEmail?: string; pollingIntervalMinutes?: number }) =>
      apiRequest("POST", "/api/email-command/connection", data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-command/connection"] });
      setConnClientId("");
      setConnClientSecret("");
      setConnAzureTenantId("");
      setConnEmail("");
      toast({ title: "Email connected!", description: "Your inbox is now connected and polling will start automatically" });
    },
    onError: (err: any) => toast({ title: "Connection failed", description: err.message, variant: "destructive" }),
  });

  const updateConnectionMutation = useMutation({
    mutationFn: (data: { pollingEnabled?: boolean; pollingIntervalMinutes?: number }) =>
      apiRequest("PUT", "/api/email-command/connection", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-command/connection"] });
      toast({ title: "Settings updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: () => apiRequest("DELETE", "/api/email-command/connection"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-command/connection"] });
      toast({ title: "Email disconnected", description: "Polling has been stopped and credentials removed" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const processEmailMutation = useMutation({
    mutationFn: (emailId: number) => apiRequest("POST", `/api/email-command/process/${emailId}`),
    onSuccess: () => {
      invalidateAll();
      toast({ title: "Email processed", description: "AI has classified the email and proposed actions" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const autoApproveMap = new Map(autoApproveSettings.map(s => [s.actionType, s.enabled]));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md flex items-center justify-center bg-gradient-to-br from-[#1F3A5F] to-[#2d5a8e]">
          <Mail className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Email Command Centre</h1>
          <p className="text-muted-foreground text-sm">AI-powered email triage — classify, propose actions, learn from every decision</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDemoMutation.mutate()}
            disabled={loadDemoMutation.isPending}
            data-testid="button-load-demo"
          >
            {loadDemoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            Load Demo Emails
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/email-command"] })}
            data-testid="button-refresh"
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Inbox className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-total-emails">{statsLoading ? "..." : stats?.totalEmails || 0}</p>
                <p className="text-xs text-muted-foreground">Total Emails</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-pending-actions">{statsLoading ? "..." : stats?.pendingActions || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Actions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-approved-actions">{statsLoading ? "..." : stats?.approvedActions || 0}</p>
                <p className="text-xs text-muted-foreground">Approved / Executed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold" data-testid="text-auto-approved">{statsLoading ? "..." : stats?.autoApprovedActions || 0}</p>
                <p className="text-xs text-muted-foreground">Auto-Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 w-full max-w-lg">
          <TabsTrigger value="inbox" data-testid="tab-inbox">
            <Inbox className="w-4 h-4 mr-1" /> Inbox
          </TabsTrigger>
          <TabsTrigger value="actions" data-testid="tab-actions">
            <Zap className="w-4 h-4 mr-1" /> Actions
            {pendingActions.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs h-5 min-w-5 justify-center">{pendingActions.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="learning" data-testid="tab-learning">
            <Brain className="w-4 h-4 mr-1" /> AI Learning
          </TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-settings">
            <Settings className="w-4 h-4 mr-1" /> Settings
          </TabsTrigger>
        </TabsList>

        {/* INBOX TAB */}
        <TabsContent value="inbox" className="space-y-4">
          {emailsLoading ? (
            <Card><CardContent className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" /><p className="text-muted-foreground">Loading emails...</p></CardContent></Card>
          ) : emails.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <MailOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground/40" />
                <h3 className="text-lg font-semibold mb-2">No emails yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Connect your Outlook inbox or load demo emails to get started.</p>
                <Button onClick={() => loadDemoMutation.mutate()} disabled={loadDemoMutation.isPending} data-testid="button-load-demo-empty">
                  {loadDemoMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
                  Load Demo Emails
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {emails.map((email) => {
                const catConfig = CATEGORY_CONFIG[email.classification?.category || "general_enquiry"] || CATEGORY_CONFIG.general_enquiry;
                const CatIcon = catConfig.icon;
                const pendingCount = email.proposedActions.filter(a => a.status === "pending").length;

                return (
                  <Card
                    key={email.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${selectedEmail?.id === email.id ? "ring-2 ring-[#1F3A5F]" : ""}`}
                    onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}
                    data-testid={`card-email-${email.id}`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                          <CatIcon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-medium text-sm truncate">{email.fromName || email.fromAddress}</span>
                            <span className="text-xs text-muted-foreground">{new Date(email.receivedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                            {email.classification && (
                              <Badge variant="outline" className={`text-xs ${catConfig.color}`}>{catConfig.label}</Badge>
                            )}
                            {pendingCount > 0 && (
                              <Badge variant="destructive" className="text-xs">{pendingCount} pending</Badge>
                            )}
                            {email.processingStatus === "unread" && (
                              <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">Unprocessed</Badge>
                            )}
                          </div>
                          <p className="text-sm font-medium truncate" data-testid={`text-email-subject-${email.id}`}>{email.subject || "(no subject)"}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{email.aiSummary || email.bodyPreview || ""}</p>
                          {email.classification && (
                            <div className="mt-1">
                              <ConfidenceMeter confidence={email.classification.confidence} />
                            </div>
                          )}
                        </div>
                        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${selectedEmail?.id === email.id ? "rotate-90" : ""}`} />
                      </div>

                      {selectedEmail?.id === email.id && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          {email.processingStatus === "unread" && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); processEmailMutation.mutate(email.id); }}
                                disabled={processEmailMutation.isPending}
                                data-testid={`button-process-${email.id}`}
                              >
                                {processEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Brain className="w-4 h-4 mr-1" />}
                                Classify with AI
                              </Button>
                            </div>
                          )}

                          {email.classification && (
                            <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                              <div className="flex items-center gap-2">
                                <Brain className="w-4 h-4 text-[#1F3A5F]" />
                                <span className="text-sm font-medium">AI Classification</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{email.classification.reasoning}</p>
                              {Object.entries(email.classification.extractedEntities || {}).filter(([, v]) => v).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {Object.entries(email.classification.extractedEntities).filter(([, v]) => v).map(([k, v]) => (
                                    <Badge key={k} variant="secondary" className="text-xs">{k}: {String(v)}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {email.bodyText && (
                            <div className="bg-muted/30 rounded-lg p-3">
                              <p className="text-xs font-medium mb-1 text-muted-foreground">Full Email Body</p>
                              <p className="text-sm whitespace-pre-wrap">{email.bodyText.slice(0, 1000)}</p>
                            </div>
                          )}

                          {email.proposedActions.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-sm font-medium flex items-center gap-1"><Zap className="w-4 h-4" /> Proposed Actions</p>
                              {email.proposedActions.map((action) => {
                                const statusConfig = STATUS_CONFIG[action.status] || STATUS_CONFIG.pending;
                                const StatusIcon = statusConfig.icon;
                                return (
                                  <div key={action.id} className="flex items-center gap-3 p-3 border rounded-lg bg-background" data-testid={`action-${action.id}`}>
                                    <div className="flex-1">
                                      <p className="text-sm font-medium">{action.actionLabel}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <Badge variant="outline" className={`text-xs ${statusConfig.color}`}>
                                          <StatusIcon className="w-3 h-3 mr-1" />{statusConfig.label}
                                        </Badge>
                                        {action.autoApproved && (
                                          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                                            <Zap className="w-3 h-3 mr-1" />Auto
                                          </Badge>
                                        )}
                                      </div>
                                      {action.rejectionReason && (
                                        <p className="text-xs text-red-600 mt-1">Correction: {action.rejectionReason}</p>
                                      )}
                                      {action.executionResult && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {(action.executionResult as any).message || "Executed"}
                                        </p>
                                      )}
                                    </div>
                                    {action.status === "pending" && (
                                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
                                          onClick={() => approveMutation.mutate(action.id)}
                                          disabled={approveMutation.isPending}
                                          data-testid={`button-approve-${action.id}`}
                                        >
                                          <CheckCircle className="w-4 h-4 mr-1" />Approve
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                                          onClick={() => { setRejectingAction(action); setRejectionText(""); }}
                                          disabled={rejectMutation.isPending}
                                          data-testid={`button-reject-${action.id}`}
                                        >
                                          <XCircle className="w-4 h-4 mr-1" />Reject
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ACTIONS TAB */}
        <TabsContent value="actions" className="space-y-4">
          <PendingActionsView
            pendingActions={pendingActions}
            onApprove={(id) => approveMutation.mutate(id)}
            onReject={(action) => { setRejectingAction(action); setRejectionText(""); }}
            isApproving={approveMutation.isPending}
          />
        </TabsContent>

        {/* AI LEARNING TAB */}
        <TabsContent value="learning" className="space-y-4">
          <AILearningPanel />
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#FF8C42]" />
                Auto-Approve Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Enable auto-approve for specific action types. When enabled, the AI will automatically execute these actions without waiting for operator approval.
              </p>
              {ACTION_TYPES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`setting-auto-approve-${key}`}>
                  <div>
                    <Label className="text-sm font-medium">{label}</Label>
                    <p className="text-xs text-muted-foreground">Auto-execute {label.toLowerCase()} actions</p>
                  </div>
                  <Switch
                    checked={autoApproveMap.get(key) === true}
                    onCheckedChange={(enabled) => autoApproveMutation.mutate({ actionType: key, enabled })}
                    data-testid={`switch-auto-approve-${key}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#1F3A5F]" />
                Email Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {connectionLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Checking connection status...</span>
                </div>
              ) : connectionStatus?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800">
                    <Wifi className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300" data-testid="text-connection-status">Connected to Microsoft Outlook</p>
                      {connectionStatus.connectedEmail && (
                        <p className="text-xs text-muted-foreground" data-testid="text-connected-email">Mailbox: {connectionStatus.connectedEmail}</p>
                      )}
                      {connectionStatus.lastPolledAt && (
                        <p className="text-xs text-muted-foreground">Last polled: {new Date(connectionStatus.lastPolledAt).toLocaleString()}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={connectionStatus.pollingActive ? "border-green-500 text-green-700" : "border-gray-400 text-gray-500"}>
                      {connectionStatus.pollingActive ? "Polling Active" : "Polling Paused"}
                    </Badge>
                  </div>

                  {connectionStatus.lastError && (
                    <div className="flex items-center gap-2 p-3 border rounded-lg bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
                      <AlertTriangle className="w-4 h-4 text-red-600" />
                      <p className="text-xs text-red-700 dark:text-red-300">{connectionStatus.lastError}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Auto-Poll Inbox</Label>
                      <p className="text-xs text-muted-foreground">Automatically check for new emails</p>
                    </div>
                    <Switch
                      checked={connectionStatus.pollingEnabled ?? false}
                      onCheckedChange={(enabled) => updateConnectionMutation.mutate({ pollingEnabled: enabled })}
                      data-testid="switch-polling-enabled"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <Label className="text-sm font-medium">Polling Interval</Label>
                      <p className="text-xs text-muted-foreground">How often to check for new emails</p>
                    </div>
                    <select
                      className="border rounded-md p-2 text-sm bg-background"
                      value={connectionStatus.pollingIntervalMinutes || 2}
                      onChange={(e) => updateConnectionMutation.mutate({ pollingIntervalMinutes: parseInt(e.target.value) })}
                      data-testid="select-polling-interval"
                    >
                      <option value="1">Every 1 minute</option>
                      <option value="2">Every 2 minutes</option>
                      <option value="5">Every 5 minutes</option>
                      <option value="10">Every 10 minutes</option>
                      <option value="15">Every 15 minutes</option>
                      <option value="30">Every 30 minutes</option>
                    </select>
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => disconnectMutation.mutate()}
                    disabled={disconnectMutation.isPending}
                    data-testid="button-disconnect-email"
                  >
                    {disconnectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Unlink className="w-4 h-4 mr-1" />}
                    Disconnect Email
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 border rounded-lg bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800">
                    <WifiOff className="w-5 h-5 text-amber-600" />
                    <div>
                      <p className="text-sm font-medium">No email connected</p>
                      <p className="text-xs text-muted-foreground">
                        Connect your Microsoft 365 inbox to automatically poll and classify emails with AI.
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
                    <p className="text-sm font-medium">Connect Microsoft Outlook / Office 365</p>
                    <p className="text-xs text-muted-foreground">
                      You'll need an Azure App Registration with <strong>Mail.Read</strong> permission.
                      Go to <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="text-[#1F3A5F] dark:text-blue-400 underline">Azure Portal</a> → App registrations → New registration → API permissions → Microsoft Graph → Mail.Read.
                    </p>

                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs">Client ID (Application ID)</Label>
                        <Input
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={connClientId}
                          onChange={(e) => setConnClientId(e.target.value)}
                          data-testid="input-client-id"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Client Secret</Label>
                        <div className="relative">
                          <Input
                            type={showSecret ? "text" : "password"}
                            placeholder="Your client secret value"
                            value={connClientSecret}
                            onChange={(e) => setConnClientSecret(e.target.value)}
                            data-testid="input-client-secret"
                          />
                          <button
                            type="button"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowSecret(!showSecret)}
                          >
                            {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Azure Tenant ID (Directory ID)</Label>
                        <Input
                          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={connAzureTenantId}
                          onChange={(e) => setConnAzureTenantId(e.target.value)}
                          data-testid="input-azure-tenant-id"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Mailbox Email Address (optional)</Label>
                        <Input
                          placeholder="controlroom@yourcompany.com"
                          value={connEmail}
                          onChange={(e) => setConnEmail(e.target.value)}
                          data-testid="input-connected-email"
                        />
                        <p className="text-[10px] text-muted-foreground mt-0.5">The shared mailbox to poll. Leave blank to auto-detect.</p>
                      </div>
                      <div>
                        <Label className="text-xs">Polling Interval</Label>
                        <select
                          className="w-full border rounded-md p-2 text-sm bg-background"
                          value={connPollingInterval}
                          onChange={(e) => setConnPollingInterval(e.target.value)}
                          data-testid="select-initial-polling-interval"
                        >
                          <option value="1">Every 1 minute</option>
                          <option value="2">Every 2 minutes</option>
                          <option value="5">Every 5 minutes</option>
                          <option value="10">Every 10 minutes</option>
                          <option value="15">Every 15 minutes</option>
                          <option value="30">Every 30 minutes</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnectionMutation.mutate({
                          clientId: connClientId,
                          clientSecret: connClientSecret,
                          azureTenantId: connAzureTenantId,
                          connectedEmail: connEmail || undefined,
                        })}
                        disabled={!connClientId || !connClientSecret || !connAzureTenantId || testConnectionMutation.isPending}
                        data-testid="button-test-connection"
                      >
                        {testConnectionMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <TestTube className="w-4 h-4 mr-1" />}
                        Test Connection
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => connectEmailMutation.mutate({
                          clientId: connClientId,
                          clientSecret: connClientSecret,
                          azureTenantId: connAzureTenantId,
                          connectedEmail: connEmail || undefined,
                          pollingIntervalMinutes: parseInt(connPollingInterval),
                        })}
                        disabled={!connClientId || !connClientSecret || !connAzureTenantId || connectEmailMutation.isPending}
                        className="bg-[#1F3A5F] hover:bg-[#2d5a8e]"
                        data-testid="button-connect-email"
                      >
                        {connectEmailMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Link2 className="w-4 h-4 mr-1" />}
                        Connect Email
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground text-center">
                    Don't have Azure credentials? Use the <strong>"Load Demo Emails"</strong> button on the Inbox tab to test the AI classification.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Rejection Dialog */}
      <Dialog open={!!rejectingAction} onOpenChange={(open) => { if (!open) setRejectingAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Action — Provide Correction</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Help the AI learn by explaining what the correct action should be. This feedback is stored and used to improve future classifications.
            </p>
            {rejectingAction && (
              <div className="p-3 border rounded-lg bg-muted/50">
                <p className="text-sm font-medium">{rejectingAction.actionLabel}</p>
                <Badge variant="outline" className="text-xs mt-1">{rejectingAction.actionType}</Badge>
              </div>
            )}
            <div>
              <Label className="text-sm font-medium">What should the correct action type be? (optional)</Label>
              <select
                className="mt-1 w-full border rounded-md p-2 text-sm bg-background"
                value={correctedActionType}
                onChange={(e) => setCorrectedActionType(e.target.value)}
                data-testid="select-corrected-action-type"
              >
                <option value="">-- Keep same action type --</option>
                <option value="create_shift">Create Shift</option>
                <option value="cancel_shift">Cancel Shift</option>
                <option value="update_shift">Update Shift</option>
                <option value="create_site">Create Site</option>
                <option value="create_client">Create Client</option>
                <option value="assign_employee">Assign Employee</option>
                <option value="notify_team">Notify Team</option>
                <option value="none">No Action Needed</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">Correction details (required)</Label>
              <Textarea
                placeholder="What should the AI have done instead? e.g., 'This email is about a schedule change, not a new shift. The officer needs a different time slot, not an additional shift.'"
                value={rejectionText}
                onChange={(e) => setRejectionText(e.target.value)}
                className="min-h-[100px] mt-1"
                data-testid="textarea-rejection-reason"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectingAction(null); setCorrectedActionType(""); }} data-testid="button-cancel-reject">Cancel</Button>
            <Button
              variant="destructive"
              disabled={!rejectionText.trim() || rejectMutation.isPending}
              onClick={() => {
                if (rejectingAction) {
                  rejectMutation.mutate({
                    actionId: rejectingAction.id,
                    correction: rejectionText.trim(),
                    correctedActionType: correctedActionType || undefined,
                  });
                }
              }}
              data-testid="button-confirm-reject"
            >
              {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
              Reject with Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PendingActionsView({
  pendingActions, onApprove, onReject, isApproving,
}: {
  pendingActions: ProposedAction[];
  onApprove: (id: number) => void;
  onReject: (action: ProposedAction) => void;
  isApproving: boolean;
}) {
  if (pendingActions.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400/40" />
          <h3 className="text-lg font-semibold mb-2">All caught up</h3>
          <p className="text-muted-foreground text-sm">No pending actions require your approval.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {pendingActions.map((action) => (
        <Card key={action.id} data-testid={`pending-action-${action.id}`}>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{action.actionLabel}</p>
                <Badge variant="outline" className="text-xs mt-1">{action.actionType.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/20"
                  onClick={() => onApprove(action.id)}
                  disabled={isApproving}
                  data-testid={`button-approve-pending-${action.id}`}
                >
                  <CheckCircle className="w-4 h-4 mr-1" />Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20"
                  onClick={() => onReject(action)}
                  data-testid={`button-reject-pending-${action.id}`}
                >
                  <XCircle className="w-4 h-4 mr-1" />Reject
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function AILearningPanel() {
  const { toast } = useToast();
  const { data: events = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/ai-learning/events"],
    refetchInterval: 15000,
  });

  const { data: analytics } = useQuery<any>({
    queryKey: ["/api/ai-learning/analytics"],
    refetchInterval: 30000,
  });

  const backfillMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/ai-learning/backfill-decisions"),
    onSuccess: (data: any) => {
      data.json().then((r: any) => {
        queryClient.invalidateQueries({ queryKey: ["/api/ai-learning"] });
        toast({ title: "Backfill complete", description: r.message });
      });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  if (isLoading) {
    return <Card><CardContent className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold" data-testid="text-total-learning-events">{analytics?.totalEvents || events.length}</p>
            <p className="text-xs text-muted-foreground">Total Decisions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{analytics?.emailEvents || 0}</p>
            <p className="text-xs text-muted-foreground">Email Decisions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{analytics?.schedulingEvents || 0}</p>
            <p className="text-xs text-muted-foreground">Scheduling Decisions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{analytics?.approvalRate || 0}%</p>
            <p className="text-xs text-muted-foreground">Approval Rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">{analytics?.avgConfidence || 0}%</p>
            <p className="text-xs text-muted-foreground">Avg Confidence</p>
          </CardContent>
        </Card>
      </div>

      {analytics?.topCorrections?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Top Correction Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topCorrections.map((c: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 border rounded-lg">
                  <span className="text-sm">{c.reason.replace(/_/g, " ")}</span>
                  <Badge variant="outline" className="text-xs">{c.count} times</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => backfillMutation.mutate()}
          disabled={backfillMutation.isPending}
          data-testid="button-backfill-decisions"
        >
          {backfillMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RefreshCw className="w-4 h-4 mr-1" />}
          Sync Legacy Decisions
        </Button>
        <span className="text-xs text-muted-foreground">Import existing AI scheduling decisions into the unified learning engine</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-[#FF8C42]" />
            Learning Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="text-center py-8">
              <Brain className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No learning events yet. Process some emails to start building the AI knowledge base.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {events.slice(0, 30).map((event: any) => {
                const proposal = event.aiProposal as any;
                return (
                  <div key={event.id} className="flex items-start gap-3 p-3 border rounded-lg text-sm" data-testid={`learning-event-${event.id}`}>
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${event.status === "accepted" ? "bg-green-500" : event.status === "rejected" ? "bg-red-500" : "bg-amber-500"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{event.domain}</Badge>
                        <Badge variant="outline" className={`text-xs ${event.status === "accepted" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300" : event.status === "rejected" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"}`}>
                          {event.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString("en-GB")}</span>
                      </div>
                      <p className="text-xs mt-1 truncate">
                        {proposal?.category && `Category: ${proposal.category}`}
                        {proposal?.actionType && ` → ${proposal.actionType}`}
                        {proposal?.action && `Action: ${proposal.action}`}
                        {proposal?.employeeName && ` — ${proposal.employeeName}`}
                        {proposal?.summary && ` — ${proposal.summary}`}
                      </p>
                      {event.operatorCorrection && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">Correction: {event.operatorCorrection}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
