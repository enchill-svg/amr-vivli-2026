import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, Database, FileSpreadsheet, Microscope, ShieldCheck } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { AuthGate } from "@/components/vt/AuthGate";
import { toast } from "sonner";

export const Route = createFileRoute("/ingest")({
  component: IngestPage,
  head: () => ({ meta: [{ title: "Data Ingestion — AMR LifeIntel" }] }),
});

const FIELD_KEYWORDS: Record<string, string[]> = {
  "Country/date": ["country", "iso3", "date", "year", "program"],
  "MIC/resistance": ["mic", "comparator", "log2", "s/i/r", "sir", "breakpoint", "resistance"],
  Crosswalk: ["drug", "organism", "pathogen", "age", "crosswalk", "mapping"],
};

function classifyColumns(headers: string[]) {
  const counts: Record<string, number> = { "Country/date": 0, "MIC/resistance": 0, Crosswalk: 0 };
  for (const h of headers) {
    const lower = h.trim().toLowerCase();
    for (const [group, keywords] of Object.entries(FIELD_KEYWORDS)) {
      if (keywords.some((k) => lower.includes(k))) counts[group] += 1;
    }
  }
  return counts;
}

async function previewFile(file: File) {
  const isCsv = /\.csv$/i.test(file.name);
  if (!isCsv) {
    toast.info(
      `Selected "${file.name}" (${(file.size / 1024).toFixed(1)} KB) — in-browser preview only supports CSV right now; no processing pipeline is wired up yet.`,
    );
    return;
  }
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) {
    toast.error(`"${file.name}" appears to be empty.`);
    return;
  }
  const headers = lines[0].split(",");
  const rowCount = lines.length - 1;
  const detected = classifyColumns(headers);
  const detectedSummary = Object.entries(detected)
    .filter(([, n]) => n > 0)
    .map(([group, n]) => `${group} (${n})`)
    .join(", ");
  toast.success(
    `Parsed "${file.name}" locally — ${rowCount} rows × ${headers.length} columns.` +
      (detectedSummary ? ` Detected fields: ${detectedSummary}.` : "") +
      " This is a client-side preview only; no backend upload pipeline is wired up yet.",
  );
}

function IngestPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsParsing(true);
    try {
      for (const file of Array.from(files)) {
        await previewFile(file);
      }
    } finally {
      setIsParsing(false);
      e.target.value = "";
    }
  };

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
      <AuthGate message="Sign in to upload and profile AMR surveillance datasets.">
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
                organism crosswalks and breakpoint tables. Every upload creates a versioned
                processing run.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                multiple
                className="hidden"
                onChange={handleFilesSelected}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isParsing}
                className="mt-5 rounded-full bg-[color:var(--accent)] px-5 py-2 text-sm font-medium text-[color:var(--accent-foreground)] disabled:opacity-60"
              >
                {isParsing ? "Parsing…" : "Select files"}
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
      </AuthGate>
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
