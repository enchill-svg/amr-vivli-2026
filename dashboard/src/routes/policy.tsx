import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { GitCompare } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { getInterventionTable } from "@/lib/amr-data.functions";

export const Route = createFileRoute("/policy")({
  component: InterventionPage,
  head: () => ({ meta: [{ title: "Intervention Policy — AMR LifeIntel" }] }),
});

function InterventionPage() {
  const { data: rows = [] } = useQuery({
    queryKey: ["interventions"],
    queryFn: getInterventionTable,
  });
  const ranked = rows.filter((r) => r.priorityRank != null);
  const withheld = rows.filter((r) => r.qualityGate === "withhold");

  return (
    <CommandPage
      icon={GitCompare}
      eyebrow="Intervention Policy"
      title="Ranked interventions with integrity gating"
      subtitle="Published from intervention_recommendations_ranked_gated_v1.csv. Data-gap and confounded estimates are shown but not ranked."
      kpis={[
        { label: "Categories", value: String(rows.length), color: "var(--accent)" },
        { label: "Gated ranks", value: String(ranked.length), color: "var(--status-ok)" },
        { label: "Withheld", value: String(withheld.length), color: "var(--status-warn)" },
        {
          label: "Policy",
          value: "Integrity",
          color: "var(--status-info)",
          sub: "no fabricated LE",
        },
      ]}
    >
      <GlassCard
        title="Intervention deliverable"
        subtitle="Stage 7 categories per Justice brief; LE gain only where defensible."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-2 pr-3">Pathogen</th>
                <th className="pb-2 pr-3">Category</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Gate</th>
                <th className="pb-2 pr-3">Rank</th>
                <th className="pb-2">LE gain (1pp)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={`${r.pathogenType}-${r.interventionCategory}-${r.subMeasure}`}
                  className="border-t border-border/50"
                >
                  <td className="py-2 pr-3">{r.pathogenType}</td>
                  <td className="py-2 pr-3">
                    {r.interventionCategory}
                    {r.subMeasure ? ` · ${r.subMeasure}` : ""}
                  </td>
                  <td className="py-2 pr-3">{r.dataStatus}</td>
                  <td className="py-2 pr-3">{r.qualityGate}</td>
                  <td className="py-2 pr-3 font-mono">{r.priorityRank ?? "—"}</td>
                  <td className="py-2 font-mono">
                    {r.estimatedLeGainYears == null ? "—" : r.estimatedLeGainYears.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {withheld.map((r) => (
          <p
            key={`${r.interventionCategory}-caveat`}
            className="mt-3 text-xs text-muted-foreground"
          >
            {r.evidenceCaveat}
          </p>
        ))}
      </GlassCard>
    </CommandPage>
  );
}
