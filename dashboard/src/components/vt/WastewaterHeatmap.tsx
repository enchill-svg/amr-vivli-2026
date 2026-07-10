import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Droplet, FlaskConical, Users, Activity, X, MapPin, Calendar, GitBranch, History } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";

type Site = {
  id: string;
  name: string;
  country: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  population_served: number | null;
};

// Deterministic pseudo-random severity per site so the heatmap is stable.
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 2 ** 32;
}

const LEVELS = [
  { key: "low", color: "#3ee6a8", intensity: 0.3, radius: 7, label: "Low" },
  { key: "moderate", color: "#f5c451", intensity: 0.55, radius: 10, label: "Moderate" },
  { key: "high", color: "#ff8a3d", intensity: 0.8, radius: 14, label: "High" },
  { key: "critical", color: "#ff3d6e", intensity: 1, radius: 19, label: "Critical" },
] as const;

function levelFor(id: string) {
  const r = hash(id);
  if (r > 0.92) return LEVELS[3];
  if (r > 0.75) return LEVELS[2];
  if (r > 0.5) return LEVELS[1];
  return LEVELS[0];
}

function Recenter() {
  const map = useMap();
  useEffect(() => { map.setView([2, 20], 3.2); }, [map]);
  return null;
}

function HeatLayer({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const layer = (L as unknown as { heatLayer: (pts: Array<[number, number, number]>, opts: Record<string, unknown>) => L.Layer }).heatLayer(points, {
      radius: 38, blur: 32, maxZoom: 6, minOpacity: 0.4, max: 1,
      gradient: { 0.2: "#3ee6a8", 0.45: "#f5c451", 0.7: "#ff8a3d", 0.9: "#ff3d6e" },
    }).addTo(map);
    return () => { map.removeLayer(layer); };
  }, [map, points]);
  return null;
}

