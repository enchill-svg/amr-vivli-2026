import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapContainer, TileLayer, CircleMarker, Tooltip, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.heat";
import "leaflet/dist/leaflet.css";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Brain,
  Crosshair,
  Database,
  FlaskConical,
  Globe2,
  Layers,
  Radio,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import {
  getCountryYearPanel,
  getLiveCountryTrends,
  lifeGainDisplay,
} from "@/lib/amr-data.functions";
import type { AMRCountryTrend, CountryYearRow, PathogenType } from "@/lib/amr-demo-data";

type MapMetric =
  | "riskScore"
  | "earlyWarningScore"
  | "resistanceRate"
  | "fundingMismatch"
  | "lifeExpectancy";

const metricLabels: Record<MapMetric, string> = {
  riskScore: "Country risk",
  earlyWarningScore: "Early warning",
  resistanceRate: "Resistance burden",
  fundingMismatch: "Funding gap",
  lifeExpectancy: "Life expectancy",
};

function severityColor(value: number) {
  if (value >= 88) return "#ff3d6e";
  if (value >= 78) return "#ff8a3d";
  if (value >= 65) return "#f5c451";
  return "#3ee6a8";
}

/** Inverted scale — unlike the other (higher-is-worse) metrics, a low life
 * expectancy is the hotspot. */
function lifeExpectancyColor(value: number) {
  if (value < 55) return "#ff3d6e";
  if (value < 65) return "#ff8a3d";
  if (value < 75) return "#f5c451";
  return "#3ee6a8";
}

function colorForMetric(metric: MapMetric, value: number) {
  return metric === "lifeExpectancy" ? lifeExpectancyColor(value) : severityColor(value);
}

/** 0–1 "badness" used for heat-layer intensity and marker radius. For the
 * higher-is-worse metrics this is just value/100 (unchanged from before);
 * life expectancy is normalized over a plausible 40–85y band and inverted. */
function metricIntensity(metric: MapMetric, value: number): number {
  if (metric === "lifeExpectancy") {
    const clamped = Math.min(85, Math.max(40, value));
    return Math.min(1, Math.max(0, (85 - clamped) / 45));
  }
  return Math.min(1, Math.max(0, value / 100));
}

function yearKey(pathogenType: string, iso3: string, year: number) {
  return `${pathogenType}:${iso3}:${year}`;
}

function metricValue(
  row: AMRCountryTrend,
  metric: MapMetric,
  yearCtx: { year: number | null; yearIndex: Map<string, CountryYearRow> },
): number | null {
  if (metric === "resistanceRate") return row.resistanceRate * 100;
  if (metric === "fundingMismatch")
    return row.fundingMismatch == null ? null : Math.abs(row.fundingMismatch) * 100;
  if (metric === "lifeExpectancy") {
    if (yearCtx.year == null) return null;
    const hit = yearCtx.yearIndex.get(yearKey(row.pathogenType, row.iso3, yearCtx.year));
    return hit ? hit.lifeExpectancy : null;
  }
  return row[metric];
}

function coordKey(row: AMRCountryTrend) {
  return `${row.latitude},${row.longitude}`;
}

/** Deterministic small offset so a country present in both the bacterial and
 * fungal tables (same geocoded coordinate) doesn't render two markers stacked
 * exactly on top of each other. */
function jitteredPosition(row: AMRCountryTrend, group: AMRCountryTrend[]): [number, number] {
  if (group.length <= 1) return [row.latitude, row.longitude];
  const ordered = [...group].sort((a, b) => a.pathogenType.localeCompare(b.pathogenType));
  const index = ordered.indexOf(row);
  const angle = (2 * Math.PI * index) / ordered.length;
  const offsetDeg = 0.6;
  return [row.latitude + offsetDeg * Math.sin(angle), row.longitude + offsetDeg * Math.cos(angle)];
}

