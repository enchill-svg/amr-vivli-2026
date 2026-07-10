import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet.heat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMapSelection } from "./MapSelection";

type AlertRow = {
  id: string;
  country: string;
  pathogen: string;
  title: string;
  severity: "low" | "moderate" | "high" | "critical";
  status: string;
  detected_at: string;
  description?: string | null;
};

type SiteRow = {
  id: string;
  name: string;
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  population_served: number | null;
};

const SEVERITY_COLOR: Record<string, string> = {
  low: "#3ee6a8",
  moderate: "#f5c451",
  high: "#ff8a3d",
  critical: "#ff3d6e",
};

const SEVERITY_RADIUS: Record<string, number> = {
  low: 8,
  moderate: 12,
  high: 16,
  critical: 22,
};

const SEVERITY_INTENSITY: Record<string, number> = {
  low: 0.35,
  moderate: 0.55,
  high: 0.8,
  critical: 1.0,
};

// Approximate centroid lookups so alerts (which only store country) can still be plotted.
const COUNTRY_COORDS: Record<string, [number, number]> = {
  "Nigeria": [9.082, 8.6753],
  "South Africa": [-28.4793, 24.6727],
  "Kenya": [-0.0236, 37.9062],
  "Democratic Republic of the Congo": [-4.0383, 21.7587],
  "Egypt": [26.8206, 30.8025],
  "Ethiopia": [9.145, 40.4897],
  "Ghana": [7.9465, -1.0232],
  "Senegal": [14.4974, -14.4524],
  "Uganda": [1.3733, 32.2903],
  "Tanzania": [-6.369, 34.8888],
  "Morocco": [31.7917, -7.0926],
  "Algeria": [28.0339, 1.6596],
  "Mozambique": [-18.6657, 35.5296],
  "Namibia": [-22.9576, 18.4904],
  "Zambia": [-13.1339, 27.8493],
  "Zimbabwe": [-19.0154, 29.1549],
  "Cameroon": [7.3697, 12.3547],
  "Rwanda": [-1.9403, 29.8739],
  "Sudan": [12.8628, 30.2176],
  "Côte d'Ivoire": [7.54, -5.5471],
  "Ivory Coast": [7.54, -5.5471],
};

function Recenter() {
  const map = useMap();
  useEffect(() => {
    map.setView([2, 20], 3);
  }, [map]);
  return null;
}

