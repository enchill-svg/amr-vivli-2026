import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { RiskPill, TinyBar } from "@/components/amr/AMRDataCards";
import { formatLifeGain, getLiveCountryTrends } from "@/lib/amr-data.functions";

export const Route = createFileRoute("/countries")({
  component: CountriesPage,
  head: () => ({ meta: [{ title: "Country Explorer — AMR LifeIntel" }] }),
});

function CountriesPage() {
  const [query, setQuery] = useState("");
  const { data = [] } = useQuery({
    queryKey: ["countries-explorer"],
    queryFn: () => getLiveCountryTrends("all"),
    refetchInterval: 60_000,
  });
  const rows = useMemo(
    () =>
      data
        .filter((r) =>
          `${r.country} ${r.iso3} ${r.dominantOrganism} ${r.dominantDrug}`
            .toLowerCase()
            .includes(query.toLowerCase()),
        )
        .sort((a, b) => {
          if (a.riskScore == null && b.riskScore == null) return 0;
          if (a.riskScore == null) return 1;
          if (b.riskScore == null) return -1;
          return b.riskScore - a.riskScore;
        }),
    [data, query],
  );
  const top = rows[0];
  const chartRows = rows.slice(0, 10).map((r) => ({
    country: r.iso3,
    risk: r.riskScore,
    gain: r.predictedLifeGain == null ? 0 : Number((r.predictedLifeGain * 100).toFixed(0)),
  }));
  const scoredRows = rows.filter((r) => r.riskScore != null);
  const knownGainRows = rows.filter((r) => r.predictedLifeGain != null);
  const avgGain = knownGainRows.length
    ? knownGainRows.reduce((s, r) => s + (r.predictedLifeGain as number), 0) / knownGainRows.length
    : null;
  const radar = top
    ? [
        { metric: "Risk", value: top.riskScore },
        { metric: "Warning", value: top.earlyWarningScore },
        { metric: "Resistance", value: top.resistanceRate * 100 },
        {
          metric: "Funding gap",
          value: top.fundingMismatch == null ? null : Math.abs(top.fundingMismatch) * 100,
        },
        { metric: "Data quality", value: top.dataQuality * 100 },
        { metric: "Confidence", value: top.confidence * 100 },
      ]
    : [];

  return (
    <CommandPage
      icon={Landmark}
      eyebrow="Country Explorer"
      title="Compare national AMR risk and life-expectancy impact"
      subtitle="Country-level analytical workspace for WHO-style ranking, prioritization, evidence quality, and intervention targeting."
      kpis={[
        {
          label: "Countries",
          value: String(new Set(rows.map((r) => r.iso3)).size),
          color: "var(--accent)",
        },
        {
          label: "Highest risk",
          value: top?.iso3 ?? "—",
          color: "var(--status-alert)",
          sub: top?.country,
        },
        {
          label: "Mean risk",
          value: scoredRows.length
            ? Math.round(
                scoredRows.reduce((s, r) => s + (r.riskScore as number), 0) / scoredRows.length,
              ).toString()
            : "—",
          color: "var(--status-warn)",
        },
        {
          label: "Avg gain",
          value: formatLifeGain(avgGain),
          color: "var(--status-ok)",
        },
      ]}
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard
          className="xl:col-span-2"
          title="Country ranking table"
          subtitle="Filter by country, organism, ISO3, or drug"
          action={
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search countries…"
                className="h-8 rounded-lg border border-input bg-background/40 pl-8 pr-3 text-xs"
              />
            </div>
          }
        >
          <div className="overflow-hidden rounded-xl border border-border/60">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Country</th>
                  <th>Signal</th>
                  <th>Risk</th>
                  <th>Trend</th>
                  <th>Life exp.</th>
                  <th>Gain</th>
                  <th className="pr-3">Quality</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={`${r.iso3}-${r.pathogenType}`}
                    className="border-t border-border/50 hover:bg-secondary/20"
                  >
                    <td className="p-3">
                      <div className="font-medium">{r.country}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.iso3} · {r.pathogenType}
                      </div>
                    </td>
                    <td>
                      <div>{r.dominantOrganism}</div>
                      <div className="text-[10px] text-muted-foreground">{r.dominantDrug}</div>
                    </td>
                    <td>
                      <RiskPill value={r.riskScore} />
                    </td>
                    <td className="capitalize">{r.trendLabel}</td>
                    <td>{r.lifeExpectancy == null ? "—" : `${r.lifeExpectancy.toFixed(1)}y`}</td>
                    <td
                      className={
                        r.predictedLifeGain == null
                          ? "text-muted-foreground"
                          : "text-[color:var(--status-ok)]"
                      }
                    >
                      {formatLifeGain(r.predictedLifeGain)}
                    </td>
                    <td className="pr-3">
                      <TinyBar value={r.dataQuality * 100} color="var(--accent)" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>

        <GlassCard
          title="Selected country profile"
          subtitle={top ? `${top.country} · ${top.dominantOrganism}` : "No country selected"}
        >
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={radar}>
                <PolarGrid stroke="oklch(0.3 0.04 250 / 0.45)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: "#94a3b8", fontSize: 10 }} />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: "#94a3b8", fontSize: 9 }}
                />
                <Radar
                  dataKey="value"
                  stroke="oklch(0.78 0.18 200)"
                  fill="oklch(0.78 0.18 200)"
                  fillOpacity={0.25}
                  connectNulls
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          {top && (
            <div className="rounded-xl border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 p-3 text-xs leading-relaxed">
              <b>Recommendation:</b> {top.recommendedIntervention}. Evidence level:{" "}
              {top.evidenceLevel}; confidence {Math.round(top.confidence * 100)}%.
              <div className="mt-1.5 italic text-muted-foreground">
                {top.fundingMismatch == null
                  ? `Funding gap not modeled — no Hub R&D data matched to ${top.dominantOrganism}.`
                  : `Funding gap reflects ${top.dominantOrganism}'s global R&D-vs-burden proxy, not a ${top.country}-specific figure.`}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      <GlassCard
        title="Risk and intervention opportunity"
        subtitle="Top ten countries by risk score; green line indicates model-predicted life-expectancy gain ×100."
      >
        <div className="h-80">
          <ResponsiveContainer>
            <BarChart data={chartRows}>
              <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
              <XAxis dataKey="country" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.22 0.04 250)",
                  border: "1px solid oklch(0.3 0.05 250)",
                  fontSize: 11,
                }}
              />
              <Bar dataKey="risk" fill="oklch(0.68 0.24 25)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="gain" fill="oklch(0.78 0.17 155)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </CommandPage>
  );
}
