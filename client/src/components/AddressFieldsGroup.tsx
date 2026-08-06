import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";
import { getGoogleMapsApiKey, loadGoogleMaps, parsePlaceResult, type ParsedAddress } from "@/lib/google-maps-loader";

export type AddressValue = {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postcode?: string;
  country?: string;
};

type AddressFieldsGroupProps = {
  value: AddressValue;
  onChange: (patch: Partial<AddressValue>) => void;
  idPrefix?: string;
  livingFrom?: string;
  livingTo?: string;
  onLivingFromChange?: (value: string) => void;
  onLivingToChange?: (value: string) => void;
};

export function AddressFieldsGroup({
  value,
  onChange,
  idPrefix = "addr",
  livingFrom,
  livingTo,
  onLivingFromChange,
  onLivingToChange,
}: AddressFieldsGroupProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!apiKey || !searchRef.current) return;
    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !searchRef.current) return;
        const google = (window as any).google;
        autocomplete = new google.maps.places.Autocomplete(searchRef.current, {
          componentRestrictions: { country: ["gb", "ie"] },
          fields: ["address_components", "formatted_address"],
          types: ["address"],
        });
        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place?.address_components) return;
          const parsed: ParsedAddress = parsePlaceResult(place);
          onChangeRef.current({
            addressLine1: parsed.addressLine1,
            addressLine2: parsed.addressLine2,
            city: parsed.city,
            county: parsed.county,
            postcode: parsed.postcode,
            country: parsed.country,
          });
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [apiKey]);

  return (
    <div className="space-y-3">
      {apiKey ? (
        <div className="space-y-1">
          <Label className="text-xs flex items-center gap-1">
            <MapPin className="w-3 h-3" /> Search address
          </Label>
          <Input
            ref={searchRef}
            placeholder="Start typing an address..."
            data-testid={`${idPrefix}-search`}
            autoComplete="off"
          />
          <p className="text-[11px] text-muted-foreground">Powered by Google Maps — selects and fills the fields below</p>
        </div>
      ) : (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
          Add <code className="text-[10px]">VITE_GOOGLE_MAPS_API_KEY</code> to enable Google Maps address search.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Address Line 1</Label>
          <Input
            value={value.addressLine1 || ""}
            onChange={(e) => onChange({ addressLine1: e.target.value })}
            data-testid={`${idPrefix}-line1`}
          />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Address Line 2</Label>
          <Input
            value={value.addressLine2 || ""}
            onChange={(e) => onChange({ addressLine2: e.target.value })}
            data-testid={`${idPrefix}-line2`}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">City</Label>
          <Input value={value.city || ""} onChange={(e) => onChange({ city: e.target.value })} data-testid={`${idPrefix}-city`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">County</Label>
          <Input value={value.county || ""} onChange={(e) => onChange({ county: e.target.value })} data-testid={`${idPrefix}-county`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Postcode</Label>
          <Input value={value.postcode || ""} onChange={(e) => onChange({ postcode: e.target.value })} data-testid={`${idPrefix}-postcode`} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Country</Label>
          <Input value={value.country || ""} onChange={(e) => onChange({ country: e.target.value })} data-testid={`${idPrefix}-country`} />
        </div>
        {onLivingFromChange && (
          <div className="space-y-1">
            <Label className="text-xs">Living from</Label>
            <Input type="date" value={livingFrom || ""} onChange={(e) => onLivingFromChange(e.target.value)} />
          </div>
        )}
        {onLivingToChange && (
          <div className="space-y-1">
            <Label className="text-xs">Living to</Label>
            <Input type="date" value={livingTo || ""} onChange={(e) => onLivingToChange(e.target.value)} />
          </div>
        )}
      </div>
    </div>
  );
}
