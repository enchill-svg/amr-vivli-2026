import { createFileRoute } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/api-docs")({
  component: ApiDocsPage,
  head: () => ({
    meta: [
      { title: "Data Access — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "How to read the published dashboard bundle and underlying CSVs — there is no live REST API; this is a static-data submission.",
      },
    ],
  }),
});

const bundleFields = [
  { k: "pipeline_run", d: "{ run_id, status } for the pipeline run that produced this bundle." },
  {
    k: "countryRiskBacterial / countryRiskFungal",
    d: "Gated country-level composite risk scores, one row per country per pathogen type. Non-pass rows carry a null score.",
  },
  {
    k: "clusterTypologyBacterial / clusterTypologyFungal",
    d: "Country–organism–drug rows with cluster typology label and quality_gate.",
  },
  {
    k: "interventions",
    d: "Ranked intervention recommendations with estimated life-expectancy gain, where the sample size clears the pipeline's reliability threshold.",
  },
  {
    k: "fundingGap / hubFundingComposition / fundingByYear",
    d: "Organism-level and hub-level funding-vs-burden alignment tables.",
  },
  {
    k: "gatingComparison",
    d: "Per-deliverable counts of pass / bounds_only / withhold rows, ranked vs. gated.",
  },
  {
    k: "identifiabilityLedger",
    d: "Documented data-quality gaps and the Manski bounds computed in place of a point estimate.",
  },
  {
    k: "associationSensitivity",
    d: "Sensitivity-analysis manifest for the life-expectancy association model (sample sizes, covariates included per spec).",
  },
  { k: "deliverablesIndex", d: "Maps each output artifact to its source pipeline stage." },
];

function ApiDocsPage() {
  return (
    <CommandPage
      icon={Code2}
      eyebrow="Data Access"
      title="Reading this submission's data"
      subtitle="There is no live REST API behind this dashboard — it is a static analytical submission. Every chart on this site reads from one published JSON bundle, itself built from versioned CSVs in the repository."
    >
      <GlassCard
        title="The published bundle"
        subtitle="Fetched client-side by every page in this dashboard; safe to fetch directly."
      >
        <pre className="overflow-x-auto rounded-xl border border-border/60 bg-background/50 p-4 text-xs">
          <code>{`curl https://<this-deployment>/data/published/dashboard_bundle_v1.json`}</code>
        </pre>
        <div className="mt-3 space-y-2">
          {bundleFields.map((f) => (
            <div
              key={f.k}
              className="grid gap-2 rounded-xl border border-border/60 bg-background/30 p-3 text-sm md:grid-cols-[280px_1fr]"
            >
              <code className="text-xs text-[color:var(--accent)]">{f.k}</code>
              <span className="text-xs text-muted-foreground">{f.d}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard
        title="Underlying CSVs"
        subtitle="The bundle above is generated from these versioned tables — read them directly for full column detail and provenance."
      >
        <p className="text-xs text-muted-foreground leading-relaxed">
          Every table backing the bundle lives under{" "}
          <code className="text-[color:var(--accent)]">data/published/*.csv</code> in the project
          repository, each with a matching <code>_v1</code> schema version. Gated deliverables (
          <code>*_gated_v1.csv</code>) are the public-facing, evidence-gate-filtered versions; an
          audit trail of the ungated values is kept alongside them for reviewers, per the
          methodology described on the{" "}
          <a href="/methodology" className="text-[color:var(--accent)] hover:underline">
            Methodology
          </a>{" "}
          page.
        </p>
      </GlassCard>
    </CommandPage>
  );
}
