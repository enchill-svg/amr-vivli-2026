import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import {
  Leaf,
  Droplet,
  Wind,
  Thermometer,
  AlertTriangle,
  Brain,
  TrendingUp,
  MapPin,
} from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { InsightPanel } from "@/components/vt/KpiStrip";
import { AnomalyExplanationCard, DEMO_ANOMALIES } from "@/components/vt/AnomalyExplanation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea,
  Cell,
} from "recharts";

export const Route = createFileRoute("/environment")({
  component: EnvironmentPage,
  head: () => ({
    meta: [
      { title: "Environmental Surveillance — ViralTrack-Afrika" },
      {
        name: "description",
        content:
          "Wastewater, air-quality, and climate signals fused with AI anomaly detection and weekly outbreak early-warnings.",
      },
    ],
  }),
});

const WastewaterHeatmap = lazy(() =>
  import("@/components/vt/WastewaterHeatmap").then((m) => ({ default: m.WastewaterHeatmap })),
);

type SignalRow = {
  day: string;
  sarscov2: number;
  influenza: number;
  rsv: number;
  cholera: number;
  mpox: number;
  baseline: number;
};

function buildSignals(days = 56): SignalRow[] {
  const out: SignalRow[] = [];
  const start = Date.now() - days * 86400000;
  for (let i = 0; i < days; i++) {
    const t = i / days;
    const wave = Math.sin(t * Math.PI * 2.2);
    out.push({
      day: new Date(start + i * 86400000).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      sarscov2: Math.round(40 + wave * 18 + Math.random() * 8 + i * 0.4),
      influenza: Math.round(22 + Math.sin(t * 6) * 9 + Math.random() * 5),
      rsv: Math.round(18 + Math.cos(t * 4) * 7 + Math.random() * 4),
      cholera: Math.round(8 + Math.max(0, wave) * 14 + (i > days - 12 ? i * 1.6 : 0)),
      mpox: Math.round(5 + Math.max(0, Math.sin(t * 3)) * 9 + (i > days - 18 ? i * 0.9 : 0)),
      baseline: 35,
    });
  }
  return out;
}

const ANOMALIES = [
  {
    site: "Kinshasa-W3",
    pathogen: "Cholera",
    z: 4.2,
    delta: "+312%",
    country: "DR Congo",
    severity: "critical" as const,
  },
  {
    site: "Lagos-Ikoyi",
    pathogen: "Mpox clade Ib",
    z: 3.6,
    delta: "+184%",
    country: "Nigeria",
    severity: "high" as const,
  },
  {
    site: "Nairobi-Dandora",
    pathogen: "SARS-CoV-2 JN.1",
    z: 2.9,
    delta: "+92%",
    country: "Kenya",
    severity: "high" as const,
  },
  {
    site: "Cape Town-Athlone",
    pathogen: "Influenza A H3N2",
    z: 2.4,
    delta: "+61%",
    country: "South Africa",
    severity: "moderate" as const,
  },
  {
    site: "Addis-Kaliti",
    pathogen: "Polio (cVDPV2)",
    z: 2.2,
    delta: "+47%",
    country: "Ethiopia",
    severity: "moderate" as const,
  },
];

const WEEKLY = [
  { week: "W-5", risk: 41 },
  { week: "W-4", risk: 46 },
  { week: "W-3", risk: 52 },
  { week: "W-2", risk: 58 },
  { week: "W-1", risk: 67 },
  { week: "Now", risk: 74 },
  { week: "W+1", risk: 81 },
  { week: "W+2", risk: 86 },
];

const SEVERITY: Record<string, string> = {
  low: "#3ee6a8",
  moderate: "#f5c451",
  high: "#ff8a3d",
  critical: "#ff3d6e",
};

