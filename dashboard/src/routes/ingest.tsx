import { createFileRoute } from "@tanstack/react-router";
import { Upload, Database, FileSpreadsheet, Microscope, ShieldCheck } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/ingest")({
  component: IngestPage,
  head: () => ({ meta: [{ title: "Data Ingestion — AMR LifeIntel" }] }),
});

function IngestPage() {
  return (
    <CommandPage
      icon={Upload}
      eyebrow="Data Engineering Pipeline"
      title="Upload, profile, harmonize, validate and refresh dashboards"
      subtitle="Production-ready ETL/ELT workflow for CSV, Excel, multi-sheet workbooks and future surveillance sources."
      kpis={[
        { label: "Accepted", value: "CSV/XLSX", color: "var(--accent)" },
        { label: "Schema detection", value: "Auto", color: "var(--status-info)" },
        { label: "Validation", value: "Logs", color: "var(--status-warn)" },
        { label: "Refresh", value: "Auto", color: "var(--status-ok)" },
      ]}
    >
      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard
          className="xl:col-span-2"
          title="Drop datasets here"
          subtitle="The production backend links this surface to the upload API, Celery workers and validation log tables."
        >
          <div className="rounded-2xl border border-dashed border-[color:var(--accent)]/50 bg-[color:var(--accent)]/10 p-12 text-center">
            <Upload className="mx-auto h-10 w-10 text-[color:var(--accent)]" />
            <h3 className="mt-4 text-lg font-medium">Upload AMR surveillance files</h3>
            <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
              CSV, Excel, multiple sheets, country indicators, R&D funding, drug crosswalks,
              organism crosswalks and breakpoint tables. Every upload creates a versioned processing
              run.
            </p>
            <button className="mt-5 rounded-full bg-[color:var(--accent)] px-5 py-2 text-sm font-medium text-[color:var(--accent-foreground)]">
              Select files
            </button>
          </div>
        </GlassCard>
        <GlassCard title="Automatic detection" subtitle="Fields detected during profiling.">
          <PipelineItem
            icon={Database}
            title="Country/date fields"
            text="Country names, ISO3, collection date, year, surveillance program."
          />
          <PipelineItem
            icon={Microscope}
            title="MIC and resistance"
            text="MIC notation, comparator, log₂ value, S/I/R category, breakpoint basis."
          />
          <PipelineItem
            icon={FileSpreadsheet}
            title="Crosswalks"
            text="Drug codes, organisms, country strings, age bands and mapping versions."
          />
          <PipelineItem
            icon={ShieldCheck}
            title="Validation"
            text="Invalid MICs, impossible years, duplicates, unknown drugs and sparse denominators."
          />
        </GlassCard>
      </div>
      <GlassCard
        title="Pipeline stages"
        subtitle="Designed to run as background jobs and refresh analytical views when complete."
      >
        <div className="grid gap-3 md:grid-cols-6">
          {["Ingest", "Profile", "Harmonize", "Validate", "Model", "Publish"].map((step, i) => (
            <div
              key={step}
              className="rounded-xl border border-border/60 bg-background/30 p-4 text-center"
            >
              <div className="mx-auto grid h-8 w-8 place-items-center rounded-full bg-[color:var(--accent)]/15 font-mono text-[color:var(--accent)]">
                {i + 1}
              </div>
              <div className="mt-3 text-sm font-medium">{step}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </CommandPage>
  );
}

function PipelineItem({
  icon: Icon,
  title,
  text,
}: {
  icon: typeof Database;
  title: string;
  text: string;
}) {
  return (
    <div className="mb-3 rounded-xl border border-border/60 bg-background/30 p-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="h-4 w-4 text-[color:var(--accent)]" />
        {title}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
