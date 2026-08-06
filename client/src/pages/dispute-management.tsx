import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Filter, Loader2, MessageSquare, Send, ShieldAlert, Eye,
  Scale, XCircle, ArrowUpCircle,
} from "lucide-react";

type Dispute = {
  id: number;
  tenantId: number;
  shiftId: number;
  supplierId: number;
  status: "open" | "under_review" | "resolved" | "escalated" | "closed";
  reason: string;
  resolution: string | null;
  resolvedBy: number | null;
  resolvedAt: string | null;
  escalatedAt: string | null;
  createdBy: number;
  createdAt: string;
};

type DisputeMessage = {
  id: number;
  disputeId: number;
  userId: number;
  userName: string;
  message: string;
  createdAt: string;
};

type DisputeDetail = Dispute & {
  messages: DisputeMessage[];
  shift: Record<string, any>;
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  open: { label: "Open", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", icon: AlertTriangle },
  under_review: { label: "Under Review", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", icon: Eye },
  resolved: { label: "Resolved", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  escalated: { label: "Escalated", className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", icon: ArrowUpCircle },
  closed: { label: "Closed", className: "bg-gray-100 text-gray-700 dark:bg-gray-800/30 dark:text-gray-400", icon: XCircle },
};

export default function DisputeManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const adminRoles = ["super_admin", "tenant_admin", "ceo", "operations_manager", "regional_manager", "admin", "hr_manager", "accountant"];
  const isAdmin = adminRoles.includes(user?.role || "");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [resolveDialog, setResolveDialog] = useState<Dispute | null>(null);
  const [resolutionText, setResolutionText] = useState("");

  const { data: disputes = [], isLoading } = useQuery<Dispute[]>({
    queryKey: ["/api/disputes"],
  });

  const { data: disputeDetail, isLoading: isDetailLoading } = useQuery<DisputeDetail>({
    queryKey: ["/api/disputes", expandedId],
    enabled: !!expandedId,
  });

  const addMessageMutation = useMutation({
    mutationFn: async ({ disputeId, message }: { disputeId: number; message: string }) => {
      await apiRequest("POST", `/api/disputes/${disputeId}/messages`, { message });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disputes"] });
      setNewMessage("");
      toast({ title: "Message Sent", description: "Your message has been added to the dispute." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async ({ disputeId, resolution }: { disputeId: number; resolution: string }) => {
      await apiRequest("PATCH", `/api/disputes/${disputeId}/resolve`, { resolution });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disputes"] });
      setResolveDialog(null);
      setResolutionText("");
      toast({ title: "Dispute Resolved", description: "The dispute has been marked as resolved." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const escalateMutation = useMutation({
    mutationFn: async (disputeId: number) => {
      await apiRequest("PATCH", `/api/disputes/${disputeId}/escalate`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/disputes"] });
      toast({ title: "Dispute Escalated", description: "The dispute has been escalated for further review." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSendMessage = (disputeId: number) => {
    if (!newMessage.trim()) {
      toast({ title: "Message Required", description: "Please enter a message.", variant: "destructive" });
      return;
    }
    addMessageMutation.mutate({ disputeId, message: newMessage.trim() });
  };

  const handleResolve = () => {
    if (!resolveDialog || !resolutionText.trim()) {
      toast({ title: "Resolution Required", description: "Please provide a resolution text.", variant: "destructive" });
      return;
    }
    resolveMutation.mutate({ disputeId: resolveDialog.id, resolution: resolutionText.trim() });
  };

  const filtered = disputes.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        d.reason.toLowerCase().includes(q) ||
        String(d.id).includes(q) ||
        String(d.shiftId).includes(q)
      );
    }
    return true;
  });

  const totalCount = disputes.length;
  const openCount = disputes.filter((d) => d.status === "open").length;
  const underReviewCount = disputes.filter((d) => d.status === "under_review").length;
  const resolvedCount = disputes.filter((d) => d.status === "resolved").length;
  const escalatedCount = disputes.filter((d) => d.status === "escalated").length;

  return (
    <div className="p-6 space-y-6" data-testid="dispute-management-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
          <Scale className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Dispute Management</h1>
          <p className="text-muted-foreground text-sm">
            Track and manage shift disputes{isAdmin ? " across all suppliers" : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3" data-testid="dispute-summary">
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4" style={{ color: "#1F3A5F" }} />
              <div>
                <p className="text-lg font-bold" data-testid="stat-total">{totalCount}</p>
                <p className="text-xs text-muted-foreground">Total Disputes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-open">{openCount}</p>
                <p className="text-xs text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-blue-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-under-review">{underReviewCount}</p>
                <p className="text-xs text-muted-foreground">Under Review</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-resolved">{resolvedCount}</p>
                <p className="text-xs text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <ArrowUpCircle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-lg font-bold" data-testid="stat-escalated">{escalatedCount}</p>
                <p className="text-xs text-muted-foreground">Escalated</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3" data-testid="dispute-filters">
        <div className="flex-1">
          <Input
            placeholder="Search by dispute ID, shift ID, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48" data-testid="select-status-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="under_review">Under Review</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="escalated">Escalated</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <Card>
          <CardContent className="p-8 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="text-muted-foreground">Loading disputes...</span>
          </CardContent>
        </Card>
      )}

      {!isLoading && filtered.length === 0 && (
        <Card data-testid="card-empty">
          <CardContent className="p-8 text-center">
            <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">No Disputes Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {totalCount === 0
                ? "No disputes have been raised yet."
                : "No disputes match your current filters."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3" data-testid="dispute-list">
          {filtered.map((dispute) => {
            const statusConf = STATUS_CONFIG[dispute.status] || STATUS_CONFIG.open;
            const StatusIcon = statusConf.icon;
            const isExpanded = expandedId === dispute.id;
            const detail = isExpanded && disputeDetail?.id === dispute.id ? disputeDetail : null;

            return (
              <Card key={dispute.id} data-testid={`card-dispute-${dispute.id}`}>
                <CardContent className="p-4">
                  <div
                    className="flex items-center justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : dispute.id)}
                    data-testid={`row-dispute-${dispute.id}`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1F3A5F, #2d5a8e)" }}>
                        <ShieldAlert className="w-4 h-4 text-white" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm" data-testid={`text-dispute-id-${dispute.id}`}>
                            #{dispute.id}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            Shift #{dispute.shiftId}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(dispute.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit", month: "short", year: "numeric",
                            })}
                          </span>
                          <span className="truncate max-w-[300px]" data-testid={`text-reason-${dispute.id}`}>
                            {dispute.reason.length > 80
                              ? dispute.reason.substring(0, 80) + "..."
                              : dispute.reason}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge className={statusConf.className + " text-xs"} data-testid={`badge-status-${dispute.id}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {statusConf.label}
                      </Badge>
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t space-y-4" data-testid={`details-dispute-${dispute.id}`}>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Full Reason</p>
                        <p className="text-sm" data-testid={`text-full-reason-${dispute.id}`}>{dispute.reason}</p>
                      </div>

                      {dispute.resolution && (
                        <div className="p-3 rounded-lg border border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-800/30">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Resolution
                          </p>
                          <p className="text-sm mt-1" data-testid={`text-resolution-${dispute.id}`}>
                            {dispute.resolution}
                          </p>
                          {dispute.resolvedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Resolved on {new Date(dispute.resolvedAt).toLocaleDateString("en-GB")}
                            </p>
                          )}
                        </div>
                      )}

                      {isDetailLoading && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading messages...
                        </div>
                      )}

                      {detail && detail.messages && detail.messages.length > 0 && (
                        <div data-testid={`messages-dispute-${dispute.id}`}>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" /> Message Thread ({detail.messages.length})
                          </p>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {detail.messages.map((msg) => (
                              <div
                                key={msg.id}
                                className="p-3 rounded-lg border text-sm"
                                data-testid={`message-${msg.id}`}
                              >
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-medium text-xs">{msg.userName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(msg.createdAt).toLocaleString("en-GB", {
                                      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <p>{msg.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {detail && detail.messages && detail.messages.length === 0 && (
                        <p className="text-xs text-muted-foreground">No messages yet.</p>
                      )}

                      {dispute.status !== "closed" && dispute.status !== "resolved" && (
                        <div className="flex items-center gap-2" data-testid={`form-message-${dispute.id}`}>
                          <Textarea
                            placeholder="Type a message..."
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            rows={2}
                            className="flex-1"
                            data-testid={`input-message-${dispute.id}`}
                          />
                          <Button
                            size="icon"
                            onClick={(e) => { e.stopPropagation(); handleSendMessage(dispute.id); }}
                            disabled={addMessageMutation.isPending || !newMessage.trim()}
                            data-testid={`button-send-message-${dispute.id}`}
                          >
                            {addMessageMutation.isPending
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Send className="w-4 h-4" />}
                          </Button>
                        </div>
                      )}

                      {isAdmin && dispute.status !== "closed" && dispute.status !== "resolved" && (
                        <div className="flex items-center gap-2 pt-1" data-testid={`admin-actions-${dispute.id}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              setResolveDialog(dispute);
                            }}
                            data-testid={`button-resolve-${dispute.id}`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200"
                            onClick={(e) => {
                              e.stopPropagation();
                              escalateMutation.mutate(dispute.id);
                            }}
                            disabled={escalateMutation.isPending || dispute.status === "escalated"}
                            data-testid={`button-escalate-${dispute.id}`}
                          >
                            {escalateMutation.isPending
                              ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              : <ArrowUpCircle className="w-3.5 h-3.5 mr-1.5" />}
                            Escalate
                          </Button>
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

      <Dialog open={!!resolveDialog} onOpenChange={(open) => { if (!open) { setResolveDialog(null); setResolutionText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              Resolve Dispute
            </DialogTitle>
            <DialogDescription>
              {resolveDialog && (
                <>Dispute #{resolveDialog.id} — Shift #{resolveDialog.shiftId}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Provide a resolution summary for this dispute. This will be visible to all parties.
            </p>
            <Textarea
              value={resolutionText}
              onChange={(e) => setResolutionText(e.target.value)}
              placeholder="e.g. After reviewing evidence, the shift hours have been adjusted to reflect actual attendance..."
              rows={4}
              data-testid="input-resolution"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setResolveDialog(null); setResolutionText(""); }}
              data-testid="button-cancel-resolve"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResolve}
              disabled={resolveMutation.isPending || !resolutionText.trim()}
              style={{ backgroundColor: "#FF8C42", borderColor: "#FF8C42" }}
              className="text-white"
              data-testid="button-submit-resolve"
            >
              {resolveMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              )}
              Resolve Dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
