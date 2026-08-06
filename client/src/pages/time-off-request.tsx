import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { type LucideIcon, Calendar, Clock, Loader2, CalendarOff, CheckCircle2, XCircle, AlertCircle } from "lucide-react";

type TimeOffRequest = {
  id: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  notes: string | null;
  status: "pending" | "approved" | "rejected" | "cancelled";
  reviewNote: string | null;
  createdAt: string;
};

const LEAVE_TYPE_LABELS: Record<string, string> = {
  annual_leave: "Annual Leave",
  sick_leave: "Sick Leave",
  personal: "Personal",
  training: "Training",
};

const STATUS_BADGE: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300", icon: Clock },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300", icon: XCircle },
  cancelled: { label: "Cancelled", className: "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-900/30 dark:text-gray-400", icon: AlertCircle },
};

function calculateDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export default function TimeOffRequestPage() {
  const { toast } = useToast();
  const [leaveType, setLeaveType] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const { data: requests = [], isLoading } = useQuery<TimeOffRequest[]>({
    queryKey: ["/api/time-off/my-requests"],
  });

  const totalDays = useMemo(() => calculateDays(startDate, endDate), [startDate, endDate]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/time-off/request", { leaveType, startDate, endDate, notes: notes || undefined });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off/my-requests"] });
      toast({ title: "Request submitted", description: "Your time-off request has been submitted for review." });
      setLeaveType("");
      setStartDate("");
      setEndDate("");
      setNotes("");
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/time-off/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-off/my-requests"] });
      toast({ title: "Request cancelled" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const canSubmit = leaveType && startDate && endDate && totalDays > 0;

  return (
    <div className="p-4 sm:p-6 space-y-6" data-testid="time-off-request-page">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold">Request Time Off</h1>
        <p className="text-muted-foreground text-sm">Submit a time-off request for your manager to review.</p>
      </div>

      <Card data-testid="card-time-off-form">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="w-4 h-4" /> New Request
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leave-type">Leave Type</Label>
              <Select value={leaveType} onValueChange={setLeaveType}>
                <SelectTrigger id="leave-type" data-testid="select-leave-type">
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual_leave">Annual Leave</SelectItem>
                  <SelectItem value="sick_leave">Sick Leave</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="training">Training</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Days Requested</Label>
              <div className={`flex items-center gap-2 p-2 rounded-md border min-h-[40px] ${totalDays > 0 ? "border-primary/40 bg-primary/5" : "border-muted"}`} data-testid="text-total-days">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className={`font-semibold ${totalDays > 0 ? "text-primary" : "text-muted-foreground"}`}>
                  {totalDays > 0 ? `${totalDays} day${totalDays !== 1 ? "s" : ""}` : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional information about your request..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              className="resize-none"
              rows={3}
              data-testid="textarea-notes"
            />
            <p className="text-xs text-muted-foreground text-right">{notes.length}/500</p>
          </div>

          <Button
            onClick={() => submitMutation.mutate()}
            disabled={!canSubmit || submitMutation.isPending}
            className="w-full sm:w-auto"
            data-testid="button-submit-request"
          >
            {submitMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {submitMutation.isPending ? "Submitting..." : "Submit Request"}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-request-history">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarOff className="w-4 h-4" /> My Request History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading...
            </div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">You have no time-off requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const statusConf = STATUS_BADGE[req.status] || STATUS_BADGE.pending;
                const StatusIcon = statusConf.icon;
                return (
                  <div key={req.id} className="p-3 rounded-lg border space-y-2" data-testid={`card-request-${req.id}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm" data-testid={`text-request-type-${req.id}`}>
                            {LEAVE_TYPE_LABELS[req.leaveType] || req.leaveType}
                          </span>
                          <Badge variant="outline" className={statusConf.className} data-testid={`badge-request-status-${req.id}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {statusConf.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          <span data-testid={`text-request-dates-${req.id}`}>
                            {new Date(req.startDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            {req.startDate !== req.endDate && (
                              <> – {new Date(req.endDate + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</>
                            )}
                          </span>
                          <span className="text-xs ml-1">({req.totalDays} day{req.totalDays !== 1 ? "s" : ""})</span>
                        </div>
                        {req.notes && (
                          <p className="text-xs text-muted-foreground" data-testid={`text-request-notes-${req.id}`}>{req.notes}</p>
                        )}
                        {req.reviewNote && (
                          <p className="text-xs text-muted-foreground italic" data-testid={`text-review-note-${req.id}`}>
                            Manager note: {req.reviewNote}
                          </p>
                        )}
                      </div>
                      {req.status === "pending" && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" data-testid={`button-cancel-request-${req.id}`}>
                              Cancel
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Time-Off Request</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this time-off request? This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Request</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => cancelMutation.mutate(req.id)}
                              >
                                Cancel Request
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Submitted {new Date(req.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
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
