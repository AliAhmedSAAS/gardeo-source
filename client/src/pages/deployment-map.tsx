import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MapPin,
  Building2,
  Globe,
  Eye,
  Loader2,
  Search,
  Users,
  Shield,
  AlertTriangle,
  Flame,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers,
  BarChart3,
} from "lucide-react";
import type { Site } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

interface MapSite extends Site {
  activeShiftCount: number;
  assignedOfficers: number;
  unfilledShifts: number;
  status: "active" | "inactive" | "understaffed" | "no_shifts";
}

interface RegionData {
  name: string;
  sites: number;
  activeSites: number;
  officers: number;
  activeShifts: number;
  unfilledShifts: number;
}

interface MapData {
  sites: MapSite[];
  totalOfficers: number;
  totalDeployedOfficers: number;
  totalActiveShifts: number;
  regions: RegionData[];
}

const postcodeCoords: Record<string, { lat: number; lng: number }> = {
  EC: { lat: 51.515, lng: -0.089 }, WC: { lat: 51.516, lng: -0.12 },
  SW: { lat: 51.47, lng: -0.17 }, SE: { lat: 51.48, lng: -0.05 },
  NW: { lat: 51.55, lng: -0.19 }, W1: { lat: 51.514, lng: -0.145 },
  E1: { lat: 51.515, lng: -0.06 }, N1: { lat: 51.54, lng: -0.1 },
  BR: { lat: 51.4, lng: 0.03 }, CR: { lat: 51.37, lng: -0.1 },
  DA: { lat: 51.44, lng: 0.18 }, EN: { lat: 51.65, lng: -0.08 },
  HA: { lat: 51.58, lng: -0.34 }, IG: { lat: 51.56, lng: 0.07 },
  KT: { lat: 51.38, lng: -0.3 }, RM: { lat: 51.57, lng: 0.18 },
  SM: { lat: 51.37, lng: -0.17 }, TW: { lat: 51.44, lng: -0.35 },
  UB: { lat: 51.54, lng: -0.43 }, WD: { lat: 51.67, lng: -0.38 },
  AL: { lat: 51.75, lng: -0.34 }, B1: { lat: 52.48, lng: -1.9 },
  BA: { lat: 51.38, lng: -2.36 }, BB: { lat: 53.78, lng: -2.47 },
  BD: { lat: 53.79, lng: -1.75 }, BH: { lat: 50.72, lng: -1.88 },
  BL: { lat: 53.58, lng: -2.43 }, BN: { lat: 50.83, lng: -0.14 },
  BS: { lat: 51.45, lng: -2.58 }, CA: { lat: 54.89, lng: -2.93 },
  CB: { lat: 52.2, lng: 0.12 }, CF: { lat: 51.48, lng: -3.18 },
  CH: { lat: 53.19, lng: -2.89 }, CM: { lat: 51.73, lng: 0.47 },
  CO: { lat: 51.89, lng: 0.9 }, CT: { lat: 51.28, lng: 1.08 },
  CV: { lat: 52.41, lng: -1.51 }, CW: { lat: 53.1, lng: -2.44 },
  DE: { lat: 52.92, lng: -1.48 }, DH: { lat: 54.78, lng: -1.57 },
  DL: { lat: 54.52, lng: -1.55 }, DN: { lat: 53.52, lng: -1.13 },
  DT: { lat: 50.71, lng: -2.44 }, DY: { lat: 52.51, lng: -2.09 },
  EH: { lat: 55.95, lng: -3.19 }, EX: { lat: 50.72, lng: -3.53 },
  FK: { lat: 56.12, lng: -3.94 }, FY: { lat: 53.82, lng: -3.05 },
  G1: { lat: 55.86, lng: -4.25 }, GL: { lat: 51.86, lng: -2.24 },
  GU: { lat: 51.24, lng: -0.77 }, HD: { lat: 53.64, lng: -1.78 },
  HG: { lat: 54.0, lng: -1.54 }, HP: { lat: 51.75, lng: -0.74 },
  HR: { lat: 52.06, lng: -2.72 }, HU: { lat: 53.74, lng: -0.33 },
  HX: { lat: 53.73, lng: -1.86 }, IP: { lat: 52.06, lng: 1.16 },
  IV: { lat: 57.48, lng: -4.22 }, KA: { lat: 55.46, lng: -4.63 },
  LA: { lat: 54.05, lng: -2.8 }, LD: { lat: 52.25, lng: -3.38 },
  LE: { lat: 52.63, lng: -1.13 }, LL: { lat: 53.23, lng: -3.83 },
  LN: { lat: 53.23, lng: -0.54 }, LS: { lat: 53.8, lng: -1.55 },
  LU: { lat: 51.88, lng: -0.42 }, M1: { lat: 53.48, lng: -2.24 },
  ME: { lat: 51.39, lng: 0.54 }, MK: { lat: 52.04, lng: -0.76 },
  NE: { lat: 54.98, lng: -1.61 }, NG: { lat: 52.95, lng: -1.15 },
  NN: { lat: 52.24, lng: -0.9 }, NP: { lat: 51.59, lng: -2.99 },
  NR: { lat: 52.63, lng: 1.3 }, OL: { lat: 53.54, lng: -2.12 },
  OX: { lat: 51.75, lng: -1.26 }, PE: { lat: 52.57, lng: -0.24 },
  PL: { lat: 50.37, lng: -4.14 }, PO: { lat: 50.8, lng: -1.09 },
  PR: { lat: 53.76, lng: -2.7 }, RG: { lat: 51.45, lng: -0.98 },
  RH: { lat: 51.12, lng: -0.19 }, SA: { lat: 51.62, lng: -3.94 },
  SG: { lat: 51.9, lng: -0.1 }, SK: { lat: 53.39, lng: -2.16 },
  SL: { lat: 51.51, lng: -0.59 }, SN: { lat: 51.56, lng: -1.78 },
  SO: { lat: 50.9, lng: -1.4 }, SP: { lat: 51.07, lng: -1.8 },
  SR: { lat: 54.91, lng: -1.38 }, SS: { lat: 51.54, lng: 0.71 },
  ST: { lat: 53.0, lng: -2.18 }, SY: { lat: 52.71, lng: -2.75 },
  TA: { lat: 51.02, lng: -3.1 }, TF: { lat: 52.68, lng: -2.49 },
  TN: { lat: 51.13, lng: 0.26 }, TQ: { lat: 50.46, lng: -3.56 },
  TR: { lat: 50.26, lng: -5.05 }, TS: { lat: 54.57, lng: -1.23 },
  WA: { lat: 53.39, lng: -2.59 }, WF: { lat: 53.68, lng: -1.5 },
  WN: { lat: 53.55, lng: -2.63 }, WR: { lat: 52.19, lng: -2.22 },
  WS: { lat: 52.58, lng: -1.98 }, WV: { lat: 52.59, lng: -2.13 },
  YO: { lat: 53.96, lng: -1.08 }, AB: { lat: 57.15, lng: -2.09 },
  DD: { lat: 56.46, lng: -2.97 }, KY: { lat: 56.21, lng: -3.15 },
  ML: { lat: 55.77, lng: -3.99 }, PA: { lat: 55.84, lng: -4.43 },
  PH: { lat: 56.65, lng: -3.43 }, TD: { lat: 55.6, lng: -2.69 },
  BT: { lat: 54.6, lng: -5.93 },
};

