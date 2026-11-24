import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Megaphone, Search, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SitePicker } from "@/components/broadcast/SitePicker";
import { OfficerTable } from "@/components/broadcast/OfficerTable";
import { MessageComposer } from "@/components/broadcast/MessageComposer";
import type {
  BroadcastChannel, BroadcastConfig, BroadcastOfficer, BroadcastSite, BroadcastStatus,
  MessageScope, OfficerFilter, OfficerSearchResult, ShiftMessage,
} from "@/components/broadcast/types";

const FILTER_OPTIONS: { value: OfficerFilter; label: string }[] = [
  { value: "all", label: "All officers" },
  { value: "previously_worked", label: "Previously worked at this site" },
  { value: "car_owner", label: "Car owners" },
  { value: "new", label: "New officers" },
];

const POLL_MS = 2000;

function readShiftIdFromUrl(): number | null {
  const id = Number(new URLSearchParams(window.location.search).get("id"));
  return Number.isInteger(id) && id > 0 ? id : null;
}

type PendingSend = { channel: BroadcastChannel; employeeIds: number[]; label: string };

export default function BroadcastPage() {
  const { toast } = useToast();
  const [shiftId] = useState(readShiftIdFromUrl);
  const [scope, setScope] = useState<MessageScope>("single");
  const [site, setSite] = useState<BroadcastSite | null>(null);
  const [postcode, setPostcode] = useState("");
  const [radius, setRadius] = useState(10);
  const [filter, setFilter] = useState<OfficerFilter>("all");
  const [officerType, setOfficerType] = useState("all");
  const [name, setName] = useState("");
  const [result, setResult] = useState<OfficerSearchResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [pendingSend, setPendingSend] = useState<PendingSend | null>(null);
  const [broadcastId, setBroadcastId] = useState<number | null>(null);

  const { data: config } = useQuery<BroadcastConfig>({ queryKey: ["/api/broadcast/config"] });
  const { data: officerTypes = [] } = useQuery<{ id: number; name: string }[]>({ queryKey: ["/api/tenant/officer-types"] });

  const { data: shiftMessage, error: shiftError } = useQuery<ShiftMessage>({
    queryKey: [`/api/broadcast/shift/${shiftId}/message?scope=${scope}`],
    enabled: !!shiftId,
  });

  useEffect(() => {
    if (!shiftMessage) return;
    setSite(shiftMessage.site);
    setSubject(shiftMessage.subject);
    setBody(shiftMessage.body);
  }, [shiftMessage]);

  const { data: status } = useQuery<BroadcastStatus>({
    queryKey: [`/api/broadcast/${broadcastId}`],
    enabled: !!broadcastId,
    refetchInterval: (query) => (query.state.data?.status === "completed" ? false : POLL_MS),
  });

  const searchMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/broadcast/officers/search", {
        siteId: site?.id,
        postcode: postcode.trim() || undefined,
        radiusMiles: radius,
        filter,
        officerType: officerType === "all" ? undefined : officerType,
        name: name.trim() || undefined,
      });
      return (await res.json()) as OfficerSearchResult;
    },
    onSuccess: (data) => {
      setResult(data);
      setSelected(new Set());
    },
    onError: (err: Error) => toast({ title: "Search failed", description: err.message, variant: "destructive" }),
  });

  const sendMutation = useMutation({
    mutationFn: async (p: PendingSend) => {
      const res = await apiRequest("POST", "/api/broadcast/send", {
        channel: p.channel,
        employeeIds: p.employeeIds,
        subject: p.channel === "email" ? subject.trim() : undefined,
        body: body.trim(),
        shiftId: shiftId ?? undefined,
        siteId: site?.id,
      });
      return (await res.json()) as { id: number; queued: number; skipped: number };
    },
    onSuccess: (data) => {
      setBroadcastId(data.id);
      toast({
        title: "Broadcast started",
        description: `${data.queued} queued${data.skipped ? `, ${data.skipped} skipped (no contact details)` : ""}.`,
      });
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const isSending = sendMutation.isPending || status?.status === "sending";
  const canSearch = !!site || postcode.trim().length >= 5;

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const requestBulk = (channel: BroadcastChannel) => {
    if (config && selectedIds.length > config.maxRecipients) {
      toast({ title: "Too many recipients", description: `Select at most ${config.maxRecipients} officers per broadcast.`, variant: "destructive" });
      return;
    }
    setPendingSend({ channel, employeeIds: selectedIds, label: `${selectedIds.length} officer${selectedIds.length === 1 ? "" : "s"}` });
  };

  const requestSingle = (officer: BroadcastOfficer, channel: BroadcastChannel) => {
    setPendingSend({ channel, employeeIds: [officer.employeeId], label: officer.name });
  };

  return (
    <div className="p-6 space-y-6" data-testid="broadcast-page">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 bg-primary">
          <Megaphone className="w-5 h-5 text-primary-foreground" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Email & SMS Broadcast</h1>
          <p className="text-muted-foreground text-sm">Find in-house officers near a site and send them shift details by email or SMS.</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Find officers</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Site</Label>
                  <SitePicker value={site} onChange={setSite} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Or postcode (overrides site location)</Label>
                  <Input value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="e.g. SW19 7NS" maxLength={10} data-testid="input-postcode" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Radius</Label>
                  <Select value={String(radius)} onValueChange={(v) => setRadius(Number(v))}>
                    <SelectTrigger data-testid="select-radius"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(config?.radiusOptions ?? [10, 20, 30, 50, 100]).map((r) => (
                        <SelectItem key={r} value={String(r)}>{r} miles</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Show</Label>
                  <Select value={filter} onValueChange={(v) => setFilter(v as OfficerFilter)}>
                    <SelectTrigger data-testid="select-filter"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FILTER_OPTIONS.map((f) => (
                        <SelectItem key={f.value} value={f.value} disabled={f.value === "previously_worked" && !site}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Officer type</Label>
                  <Select value={officerType} onValueChange={setOfficerType}>
                    <SelectTrigger data-testid="select-officer-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All types</SelectItem>
                      {officerTypes.map((t) => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Search name" maxLength={100} data-testid="input-officer-name" />
                </div>
              </div>
              <Button onClick={() => searchMutation.mutate()} disabled={!canSearch || searchMutation.isPending} data-testid="button-search-officers">
                {searchMutation.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
                Search officers
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {result.officers.length} officer{result.officers.length === 1 ? "" : "s"} found
                  {selected.size > 0 && <span className="text-muted-foreground font-normal"> · {selected.size} selected</span>}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Centre: {result.center.postcode || `${result.center.lat.toFixed(4)}, ${result.center.lng.toFixed(4)}`}
                  {result.truncated && " · showing the nearest results only"}
                  {result.geocodePending > 0 && ` · ${result.geocodePending} officer postcodes still being located, search again shortly`}
                </p>
              </CardHeader>
              <CardContent>
                <OfficerTable
                  officers={result.officers}
                  selected={selected}
                  onSelectionChange={setSelected}
                  onSendSingle={requestSingle}
                  emailEnabled={!!config?.emailEnabled}
                  smsEnabled={!!config?.smsEnabled}
                  sending={isSending}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Message</CardTitle>
            {shiftId && (
              <div className="space-y-1">
                <Label className="text-xs">Shifts to include</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as MessageScope)}>
                  <SelectTrigger data-testid="select-scope"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">This shift only</SelectItem>
                    <SelectItem value="all">All open shifts at this site</SelectItem>
                  </SelectContent>
                </Select>
                {shiftError && <p className="text-xs text-red-600">{(shiftError as Error).message}</p>}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <MessageComposer
              subject={subject}
              body={body}
              onSubjectChange={setSubject}
              onBodyChange={setBody}
              config={config}
              selectedCount={selected.size}
              sending={isSending}
              status={status ?? null}
              onSendBulk={requestBulk}
            />
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!pendingSend} onOpenChange={(open) => { if (!open) setPendingSend(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send {pendingSend?.channel === "email" ? "email" : "SMS"}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will send the current message to {pendingSend?.label}. Officers without a valid
              {pendingSend?.channel === "email" ? " email address" : " mobile number"} will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingSend) sendMutation.mutate(pendingSend); setPendingSend(null); }}
              data-testid="button-confirm-send"
            >
              Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
