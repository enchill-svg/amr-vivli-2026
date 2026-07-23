import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { getPathogenSignals, isUsingPublishedData } from "@/lib/amr-data.functions";
import { TinyBar } from "@/components/amr/AMRDataCards";

export const Route = createFileRoute("/pathogens")({
  component: ResistancePage,
  head: () => ({ meta: [{ title: "Resistance Explorer — AMR LifeIntel" }] }),
});

function ResistancePage() {
  const { data = [] } = useQuery({
    queryKey: ["pathogen-signals"],
    queryFn: () => getPathogenSignals("all"),
    refetchInterval: 60_000,
  });
  const rows = [...data].sort((a, b) => b.resistanceRate - a.resistanceRate);
  const chart = rows.map((r) => ({
    name: `${r.organism.split(" ")[0]}·${r.drug.split(" ")[0]}`,
    resistance: Math.round(r.resistanceRate * 100),
    fitness: r.evolutionaryFitness,
    failure: Math.round((1 - r.distanceToFailure) * 100),
    confidence: Math.round(r.confidence * 100),
  }));

  return (
    <CommandPage
      icon={FlaskConical}
      eyebrow="Resistance Explorer"
      title="Organism–drug resistance intelligence"
      subtitle="Ranks AMR signals by current resistance burden, MIC drift, evolutionary fitness, and distance-to-failure."
      kpis={[
        { label: "Signals", value: String(rows.length), color: "var(--accent)" },
        {
          label: "Highest resistance",
          value: rows[0] ? `${Math.round(rows[0].resistanceRate * 100)}%` : "—",
          color: "var(--status-alert)",
          sub: rows[0]?.organism,
        },
        {
          label: "Top EFS",
          value: rows[0]
            ? String(Math.round(Math.max(...rows.map((r) => r.evolutionaryFitness))))
            : "—",
          color: "var(--status-warn)",
        },
        {
          label: "Pathogen arms",
          value: "2",
          color: "var(--status-info)",
          sub: "Bacteria + fungi",
        },
      ]}
    >
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard
          title="Resistance prevalence by organism–drug"
          subtitle={
            isUsingPublishedData()
              ? "Current classified resistance rate from the published pipeline bundle."
              : "Published pipeline bundle unavailable — no demo fallback for this view."
          }
        >
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                <YAxis stroke="#94a3b8" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.22 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                />
                <Bar dataKey="resistance" fill="oklch(0.68 0.24 25)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
        <GlassCard
          title="Evolutionary failure space"
          subtitle="X = resistance burden; Y = evolutionary fitness; bubble = confidence."
        >
          <div className="h-80">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
                <XAxis
                  type="number"
                  dataKey="resistance"
                  name="Resistance"
                  unit="%"
                  domain={[0, 100]}
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <YAxis
                  type="number"
                  dataKey="fitness"
                  name="EFS"
                  domain={["auto", "auto"]}
                  stroke="#94a3b8"
                  fontSize={10}
                />
                <ZAxis dataKey="confidence" range={[60, 300]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={{
                    background: "oklch(0.22 0.04 250)",
                    border: "1px solid oklch(0.3 0.05 250)",
                    fontSize: 11,
                  }}
                />
                <Scatter data={chart} fill="oklch(0.78 0.18 200)" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>
      <GlassCard
        title="Explainable signal table"
        subtitle="Every signal carries a recommendation and confidence score."
      >
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((r) => {
            const withheld = r.qualityGate === "withhold";
            const gated = withheld || r.qualityGate === "bounds_only";
            const gateColor = withheld ? "var(--status-alert)" : "var(--status-warn)";
            const gateLabel = withheld ? "Withheld" : "Bounds only";
            return (
              <div key={r.id} className="rounded-xl border border-border/60 bg-card/45 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-medium">{r.organism}</div>
                      {gated && (
                        <span
                          className="rounded-full border px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide"
                          style={{ borderColor: `${gateColor}80`, color: gateColor }}
                        >
                          {gateLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.country} · {r.drug} · {r.pathogenType}
                    </div>
                  </div>
                  <div className="text-right font-mono text-sm text-[color:var(--status-alert)]">
                    {Math.round(r.resistanceRate * 100)}%
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3 text-[10px] text-muted-foreground">
                  <div>
                    EFS <b className="text-foreground">{r.evolutionaryFitness.toFixed(1)}</b>
                  </div>
                  <div>
                    MIC shift <b className="text-foreground">{r.micShift.toFixed(1)}</b>
                  </div>
                  <div>
                    Confidence <b className="text-foreground">{Math.round(r.confidence * 100)}%</b>
                  </div>
                </div>
                <div className="mt-2">
                  <TinyBar value={r.evolutionaryFitness} color="var(--status-warn)" />
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  {r.recommendation}
                </p>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </CommandPage>
  );
}
