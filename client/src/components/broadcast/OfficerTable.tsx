import { Mail, MessageSquare, Car } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BroadcastChannel, BroadcastOfficer } from "./types";

type Props = {
  officers: BroadcastOfficer[];
  selected: Set<number>;
  onSelectionChange: (next: Set<number>) => void;
  onSendSingle: (officer: BroadcastOfficer, channel: BroadcastChannel) => void;
  emailEnabled: boolean;
  smsEnabled: boolean;
  sending: boolean;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function OfficerTable({ officers, selected, onSelectionChange, onSendSingle, emailEnabled, smsEnabled, sending }: Props) {
  const allSelected = officers.length > 0 && officers.every((o) => selected.has(o.employeeId));

  const toggleAll = (checked: boolean) => {
    onSelectionChange(checked ? new Set(officers.map((o) => o.employeeId)) : new Set());
  };

  const toggleOne = (id: number, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    onSelectionChange(next);
  };

  if (officers.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No officers match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto border rounded-md">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr className="text-left">
            <th className="p-2 w-8">
              <Checkbox checked={allSelected} onCheckedChange={(v) => toggleAll(!!v)} data-testid="checkbox-select-all-officers" />
            </th>
            <th className="p-2">Officer</th>
            <th className="p-2 text-right">Miles</th>
            <th className="p-2">Postcode</th>
            <th className="p-2">Type</th>
            <th className="p-2 text-center">Site shifts</th>
            <th className="p-2">Last worked</th>
            <th className="p-2">Email</th>
            <th className="p-2">Mobile</th>
            <th className="p-2 text-center">Send</th>
          </tr>
        </thead>
        <tbody>
          {officers.map((o) => (
            <tr key={o.employeeId} className="border-t" data-testid={`row-officer-${o.employeeId}`}>
              <td className="p-2">
                <Checkbox checked={selected.has(o.employeeId)} onCheckedChange={(v) => toggleOne(o.employeeId, !!v)} />
              </td>
              <td className="p-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{o.name}</span>
                  {o.carOwner && <Car className="w-3.5 h-3.5 text-muted-foreground" aria-label="Car owner" />}
                  {o.isNew && <Badge variant="secondary" className="text-[10px]">New</Badge>}
                </div>
              </td>
              <td className="p-2 text-right font-mono">{o.distanceMiles.toFixed(1)}</td>
              <td className="p-2 font-mono">{o.postcode || "—"}</td>
              <td className="p-2">{o.officerType || "—"}</td>
              <td className="p-2 text-center">{o.siteShifts || "—"}</td>
              <td className="p-2 font-mono">{formatDate(o.lastWorked)}</td>
              <td className="p-2 max-w-[180px] truncate" title={o.email || ""}>{o.email || <span className="text-muted-foreground">—</span>}</td>
              <td className="p-2 font-mono">{o.phone || <span className="text-muted-foreground">—</span>}</td>
              <td className="p-2">
                <div className="flex justify-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={sending || !emailEnabled || !o.email}
                    onClick={() => onSendSingle(o, "email")}
                    title="Send email"
                    data-testid={`button-email-officer-${o.employeeId}`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={sending || !smsEnabled || !o.phone}
                    onClick={() => onSendSingle(o, "sms")}
                    title="Send SMS"
                    data-testid={`button-sms-officer-${o.employeeId}`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
