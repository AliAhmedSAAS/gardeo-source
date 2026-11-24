import { Mail, MessageSquare, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { BroadcastChannel, BroadcastConfig, BroadcastStatus } from "./types";

type Props = {
  subject: string;
  body: string;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  config: BroadcastConfig | undefined;
  selectedCount: number;
  sending: boolean;
  status: BroadcastStatus | null;
  onSendBulk: (channel: BroadcastChannel) => void;
};

const SMS_SINGLE = 160;
const SMS_MULTIPART = 153;

function smsSegments(length: number): number {
  if (length === 0) return 0;
  return length <= SMS_SINGLE ? 1 : Math.ceil(length / SMS_MULTIPART);
}

export function MessageComposer({ subject, body, onSubjectChange, onBodyChange, config, selectedCount, sending, status, onSendBulk }: Props) {
  const canSend = selectedCount > 0 && body.trim().length > 0 && !sending;

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="broadcast-subject" className="text-xs">Email subject</Label>
        <Input
          id="broadcast-subject"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          maxLength={200}
          data-testid="input-broadcast-subject"
        />
      </div>
      <div>
        <Label htmlFor="broadcast-body" className="text-xs">Message</Label>
        <Textarea
          id="broadcast-body"
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          rows={10}
          maxLength={5000}
          className="font-mono text-xs"
          data-testid="textarea-broadcast-body"
        />
        <p className="text-[11px] text-muted-foreground mt-1">
          {body.length} characters · {smsSegments(body.length)} SMS segment{smsSegments(body.length) === 1 ? "" : "s"}
        </p>
      </div>

      <div className="text-[11px] text-muted-foreground space-y-0.5">
        <div>Email from: {config?.emailEnabled ? config.emailFrom : "not configured (Settings → Email / SMTP)"}</div>
        <div>SMS: {config?.smsEnabled ? "Twilio configured" : "Twilio not configured"}</div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={!canSend || !config?.emailEnabled || !subject.trim()}
          onClick={() => onSendBulk("email")}
          data-testid="button-send-bulk-email"
        >
          {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />}
          Email {selectedCount} selected
        </Button>
        <Button
          variant="outline"
          disabled={!canSend || !config?.smsEnabled}
          onClick={() => onSendBulk("sms")}
          data-testid="button-send-bulk-sms"
        >
          {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MessageSquare className="w-4 h-4 mr-1" />}
          SMS {selectedCount} selected
        </Button>
      </div>

      {status && (
        <div className="rounded-md border p-3 text-xs space-y-1" data-testid="broadcast-status">
          <div className="font-medium">
            {status.channel === "email" ? "Email" : "SMS"} broadcast #{status.id} — {status.status === "sending" ? "sending…" : "completed"}
          </div>
          <div>
            Sent {status.sentCount} of {status.recipientCount}
            {status.failedCount > 0 && <span className="text-red-600"> · {status.failedCount} failed</span>}
          </div>
          {status.failures.length > 0 && (
            <ul className="max-h-32 overflow-y-auto list-disc pl-4 text-muted-foreground">
              {status.failures.map((f, i) => (
                <li key={`${f.employeeId}-${i}`}>{f.name || f.destination || "Unknown"}: {f.error || "Failed"}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
