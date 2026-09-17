import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest, formatApiErrorDescription, formatApiErrorTitle, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2,
  Clock,
  Loader2,
  PhoneCall,
  RefreshCw,
  Undo2,
} from "lucide-react";

const PRECHECK_REASONS = [
  "No internet",
  "Pre-check by contractor",
  "Phone broken",
  "Client does not allow phone",
  "Officer does not know the app",
  "Other",
] as const;

const BOOK_ON_REASONS = [
  "Internet issue",
  "Phone broken",
  "Client does not allow phone",
  "Does not know the app",
  "Other",
] as const;

const CHECK_CALL_REASONS = [
  "No internet",
  "Phone broken",
  "Battery dead",
  "Link not working",
  "Shared live location",
  "Shared timestamp photo",
  "Phone not allowed on site",
  "Client will take check-calls",
  "Check-call by contractor",
  "Other",
] as const;

type PendingCall = {
  id: string;
  callType: "precheck" | "book_on" | "check_call";
  shiftId: number;
  checkCallId?: number;
  dueAt: string | null;
  siteName: string;
  employeeName: string;
  employeePhone: string | null;
  siaLicenseNumber: string | null;
  startTime: string;
  endTime: string;
  date: string;
  status: "pending" | "taken_manual" | "taken_app";
  clientEmail: string | null;
  bookOnEmail: string | null;
  managerEmail: string | null;
  managerName: string | null;
  clientName: string | null;
};

type ReversiblePrecheck = {
  id: string;
  shiftId: number;
  siteName: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  status: "taken_manual";
  reason: string | null;
};

type TakenCheckCall = {
  id: string;
  checkCallId: number;
  shiftId: number;
  siteName: string;
  employeeName: string;
  startTime: string;
  endTime: string;
  status: "taken_app" | "taken_manual";
  method: string | null;
  takenAt: string | null;
  dueAt: string | null;
  distanceMetres: number | null;
  withinRange: boolean | null;
};

type PendingCallsResponse = {
  pending: PendingCall[];
  reversiblePrechecks: ReversiblePrecheck[];
  takenCheckCalls?: TakenCheckCall[];
  fromEmail: string | null;
  fromName: string | null;
};

async function uploadTimestampPhoto(file: File): Promise<string> {
  const urlRes = await apiRequest("POST", "/api/uploads/request-url", {
    name: file.name,
    size: file.size,
    contentType: file.type || "application/octet-stream",
  });
  const data = await urlRes.json();
  if (data.useDirectUpload || !data.uploadURL) {
    const directRes = await fetch("/api/uploads/upload", {
      method: "POST",
      headers: {
        "X-File-Name": file.name,
        "Content-Type": file.type || "application/octet-stream",
      },
      body: file,
      credentials: "include",
    });
    const direct = await directRes.json();
    if (!directRes.ok) throw new Error(direct.error || direct.message || "Upload failed");
    return direct.objectPath as string;
  }
  const uploadRes = await fetch(data.uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type || "application/octet-stream" },
  });
  if (!uploadRes.ok) throw new Error("Failed to upload photo");
  return data.objectPath as string;
}

function callTypeLabel(t: PendingCall["callType"]) {
  if (t === "precheck") return "Precheck";
  if (t === "book_on") return "Book-on";
  return "Check-call";
}

function defaultBookOnMessage(row: PendingCall, bookOnTime: string) {
  const sia = row.siaLicenseNumber || "N/A";
  return `${row.employeeName} (SIA: ${sia}) has booked on at ${row.siteName} at ${bookOnTime}.`;
}

