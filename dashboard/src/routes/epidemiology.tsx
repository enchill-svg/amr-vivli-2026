import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse } from "lucide-react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import {
  getLiveCountryTrends,
  getPathogenComparisonStats,
  getResistanceSeries,
} from "@/lib/amr-data.functions";

export const Route = createFileRoute("/epidemiology")({
  component: LifeExpectancyPage,
  head: () => ({ meta: [{ title: "Life Expectancy Explorer — AMR LifeIntel" }] }),
});

function formatUsd(value: number) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground">{value}</dd>
    </div>
  );
}

function LifeExpectancyPage() {
  const { data: countries = [] } = useQuery({
    queryKey: ["life-countries"],
    queryFn: () => getLiveCountryTrends("all"),
  });
  const { data: series = [] } = useQuery({
    queryKey: ["life-series"],
    queryFn: getResistanceSeries,
  });
  const { data: bacterialStats = null } = useQuery({
    queryKey: ["pathogen-compare", "bacterial"],
    queryFn: () => getPathogenComparisonStats("bacterial"),
  });
  const { data: fungalStats = null } = useQuery({
    queryKey: ["pathogen-compare", "fungal"],
    queryFn: () => getPathogenComparisonStats("fungal"),
  });
  const scatter = countries.map((r) => ({
    country: r.country,
    resistance: Math.round(r.resistanceRate * 100),
    life: r.lifeExpectancy,
    risk: r.riskScore,
    gain: r.predictedLifeGain,
  }));
  const strongest = [...countries].sort((a, b) => b.predictedLifeGain - a.predictedLifeGain)[0];
  const comparisonColumns = [
    { key: "bacterial", label: "Bacterial", stats: bacterialStats, color: "oklch(0.68 0.24 25)" },
    { key: "fungal", label: "Fungal", stats: fungalStats, color: "oklch(0.78 0.18 200)" },
  ] as const;

  return (
    <CommandPage
      icon={HeartPulse}
      eyebrow="Life Expectancy Explorer"
      title="Estimate how AMR patterns associate with population health"
      subtitle="Policy-facing view linking AMR burden, evolutionary trajectory, health-system indicators, and modeled life-expectancy gains."
      kpis={[
        {
          label: "Best intervention gain",
          value: strongest ? `+${strongest.predictedLifeGain.toFixed(2)}y` : "—",
          color: "var(--status-ok)",
          sub: strongest?.country,
        },
        { label: "Outcome", value: "Life exp.", color: "var(--accent)", sub: "Country-year" },
        {
          label: "Model class",
          value: "GLM",
          color: "var(--status-info)",
          sub: "Mixed-effects ready",
        },
        {
          label: "Uncertainty",
          value: "95% CI",
          color: "var(--status-warn)",
          sub: "Bootstrap-ready",
        },
      ]}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard
          title="Resistance burden vs life expectancy"
          subtitle="Each point is a country signal. Interpret as association, not causal attribution."
        >
          <div className="h-80">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
                <XAxis
                  dataKey="resistance"
                  name="Resistance"
                  unit="%"
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <YAxis
                  dataKey="life"
                  name="Life expectancy"
                  unit="y"
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "oklch(0.22 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                />
                <Scatter data={scatter} fill="oklch(0.78 0.18 200)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard
          title="Population outcome trend"
          subtitle="Resistance burden and life expectancy streams."
        >
          <div className="h-80">
            <ResponsiveContainer>
              <ComposedChart data={series}>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  dataKey="life"
                  name="Life expectancy"
                  stroke="oklch(0.78 0.17 155)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="bacterial"
                  name="Bacterial burden"
                  stroke="oklch(0.68 0.24 25)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  dataKey="fungal"
                  name="Fungal burden"
                  stroke="oklch(0.78 0.18 200)"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
      <GlassCard
        title="Bacteria vs. fungi"
        subtitle="Reporting coverage and R&D funding profile by pathogen type, from the gated country-year panel."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {comparisonColumns.map(({ key, label, stats, color }) => (
            <div key={key} className="rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="text-sm font-medium" style={{ color }}>
                {label}
              </div>
              {stats ? (
                <dl className="mt-3 space-y-2 text-xs">
                  <StatRow label="Year range" value={`${stats.yearMin}–${stats.yearMax}`} />
                  <StatRow label="Countries reporting" value={String(stats.countryCount)} />
                  <StatRow
                    label="Longest single-country run"
                    value={stats.longestIso ? `${stats.longestIso} · ${stats.longestN}y` : "—"}
                  />
                  <StatRow
                    label="Peak R&D funding year"
                    value={`${stats.fundingPeakYear} · ${formatUsd(stats.fundingPeakValue)}`}
                  />
                  <StatRow
                    label="Organisms below quality gate"
                    value={String(stats.gatedOrganisms.length)}
                  />
                </dl>
              ) : (
                <p className="mt-3 text-xs italic text-muted-foreground">
                  Not modeled — insufficient published data.
                </p>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard
        title="Interpretation guardrails"
        subtitle="The platform is designed for transparent, policy-safe inference."
      >
        <div className="grid gap-3 md:grid-cols-4">
          {[
            [
              "Confounding",
              "Life expectancy depends on many non-AMR factors; models adjust for health capacity and external indicators.",
            ],
            [
              "Breakpoints",
              "Fungal drug–species pairs without breakpoints are kept as MIC-only or uncertainty-bounded signals.",
            ],
            [
              "Coverage",
              "Sparse country-year cells are flagged by data quality score before policy ranking.",
            ],
            [
              "Causality",
              "Outputs are decision-support estimates, not causal claims unless a causal design is selected.",
            ],
          ].map(([t, x]) => (
            <div key={t} className="rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="text-sm font-medium">{t}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{x}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </CommandPage>
  );
}
