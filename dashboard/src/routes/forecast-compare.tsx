import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GitCompare, TrendingUp, TrendingDown, Layers, Zap, Brain } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

export const Route = createFileRoute("/forecast-compare")({
  component: ForecastComparePage,
  head: () => ({
    meta: [
      { title: "Country-to-Country Forecast Comparison — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "Compare epidemic forecasts side by side across African countries with selectable horizons and AI-surfaced drivers.",
      },
    ],
  }),
});

const COUNTRIES = [
  { code: "NG", name: "Nigeria", color: "oklch(0.78 0.18 200)" },
  { code: "ZA", name: "South Africa", color: "oklch(0.7 0.22 25)" },
  { code: "KE", name: "Kenya", color: "oklch(0.82 0.16 195)" },
  { code: "EG", name: "Egypt", color: "oklch(0.78 0.19 60)" },
  { code: "CD", name: "DR Congo", color: "oklch(0.7 0.2 300)" },
  { code: "ET", name: "Ethiopia", color: "oklch(0.78 0.17 155)" },
  { code: "MA", name: "Morocco", color: "oklch(0.78 0.16 290)" },
  { code: "NA", name: "Namibia", color: "oklch(0.7 0.22 25)" },
];

const HORIZONS = [7, 14, 30, 90] as const;
type Horizon = (typeof HORIZONS)[number];

const DRIVERS: Record<string, string[]> = {
  NG: ["Wastewater ↑31% (Lagos)", "Mpox clade Ib detected", "Inter-state mobility +18%"],
  ZA: ["Stable Rt 0.94", "Genomic coverage 84%", "Healthcare load nominal"],
  KE: ["RSV change-point posterior 0.94", "Rainfall anomaly +1.4σ"],
  EG: ["Pilgrim mobility window", "Wastewater stable"],
  CD: ["Cholera signal +312% Kinshasa-W3", "Cross-border with Brazzaville ↑27%"],
  ET: ["Polio cVDPV2 trace", "Climate baseline"],
  MA: ["Tourism inflow +12%", "Sequencing capacity high"],
  NA: ["Critical Rt 1.21", "Hospital stress 78%"],
};