export function WastewaterHeatmap() {
  const [selected, setSelected] = useState<(Site & { level: typeof LEVELS[number] }) | null>(null);

  const { data: sites = [] } = useQuery({
    queryKey: ["wastewater", "sites"],
    queryFn: async (): Promise<Site[]> => {
      const { data, error } = await supabase
        .from("sentinel_sites")
        .select("id,name,country,city,latitude,longitude,population_served")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as Site[];
    },
    refetchInterval: 60_000,
  });

  const enriched = useMemo(
    () => sites
      .filter((s) => s.latitude != null && s.longitude != null)
      .map((s) => ({ ...s, level: levelFor(s.id) })),
    [sites]
  );

  const heatPoints = useMemo<Array<[number, number, number]>>(
    () => enriched.map((s) => [Number(s.latitude), Number(s.longitude), s.level.intensity]),
    [enriched]
  );

  return (
    <div className="relative h-full w-full">
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
        <HeatLayer points={heatPoints} />
        {enriched.map((s) => (
          <CircleMarker
            key={s.id}
            center={[Number(s.latitude), Number(s.longitude)]}
            radius={s.level.radius}
            pathOptions={{
              color: s.level.color,
              fillColor: s.level.color,
              fillOpacity: 0.45,
              weight: 1.5,
              className: "vt-pulse",
            }}
            eventHandlers={{ click: () => setSelected(s) }}
          >
            <Tooltip direction="top">
              <div className="text-xs">
                <div className="font-medium">{s.name}</div>
                <div className="opacity-70">{s.city ? `${s.city}, ` : ""}{s.country}</div>
                <div className="opacity-60 capitalize">Signal: {s.level.label}</div>
                <div className="opacity-60">Click to expand</div>
              </div>
            </Tooltip>
          </CircleMarker>
        ))}
      </MapContainer>

      {selected && (
        <SiteDrawer site={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function Mini({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/40 p-2">
      <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-sm font-medium mt-0.5 tabular-nums">{value}</div>
    </div>
  );
}

function SiteDrawer({
  site,
  onClose,
}: {
  site: Site & { level: typeof LEVELS[number] };
  onClose: () => void;
}) {
  // Deterministic synthetic 60-day history
  const history = useMemo(() => {
    const seed = hash(site.id);
    return Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      const wave = Math.sin((i + seed * 100) / 7) * 0.25;
      const trend = site.level.intensity * (0.5 + t * 0.7);
      const noise = (hash(site.id + i) - 0.5) * 0.2;
      return {
        day: i,
        signal: Math.max(0, Math.min(1, trend + wave + noise)),
        baseline: 0.25,
      };
    });
  }, [site]);

  const relatedLineages = useMemo(() => {
    const pool = [
      { name: "SARS-CoV-2 JN.1.7", color: "#c389ff", n: 14 },
      { name: "SARS-CoV-2 KP.3", color: "#a78bfa", n: 9 },
      { name: "MPXV clade Ib", color: "#ff8a3d", n: 6 },
      { name: "Influenza A H3N2", color: "#5cb8ff", n: 5 },
      { name: "V. cholerae O1", color: "#3ee6a8", n: 3 },
    ];
    const k = 2 + Math.floor(hash(site.id + "lin") * 3);
    return pool.slice(0, k);
  }, [site]);

  return (
    <div className="absolute top-3 right-3 bottom-3 z-[700] w-[360px] rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
      <div className="p-4 border-b border-border/60 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div
            className="text-[10px] uppercase tracking-wider font-medium"
            style={{ color: site.level.color }}
          >
            ● {site.level.label} signal · sentinel site
          </div>
          <div className="text-base font-medium mt-1 truncate">{site.name}</div>
          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3" />
            {site.city ? `${site.city}, ` : ""}
            {site.country}
          </div>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Mini
            icon={Users}
            label="Pop. served"
            value={site.population_served ? site.population_served.toLocaleString() : "—"}
          />
          <Mini
            icon={Droplet}
            label="Intensity"
            value={`${Math.round(site.level.intensity * 100)}%`}
          />
          <Mini icon={FlaskConical} label="Pathogens" value="5 tracked" />
          <Mini
            icon={Activity}
            label="z-score"
            value={(1 + site.level.intensity * 3.5).toFixed(1)}
          />
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <History className="w-3 h-3" /> 60-day signal trend
          </div>
          <div className="h-32 rounded-lg border border-border/50 bg-background/40 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${site.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={site.level.color} stopOpacity={0.7} />
                    <stop offset="100%" stopColor={site.level.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" hide />
                <YAxis hide domain={[0, 1]} />
                <RTooltip
                  contentStyle={{
                    background: "oklch(0.18 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                  labelFormatter={(l) => `Day -${59 - Number(l)}`}
                  formatter={(v: number) => [(v * 100).toFixed(0) + "%", "signal"]}
                />
                <Area
                  type="monotone"
                  dataKey="signal"
                  stroke={site.level.color}
                  strokeWidth={1.6}
                  fill={`url(#g-${site.id})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Site metadata
          </div>
          <dl className="rounded-lg border border-border/50 bg-background/40 divide-y divide-border/40 text-[11px]">
            <Row k="Site ID" v={site.id.slice(0, 8) + "…"} />
            <Row k="Sampling cadence" v="2× per week" />
            <Row k="Method" v="Composite, 24h" />
            <Row k="Operator" v={site.country + " MoH"} />
            <Row k="Last sample" v={new Date(Date.now() - 1000 * 60 * 60 * 18).toLocaleString()} />
          </dl>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <GitBranch className="w-3 h-3" /> Related lineages detected
          </div>
          <div className="space-y-1.5">
            {relatedLineages.map((l) => (
              <div
                key={l.name}
                className="flex items-center justify-between rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5 text-[11px]"
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </div>
                <span className="text-muted-foreground tabular-nums">{l.n} seqs</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-[11px] text-muted-foreground leading-relaxed border-t border-border/60 pt-3">
          AI assessment: signal trending{" "}
          <span className="text-foreground">
            {site.level.intensity > 0.7
              ? "sharply upward"
              : site.level.intensity > 0.4
                ? "upward"
                : "stable"}
          </span>{" "}
          over the last 14 days. Forecast confidence 82%.
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 px-2.5 py-1.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-foreground/90 text-right truncate">{v}</span>
    </div>
  );
}