function EnvironmentPage() {
  const [pathogen, setPathogen] = useState<"sarscov2" | "influenza" | "rsv" | "cholera" | "mpox">(
    "sarscov2",
  );
  const data = useMemo(() => buildSignals(56), []);

  const peak = useMemo(() => Math.max(...data.map((d) => d[pathogen] as number)), [data, pathogen]);
  const latest = data[data.length - 1][pathogen] as number;
  const weekAgo = data[data.length - 8][pathogen] as number;
  const delta = (((latest - weekAgo) / Math.max(1, weekAgo)) * 100).toFixed(1);

  return (
    <CommandPage
      icon={Leaf}
      eyebrow="Environmental Surveillance"
      title="Wastewater & climate intelligence"
      subtitle="Continuous monitoring of 412 sentinel sites across 54 African nations — fused with AI anomaly detection and a rolling 14-day forecast."
      kpis={[
        {
          label: "Active sites",
          value: "412",
          color: "var(--accent)",
          sub: "37 offline · 12 maintenance",
        },
        {
          label: "Composite risk",
          value: "74/100",
          color: "var(--status-warn)",
          sub: "+7 vs last week",
        },
        {
          label: "Anomalies (7d)",
          value: "23",
          color: "var(--status-alert)",
          sub: "5 critical · 9 high",
        },
        {
          label: "Forecast horizon",
          value: "14d",
          color: "var(--status-info)",
          sub: "95% CI, hourly refresh",
        },
      ]}
    >
      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard
          className="lg:col-span-2"
          title="Pathogen signal vs. baseline"
          subtitle={`8-week wastewater concentration · current ${delta}% week-over-week`}
          action={
            <div className="flex flex-wrap gap-1 text-[10px]">
              {(["sarscov2", "influenza", "rsv", "cholera", "mpox"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPathogen(p)}
                  className={`px-2 py-1 rounded ${pathogen === p ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]" : "bg-secondary/40 text-muted-foreground hover:text-foreground"}`}
                >
                  {p === "sarscov2"
                    ? "SARS-CoV-2"
                    : p === "influenza"
                      ? "Influenza"
                      : p === "rsv"
                        ? "RSV"
                        : p === "cholera"
                          ? "Cholera"
                          : "Mpox"}
                </button>
              ))}
            </div>
          }
        >
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="envSig" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.05 250 / 0.3)" />
                <XAxis
                  dataKey="day"
                  tick={{ fill: "oklch(0.7 0.02 220)", fontSize: 10 }}
                  interval={6}
                />
                <YAxis tick={{ fill: "oklch(0.7 0.02 220)", fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.045 250)",
                    border: "1px solid oklch(0.4 0.05 250)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={35}
                  stroke="#f5c451"
                  strokeDasharray="4 4"
                  label={{
                    value: "Outbreak baseline",
                    fill: "#f5c451",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
                <ReferenceArea
                  x1={data[data.length - 8].day}
                  x2={data[data.length - 1].day}
                  fill="#ff3d6e"
                  fillOpacity={0.06}
                />
                <Area
                  type="monotone"
                  dataKey={pathogen}
                  stroke="oklch(0.78 0.18 200)"
                  strokeWidth={2}
                  fill="url(#envSig)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <Stat label="Latest" value={`${latest} cp/mL`} color="var(--accent)" />
            <Stat label="7d peak" value={`${peak} cp/mL`} color="var(--status-warn)" />
            <Stat
              label="WoW change"
              value={`${delta}%`}
              color={Number(delta) > 0 ? "var(--status-alert)" : "var(--status-ok)"}
            />
          </div>
        </GlassCard>

        <InsightPanel
          items={[
            {
              tag: "Critical",
              title: "Cholera surge — Kinshasa basin",
              body: "Composite z-score 4.2 across 3 Kinshasa sites. Predicted clinical signal in 6–9 days; pre-position ORS and chlorine stocks.",
            },
            {
              tag: "High",
              title: "Mpox clade Ib expanding",
              body: "Lagos and Kinshasa wastewater both >3σ above baseline. 14-day forecast suggests cross-border spread to Cameroon.",
            },
            {
              tag: "Watch",
              title: "SARS-CoV-2 JN.1 plateau breaking",
              body: "Nairobi and Kampala signals rising after 6-week plateau — likely autumn wave initiation.",
            },
          ]}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard
          className="lg:col-span-2"
          title="Africa wastewater heatmap"
          subtitle="412 sentinel sites · click any node for site-level intelligence"
        >
          <div
            className="rounded-xl overflow-hidden border border-border/60 bg-background/30"
            style={{ height: 460 }}
          >
            <Suspense
              fallback={
                <div className="h-full grid place-items-center text-xs text-muted-foreground">
                  Loading geospatial layer…
                </div>
              }
            >
              <WastewaterHeatmap />
            </Suspense>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
            <span className="font-medium text-foreground">Severity</span>
            {Object.entries(SEVERITY).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: v, boxShadow: `0 0 8px ${v}` }}
                />
                {k}
              </span>
            ))}
          </div>
        </GlassCard>

        <GlassCard
          title="AI anomaly detector"
          subtitle="Z-score > 2.0 across rolling 14-day window"
        >
          <ul className="space-y-2.5">
            {ANOMALIES.map((a) => (
              <li
                key={a.site}
                className="rounded-lg border border-border/60 bg-background/30 p-3 hover:border-[color:var(--accent)]/50 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="mt-0.5 w-2 h-2 rounded-full shrink-0"
                    style={{
                      background: SEVERITY[a.severity],
                      boxShadow: `0 0 6px ${SEVERITY[a.severity]}`,
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{a.pathogen}</div>
                      <div
                        className="text-[11px] font-mono tabular-nums"
                        style={{ color: SEVERITY[a.severity] }}
                      >
                        z {a.z.toFixed(1)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {a.site} · {a.country}
                      </span>
                      <span className="text-[color:var(--status-alert)]">{a.delta}</span>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard
          className="lg:col-span-2"
          title="Weekly early-warning forecast"
          subtitle="Composite outbreak risk · 5 weeks history + 2 weeks AI projection"
        >
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={WEEKLY} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.4 0.05 250 / 0.3)" />
                <XAxis dataKey="week" tick={{ fill: "oklch(0.7 0.02 220)", fontSize: 10 }} />
                <YAxis tick={{ fill: "oklch(0.7 0.02 220)", fontSize: 10 }} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.045 250)",
                    border: "1px solid oklch(0.4 0.05 250)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <ReferenceLine
                  y={75}
                  stroke="#ff3d6e"
                  strokeDasharray="4 4"
                  label={{
                    value: "Action threshold",
                    fill: "#ff3d6e",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
                <Bar dataKey="risk" radius={[6, 6, 0, 0]}>
                  {WEEKLY.map((w, i) => (
                    <Cell
                      key={i}
                      fill={
                        w.risk >= 75
                          ? "#ff3d6e"
                          : w.risk >= 60
                            ? "#ff8a3d"
                            : w.risk >= 45
                              ? "#f5c451"
                              : "#3ee6a8"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
            <Stat label="This week" value="74" color="var(--status-warn)" />
            <Stat label="Next week (AI)" value="81" color="var(--status-alert)" />
            <Stat label="W+2 (AI)" value="86" color="var(--status-alert)" />
          </div>
        </GlassCard>

        <GlassCard title="Environmental covariates" subtitle="Climate & infrastructure drivers">
          <ul className="space-y-3 text-xs">
            <Covariate
              icon={Thermometer}
              label="Surface temp anomaly"
              value="+1.8°C"
              color="#ff8a3d"
              sub="Sahel belt · 30-day mean"
            />
            <Covariate
              icon={Droplet}
              label="Rainfall (z)"
              value="+2.3σ"
              color="#5cb8ff"
              sub="Central Africa · flood-linked cholera risk"
            />
            <Covariate
              icon={Wind}
              label="PM2.5 (urban mean)"
              value="68 µg/m³"
              color="#f5c451"
              sub="WHO limit 15 — respiratory load"
            />
            <Covariate
              icon={TrendingUp}
              label="Mobility index"
              value="+12%"
              color="#a78bfa"
              sub="Inter-country travel vs 2024 baseline"
            />
            <Covariate
              icon={AlertTriangle}
              label="Sanitation coverage"
              value="62%"
              color="#ff3d6e"
              sub="Sub-Saharan mean — gap fuels enteric outbreaks"
            />
          </ul>
        </GlassCard>
      </div>

      <GlassCard
        title="AI anomaly explanations"
        subtitle="Top contributing features, confidence, and recommended response actions for each flagged signal"
      >
        <div className="grid lg:grid-cols-2 gap-3">
          {DEMO_ANOMALIES.map((a) => (
            <AnomalyExplanationCard key={a.id} a={a} />
          ))}
        </div>
      </GlassCard>
    </CommandPage>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-lg font-light tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function Covariate({
  icon: Icon,
  label,
  value,
  color,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
  sub: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg grid place-items-center shrink-0"
        style={{ background: `${color}1f`, color }}
      >
        <Icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground">{label}</span>
          <span className="font-mono tabular-nums" style={{ color }}>
            {value}
          </span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </li>
  );
}
