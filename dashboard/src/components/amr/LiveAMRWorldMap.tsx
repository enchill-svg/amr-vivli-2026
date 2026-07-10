import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Brain, Crosshair, Database, FlaskConical, Globe2, Layers, Radio, ShieldCheck, TrendingUp } from "lucide-react";
import { getLiveCountryTrends } from "@/lib/amr-data.functions";
import type { AMRCountryTrend, PathogenType } from "@/lib/amr-demo-data";

type MapMetric = "riskScore" | "earlyWarningScore" | "resistanceRate" | "fundingMismatch";

const metricLabels: Record<MapMetric, string> = {
  riskScore: "Country risk",
  earlyWarningScore: "Early warning",
  resistanceRate: "Resistance burden",
  fundingMismatch: "Funding gap",
};

function severityColor(value: number) {
  if (value >= 88) return "#ff3d6e";
  if (value >= 78) return "#ff8a3d";
  if (value >= 65) return "#f5c451";
  return "#3ee6a8";
}

function metricValue(row: AMRCountryTrend, metric: MapMetric) {
  if (metric === "resistanceRate") return row.resistanceRate * 100;
  if (metric === "fundingMismatch") return Math.max(0, row.fundingMismatch * 100);
  return row[metric];
}

function trendIcon(label: AMRCountryTrend["trendLabel"]) {
  if (label === "declining") return <ArrowDownRight className="w-3.5 h-3.5 text-[color:var(--status-ok)]" />;
  if (label === "stable") return <Activity className="w-3.5 h-3.5 text-[color:var(--status-info)]" />;
  return <ArrowUpRight className="w-3.5 h-3.5 text-[color:var(--status-alert)]" />;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function MapAutoFit({ rows }: { rows: AMRCountryTrend[] }) {
  const map = useMap();
  useEffect(() => {
    if (!rows.length) return;
    const bounds = L.latLngBounds(rows.map((row) => [row.latitude, row.longitude] as [number, number]));
    const t = window.setTimeout(() => map.fitBounds(bounds.pad(0.18), { animate: true }), 150);
    return () => window.clearTimeout(t);
  }, [map, rows]);
  return null;
}

function HeatLayer({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return undefined;
    const layer = (L as unknown as { heatLayer: (pts: Array<[number, number, number]>, opts: Record<string, unknown>) => L.Layer }).heatLayer(points, {
      radius: 42,
      blur: 32,
      maxZoom: 6,
      minOpacity: 0.26,
      max: 1,
      gradient: {
        0.18: "#3ee6a8",
        0.42: "#f5c451",
        0.68: "#ff8a3d",
        0.9: "#ff3d6e",
      },
    }).addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points]);
  return null;
}