function trendIcon(label: AMRCountryTrend["trendLabel"]) {
  if (label === "declining")
    return <ArrowDownRight className="w-3.5 h-3.5 text-[color:var(--status-ok)]" />;
  if (label === "stable")
    return <Activity className="w-3.5 h-3.5 text-[color:var(--status-info)]" />;
  return <ArrowUpRight className="w-3.5 h-3.5 text-[color:var(--status-alert)]" />;
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function MapAutoFit({ rows }: { rows: AMRCountryTrend[] }) {
  const map = useMap();
  useEffect(() => {
    if (!rows.length) return;
    const bounds = L.latLngBounds(
      rows.map((row) => [row.latitude, row.longitude] as [number, number]),
    );
    const t = window.setTimeout(() => map.fitBounds(bounds.pad(0.18), { animate: true }), 150);
    return () => window.clearTimeout(t);
  }, [map, rows]);
  return null;
}

function HeatLayer({ points }: { points: Array<[number, number, number]> }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return undefined;
    const layer = (
      L as unknown as {
        heatLayer: (pts: Array<[number, number, number]>, opts: Record<string, unknown>) => L.Layer;
      }
    )
      .heatLayer(points, {
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
      })
      .addTo(map);
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

  const { data: yearRows = [] } = useQuery({
    queryKey: ["amr-country-year-panel", pathogenType],
    queryFn: () => getCountryYearPanel(pathogenType),
    refetchInterval: 60_000,
  });

  const yearIndex = useMemo(() => {
    const map = new Map<string, CountryYearRow>();
    for (const row of yearRows) map.set(yearKey(row.pathogenType, row.iso3, row.year), row);
    return map;
  }, [yearRows]);

  const yearBounds = useMemo(() => {
    if (!yearRows.length) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const row of yearRows) {
      if (row.year < min) min = row.year;
      if (row.year > max) max = row.year;
    }
    return { min, max };
  }, [yearRows]);

  const [yearOverride, setYearOverride] = useState<number | null>(null);
  useEffect(() => {
    setYearOverride(null);
  }, [pathogenType]);
  const year = yearOverride ?? yearBounds?.max ?? null;
  const yearCtx = useMemo(() => ({ year, yearIndex }), [year, yearIndex]);

  const sorted = useMemo(
    () =>
      [...data].sort((a, b) => {
        const av = metricValue(a, metric, yearCtx);
        const bv = metricValue(b, metric, yearCtx);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return metric === "lifeExpectancy" ? av - bv : bv - av;
      }),
    [data, metric, yearCtx],
  );
  const hotspots = sorted.slice(0, 5);
  const rising = data.filter(
    (row) => row.trendLabel === "surging" || row.trendLabel === "rising",
  ).length;
  const highRisk = data.filter((row) => row.riskScore >= 80).length;
  const heatPoints = data
    .map((row) => {
      const value = metricValue(row, metric, yearCtx);
      return value == null
        ? null
        : ([row.latitude, row.longitude, metricIntensity(metric, value)] as [
            number,
            number,
            number,
          ]);
    })
    .filter((point): point is [number, number, number] => point !== null);
  const coordGroups = useMemo(() => {
    const groups = new Map<string, AMRCountryTrend[]>();
    for (const row of data) {
      const key = coordKey(row);
      const group = groups.get(key);
      if (group) group.push(row);
      else groups.set(key, [row]);
    }
    return groups;
  }, [data]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl vt-glass vt-scanline">
      <div className="absolute left-4 top-4 z-[700] max-w-[370px] rounded-2xl border border-[color:var(--accent)]/30 bg-background/85 p-4 shadow-2xl backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> Live AMR situation room
        </div>
        <h2 className="mt-2 text-xl font-display font-light tracking-tight">
          Global resistance risk map
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          WFP HungerMap-style AMR intelligence: resistance burden, MIC trajectory, life-expectancy
          association, funding mismatch, and intervention leverage.
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MapKpi
            icon={Globe2}
            label="Countries"
            value={String(data.length)}
            color="var(--accent)"
          />
          <MapKpi
            icon={AlertTriangle}
            label="High risk"
            value={String(highRisk)}
            color="var(--status-alert)"
          />
          <MapKpi
            icon={TrendingUp}
            label="Rising"
            value={String(rising)}
            color="var(--status-warn)"
          />
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

        {metric === "lifeExpectancy" &&
          (yearBounds ? (
            <div className="mt-3 rounded-lg border border-border/60 bg-card/40 p-2">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="uppercase tracking-wider">Year</span>
                <span className="font-mono text-[color:var(--accent)]">{year}</span>
              </div>
              <input
                type="range"
                min={yearBounds.min}
                max={yearBounds.max}
                step={1}
                value={year ?? yearBounds.max}
                onChange={(e) => setYearOverride(Number(e.target.value))}
                className="mt-1.5 w-full accent-[color:var(--accent)]"
              />
              <div className="mt-0.5 flex justify-between text-[9px] text-muted-foreground">
                <span>{yearBounds.min}</span>
                <span>{yearBounds.max}</span>
              </div>
            </div>
          ) : (
            <div className="mt-3 text-[10px] italic text-muted-foreground">Loading year data…</div>
          ))}
      </div>

      {!compact && (
        <div className="absolute bottom-4 left-4 z-[700] w-[360px] rounded-2xl border border-border/60 bg-background/85 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Priority hotspots
            </div>
            <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] font-mono text-[color:var(--accent)]">
              AUTO-RANKED
            </span>
          </div>
          <div className="space-y-2">
            {hotspots.map((row, index) => (
              <button
                key={`${row.iso3}-${row.pathogenType}`}
                onClick={() => setSelected(row)}
                className="flex w-full items-center gap-2 rounded-lg border border-border/50 bg-card/40 p-2 text-left transition hover:border-[color:var(--accent)]/50"
              >
                <div
                  className="grid h-7 w-7 place-items-center rounded-md font-mono text-xs"
                  style={{
                    background: `${severityColor(row.riskScore)}22`,
                    color: severityColor(row.riskScore),
                  }}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium">{row.country}</div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {row.dominantOrganism} · {row.dominantDrug}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-mono text-xs"
                    style={{ color: severityColor(row.riskScore) }}
                  >
                    {row.riskScore}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                    {trendIcon(row.trendLabel)} {row.trendLabel}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="absolute right-4 top-4 z-[700] rounded-2xl border border-border/60 bg-background/85 p-3 backdrop-blur-xl">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          <Layers className="h-3.5 w-3.5" /> Legend
        </div>
        <LegendItem color="#ff3d6e" label="Extreme / critical" />
        <LegendItem color="#ff8a3d" label="High" />
        <LegendItem color="#f5c451" label="Moderate" />
        <LegendItem color="#3ee6a8" label="Lower risk" />
        {metric === "lifeExpectancy" && (
          <div className="mt-1 text-[10px] italic text-muted-foreground">
            Scale inverted for this metric — red = lowest life expectancy
          </div>
        )}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full border border-dashed"
            style={{ borderColor: "var(--status-warn)" }}
          />
          Dashed = gated (bounds only / withheld)
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span
            className="h-2.5 w-2.5 rounded-full border border-dotted"
            style={{ borderColor: "var(--muted-foreground)" }}
          />
          {metric === "lifeExpectancy"
            ? "Dotted = no life-expectancy data for the selected year"
            : metric === "fundingMismatch"
              ? "Dotted = funding gap not modeled (organism-level proxy, no match)"
              : "Dotted = metric not modeled for this country"}
        </div>
        <div className="mt-2 border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
          Refresh: {isFetching ? "syncing…" : "60s"}
        </div>
      </div>

      <MapContainer
        center={[20, 0]}
        zoom={compact ? 1.8 : 2.2}
        minZoom={2}
        maxZoom={7}
        scrollWheelZoom
        worldCopyJump
        style={{ height: "100%", width: "100%", background: "oklch(0.14 0.04 250)" }}
      >
        <TileLayer
          attribution="&copy; OpenStreetMap &copy; CARTO"
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapAutoFit rows={data} />
        <HeatLayer points={heatPoints} />
        {data.map((row) => {
          const value = metricValue(row, metric, yearCtx);
          const notModeled = value == null;
          const color = notModeled ? "var(--muted-foreground)" : colorForMetric(metric, value);
          const radius = notModeled
            ? 8
            : Math.max(8, Math.min(28, 8 + metricIntensity(metric, value) * 25));
          const withheld = row.qualityGate === "withhold";
          const gated = withheld || row.qualityGate === "bounds_only";
          const gateColor = withheld ? "var(--status-alert)" : "var(--status-warn)";
          const gateLabel = withheld ? "Withheld" : "Bounds only";
          const position = jitteredPosition(row, coordGroups.get(coordKey(row)) ?? [row]);
          return (
            <CircleMarker
              key={`${row.iso3}-${row.pathogenType}-${metric}-${year ?? ""}`}
              center={position}
              radius={radius}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: notModeled ? 0.12 : withheld ? 0.18 : gated ? 0.28 : 0.45,
                opacity: notModeled ? 0.55 : 0.95,
                weight: selected?.iso3 === row.iso3 ? 3 : 1.5,
                dashArray: notModeled ? "1 4" : gated ? "4 3" : undefined,
              }}
              eventHandlers={{ click: () => setSelected(row) }}
              className={row.trendLabel === "surging" ? "vt-pulse" : undefined}
            >
              <Tooltip direction="top">
                <div className="text-xs">
                  <div className="font-medium">
                    {row.country} · {row.pathogenType}
                  </div>
                  <div>Risk score: {row.riskScore}</div>
                  <div>Resistance: {formatPercent(row.resistanceRate)}</div>
                  {gated && (
                    <div
                      className="mt-1 text-[10px] font-medium uppercase tracking-wide"
                      style={{ color: gateColor }}
                    >
                      {gateLabel} — reduced confidence
                    </div>
                  )}
                </div>
              </Tooltip>
              <Popup>
                <div className="min-w-[230px] text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{row.country}</div>
                    {gated && (
                      <span
                        className="rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                        style={{ borderColor: `${gateColor}80`, color: gateColor }}
                      >
                        {gateLabel}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 opacity-75">
                    {row.dominantOrganism} · {row.dominantDrug}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <PopupStat label="Risk" value={row.riskScore.toFixed(0)} />
                    <PopupStat label="Warning" value={row.earlyWarningScore.toFixed(0)} />
                    <PopupStat label="Resistance" value={formatPercent(row.resistanceRate)} />
                    <PopupStat label="Life exp." value={`${row.lifeExpectancy.toFixed(1)}y`} />
                  </div>
                  <div className="mt-3 rounded border border-slate-600/40 bg-slate-900/50 p-2">
                    <div className="font-medium">Recommended intervention</div>
                    <div className="mt-1 opacity-75">{row.recommendedIntervention}</div>
                    <div className="mt-1 text-[11px] opacity-75">
                      Predicted gain:{" "}
                      {lifeGainDisplay(row.predictedLifeGain, row.predictedLifeGainSampleCount)}
                    </div>
                  </div>
                  {gated && row.gateReason && (
                    <div className="mt-2 text-[10px] italic opacity-60">
                      Gate reason: {row.gateReason.replace(/_/g, " ")}
                    </div>
                  )}
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
              <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--accent)]">
                Selected country
              </div>
              <h3 className="mt-1 text-2xl font-light">{selected.country}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {selected.dominantOrganism} · {selected.dominantDrug} · {selected.latestYear}
              </p>
            </div>
            <button
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(null)}
            >
              Close
            </button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricTile
              icon={Crosshair}
              label="Risk score"
              value={selected.riskScore.toFixed(0)}
              color={severityColor(selected.riskScore)}
            />
            <MetricTile
              icon={Brain}
              label="Early warning"
              value={selected.earlyWarningScore.toFixed(0)}
              color={severityColor(selected.earlyWarningScore)}
            />
            <MetricTile
              icon={FlaskConical}
              label="Resistance"
              value={formatPercent(selected.resistanceRate)}
              color="var(--status-warn)"
            />
            <MetricTile
              icon={ShieldCheck}
              label="Confidence"
              value={formatPercent(selected.confidence)}
              color="var(--status-info)"
            />
          </div>
          <div className="mt-4 rounded-xl border border-border/60 bg-card/50 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Funding mismatch</span>
              <span
                className={
                  selected.fundingMismatch == null
                    ? "text-muted-foreground"
                    : selected.fundingMismatch > 0.5
                      ? "text-[color:var(--status-alert)]"
                      : "text-[color:var(--status-ok)]"
                }
              >
                {selected.fundingMismatch == null
                  ? "Not modeled"
                  : formatPercent(Math.abs(selected.fundingMismatch))}
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full"
                style={
                  selected.fundingMismatch == null
                    ? {
                        width: "100%",
                        opacity: 0.35,
                        background:
                          "repeating-linear-gradient(45deg, var(--muted-foreground), var(--muted-foreground) 4px, transparent 4px, transparent 8px)",
                      }
                    : {
                        width: `${Math.min(100, Math.abs(selected.fundingMismatch) * 100)}%`,
                        background:
                          selected.fundingMismatch > 0.5
                            ? "var(--status-alert)"
                            : "var(--status-ok)",
                      }
                }
              />
            </div>
            <div className="mt-1.5 text-[10px] italic text-muted-foreground">
              {selected.fundingMismatch == null
                ? `Not modeled — no Hub R&D data matched to ${selected.dominantOrganism}.`
                : `Proxy: ${selected.dominantOrganism}'s global R&D-vs-burden gap — organism-level, not country-specific.`}
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 p-3 text-xs leading-relaxed">
            <span className="font-medium text-[color:var(--accent)]">Policy recommendation:</span>{" "}
            {selected.recommendedIntervention}. Expected life expectancy gain is{" "}
            <b>
              {lifeGainDisplay(selected.predictedLifeGain, selected.predictedLifeGainSampleCount)}
            </b>
            , evidence level <b>{selected.evidenceLevel}</b>.
          </div>
        </div>
      )}
    </div>
  );
}

function MapKpi({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Globe2;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/60 p-2">
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      <div className="mt-1 text-lg font-light" style={{ color }}>
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="mb-1 flex items-center gap-2 text-[10px] text-muted-foreground">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 10px ${color}` }}
      />
      {label}
    </div>
  );
}

function PopupStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-900/60 p-2">
      <div className="text-[10px] uppercase opacity-60">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: typeof Crosshair;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" style={{ color }} />
        {label}
      </div>
      <div className="mt-2 text-2xl font-light" style={{ color }}>
        {value}
      </div>
    </div>
  );
}
