export type ParsedAddress = {
  addressLine1: string;
  addressLine2: string;
  city: string;
  county: string;
  postcode: string;
  country: string;
  lat?: number;
  lng?: number;
};

type AddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type PlaceResult = {
  address_components?: AddressComponent[];
  formatted_address?: string;
  geometry?: { location?: { lat: () => number; lng: () => number } };
};

let loadPromise: Promise<void> | null = null;

export function getGoogleMapsApiKey(): string | undefined {
  return import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || undefined;
}

export function loadGoogleMaps(): Promise<void> {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(new Error("Google Maps API key is not configured"));
  }
  if (typeof window !== "undefined" && (window as any).google?.maps?.places) {
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-google-maps="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Google Maps")));
      return;
    }
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });

  return loadPromise;
}

export function parsePlaceResult(place: PlaceResult): ParsedAddress {
  const components = place.address_components || [];
  const pick = (...types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name || "";

  const streetNumber = pick("street_number");
  const route = pick("route");
  const subpremise = pick("subpremise", "premise");
  const city =
    pick("postal_town", "locality", "sublocality", "administrative_area_level_2") ||
    pick("administrative_area_level_1");
  const county = pick("administrative_area_level_2", "administrative_area_level_1");
  const postcode = pick("postal_code");
  const country = pick("country");

  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim();
  const lat = place.geometry?.location?.lat?.();
  const lng = place.geometry?.location?.lng?.();

  return {
    addressLine1: line1 || (place.formatted_address?.split(",")[0]?.trim() ?? ""),
    addressLine2: subpremise,
    city,
    county,
    postcode,
    country: country || "United Kingdom",
    lat: lat != null ? lat : undefined,
    lng: lng != null ? lng : undefined,
  };
}

export async function geocodeAddress(query: string): Promise<ParsedAddress | null> {
  const q = query.trim();
  if (!q) return null;
  await loadGoogleMaps();
  const google = (window as any).google;
  const geocoder = new google.maps.Geocoder();
  return new Promise((resolve) => {
    geocoder.geocode({ address: q, componentRestrictions: { country: "gb" } }, (results: any[], status: string) => {
      if (status !== "OK" || !results?.[0]) {
        resolve(null);
        return;
      }
      resolve(parsePlaceResult(results[0]));
    });
  });
}
