import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { TinyBar } from "@/components/amr/AMRDataCards";
import {
  getFundingByYear,
  getFundingGapRows,
  getHubFundingComposition,
} from "@/lib/amr-data.functions";

function formatUsd(value: number) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export const Route = createFileRoute("/marketplace")({
  component: FundingPage,
  head: () => ({ meta: [{ title: "Funding Gap Explorer — AMR LifeIntel" }] }),
});

function FundingPage() {
  const [view, setView] = useState<"organism" | "year">("organism");
  const { data: fundingRows = [] } = useQuery({
    queryKey: ["funding-gap"],
    queryFn: getFundingGapRows,
  });
  const { data: fundingByYear = [] } = useQuery({
    queryKey: ["funding-by-year"],
    queryFn: getFundingByYear,
  });
  const { data: hubComposition = [] } = useQuery({
    queryKey: ["hub-funding-composition"],
    queryFn: getHubFundingComposition,
  });
  const underfunded = fundingRows.filter((r) => r.gap < 0).sort((a, b) => a.gap - b.gap);
  const hubGeography = hubComposition
    .filter((r) => r.compositionDimension === "geography")
    .sort((a, b) => b.shareOfHubTotal - a.shareOfHubTotal);
  const hubModality = hubComposition
    .filter((r) => r.compositionDimension === "modality")
    .sort((a, b) => b.shareOfHubTotal - a.shareOfHubTotal);
  const hubTotal = hubGeography.reduce((s, r) => s + r.amountUsd, 0);
  const chart = fundingRows.map((r) => ({
    organism: r.organism.replace(/^(\w)\w+/, "$1."),
    burden: Math.round(r.burdenShare * 1000) / 10,
    funding: Math.round(r.fundingShare * 1000) / 10,
    gap: Math.round(r.gap * 1000) / 10,
  }));

  return (
    <CommandPage
      icon={Landmark}
      eyebrow="Funding Gap Explorer"
      title="AMR R&D investment vs surveillance burden"
      subtitle="Organism-level burden share vs Global AMR R&D Hub funding share (pro-rated)."
      kpis={[
        { label: "Organisms", value: String(fundingRows.length), color: "var(--accent)" },
        { label: "Underfunded", value: String(underfunded.length), color: "var(--status-alert)" },
        {
          label: "Top gap",
          value: underfunded[0] ? String(underfunded[0].gap) : "—",
          color: "var(--status-alert)",
          sub: underfunded[0]?.organism,
        },
        {
          label: "Source",
          value: "Hub",
          color: "var(--status-info)",
          sub: "funding_gap_summary_v1",
        },
      ]}
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard
          className="xl:col-span-2"
          title="Burden–funding share"
          subtitle={
            view === "organism"
              ? "Negative gap = funding share below burden share."
              : "Hub R&D pro-rated totals by project start year, bacterial vs fungal."
          }
        >
          <div className="mb-3 flex flex-wrap gap-1.5">
            <button
              onClick={() => setView("organism")}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${view === "organism" ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]" : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"}`}
            >
              By organism
            </button>
            <button
              onClick={() => setView("year")}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${view === "year" ? "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]" : "border border-border bg-card/60 text-muted-foreground hover:text-foreground"}`}
            >
              By year
            </button>
          </div>
          <div className="h-96">
            <ResponsiveContainer>
              {view === "organism" ? (
                <BarChart data={chart}>
                  <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
                  <XAxis
                    dataKey="organism"
                    stroke="#94a3b8"
                    fontSize={10}
                    angle={-20}
                    height={60}
                    textAnchor="end"
                  />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.22 0.04 250)",
                      border: "1px solid oklch(0.3 0.05 250)",
                      fontSize: 11,
                    }}
                  />
                  <Bar dataKey="burden" fill="oklch(0.68 0.24 25)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="funding" fill="oklch(0.78 0.18 200)" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <LineChart data={fundingByYear}>
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
                    type="monotone"
                    dataKey="bacterial"
                    name="Bacterial"
                    stroke="oklch(0.68 0.24 25)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="fungal"
                    name="Fungal"
                    stroke="oklch(0.78 0.18 200)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard title="Largest funding gaps" subtitle="From pipeline Stage 6 alignment.">
          <div className="space-y-3">
            {underfunded.slice(0, 6).map((r) => (
              <div key={r.organism} className="rounded-xl border border-border/60 bg-card/45 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{r.organism}</div>
                    <div className="text-xs text-muted-foreground">{r.pathogenType}</div>
                  </div>
                  <div className="font-mono text-[color:var(--status-alert)]">
                    {r.gap.toFixed(3)}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {r.alignmentDirection.replace(/_/g, " ")}
                </p>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      <GlassCard
        title="Global AMR R&D Hub funding composition"
        subtitle={`Where the Hub's ${formatUsd(hubTotal)} in tracked funding goes, by recipient geography and R&D modality.`}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              By recipient geography
            </div>
            <div className="space-y-2.5">
              {hubGeography.map((r) => (
                <div key={r.bucket}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium capitalize">{r.bucket.replace(/_/g, " ")}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatUsd(r.amountUsd)} · {(r.shareOfHubTotal * 100).toFixed(1)}%
                    </span>
                  </div>
                  <TinyBar
                    value={r.shareOfHubTotal * 100}
                    color={r.bucket === "ssa" ? "var(--status-alert)" : "var(--accent)"}
                  />
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              By R&D modality
            </div>
            <div className="space-y-2.5">
              {hubModality.map((r) => (
                <div key={r.bucket}>
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="font-medium capitalize">{r.bucket.replace(/_/g, " ")}</span>
                    <span className="font-mono text-muted-foreground">
                      {formatUsd(r.amountUsd)} · {(r.shareOfHubTotal * 100).toFixed(1)}%
                    </span>
                  </div>
                  <TinyBar value={r.shareOfHubTotal * 100} color="var(--status-info)" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs italic text-muted-foreground">
          Global AMR R&D Hub, all diseases — not AMR-specific, not country-level. Hub excludes
          private/VC funding.
        </p>
      </GlassCard>
    </CommandPage>
  );
}
