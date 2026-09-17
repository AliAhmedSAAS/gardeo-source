import { useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin } from "lucide-react";
import {
  getGoogleMapsApiKey,
  geocodeAddress,
  geocodePostcode,
  extractUkPostcode,
  loadGoogleMaps,
  parsePlaceResult,
} from "@/lib/google-maps-loader";

export type SiteAddressValue = {
  address: string;
  county: string;
  city: string;
  postcode: string;
  latitude: string;
  longitude: string;
};

type SiteAddressFieldsProps = {
  value: SiteAddressValue;
  onChange: (patch: Partial<SiteAddressValue>) => void;
};

function coordsFromParsed(parsed: { lat?: number; lng?: number }) {
  return {
    latitude: parsed.lat != null ? String(parsed.lat) : "",
    longitude: parsed.lng != null ? String(parsed.lng) : "",
  };
}

export function SiteAddressFields({ value, onChange }: SiteAddressFieldsProps) {
  const addressRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  const lastGeocodedPostcode = useRef("");
  const apiKey = getGoogleMapsApiKey();

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!apiKey || !addressRef.current) return;
    let autocomplete: any;
    let listener: any;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !addressRef.current) return;
        const google = (window as any).google;
        autocomplete = new google.maps.places.Autocomplete(addressRef.current, {
          componentRestrictions: { country: ["gb", "ie"] },
          fields: ["name", "address_components", "formatted_address", "geometry"],
        });
        listener = autocomplete.addListener("place_changed", async () => {
          const place = autocomplete.getPlace();
          let parsed = place?.address_components ? parsePlaceResult(place) : null;
          const query = place?.formatted_address || place?.name || "";
          if (!parsed?.postcode && query) {
            parsed = (await geocodeAddress(query)) || parsed;
          }
          if (!parsed) return;
          const postcode = parsed.postcode || extractUkPostcode(query) || "";
          onChangeRef.current({
            address: parsed.address || place?.name || query,
            county: parsed.county,
            city: parsed.city,
            postcode,
            ...coordsFromParsed(parsed),
          });
          if (postcode) {
            lastGeocodedPostcode.current = postcode.trim().toUpperCase();
            const fromPostcode = await geocodePostcode(postcode);
            if (fromPostcode?.lat != null && fromPostcode?.lng != null) {
              onChangeRef.current({
                latitude: String(fromPostcode.lat),
                longitude: String(fromPostcode.lng),
                city: parsed.city || fromPostcode.city,
                county: parsed.county || fromPostcode.county,
              });
            }
          }
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (listener) listener.remove();
    };
  }, [apiKey]);

  useEffect(() => {
    const postcode = value.postcode.trim().toUpperCase();
    if (!apiKey || postcode.length < 5 || postcode === lastGeocodedPostcode.current) return;
    const timer = window.setTimeout(async () => {
      const parsed = await geocodePostcode(postcode);
      if (!parsed?.lat || parsed.lng == null) return;
      lastGeocodedPostcode.current = postcode;
      onChangeRef.current({
        latitude: String(parsed.lat),
        longitude: String(parsed.lng),
        city: value.city || parsed.city,
        county: value.county || parsed.county,
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [apiKey, value.postcode]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1.5 col-span-2">
        <Label className="text-xs flex items-center gap-1">
          <MapPin className="w-3 h-3" /> Address *
        </Label>
        <Input
          ref={addressRef}
          value={value.address}
          onChange={(e) => {
            const next = e.target.value;
            const found = extractUkPostcode(next);
            onChange(found && found !== value.postcode.trim().toUpperCase()
              ? { address: next, postcode: found }
              : { address: next });
          }}
          placeholder={apiKey ? "e.g. Ab Inbev Magor Brewery NP26 3RA" : "Site address"}
          autoComplete="off"
          data-testid="input-site-address"
        />
        {apiKey ? (
          <p className="text-[11px] text-muted-foreground">Search a site name or postcode in Google, e.g. Ab Inbev Magor Brewery NP26 3RA.</p>
        ) : (
          <p className="text-[11px] text-amber-700">Add VITE_GOOGLE_MAPS_API_KEY to enable Google address lookup.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">County</Label>
        <Input
          value={value.county}
          onChange={(e) => onChange({ county: e.target.value })}
          data-testid="input-site-county"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">City</Label>
        <Input
          value={value.city}
          onChange={(e) => onChange({ city: e.target.value })}
          data-testid="input-site-city"
        />
      </div>
      <div className="space-y-1.5 col-span-2">
        <Label className="text-xs">Postcode</Label>
        <Input
          value={value.postcode}
          onChange={(e) => onChange({ postcode: e.target.value })}
          placeholder="SW1A 1AA"
          data-testid="input-site-postcode"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Latitude</Label>
        <Input
          value={value.latitude}
          readOnly
          placeholder="From postcode"
          data-testid="input-site-lat"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Longitude</Label>
        <Input
          value={value.longitude}
          readOnly
          placeholder="From postcode"
          data-testid="input-site-lng"
        />
      </div>
      <p className="col-span-2 text-[11px] text-muted-foreground -mt-2">
        Latitude and longitude are fetched automatically from the postcode.
      </p>
    </div>
  );
}