function getSiteLatLng(site: Site): [number, number] | null {
  if (site.latitude && site.longitude) {
    const lat = parseFloat(site.latitude);
    const lng = parseFloat(site.longitude);
    if (!isNaN(lat) && !isNaN(lng)) return [lat, lng];
  }
  if (site.postcode) {
    const prefix = site.postcode.trim().toUpperCase().replace(/\s+/g, "").slice(0, 2);
    const match = postcodeCoords[prefix] || postcodeCoords[prefix[0] + "1"];
    if (match) return [match.lat, match.lng];
  }
  return null;
}

function createMarkerIcon(status: string): L.DivIcon {
  const colors: Record<string, { bg: string; border: string; pulse: string }> = {
    active: { bg: "#10B981", border: "#059669", pulse: "rgba(16,185,129,0.4)" },
    understaffed: { bg: "#F59E0B", border: "#D97706", pulse: "rgba(245,158,11,0.4)" },
    inactive: { bg: "#6B7280", border: "#4B5563", pulse: "none" },
    no_shifts: { bg: "#3B82F6", border: "#2563EB", pulse: "none" },
  };
  const c = colors[status] || colors.inactive;
  const hasPulse = status === "active" || status === "understaffed";

  return L.divIcon({
    className: "custom-marker",
    html: `<div style="position:relative;width:28px;height:28px;">
      ${hasPulse ? `<div style="position:absolute;top:-4px;left:-4px;width:36px;height:36px;border-radius:50%;background:${c.pulse};animation:pulse 2s ease-in-out infinite;"></div>` : ""}
      <div style="position:absolute;top:0;left:0;width:28px;height:28px;border-radius:50%;background:${c.bg};border:3px solid ${c.border};box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 2a8 8 0 0 1 8 8.2c0 7.3-8 11.8-8 11.8z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });
}

function HeatMapLayer({ sites }: { sites: MapSite[] }) {
  const map = useMap();

  useEffect(() => {
    const heatPoints: [number, number, number][] = [];
    sites.forEach(site => {
      const coords = getSiteLatLng(site);
      if (coords) {
        const intensity = site.status === "active" ? 0.8 :
                         site.status === "understaffed" ? 0.6 :
                         site.status === "no_shifts" ? 0.3 : 0.1;
        heatPoints.push([coords[0], coords[1], intensity]);
      }
    });

    if (heatPoints.length === 0) return;

    const heat = (L as any).heatLayer(heatPoints, {
      radius: 35,
      blur: 25,
      maxZoom: 10,
      max: 1.0,
      gradient: {
        0.0: "#1F3A5F",
        0.3: "#3B82F6",
        0.5: "#10B981",
        0.7: "#F59E0B",
        1.0: "#EF4444",
      },
    });

    heat.addTo(map);
    return () => { map.removeLayer(heat); };
  }, [map, sites]);

  return null;
}

function MapBoundsHandler({ sites }: { sites: MapSite[] }) {
  const map = useMap();

  useEffect(() => {
    const coords = sites
      .map(s => getSiteLatLng(s))
      .filter(Boolean) as [number, number][];
    if (coords.length > 1) {
      const bounds = L.latLngBounds(coords.map(c => L.latLng(c[0], c[1])));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    } else if (coords.length === 1) {
      map.setView(coords[0], 10);
    }
  }, [map, sites]);

  return null;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
    active: { label: "Active", variant: "default", icon: Activity },
    understaffed: { label: "Understaffed", variant: "destructive", icon: AlertTriangle },
    inactive: { label: "Inactive", variant: "secondary", icon: null },
    no_shifts: { label: "No Shifts Today", variant: "outline", icon: null },
  };
  const c = config[status] || config.inactive;
  const Icon = c.icon;
  return (
    <Badge variant={c.variant} className="text-xs" data-testid={`badge-status-${status}`}>
      {Icon && <Icon className="w-3 h-3 mr-1" />}
      {c.label}
    </Badge>
  );
}

export default function DeploymentMapPage() {
  const [selectedSite, setSelectedSite] = useState<MapSite | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showRegions, setShowRegions] = useState(true);

  const { data: mapData, isLoading } = useQuery<MapData>({
    queryKey: ["/api/map-data"],
    refetchInterval: 30000,
  });

  const sites = mapData?.sites || [];
  const regions = mapData?.regions || [];

  const filteredSites = useMemo(() => {
    return sites.filter(s => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.address?.toLowerCase().includes(q) ||
          s.city?.toLowerCase().includes(q) ||
          s.postcode?.toLowerCase().includes(q) ||
          s.clientName?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [sites, statusFilter, searchQuery]);

  const activeSites = sites.filter(s => s.isActive);
  const understaffedSites = sites.filter(s => s.status === "understaffed");
  const citiesCovered = new Set(sites.map(s => s.city).filter(Boolean)).size;

  const handleSiteClick = (site: MapSite) => {
    setSelectedSite(site);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" data-testid="deployment-map-loading">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" data-testid="deployment-map-page">
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0; }
        }
        .custom-marker { background: none !important; border: none !important; }
        .leaflet-popup-content-wrapper { border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        .leaflet-popup-content { margin: 0; padding: 0; }
        .leaflet-container { border-radius: 12px; }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">
            UK Deployment Map
          </h1>
          <p className="text-muted-foreground">
            Live overview of all site deployments across the United Kingdom
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">Heat Map</span>
            <Switch
              checked={showHeatMap}
              onCheckedChange={setShowHeatMap}
              data-testid="switch-heatmap"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Sites</p>
                <p className="text-2xl font-bold" data-testid="stat-total-sites">{sites.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(31,58,95,0.1)" }}>
                <Building2 className="w-5 h-5" style={{ color: "#1F3A5F" }} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Sites</p>
                <p className="text-2xl font-bold" data-testid="stat-active-sites">{activeSites.length}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-green-100">
                <Activity className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Active Shifts</p>
                <p className="text-2xl font-bold" data-testid="stat-active-shifts">{mapData?.totalActiveShifts || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "rgba(255,140,66,0.15)" }}>
                <Shield className="w-5 h-5" style={{ color: "#FF8C42" }} />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  {understaffedSites.length > 0 ? "Understaffed" : "Cities Covered"}
                </p>
                <p className="text-2xl font-bold" data-testid="stat-understaffed">
                  {understaffedSites.length > 0 ? understaffedSites.length : citiesCovered}
                </p>
              </div>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${understaffedSites.length > 0 ? "bg-red-100" : "bg-blue-100"}`}>
                {understaffedSites.length > 0 ? (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                ) : (
                  <Globe className="w-5 h-5 text-blue-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sites, cities, postcodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-sites"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: "all", label: "All", count: sites.length },
            { value: "active", label: "Active", count: sites.filter(s => s.status === "active").length },
            { value: "understaffed", label: "Understaffed", count: understaffedSites.length },
            { value: "no_shifts", label: "No Shifts", count: sites.filter(s => s.status === "no_shifts").length },
            { value: "inactive", label: "Inactive", count: sites.filter(s => !s.isActive).length },
          ].map(f => (
            <Button
              key={f.value}
              variant={statusFilter === f.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(f.value)}
              className="text-xs"
              data-testid={`filter-${f.value}`}
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div style={{ height: "550px" }} data-testid="leaflet-map-container">
                <MapContainer
                  center={[54.5, -2.5]}
                  zoom={6}
                  style={{ height: "100%", width: "100%", zIndex: 1 }}
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  {showHeatMap && <HeatMapLayer sites={filteredSites} />}
                  <MapBoundsHandler sites={filteredSites} />

                  {filteredSites.map(site => {
                    const coords = getSiteLatLng(site);
                    if (!coords) return null;
                    return (
                      <Marker
                        key={site.id}
                        position={coords}
                        icon={createMarkerIcon(site.status)}
                        eventHandlers={{
                          click: () => handleSiteClick(site),
                        }}
                      >
                        <Popup>
                          <div className="p-3 min-w-[220px]">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-semibold text-sm" style={{ color: "#1F3A5F" }}>{site.name}</h3>
                              <StatusBadge status={site.status} />
                            </div>
                            <div className="space-y-1 text-xs text-gray-600">
                              {site.address && <p>{site.address}</p>}
                              {site.city && <p>{site.city} {site.postcode}</p>}
                              {site.clientName && (
                                <p className="flex items-center gap-1">
                                  <Building2 className="w-3 h-3" /> {site.clientName}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t text-xs">
                              <span className="flex items-center gap-1">
                                <Users className="w-3 h-3 text-green-600" />
                                <strong>{site.assignedOfficers}</strong> officers
                              </span>
                              <span className="flex items-center gap-1">
                                <Activity className="w-3 h-3 text-blue-600" />
                                <strong>{site.activeShiftCount}</strong> shifts
                              </span>
                              {site.unfilledShifts > 0 && (
                                <span className="flex items-center gap-1 text-red-600">
                                  <AlertTriangle className="w-3 h-3" />
                                  <strong>{site.unfilledShifts}</strong> unfilled
                                </span>
                              )}
                            </div>
                            <Button
                              size="sm"
                              className="w-full mt-2 text-xs"
                              style={{ backgroundColor: "#1F3A5F" }}
                              onClick={() => handleSiteClick(site)}
                              data-testid={`button-popup-details-${site.id}`}
                            >
                              <Eye className="w-3 h-3 mr-1" /> View Details
                            </Button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>

              <div className="flex items-center justify-center gap-6 p-3 bg-muted/30 text-xs text-muted-foreground border-t">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#10B981" }} />
                  <span>Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#F59E0B" }} />
                  <span>Understaffed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#3B82F6" }} />
                  <span>No Shifts</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: "#6B7280" }} />
                  <span>Inactive</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" style={{ color: "#1F3A5F" }} />
                  <span className="font-semibold text-sm">Regional Coverage</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowRegions(!showRegions)}
                  data-testid="button-toggle-regions"
                >
                  {showRegions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>
            </CardHeader>
            {showRegions && (
              <CardContent className="pt-0">
                {regions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No regional data</p>
                ) : (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {regions
                      .sort((a, b) => b.sites - a.sites)
                      .map(region => (
                        <div
                          key={region.name}
                          className="p-2.5 rounded-lg border hover:bg-muted/50 transition-colors"
                          data-testid={`region-card-${region.name}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-sm truncate">{region.name}</span>
                            <Badge variant="outline" className="text-xs">{region.sites} sites</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {region.officers}
                            </span>
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3" /> {region.activeShifts}
                            </span>
                            {region.unfilledShifts > 0 && (
                              <span className="flex items-center gap-1 text-red-500">
                                <AlertTriangle className="w-3 h-3" /> {region.unfilledShifts}
                              </span>
                            )}
                          </div>
                          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${region.sites > 0 ? (region.activeSites / region.sites) * 100 : 0}%`,
                                backgroundColor: region.unfilledShifts > 0 ? "#F59E0B" : "#10B981",
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4" style={{ color: "#1F3A5F" }} />
                <span className="font-semibold text-sm">Site Directory</span>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filteredSites.length === 0 ? (
                <div className="text-center py-6">
                  <MapPin className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">No sites found</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                  {filteredSites.map(site => (
                    <div
                      key={site.id}
                      className="flex items-center gap-2 p-2 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => handleSiteClick(site)}
                      data-testid={`card-site-${site.id}`}
                    >
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            site.status === "active" ? "#10B981" :
                            site.status === "understaffed" ? "#F59E0B" :
                            site.status === "no_shifts" ? "#3B82F6" : "#6B7280",
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" data-testid={`text-site-name-${site.id}`}>
                          {site.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {site.city || site.postcode || site.address}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />
                        <span>{site.assignedOfficers}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg" data-testid="dialog-site-details">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" style={{ color: "#1F3A5F" }} />
              {selectedSite?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedSite && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <StatusBadge status={selectedSite.status} />
                {selectedSite.assignedOfficers > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Users className="w-3 h-3 mr-1" /> {selectedSite.assignedOfficers} officers on site
                  </Badge>
                )}
                {selectedSite.unfilledShifts > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="w-3 h-3 mr-1" /> {selectedSite.unfilledShifts} unfilled shifts
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold" style={{ color: "#1F3A5F" }}>{selectedSite.activeShiftCount}</p>
                  <p className="text-xs text-muted-foreground">Active Shifts</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold" style={{ color: "#10B981" }}>{selectedSite.assignedOfficers}</p>
                  <p className="text-xs text-muted-foreground">Officers</p>
                </div>
                <div className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-lg font-bold" style={{ color: selectedSite.unfilledShifts > 0 ? "#EF4444" : "#3B82F6" }}>
                    {selectedSite.unfilledShifts}
                  </p>
                  <p className="text-xs text-muted-foreground">Unfilled</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground block text-xs mb-0.5">Address</span>
                  <span data-testid="text-dialog-address">{selectedSite.address}</span>
                </div>
                {selectedSite.city && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">City</span>
                    <span data-testid="text-dialog-city">{selectedSite.city}</span>
                  </div>
                )}
                {selectedSite.postcode && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Postcode</span>
                    <span data-testid="text-dialog-postcode">{selectedSite.postcode}</span>
                  </div>
                )}
                {selectedSite.clientName && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Client</span>
                    <span data-testid="text-dialog-client">{selectedSite.clientName}</span>
                  </div>
                )}
                {selectedSite.clientContact && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Contact</span>
                    <span>{selectedSite.clientContact}</span>
                  </div>
                )}
                {selectedSite.clientEmail && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Email</span>
                    <span>{selectedSite.clientEmail}</span>
                  </div>
                )}
                {selectedSite.clientPhone && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Phone</span>
                    <span>{selectedSite.clientPhone}</span>
                  </div>
                )}
                {selectedSite.contractRef && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Contract Ref</span>
                    <span>{selectedSite.contractRef}</span>
                  </div>
                )}
                {selectedSite.latitude && selectedSite.longitude && (
                  <div>
                    <span className="text-muted-foreground block text-xs mb-0.5">Coordinates</span>
                    <span>{selectedSite.latitude}, {selectedSite.longitude}</span>
                  </div>
                )}
              </div>

              {selectedSite.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground block text-xs mb-0.5">Notes</span>
                  <p>{selectedSite.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