export function CallChasePanel() {
  const { toast } = useToast();
  const { data, isLoading, refetch, isFetching } = useQuery<PendingCallsResponse>({
    queryKey: ["/api/control-room/pending-calls"],
    refetchInterval: 30000,
  });

  const pending = data?.pending || [];
  const reversible = data?.reversiblePrechecks || [];
  const takenCheckCalls = data?.takenCheckCalls || [];

  const [precheckRow, setPrecheckRow] = useState<PendingCall | null>(null);
  const [bookOnRow, setBookOnRow] = useState<PendingCall | null>(null);
  const [checkCallRow, setCheckCallRow] = useState<PendingCall | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [precheckReason, setPrecheckReason] = useState("");
  const [precheckOther, setPrecheckOther] = useState("");

  const [bookOnReason, setBookOnReason] = useState("");
  const [bookOnOther, setBookOnOther] = useState("");
  const [bookOnTime, setBookOnTime] = useState("");
  const [bookOnEmail, setBookOnEmail] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [checkReason, setCheckReason] = useState("");
  const [checkOther, setCheckOther] = useState("");
  const [checkPhotoUrl, setCheckPhotoUrl] = useState<string | null>(null);
  const [checkPhotoName, setCheckPhotoName] = useState<string | null>(null);
  const [checkUploading, setCheckUploading] = useState(false);

  const prechecks = useMemo(() => pending.filter((p) => p.callType === "precheck"), [pending]);
  const bookOns = useMemo(() => pending.filter((p) => p.callType === "book_on"), [pending]);
  const checkCalls = useMemo(() => pending.filter((p) => p.callType === "check_call"), [pending]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/control-room/pending-calls"] });
    queryClient.invalidateQueries({ queryKey: ["/api/shifts"] });
  };

  const resetPrecheckForm = () => {
    setPrecheckReason("");
    setPrecheckOther("");
    setFormError(null);
  };

  const resetBookOnForm = () => {
    setBookOnReason("");
    setBookOnOther("");
    setBookOnTime("");
    setBookOnEmail("");
    setCustomerName("");
    setMessage("");
    setPhotoUrl(null);
    setPhotoName(null);
    setFormError(null);
  };

  const resetCheckForm = () => {
    setCheckReason("");
    setCheckOther("");
    setCheckPhotoUrl(null);
    setCheckPhotoName(null);
    setFormError(null);
  };

  const openPrecheck = (row: PendingCall) => {
    resetPrecheckForm();
    setPrecheckRow(row);
  };

  const openBookOn = (row: PendingCall) => {
    resetBookOnForm();
    const email = row.bookOnEmail || row.clientEmail || row.managerEmail || "";
    if (!email) {
      toast({
        title: "No client email",
        description: "Site/customer has no email — book-on stays pending until an email is set on the site.",
        variant: "destructive",
      });
      return;
    }
    const time = row.startTime?.slice(0, 5) || "";
    setBookOnEmail(email);
    setCustomerName(row.clientName || row.managerName || row.siteName);
    setBookOnTime(time);
    setMessage(defaultBookOnMessage(row, time));
    setBookOnRow(row);
  };

  const openCheckCall = (row: PendingCall) => {
    resetCheckForm();
    setCheckCallRow(row);
  };

  const takePrecheckMut = useMutation({
    mutationFn: async (payload: { shiftId: number; reason?: string; reasonOther?: string; reverse?: boolean }) => {
      const res = await apiRequest("POST", `/api/control-room/shifts/${payload.shiftId}/take-precheck`, {
        reason: payload.reason,
        reasonOther: payload.reasonOther,
        reverse: payload.reverse,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Precheck updated" });
      setPrecheckRow(null);
      resetPrecheckForm();
      invalidate();
    },
    onError: async (err: any) => {
      const title = formatApiErrorTitle(err);
      const description = formatApiErrorDescription(err);
      setFormError(description || title);
      toast({ title, description, variant: "destructive" });
    },
  });

  const takeBookOnMut = useMutation({
    mutationFn: async () => {
      if (!bookOnRow) throw new Error("No row selected");
      if (!bookOnReason) throw new Error("A valid reason is required");
      if (bookOnReason === "Other" && !bookOnOther.trim()) throw new Error("Please provide details for Other");
      if (!bookOnTime.trim()) throw new Error("Book-on time is required");
      if (!photoUrl) throw new Error("Timestamp photo is required");
      if (!bookOnEmail.trim()) throw new Error("Site/customer has no email — cannot take book-on");
      const res = await apiRequest("POST", `/api/control-room/shifts/${bookOnRow.shiftId}/take-book-on`, {
        reason: bookOnReason,
        reasonOther: bookOnOther,
        bookOnTime,
        photoUrl,
        emailTo: bookOnEmail,
        customerName,
        message,
        fromAddress: data?.fromEmail,
      });
      return res.json();
    },
    onSuccess: (result) => {
      toast({
        title: "Book-on taken",
        description: result.emailQueued
          ? "Client email queued/sent."
          : result.emailError
            ? `Saved, but email failed: ${result.emailError}`
            : undefined,
      });
      setBookOnRow(null);
      resetBookOnForm();
      invalidate();
    },
    onError: (err: any) => {
      const msg = err?.message || formatApiErrorDescription(err);
      setFormError(msg);
      toast({ title: formatApiErrorTitle(err), description: msg, variant: "destructive" });
    },
  });

  const takeCheckCallMut = useMutation({
    mutationFn: async () => {
      if (!checkCallRow?.checkCallId) throw new Error("No check-call selected");
      if (!checkReason) throw new Error("A valid reason is required");
      if (checkReason === "Other" && !checkOther.trim()) throw new Error("Please provide details for Other");
      if (!checkPhotoUrl) throw new Error("Timestamp photo is required");
      const res = await apiRequest("POST", `/api/control-room/check-calls/${checkCallRow.checkCallId}/take`, {
        reason: checkReason,
        reasonOther: checkOther,
        photoUrl: checkPhotoUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Check-call taken" });
      setCheckCallRow(null);
      resetCheckForm();
      invalidate();
    },
    onError: (err: any) => {
      const msg = err?.message || formatApiErrorDescription(err);
      setFormError(msg);
      toast({ title: formatApiErrorTitle(err), description: msg, variant: "destructive" });
    },
  });

  const onPhotoSelected = async (file: File | null, kind: "book_on" | "check_call") => {
    if (!file) return;
    try {
      if (kind === "book_on") setUploading(true);
      else setCheckUploading(true);
      const path = await uploadTimestampPhoto(file);
      if (kind === "book_on") {
        setPhotoUrl(path);
        setPhotoName(file.name);
      } else {
        setCheckPhotoUrl(path);
        setCheckPhotoName(file.name);
      }
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      if (kind === "book_on") setUploading(false);
      else setCheckUploading(false);
    }
  };

  const renderRow = (row: PendingCall) => (
    <div
      key={row.id}
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3"
      data-testid={`call-row-${row.id}`}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{callTypeLabel(row.callType)}</Badge>
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending</Badge>
          <span className="font-medium truncate">{row.employeeName}</span>
          <span className="text-muted-foreground text-sm truncate">@ {row.siteName}</span>
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {row.startTime?.slice(0, 5)}–{row.endTime?.slice(0, 5)}
          </span>
          {row.dueAt && (
            <span>Due: {new Date(row.dueAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
          )}
          {row.employeePhone && <span>{row.employeePhone}</span>}
        </div>
      </div>
      <div className="flex gap-2">
        {row.callType === "precheck" && (
          <Button size="sm" onClick={() => openPrecheck(row)} data-testid={`btn-take-precheck-${row.shiftId}`}>
            Take Precheck
          </Button>
        )}
        {row.callType === "book_on" && (
          <Button size="sm" onClick={() => openBookOn(row)} data-testid={`btn-take-bookon-${row.shiftId}`}>
            Take Book-on
          </Button>
        )}
        {row.callType === "check_call" && (
          <Button size="sm" onClick={() => openCheckCall(row)} data-testid={`btn-take-checkcall-${row.checkCallId}`}>
            Take Check-call
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6" data-testid="call-chase-panel">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            Call Chase
          </h2>
          <p className="text-sm text-muted-foreground">
            Take pending Precheck, Book-on, and Check-call when officers cannot use the app.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Refresh</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Pending Precheck</span>
                <Badge variant="secondary">{prechecks.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prechecks.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No pending prechecks.</p>
              ) : (
                prechecks.map(renderRow)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Pending Book-on</span>
                <Badge variant="secondary">{bookOns.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {bookOns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No pending book-ons.</p>
              ) : (
                bookOns.map(renderRow)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span>Due Check-calls</span>
                <Badge variant="secondary">{checkCalls.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {checkCalls.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No due check-calls.</p>
              ) : (
                checkCalls.map(renderRow)
              )}
            </CardContent>
          </Card>

          {takenCheckCalls.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>Taken Check-calls</span>
                  <Badge variant="secondary">{takenCheckCalls.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {takenCheckCalls.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                    data-testid={`taken-checkcall-${row.checkCallId}`}
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          className={
                            row.status === "taken_app"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-blue-100 text-blue-800 hover:bg-blue-100"
                          }
                        >
                          {row.status === "taken_app" ? "Taken (app)" : "Taken (manual)"}
                        </Badge>
                        <span className="font-medium truncate">{row.employeeName}</span>
                        <span className="text-muted-foreground text-sm truncate">@ {row.siteName}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                        {row.takenAt && (
                          <span>
                            Taken {new Date(row.takenAt).toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}
                          </span>
                        )}
                        {row.distanceMetres != null && (
                          <span>
                            {Math.round(row.distanceMetres)}m from site
                            {row.withinRange === false ? " · outside geofence" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {reversible.length > 0 && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base">Taken Precheck (manual) — reverse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {reversible.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Taken (manual)
                        </Badge>
                        <span className="font-medium">{row.employeeName}</span>
                        <span className="text-muted-foreground text-sm">@ {row.siteName}</span>
                      </div>
                      {row.reason && (
                        <p className="text-xs text-muted-foreground mt-1">Reason: {row.reason}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={takePrecheckMut.isPending}
                      onClick={() =>
                        takePrecheckMut.mutate({ shiftId: row.shiftId, reverse: true })
                      }
                      data-testid={`btn-reverse-precheck-${row.shiftId}`}
                    >
                      <Undo2 className="w-4 h-4 mr-1" />
                      Reverse Precheck
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Take Precheck */}
      <Dialog
        open={!!precheckRow}
        onOpenChange={(open) => {
          if (!open) {
            setPrecheckRow(null);
            resetPrecheckForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Precheck</DialogTitle>
          </DialogHeader>
          {precheckRow && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm manual precheck for <strong>{precheckRow.employeeName}</strong> at{" "}
                <strong>{precheckRow.siteName}</strong>.
              </p>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={precheckReason} onValueChange={setPrecheckReason}>
                  <SelectTrigger data-testid="select-precheck-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRECHECK_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {precheckReason === "Other" && (
                <div className="space-y-2">
                  <Label>Other details</Label>
                  <Input
                    value={precheckOther}
                    onChange={(e) => setPrecheckOther(e.target.value)}
                    placeholder="Describe the reason"
                    data-testid="input-precheck-other"
                  />
                </div>
              )}
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPrecheckRow(null);
                resetPrecheckForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={takePrecheckMut.isPending || !precheckRow}
              onClick={() => {
                setFormError(null);
                if (!precheckReason) {
                  setFormError("A valid reason is required");
                  return;
                }
                if (precheckReason === "Other" && !precheckOther.trim()) {
                  setFormError("Please provide details for Other");
                  return;
                }
                takePrecheckMut.mutate({
                  shiftId: precheckRow!.shiftId,
                  reason: precheckReason,
                  reasonOther: precheckOther,
                });
              }}
              data-testid="btn-submit-take-precheck"
            >
              {takePrecheckMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirm Precheck
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Take Book-on */}
      <Dialog
        open={!!bookOnRow}
        onOpenChange={(open) => {
          if (!open) {
            setBookOnRow(null);
            resetBookOnForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Take Book-on</DialogTitle>
          </DialogHeader>
          {bookOnRow && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manual book-on for <strong>{bookOnRow.employeeName}</strong> at{" "}
                <strong>{bookOnRow.siteName}</strong>.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Customer / site email</Label>
                  <Input value={bookOnEmail} onChange={(e) => setBookOnEmail(e.target.value)} data-testid="input-bookon-email" />
                </div>
                <div className="space-y-2">
                  <Label>Customer name</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>From (control room)</Label>
                  <Input value={data?.fromEmail || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Officer contact</Label>
                  <Input value={bookOnRow.employeePhone || ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>Book-on time</Label>
                  <Input
                    type="time"
                    value={bookOnTime}
                    onChange={(e) => {
                      setBookOnTime(e.target.value);
                      setMessage(defaultBookOnMessage(bookOnRow, e.target.value));
                    }}
                    data-testid="input-bookon-time"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>Manual book-on reason</Label>
                <Select value={bookOnReason} onValueChange={setBookOnReason}>
                  <SelectTrigger data-testid="select-bookon-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOK_ON_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bookOnReason === "Other" && (
                <div className="space-y-2">
                  <Label>Other details</Label>
                  <Input
                    value={bookOnOther}
                    onChange={(e) => setBookOnOther(e.target.value)}
                    data-testid="input-bookon-other"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Timestamp photo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPhotoSelected(e.target.files?.[0] || null, "book_on")}
                  data-testid="input-bookon-photo"
                />
                {uploading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                  </p>
                )}
                {photoUrl && !uploading && (
                  <p className="text-xs text-green-700">Attached: {photoName || "photo"}</p>
                )}
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setBookOnRow(null);
                resetBookOnForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={takeBookOnMut.isPending || uploading || !bookOnRow}
              onClick={() => {
                setFormError(null);
                takeBookOnMut.mutate();
              }}
              data-testid="btn-submit-take-bookon"
            >
              {takeBookOnMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirm Book-on
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Take Check-call */}
      <Dialog
        open={!!checkCallRow}
        onOpenChange={(open) => {
          if (!open) {
            setCheckCallRow(null);
            resetCheckForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Take Check-call</DialogTitle>
          </DialogHeader>
          {checkCallRow && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Confirm check-call for <strong>{checkCallRow.employeeName}</strong> at{" "}
                <strong>{checkCallRow.siteName}</strong>.
              </p>
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={checkReason} onValueChange={setCheckReason}>
                  <SelectTrigger data-testid="select-checkcall-reason">
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHECK_CALL_REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {checkReason === "Other" && (
                <div className="space-y-2">
                  <Label>Other details</Label>
                  <Input
                    value={checkOther}
                    onChange={(e) => setCheckOther(e.target.value)}
                    data-testid="input-checkcall-other"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Timestamp photo</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => onPhotoSelected(e.target.files?.[0] || null, "check_call")}
                  data-testid="input-checkcall-photo"
                />
                {checkUploading && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Uploading…
                  </p>
                )}
                {checkPhotoUrl && !checkUploading && (
                  <p className="text-xs text-green-700">Attached: {checkPhotoName || "photo"}</p>
                )}
              </div>
              {formError && <p className="text-sm text-destructive">{formError}</p>}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCheckCallRow(null);
                resetCheckForm();
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={takeCheckCallMut.isPending || checkUploading || !checkCallRow}
              onClick={() => {
                setFormError(null);
                takeCheckCallMut.mutate();
              }}
              data-testid="btn-submit-take-checkcall"
            >
              {takeCheckCallMut.isPending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              Confirm Check-call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