function HeatLayer({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const layer = (L as unknown as { heatLayer: (pts: Array<[number, number, number]>, opts: Record<string, unknown>) => L.Layer }).heatLayer(points, {
      radius: 45,
      blur: 35,
      maxZoom: 6,
      minOpacity: 0.35,
      max: 1.0,
      gradient: {
        0.2: "#3ee6a8",
        0.45: "#f5c451",
        0.7: "#ff8a3d",
        0.9: "#ff3d6e",
      },
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}

export function LiveMap() {
  const { selected, toggle, isSelected, clear } = useMapSelection();
  const [windowDays, setWindowDays] = useState<number>(0); // 0 = all

  const { data: alerts = [] } = useQuery({
    queryKey: ["map", "alerts"],
    queryFn: async (): Promise<AlertRow[]> => {
      const { data, error } = await supabase
        .from("alerts")
        .select("id,country,pathogen,title,severity,status,detected_at,description")
        .eq("status", "active")
        .order("detected_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AlertRow[];
    },
    refetchInterval: 30_000,
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["map", "sites"],
    queryFn: async (): Promise<SiteRow[]> => {
      const { data, error } = await supabase
        .from("sentinel_sites")
        .select("id,name,country,city,latitude,longitude,population_served")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as SiteRow[];
    },
    refetchInterval: 60_000,
  });

  const filteredAlerts = useMemo(() => {
    if (!windowDays) return alerts;
    const cutoff = Date.now() - windowDays * 86_400_000;
    return alerts.filter((a) => new Date(a.detected_at).getTime() >= cutoff);
  }, [alerts, windowDays]);

  return (
    <div className="relative h-full w-full">
      <div className="absolute top-3 right-3 z-[600] flex gap-1 rounded-lg bg-card/90 border border-border p-1 backdrop-blur-sm text-[10px]">
        {[
          { d: 7, l: "7d" },
          { d: 30, l: "30d" },
          { d: 90, l: "90d" },
          { d: 0, l: "All" },
        ].map((o) => (
          <button
            key={o.l}
            onClick={() => setWindowDays(o.d)}
            className={`px-2 py-1 rounded ${windowDays === o.d ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]" : "text-muted-foreground hover:text-foreground"}`}
          >
            {o.l}
          </button>
        ))}
      </div>
      {selected.length > 0 && (
        <div className="absolute top-3 left-3 z-[600] flex items-center gap-2 rounded-lg bg-card/90 border border-[color:var(--accent)]/50 px-3 py-1.5 backdrop-blur-sm text-[11px]">
          <span className="font-medium text-[color:var(--accent)]">{selected.length}</span>
          <span className="text-muted-foreground">marker{selected.length === 1 ? "" : "s"} selected for report</span>
          <button onClick={clear} className="text-muted-foreground hover:text-foreground ml-1">Clear</button>
        </div>
      )}
    <MapContainer
      center={[2, 20]}
      zoom={3}
      minZoom={2}
      scrollWheelZoom
      worldCopyJump
      style={{ height: "100%", width: "100%", background: "oklch(0.18 0.04 250)" }}
    >
      <Recenter />
      <TileLayer
        attribution='&copy; OpenStreetMap &copy; CARTO'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <HeatLayer
        points={filteredAlerts
          .map((a) => {
            const c = COUNTRY_COORDS[a.country];
            if (!c) return null;
            return [c[0], c[1], SEVERITY_INTENSITY[a.severity] ?? 0.5] as [number, number, number];
          })
          .filter((p): p is [number, number, number] => p !== null)}
      />

      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={45}>
        {sites.map((s) =>
        s.latitude != null && s.longitude != null ? (
          <CircleMarker
            key={s.id}
            center={[Number(s.latitude), Number(s.longitude)]}
            radius={4}
            pathOptions={{ color: "#5cb8ff", fillColor: "#5cb8ff", fillOpacity: 0.9, weight: 1 }}
          >
            <Tooltip direction="top">
              <div className="text-xs">
                <div className="font-medium">{s.name}</div>
                <div className="opacity-70">{s.city ? `${s.city}, ` : ""}{s.country}</div>
                {s.population_served && (
                  <div className="opacity-70">Pop. served: {s.population_served.toLocaleString()}</div>
                )}
              </div>
            </Tooltip>
          </CircleMarker>
        ) : null,
        )}
      </MarkerClusterGroup>

      {filteredAlerts.map((a) => {
        const coords = COUNTRY_COORDS[a.country];
        if (!coords) return null;
        const color = SEVERITY_COLOR[a.severity] ?? SEVERITY_COLOR.moderate;
        const radius = SEVERITY_RADIUS[a.severity] ?? 12;
        const picked = isSelected(a.id);
        return (
          <CircleMarker
            key={a.id}
            center={coords}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: picked ? 0.7 : 0.35,
              weight: picked ? 3 : 2,
              className: "vt-pulse",
            }}
          >
            <Popup>
              <div className="text-xs space-y-1 min-w-[180px]">
                <div className="font-semibold text-sm">{a.title}</div>
                <div><span className="opacity-60">Pathogen:</span> {a.pathogen}</div>
                <div><span className="opacity-60">Country:</span> {a.country}</div>
                <div className="capitalize"><span className="opacity-60">Severity:</span>{" "}
                  <span style={{ color }} className="font-medium">{a.severity}</span>
                </div>
                <div><span className="opacity-60">Detected:</span> {new Date(a.detected_at).toLocaleString()}</div>
                {a.description && <div className="opacity-80 pt-1 border-t border-border/40">{a.description}</div>}
                <button
                  onClick={() =>
                    toggle({
                      id: a.id,
                      country: a.country,
                      pathogen: a.pathogen,
                      title: a.title,
                      severity: a.severity,
                      detected_at: a.detected_at,
                      description: a.description ?? null,
                    })
                  }
                  className="mt-2 w-full px-2 py-1 rounded text-[11px] font-medium"
                  style={{
                    background: picked ? "transparent" : "var(--accent)",
                    color: picked ? "var(--accent)" : "var(--accent-foreground)",
                    border: `1px solid var(--accent)`,
                  }}
                >
                  {picked ? "Remove from report" : "Add to report"}
                </button>
              </div>
            </Popup>
            <Tooltip direction="top">
              <div className="text-xs">
                <div className="font-medium">{a.title}</div>
                <div className="opacity-70">{a.pathogen} · {a.country}</div>
                <div className="opacity-60 capitalize">Severity: {a.severity}</div>
                <div className="opacity-60">{new Date(a.detected_at).toLocaleDateString()} · Click for details</div>
              </div>
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
    </div>
  );
}

export default LiveMap;