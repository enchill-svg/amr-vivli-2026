import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { CartesianGrid, Scatter, ScatterChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { getLiveCountryTrends, getClusterTypology } from "@/lib/amr-data.functions";

export const Route = createFileRoute("/forecasting")({
  component: MLInsightsPage,
  head: () => ({ meta: [{ title: "Analytics — AMR LifeIntel" }] }),
});

function MLInsightsPage() {
  const { data = [] } = useQuery({ queryKey: ["ml-countries"], queryFn: () => getLiveCountryTrends("all") });
  const { data: clusterRows = [] } = useQuery({ queryKey: ["cluster-typology"], queryFn: getClusterTypology });
  const scatter = data.map((r) => ({
    country: r.country,
    x: r.resistanceRate * 100,
    y: r.earlyWarningScore,
    z: r.riskScore,
    cluster: r.trendLabel,
  }));
  return (
    <CommandPage
      icon={Brain}
      eyebrow="Analytics"
      title="Clustering and country risk embedding"
      subtitle="Ward hierarchical clustering and composite risk scores from published pipeline outputs (not black-box ML)."
      kpis={[
        { label: "Methods", value: "OLS + Ward", color: "var(--accent)", sub: "Published pipeline" },
        { label: "Clusters", value: String(clusterRows.length), color: "var(--status-info)" },
        { label: "Countries", value: String(new Set(data.map((d) => d.iso3)).size), color: "var(--status-warn)" },
        { label: "Evidence", value: "Gated", color: "var(--status-ok)", sub: "Integrity layer" },
      ]}
    >
      <GlassCard title="Legacy route" subtitle="Primary navigation uses Overview, Evolution, and Methods.">
        <p className="text-sm text-muted-foreground">
          This page remains reachable for deep links. See{" "}
          <Link to="/lineages" className="text-[color:var(--accent)] hover:underline">
            Evolution
          </Link>{" "}
          and{" "}
          <Link to="/methodology" className="text-[color:var(--accent)] hover:underline">
            Methodology
          </Link>{" "}
          for the main experience.
        </p>
      </GlassCard>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard title="Country risk embedding" subtitle="X = burden proxy, Y = trajectory percentile, bubble = composite risk.">
          <div className="h-96">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
                <XAxis dataKey="x" name="Burden" unit="%" stroke="#94a3b8" fontSize={10} />
                <YAxis dataKey="y" name="Trajectory" stroke="#94a3b8" fontSize={10} />
                <ZAxis dataKey="z" range={[70, 400]} />
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
        <GlassCard title="Cluster typology" subtitle="From gated cluster_typology_* deliverables.">
          <div className="space-y-3">
            {clusterRows.map((r) => (
              <div key={r.cluster} className="rounded-xl border border-border/60 bg-card/45 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      Cluster {r.cluster}: {r.label}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.countries} countries · {r.action}
                    </div>
                  </div>
                  <div className="font-mono text-lg text-[color:var(--accent)]">{r.risk}</div>
                </div>
                <div className="mt-2 h-2 rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${r.risk}%` }} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </CommandPage>
  );
}