export function LiveAMRWorldMap({ compact = false }: { compact?: boolean }) {
  const [pathogenType, setPathogenType] = useState<PathogenType>("all");
  const [metric, setMetric] = useState<MapMetric>("riskScore");
  const [selected, setSelected] = useState<AMRCountryTrend | null>(null);

  const { data = [], isFetching } = useQuery({
    queryKey: ["amr-live-country-trends", pathogenType],
    queryFn: () => getLiveCountryTrends(pathogenType),
    refetchInterval: 60_000,
  });

  const sorted = useMemo(() => [...data].sort((a, b) => metricValue(b, metric) - metricValue(a, metric)), [data, metric]);
  const hotspots = sorted.slice(0, 5);
  const rising = data.filter((row) => row.trendLabel === "surging" || row.trendLabel === "rising").length;
  const highRisk = data.filter((row) => row.riskScore >= 80).length;
  const heatPoints = data.map((row) => [row.latitude, row.longitude, Math.min(1, metricValue(row, metric) / 100)] as [number, number, number]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl vt-glass vt-scanline">
      <div className="absolute left-4 top-4 z-[700] max-w-[370px] rounded-2xl border border-[color:var(--accent)]/30 bg-background/85 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Live AMR situation room
        </div>
        <h2 className="mt-2 text-xl font-display font-light tracking-tight">Global resistance risk map</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          WFP HungerMap-style AMR intelligence: resistance burden, MIC trajectory, life-expectancy association, funding mismatch, and intervention leverage.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MapKpi icon={Globe2} label="Countries" value={String(data.length)} color="var(--accent)" />
          <MapKpi icon={AlertTriangle} label="High risk" value={String(highRisk)} color="var(--status-alert)" />
          <MapKpi icon={TrendingUp} label="Rising" value={String(rising)} color="var(--status-warn)" />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {(["all", "bacterial", "fungal"] as PathogenType[]).map((value) => (
            <button
              key={value}
              onClick={() => setPathogenType(value)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${pathogenType === value ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]" : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"}`}
            >
              {value === "all" ? "All signals" : value}
            </button>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(Object.keys(metricLabels) as MapMetric[]).map((key) => (
            <button
              key={key}
              onClick={() => setMetric(key)}
              className={`rounded-lg px-2 py-1.5 text-left text-[10px] transition ${metric === key ? "border border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]" : "border border-border/60 text-muted-foreground hover:text-foreground"}`}
            >
              {metricLabels[key]}
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <div className="absolute bottom-4 left-4 z-[700] w-[360px] rounded-2xl border border-border/60 bg-background/85 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Priority hotspots</div>
            <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] font-mono text-[color:var(--accent)]">AUTO-RANKED</span>
          </div>
          <div className="space-y-2">
            {hotspots.map((row, index) => (
              <button key={`${row.iso3}-${row.pathogenType}`} onClick={() => setSelected(row)} className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-card/40 p-2 text-left transition hover:border-[color:var(--accent)]/50">
                <div className="grid h-7 w-7 place-items-center rounded-md font-mono text-xs" style={{ background: `${severityColor(row.riskScore)}22`, color: severityColor(row.riskScore) }}>{index + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{row.country}</div>
                  <div className="truncate text-[10px] text-muted-foreground">{row.dominantOrganism} · {row.dominantDrug}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs" style={{ color: severityColor(row.riskScore) }}>{row.riskScore}</div>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">{trendIcon(row.trendLabel)} {row.trendLabel}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute right-4 top-4 z-[700] rounded-2xl border border-border/60 bg-background/85 p-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground"><Layers className="h-3.5 w-3.5" /> Legend</div>
        <LegendItem color="#ff3d6e" label="Extreme / critical" />
        <LegendItem color="#ff8a3d" label="High" />
        <LegendItem color="#f5c451" label="Moderate" />
        <LegendItem color="#3ee6a8" label="Lower risk" />
        <div className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
          Refresh: {isFetching ? "syncing…" : "60s"}
        </div>
      </div>

      <MapContainer center={[20, 0]} zoom={compact ? 1.8 : 2.2} minZoom={2} maxZoom={7} scrollWheelZoom worldCopyJump style={{ height: "100%", width: "100%", background: "oklch(0.14 0.04 250)" }}>
        <TileLayer attribution='&copy; OpenStreetMap &copy; CARTO' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
        <MapAutoFit rows={data} />
        <HeatLayer points={heatPoints} />
        {data.map((row) => {
          const value = metricValue(row, metric);
          const color = severityColor(value);
          const radius = Math.max(8, Math.min(28, 8 + value / 4));
          return (
            <CircleMarker
              key={`${row.iso3}-${row.pathogenType}-${metric}`}
              center={[row.latitude, row.longitude]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.45, opacity: 0.95, weight: selected?.iso3 === row.iso3 ? 3 : 1.5 }}
              eventHandlers={{ click: () => setSelected(row) }}
              className={row.trendLabel === "surging" ? "vt-pulse" : undefined}
            >
              <Tooltip direction="top">
                <div className="text-xs">
                  <div className="font-medium">{row.country} · {row.pathogenType}</div>
                  <div>Risk score: {row.riskScore}</div>
                  <div>Resistance: {formatPercent(row.resistanceRate)}</div>
                </div>
              </Tooltip>
              <Popup>
                <div className="min-w-[230px] text-xs">
                  <div className="text-sm font-semibold">{row.country}</div>
                  <div className="mt-1 opacity-75">{row.dominantOrganism} · {row.dominantDrug}</div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PopupStat label="Risk" value={row.riskScore.toFixed(0)} />
                    <PopupStat label="Warning" value={row.earlyWarningScore.toFixed(0)} />
                    <PopupStat label="Resistance" value={formatPercent(row.resistanceRate)} />
                    <PopupStat label="Life exp." value={`${row.lifeExpectancy.toFixed(1)}y`} />
                  </div>
                  <div className="mt-3 rounded border border-slate-600/40 bg-slate-900/50 p-2">
                    <div className="font-medium">Recommended intervention</div>
                    <div className="mt-1 opacity-75">{row.recommendedIntervention}</div>
                    <div className="mt-1 text-[11px] opacity-75">Predicted gain: +{row.predictedLifeGain.toFixed(2)} years</div>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {selected && !compact && (
        <div className="absolute bottom-4 right-4 z-[700] w-[390px] rounded-2xl border border-[color:var(--accent)]/30 bg-background/90 p-4 shadow-2xl backdrop-blur-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--accent)]">Selected country</div>
              <h3 className="mt-1 text-2xl font-light">{selected.country}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{selected.dominantOrganism} · {selected.dominantDrug} · {selected.latestYear}</p>
            </div>
            <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSelected(null)}>Close</button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricTile icon={Crosshair} label="Risk score" value={selected.riskScore.toFixed(0)} color={severityColor(selected.riskScore)} />
            <MetricTile icon={Brain} label="Early warning" value={selected.earlyWarningScore.toFixed(0)} color={severityColor(selected.earlyWarningScore)} />
            <MetricTile icon={FlaskConical} label="Resistance" value={formatPercent(selected.resistanceRate)} color="var(--status-warn)" />
            <MetricTile icon={ShieldCheck} label="Confidence" value={formatPercent(selected.confidence)} color="var(--status-info)" />
          </div>
          <div className="mt-4 rounded-xl border border-border/60 bg-card/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Funding mismatch</span>
              <span className={selected.fundingMismatch > 0.5 ? "text-[color:var(--status-alert)]" : "text-[color:var(--status-ok)]"}>{formatPercent(Math.abs(selected.fundingMismatch))}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.abs(selected.fundingMismatch) * 100)}%`, background: selected.fundingMismatch > 0.5 ? "var(--status-alert)" : "var(--status-ok)" }} />
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 p-3 text-xs leading-relaxed">
            <span className="font-medium text-[color:var(--accent)]">Policy recommendation:</span> {selected.recommendedIntervention}. Expected life expectancy gain is approximately <b>+{selected.predictedLifeGain.toFixed(2)} years</b>, evidence level <b>{selected.evidenceLevel}</b>.
          </div>
        </div>
      )}
    </div>
  );
}

function MapKpi({ icon: Icon, label, value, color }: { icon: typeof Globe2; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-2">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <div className="mt-1 text-lg font-light" style={{ color }}>{value}</div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />{label}</div>;
}

function PopupStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded bg-slate-900/60 p-2"><div className="text-[10px] uppercase opacity-60">{label}</div><div className="font-semibold">{value}</div></div>;
}

function MetricTile({ icon: Icon, label, value, color }: { icon: typeof Crosshair; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5" style={{ color }} />{label}</div>
      <div className="mt-2 text-2xl font-light" style={{ color }}>{value}</div>
    </div>
  );
}