function ForecastComparePage() {
  const [a, setA] = useState("NG");
  const [b, setB] = useState("ZA");
  const [h, setH] = useState<Horizon>(30);
  const [pathogen, setPathogen] = useState("Mpox");

  const data = useMemo(() => buildCompare(a, b, h, pathogen), [a, b, h, pathogen]);
  const ca = COUNTRIES.find((c) => c.code === a)!;
  const cb = COUNTRIES.find((c) => c.code === b)!;
  const deltaA = (data[data.length - 1][a] as number) - (data[0][a] as number);
  const deltaB = (data[data.length - 1][b] as number) - (data[0][b] as number);

  return (
    <CommandPage
      icon={GitCompare}
      eyebrow="Comparative Forecasting"
      title="Country-to-country outbreak comparison"
      subtitle="Side-by-side AI projections with selectable horizons and the drivers shaping each country's trajectory."
      kpis={[
        { label: "Horizon", value: `${h}d`, color: "var(--accent)" },
        {
          label: `${ca.name} Δ`,
          value: fmtDelta(deltaA),
          color: deltaA >= 0 ? "var(--status-warn)" : "var(--status-ok)",
        },
        {
          label: `${cb.name} Δ`,
          value: fmtDelta(deltaB),
          color: deltaB >= 0 ? "var(--status-warn)" : "var(--status-ok)",
        },
        {
          label: "Model confidence",
          value: h <= 14 ? "91%" : h <= 30 ? "84%" : "71%",
          color: "var(--status-info)",
        },
      ]}
    >
      <GlassCard
        title={`${ca.name} vs ${cb.name} · ${pathogen}`}
        subtitle={`Bayesian SEIR + wastewater + mobility · next ${h} days`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 text-[10px]">
              {HORIZONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setH(d)}
                  className={`px-2 py-1 rounded ${h === d ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]" : "border border-border text-muted-foreground"}`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 h-80">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
                <XAxis dataKey="d" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine x="Today" stroke="oklch(0.78 0.18 200)" strokeDasharray="3 3" />
                <Line
                  type="monotone"
                  dataKey={a}
                  stroke={ca.color}
                  strokeWidth={2}
                  dot={false}
                  name={ca.name}
                />
                <Line
                  type="monotone"
                  dataKey={b}
                  stroke={cb.color}
                  strokeWidth={2}
                  dot={false}
                  name={cb.name}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-3">
            <Selector label="Country A" value={a} onChange={setA} disabled={b} color={ca.color} />
            <Selector label="Country B" value={b} onChange={setB} disabled={a} color={cb.color} />
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Pathogen
              </div>
              <select
                value={pathogen}
                onChange={(e) => setPathogen(e.target.value)}
                className="w-full bg-background/40 border border-border/60 rounded-md text-xs px-2 py-1.5"
              >
                {["Mpox", "SARS-CoV-2", "Cholera", "Lassa", "Dengue", "RSV", "H5N1"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-2 gap-4">
        <DriverPanel country={ca} drivers={DRIVERS[a] ?? []} delta={deltaA} horizon={h} />
        <DriverPanel country={cb} drivers={DRIVERS[b] ?? []} delta={deltaB} horizon={h} />
      </div>

      <GlassCard title="AI comparative brief" subtitle="Auto-generated narrative">
        <p className="text-sm text-foreground/90 leading-relaxed">
          Over the next <span className="text-[color:var(--accent)] font-medium">{h} days</span>,
          the model projects
          <span className="font-medium" style={{ color: ca.color }}>
            {" "}
            {ca.name}
          </span>{" "}
          to {deltaA >= 0 ? "expand" : "contract"} {pathogen} burden by
          <span className="font-medium"> {fmtDelta(deltaA)}</span>, while
          <span className="font-medium" style={{ color: cb.color }}>
            {" "}
            {cb.name}
          </span>{" "}
          is expected to {deltaB >= 0 ? "rise" : "decline"} by
          <span className="font-medium"> {fmtDelta(deltaB)}</span>. The divergence is primarily
          driven by wastewater and mobility signals. Recommend prioritising responder mobilization
          toward the country with higher growth and tightening cross-border genomic exchange.
        </p>
      </GlassCard>
    </CommandPage>
  );
}

function Selector({
  label,
  value,
  onChange,
  disabled,
  color,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: string;
  color: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full" style={{ background: color }} />
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-background/40 border border-border/60 rounded-md text-xs px-2 py-1.5"
      >
        {COUNTRIES.filter((c) => c.code !== disabled).map((c) => (
          <option key={c.code} value={c.code}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function DriverPanel({
  country,
  drivers,
  delta,
  horizon,
}: {
  country: { code: string; name: string; color: string };
  drivers: string[];
  delta: number;
  horizon: number;
}) {
  const up = delta >= 0;
  return (
    <GlassCard title={country.name} subtitle={`${horizon}-day outlook`}>
      <div className="flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-xl grid place-items-center border"
          style={{
            borderColor: `${country.color}55`,
            background: `${country.color}14`,
            color: country.color,
          }}
        >
          {up ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
        </div>
        <div>
          <div className="text-2xl font-light tabular-nums" style={{ color: country.color }}>
            {fmtDelta(delta)}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            projected change
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
          <Layers className="w-3 h-3" /> Drivers
        </div>
        {drivers.map((d, i) => (
          <div
            key={i}
            className="text-xs flex items-start gap-2 rounded-lg border border-border/50 bg-background/30 p-2.5"
          >
            <Brain className="w-3.5 h-3.5 mt-0.5 text-[color:var(--accent)] shrink-0" />
            <span>{d}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 text-[10px] text-[color:var(--accent)] inline-flex items-center gap-1">
        <Zap className="w-3 h-3" /> Action:{" "}
        {up ? "Stage rapid-response capacity" : "Maintain baseline & re-evaluate weekly"}
      </div>
    </GlassCard>
  );
}

function fmtDelta(n: number) {
  const s = n >= 0 ? "+" : "−";
  return `${s}${Math.abs(Math.round(n))}%`;
}

function buildCompare(a: string, b: string, h: number, pathogen: string) {
  const sa = (a.charCodeAt(0) + a.charCodeAt(1) + pathogen.length) % 13;
  const sb = (b.charCodeAt(0) + b.charCodeAt(1) + pathogen.length) % 11;
  const rows: Array<Record<string, number | string>> = [];
  for (let i = -10; i <= h; i++) {
    const va = 50 + i * (0.6 + sa * 0.12) + Math.sin((i + sa) / 4) * 8;
    const vb = 50 + i * (0.2 + sb * 0.09) + Math.sin((i + sb) / 5) * 6;
    rows.push({
      d: i === 0 ? "Today" : i < 0 ? `${i}d` : `+${i}d`,
      [a]: Math.max(0, Math.round(va)),
      [b]: Math.max(0, Math.round(vb)),
    });
  }
  return rows;
}
