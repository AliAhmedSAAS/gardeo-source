import { storage } from "./storage";

export function haversineDistanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseGpsCoords(lat: unknown, lng: unknown):
  | { ok: true; lat: number; lng: number }
  | { ok: false; message: string } {
  if (lat == null || lng == null || lat === "" || lng === "") {
    return { ok: false, message: "Location is required. Please enable GPS and try again." };
  }
  const parsedLat = parseFloat(String(lat));
  const parsedLng = parseFloat(String(lng));
  if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
    return { ok: false, message: "Location is required. Please enable GPS and try again." };
  }
  if (parsedLat < -90 || parsedLat > 90 || parsedLng < -180 || parsedLng > 180) {
    return { ok: false, message: "Invalid GPS coordinates." };
  }
  return { ok: true, lat: parsedLat, lng: parsedLng };
}

export type GeofenceResult = {
  lat: number;
  lng: number;
  distanceMetres: number | null;
  withinRange: boolean;
  geofenceRadius: number;
  siteHasCoords: boolean;
};

export async function resolveShiftGeofence(params: {
  siteId: number | null | undefined;
  tenantGeofenceRadius?: number | null;
  lat: number;
  lng: number;
}): Promise<GeofenceResult> {
  let geofenceRadius = params.tenantGeofenceRadius ?? 200;
  let distanceMetres: number | null = null;
  let withinRange = true;
  let siteHasCoords = false;

  if (params.siteId) {
    const site = await storage.getSite(params.siteId);
    if (site?.geofenceRadiusMetres != null) geofenceRadius = site.geofenceRadiusMetres;
    if (site?.latitude && site?.longitude) {
      const siteLat = parseFloat(site.latitude);
      const siteLng = parseFloat(site.longitude);
      if (!Number.isNaN(siteLat) && !Number.isNaN(siteLng)) {
        siteHasCoords = true;
        distanceMetres = Math.round(haversineDistanceMetres(params.lat, params.lng, siteLat, siteLng) * 100) / 100;
        if (distanceMetres > geofenceRadius) withinRange = false;
      }
    }
  }

  return {
    lat: params.lat,
    lng: params.lng,
    distanceMetres,
    withinRange,
    geofenceRadius,
    siteHasCoords,
  };
}

export function geofenceOutOfRangeMessage(geo: GeofenceResult, action: string): string | null {
  if (!geo.siteHasCoords || geo.withinRange) return null;
  const dist = geo.distanceMetres != null ? Math.round(geo.distanceMetres) : null;
  const distanceText = dist != null ? `${dist}m away` : "outside the site geofence";
  return `You must be at the site to ${action}. You are ${distanceText} (limit: ${geo.geofenceRadius}m).`;
}
