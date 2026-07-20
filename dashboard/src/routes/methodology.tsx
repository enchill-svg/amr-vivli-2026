import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Database } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { loadDashboardBundle } from "@/lib/published-data";

export const Route = createFileRoute("/methodology")({
  component: MethodologyPage,
  head: () => ({ meta: [{ title: "Methodology — AMR LifeIntel" }] }),
});

function MethodologyPage() {
  const { data: bundle } = useQuery({
    queryKey: ["dashboard-bundle"],
    queryFn: loadDashboardBundle,
  });

  const stages = [
    [
      "01",
      "Harmonize",
      "SOAR bacterial + SENTRY fungal cohorts → master table with versioned crosswalks (Steps 1–10).",
    ],
    [
      "02",
      "Burden & trajectory",
      "Manski bounds, evolutionary fitness scores, and Ward clustering per pathogen type.",
    ],
    [
      "03",
      "External join",
      "Life expectancy, ESAC-Net consumption (Europe), GBD SDI, hospital beds joined by ISO3–year.",
    ],
    [
      "04",
      "Association",
      "Pooled country-year OLS (suggestive only; small-sample flags where applicable).",
    ],
    [
      "05",
      "Integrity gate",
      "quality_gate applied to public deliverables — ranks/scores nulled when evidence fails.",
    ],
    ["06", "Publish", "Gated CSVs + dashboard_bundle_v1.json for the web app."],
  ];

  return (
    <CommandPage
      icon={Database}
      eyebrow="Methodology"
      title="Transparent AMR intelligence workflow"
      subtitle="Pipeline outputs, integrity gating, and published data provenance."
    >
      <GlassCard
        title="End-to-end pipeline"
        subtitle={`Run ${bundle?.pipeline_run?.run_id ?? "—"} · ${bundle?.generated_at ?? "bundle not loaded"}`}
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {stages.map(([n, title, text]) => (
            <div key={n} className="rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="font-mono text-lg text-[color:var(--accent)]">{n}</div>
              <div className="mt-2 text-sm font-medium">{title}</div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard
        title="Design choices (documented)"
        subtitle="Intentional scope boundaries aligned with the project brief's Section 7."
      >
        <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
          <li>
            Gating is <strong className="text-foreground">output-only</strong> — regression inputs
            are not filtered pre-model; public ranks/scores are withheld post-hoc.
          </li>
          <li>
            Country risk uses burden + trajectory + health expenditure (and ESAC consumption where
            matched); vaccination omitted from ranking per Output 4 wording.
          </li>
          <li>GBD LRI is joined for audit but not used in any regression or ranking model.</li>
          <li>
            Funding-gap organism ranks are computed separately within bacterial and fungal pathogen
            types.
          </li>
          <li>
            Bacterial LE association primary model: see sensitivity manifest below (country-year
            panel; not causal).
          </li>
        </ul>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard title="Gating summary" subtitle="From gating_comparison_v1.csv">
          <DataTable
            rows={(bundle?.gatingComparison ?? []).map((r) => ({
              a: String(r.deliverable ?? ""),
              b: String(r.n_pass ?? ""),
              c: String(r.n_withhold ?? ""),
              d: String(r.n_bounds_only ?? ""),
            }))}
            headers={["Deliverable", "Pass", "Withhold", "Bounds only"]}
          />
        </GlassCard>
        <GlassCard
          title="Association sensitivity"
          subtitle="From association_sensitivity_manifest_v1.csv"
        >
          <DataTable
            rows={(bundle?.associationSensitivity ?? []).map((r) => ({
              a: String(r.model_id ?? ""),
              b: String(r.pathogen_type ?? ""),
              c: String(r.n_obs ?? ""),
              d: String(r.n_countries ?? ""),
              e: String(r.sample_warning ?? "—"),
            }))}
            headers={["Model", "Type", "Obs", "Countries", "Warning"]}
          />
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard title="Q2 driver evidence" subtitle="From q2_driver_evidence_summary_v1.csv">
          <DataTable
            rows={(bundle?.q2DriverSummary ?? []).slice(0, 8).map((r) => ({
              a: String(r.driver ?? ""),
              b: String(r.pathogen_type ?? ""),
              c: String(r.evidence_status ?? ""),
            }))}
            headers={["Driver", "Pathogen", "Status"]}
          />
        </GlassCard>
        <GlassCard
          title="Identifiability ledger (sample)"
          subtitle="From identifiability_ledger_v1.csv"
        >
          <DataTable
            rows={(bundle?.identifiabilityLedger ?? []).slice(0, 8).map((r) => ({
              a: String(r.ledger_id ?? ""),
              b: String(r.gap_category ?? ""),
              c: String(r.field_or_drug ?? ""),
            }))}
            headers={["ID", "Category", "Field"]}
          />
        </GlassCard>
      </div>
    </CommandPage>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: Record<string, string>[] }) {
  const keys = ["a", "b", "c", "d", "e"].slice(0, headers.length);
  if (!rows.length) {
    return <p className="text-xs text-muted-foreground">No published rows loaded.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-border/60 text-muted-foreground">
            {headers.map((h) => (
              <th key={h} className="pb-2 pr-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/30">
              {keys.map((k) => (
                <td key={k} className="py-2 pr-3 text-muted-foreground">
                  {row[k] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
