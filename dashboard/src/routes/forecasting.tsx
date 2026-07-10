import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Brain } from "lucide-react";
import { CartesianGrid, Scatter, ScatterChart, ResponsiveContainer, Tooltip, XAxis, YAxis, ZAxis } from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { getLiveCountryTrends, getClusterTypology } from "@/lib/amr-data.functions";

export const Route = createFileRoute("/forecasting")({ component: MLInsightsPage, head: () => ({ meta: [{ title: "Machine Learning Insights — AMR LifeIntel" }] }) });

function MLInsightsPage() {
  const { data = [] } = useQuery({ queryKey: ["ml-countries"], queryFn: () => getLiveCountryTrends("all") });
  const { data: clusterRows = [] } = useQuery({ queryKey: ["cluster-typology"], queryFn: getClusterTypology });
  const scatter = data.map((r) => ({ country: r.country, x: r.resistanceRate * 100, y: r.earlyWarningScore, z: r.riskScore, cluster: r.trendLabel }));
  return (
    <CommandPage icon={Brain} eyebrow="Machine Learning Insights" title="Explainable AMR risk modeling" subtitle="Clustering, country risk scoring, future resistance prediction, funding mismatch prediction, and intervention-impact estimation." kpis={[
      { label: "Model families", value: "6", color: "var(--accent)", sub: "GLM · XGB · clusters" },
      { label: "Clusters", value: String(clusterRows.length), color: "var(--status-info)" },
      { label: "Explainability", value: "SHAP", color: "var(--status-warn)" },
      { label: "Validation", value: "Boot", color: "var(--status-ok)", sub: "Bootstrap-ready" },
    ]}>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard title="Country risk embedding" subtitle="X = resistance burden, Y = early warning, bubble = total risk.">
          <div className="h-96"><ResponsiveContainer><ScatterChart><CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" /><XAxis dataKey="x" name="Resistance" unit="%" stroke="#94a3b8" fontSize={10} /><YAxis dataKey="y" name="Early warning" stroke="#94a3b8" fontSize={10} /><ZAxis dataKey="z" range={[70, 400]} /><Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.05 250)", fontSize: 11 }} /><Scatter data={scatter} fill="oklch(0.78 0.18 200)" /></ScatterChart></ResponsiveContainer></div>
        </GlassCard>
        <GlassCard title="Cluster typology" subtitle="Policy-ready unsupervised grouping.">
          <div className="space-y-3">
            {clusterRows.map((r) => (
              <div key={r.cluster} className="rounded-xl border border-border/60 bg-card/45 p-4"><div className="flex items-center justify-between"><div><div className="text-sm font-medium">Cluster {r.cluster}: {r.label}</div><div className="text-xs text-muted-foreground">{r.countries} countries · {r.action}</div></div><div className="font-mono text-lg text-[color:var(--accent)]">{r.risk}</div></div><div className="mt-2 h-2 rounded-full bg-secondary"><div className="h-full rounded-full bg-[color:var(--accent)]" style={{ width: `${r.risk}%` }} /></div></div>
            ))}
          </div>
        </GlassCard>
      </div>
      <GlassCard title="Explainability layer" subtitle="How the production model explains country risk.">
        <div className="grid gap-3 md:grid-cols-5">
          {["Resistance prevalence", "MIC drift", "Life expectancy deficit", "Funding mismatch", "Data quality"].map((x, i) => <div key={x} className="rounded-xl border border-border/60 bg-background/30 p-4"><div className="text-xs text-muted-foreground">Feature {i + 1}</div><div className="mt-2 text-sm font-medium">{x}</div><div className="mt-3 h-2 rounded bg-secondary"><div className="h-full rounded bg-[color:var(--accent)]" style={{ width: `${90 - i * 12}%` }} /></div></div>)}
        </div>
      </GlassCard>
    </CommandPage>
  );
}
