import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Brain,
  Database,
  FlaskConical,
  Globe2,
  HeartPulse,
  Landmark,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageShell } from "@/components/vt/PageShell";
import { AMRHeroBanner } from "@/components/amr/AMRHeroBanner";
import { ClientAMRWorldMap } from "@/components/amr/ClientAMRWorldMap";
import { RiskPill, StatCard, TinyBar } from "@/components/amr/AMRDataCards";
import {
  getExecutiveKpis,
  getLiveCountryTrends,
  getPathogenSignals,
  getResistanceSeries,
} from "@/lib/amr-data.functions";
import { getFundingGapRows } from "@/lib/amr-data.functions";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "AMR Life Expectancy Intelligence Platform" },
      {
        name: "description",
        content:
          "Scientific decision-support platform for AMR resistance patterns, life expectancy, intervention impact, and funding alignment.",
      },
    ],
  }),
});

function Index() {
  const { data: kpis } = useQuery({
    queryKey: ["home-kpis"],
    queryFn: getExecutiveKpis,
    refetchInterval: 60_000,
  });
  const { data: countries = [] } = useQuery({
    queryKey: ["home-countries"],
    queryFn: () => getLiveCountryTrends("all"),
    refetchInterval: 60_000,
  });
  const { data: signals = [] } = useQuery({
    queryKey: ["home-signals"],
    queryFn: () => getPathogenSignals("all"),
    refetchInterval: 60_000,
  });
  const { data: series = [] } = useQuery({
    queryKey: ["home-series"],
    queryFn: getResistanceSeries,
  });
  const { data: fundingRows = [] } = useQuery({
    queryKey: ["home-funding"],
    queryFn: getFundingGapRows,
  });

  const highRisk = [...countries].sort((a, b) => b.riskScore - a.riskScore).slice(0, 6);
  const topSignals = [...signals]
    .sort((a, b) => b.evolutionaryFitness - a.evolutionaryFitness)
    .slice(0, 5);
  const summary = kpis ?? {
    countries: 0,
    highRisk: 0,
    rising: 0,
    avgResistance: 0,
    avgLifeGain: 0,
    fundingGap: 0,
    isolates: 0,
  };

  return (
    <PageShell>
      <AMRHeroBanner />

      <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <StatCard
          icon={Globe2}
          label="Countries monitored"
          value={summary.countries.toLocaleString()}
          sub="Bacterial + fungal"
          color="var(--accent)"
        />
        <StatCard
          icon={AlertTriangle}
          label="High-risk countries"
          value={String(summary.highRisk)}
          sub="Risk score ≥ 80"
          color="var(--status-alert)"
        />
        <StatCard
          icon={TrendingUp}
          label="Rising trajectories"
          value={String(summary.rising)}
          sub="MIC drift or rate growth"
          color="var(--status-warn)"
        />
        <StatCard
          icon={FlaskConical}
          label="Mean resistance"
          value={`${Math.round(summary.avgResistance * 100)}%`}
          sub="Current analytical set"
          color="var(--status-info)"
        />
        <StatCard
          icon={HeartPulse}
          label="Predicted gain"
          value={`+${summary.avgLifeGain.toFixed(2)}y`}
          sub="Average intervention gain"
          color="var(--status-ok)"
        />
        <StatCard
          icon={Database}
          label="Isolate signals"
          value={summary.isolates.toLocaleString()}
          sub="Live analytical rows"
          color="var(--status-purple)"
        />
      </div>

      <div className="grid grid-cols-12 gap-4">
        <section className="col-span-12 xl:col-span-8">
          <div className="h-[680px]">
            <ClientAMRWorldMap />
          </div>
        </section>

        <aside className="col-span-12 space-y-4 xl:col-span-4">
          <Panel
            title="Country risk ranking"
            subtitle="Composite burden, trajectory, funding and health-system signal"
            action={
              <Link to="/countries" className="text-[11px] text-[color:var(--accent)]">
                Open
              </Link>
            }
          >
            <div className="space-y-3">
              {highRisk.map((row) => (
                <div
                  key={`${row.iso3}-${row.pathogenType}`}
                  className="rounded-xl border border-border/60 bg-card/45 p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{row.country}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {row.dominantOrganism} · {row.dominantDrug}
                      </div>
                    </div>
                    <RiskPill value={row.riskScore} />
                  </div>
                  <div className="mt-2">
                    <TinyBar
                      value={row.riskScore}
                      color={row.riskScore > 85 ? "var(--status-alert)" : "var(--status-warn)"}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{row.pathogenType}</span>
                    <span>
                      {row.trendLabel} · confidence {Math.round(row.confidence * 100)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            title="Early-warning organism–drug signals"
            subtitle="Evolutionary fitness and distance-to-failure"
            action={
              <Link to="/pathogens" className="text-[11px] text-[color:var(--accent)]">
                Explore
              </Link>
            }
          >
            <div className="space-y-2">
              {topSignals.map((row) => (
                <div
                  key={row.id}
                  className="rounded-lg border border-border/60 bg-background/30 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium">{row.organism}</div>
                      <div className="truncate text-[10px] text-muted-foreground">
                        {row.country} · {row.drug}
                      </div>
                    </div>
                    <span className="font-mono text-xs text-[color:var(--status-alert)]">
                      {row.evolutionaryFitness}
                    </span>
                  </div>
                  <div className="mt-2">
                    <TinyBar value={row.evolutionaryFitness} color="var(--status-alert)" />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Panel
          title="Resistance and life-expectancy trend"
          subtitle="Illustrative analytical stream from harmonized country-year table"
          className="xl:col-span-2"
        >
          <div className="h-80">
            <ResponsiveContainer>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="bacterial" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.68 0.24 25)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.68 0.24 25)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="fungal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="oklch(0.78 0.18 200)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.35)" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="bacterial"
                  stroke="oklch(0.68 0.24 25)"
                  fill="url(#bacterial)"
                  name="Bacterial resistance"
                />
                <Area
                  type="monotone"
                  dataKey="fungal"
                  stroke="oklch(0.78 0.18 200)"
                  fill="url(#fungal)"
                  name="Fungal resistance"
                />
                <Line
                  type="monotone"
                  dataKey="life"
                  stroke="oklch(0.78 0.17 155)"
                  strokeWidth={2}
                  dot={false}
                  name="Life expectancy"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Funding mismatch" subtitle="High burden but lower R&D allocation">
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={fundingRows.slice(0, 8)} layout="vertical" margin={{ left: 12 }}>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.25)" />
                <XAxis type="number" stroke="#94a3b8" fontSize={10} />
                <YAxis
                  dataKey="organism"
                  type="category"
                  stroke="#94a3b8"
                  fontSize={10}
                  width={110}
                />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="gap" fill="oklch(0.68 0.24 25)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </PageShell>
  );
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-card/55 p-5 backdrop-blur-sm ${className}`}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium tracking-wide">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
