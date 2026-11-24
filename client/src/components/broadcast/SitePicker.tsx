import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPinned, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { BroadcastSite } from "./types";

type Props = {
  value: BroadcastSite | null;
  onChange: (site: BroadcastSite | null) => void;
  disabled?: boolean;
};

const DEBOUNCE_MS = 300;

export function SitePicker({ value, onChange, disabled }: Props) {
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [text]);

  const { data: sites = [], isFetching } = useQuery<BroadcastSite[]>({
    queryKey: [`/api/broadcast/sites?q=${encodeURIComponent(query)}`],
    enabled: !value && query.length >= 2,
  });

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm" data-testid="broadcast-selected-site">
        <MapPinned className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{value.name}</div>
          {value.address && value.address !== value.name && (
            <div className="text-xs text-muted-foreground truncate">{value.address}</div>
          )}
        </div>
        {!disabled && (
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onChange(null)} data-testid="button-clear-site">
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search site by name, address or postcode"
        disabled={disabled}
        data-testid="input-site-search"
      />
      {query.length >= 2 && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md max-h-64 overflow-y-auto">
          {isFetching && <div className="p-2 text-xs text-muted-foreground">Searching…</div>}
          {!isFetching && sites.length === 0 && <div className="p-2 text-xs text-muted-foreground">No sites found</div>}
          {sites.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
              onClick={() => { onChange(s); setText(""); setQuery(""); }}
              data-testid={`option-site-${s.id}`}
            >
              <div className="font-medium truncate">{s.name}</div>
              {s.address && s.address !== s.name && <div className="text-xs text-muted-foreground truncate">{s.address}</div>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
