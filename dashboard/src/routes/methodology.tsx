import { createFileRoute } from "@tanstack/react-router";
import { Database } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/methodology")({ component: MethodologyPage, head: () => ({ meta: [{ title: "Methodology — AMR LifeIntel" }] }) });

function MethodologyPage() {
  const stages = [
    ["01", "Ingestion", "CSV, Excel and multi-sheet workbooks are read into a raw landing zone with immutable file metadata and profiling summaries."],
    ["02", "Schema detection", "Country, date, MIC, drug, organism, resistance category, age, lab and surveillance fields are detected automatically."],
    ["03", "Harmonization", "Country ISO3, drug code, organism, age-band, MIC notation and date mappings are versioned as crosswalk artifacts."],
    ["04", "Validation", "Invalid MICs, impossible years, unknown entities, missing identifiers and duplicate isolate fingerprints are logged."],
    ["05", "Analytics", "Resistance prevalence, MIC distribution, temporal trend, EFS, EDTF, country risk and funding mismatch are computed."],
    ["06", "Models", "Regression, clustering, sensitivity analysis, bootstrap intervals and feature importance are generated reproducibly."],
    ["07", "Recommendations", "The policy engine converts evidence into intervention priorities with confidence and assumptions."],
    ["08", "Reports", "Dashboards and downloadable PDF, Word, PowerPoint, CSV, Excel and JSON outputs are refreshed."],
  ];
  return (
    <CommandPage icon={Database} eyebrow="Methodology" title="Transparent and reproducible AMR intelligence workflow" subtitle="Every transformation, model and recommendation is versioned, auditable and explainable.">
      <GlassCard title="End-to-end scientific pipeline" subtitle="From uploaded surveillance data to policy decision support.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {stages.map(([n, title, text]) => <div key={n} className="rounded-xl border border-border/60 bg-background/30 p-4"><div className="font-mono text-lg text-[color:var(--accent)]">{n}</div><div className="mt-2 text-sm font-medium">{title}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p></div>)}
        </div>
      </GlassCard>
      <GlassCard title="Scientific safeguards" subtitle="Designed for publication-level reporting and policy interpretation.">
        <div className="grid gap-3 md:grid-cols-3">
          <Guard title="Identifiability" text="Detection-only genotype fields and breakpoint-absent fungal drugs are reported as ranges or MIC-only evidence rather than false point estimates." />
          <Guard title="Uncertainty" text="Country risk, intervention impact and association estimates expose confidence scores and bootstrap-ready intervals." />
          <Guard title="Reproducibility" text="All crosswalks, validation logs, model versions and report outputs are timestamped and traceable to input files." />
        </div>
      </GlassCard>
    </CommandPage>
  );
}

function Guard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 p-4"><div className="text-sm font-medium text-[color:var(--accent)]">{title}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p></div>;
}
