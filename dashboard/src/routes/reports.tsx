import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileText, Download, Loader2, Presentation, Table2, BriefcaseBusiness } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { loadDashboardBundle, type DashboardBundle } from "@/lib/published-data";
import {
  buildSections,
  countRecords,
  downloadBlob,
  exportSectionsToCsv,
  exportSectionsToDocx,
  exportSectionsToPdf,
  exportSectionsToXlsx,
  slugify,
} from "@/lib/report-export";
import { toast } from "sonner";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Research Reports — AMR LifeIntel" }] }),
});

function pickReportData(title: string, bundle: DashboardBundle): Record<string, unknown> {
  switch (title) {
    case "Executive policy brief":
      return {
        countryRiskBacterial: bundle.countryRiskBacterial,
        countryRiskFungal: bundle.countryRiskFungal,
        interventions: bundle.interventions,
        fundingGap: bundle.fundingGap,
      };
    case "Scientific report":
      return {
        gatingComparison: bundle.gatingComparison,
        identifiabilityLedger: bundle.identifiabilityLedger,
        q2DriverSummary: bundle.q2DriverSummary,
        associationSensitivity: bundle.associationSensitivity,
        deliverablesIndex: bundle.deliverablesIndex,
      };
    case "Challenge demo deck":
      return {
        bundle_version: bundle.bundle_version,
        generated_at: bundle.generated_at,
        pipelineSummary: bundle.pipelineSummary,
        deliverablesIndex: bundle.deliverablesIndex,
      };
    default:
      return {
        countryRiskBacterial: bundle.countryRiskBacterial,
        countryRiskFungal: bundle.countryRiskFungal,
        clusterTypologyBacterial: bundle.clusterTypologyBacterial,
        clusterTypologyFungal: bundle.clusterTypologyFungal,
        interventions: bundle.interventions,
        fundingGap: bundle.fundingGap,
      };
  }
}

const REPORT_FORMATS = ["PDF", "Word", "DOCX", "CSV", "Excel", "JSON", "PowerPoint"] as const;
type ReportFormat = (typeof REPORT_FORMATS)[number];

function formatTokens(format: string): ReportFormat[] {
  return format
    .split("/")
    .map((s) => s.trim())
    .filter((s): s is ReportFormat => (REPORT_FORMATS as readonly string[]).includes(s));
}

async function runExport(format: ReportFormat, title: string) {
  const bundle = await loadDashboardBundle();
  if (!bundle) {
    toast.error("Published dataset unavailable — cannot prepare export.");
    return;
  }
  const data = pickReportData(title, bundle);
  const sections = buildSections(data);
  const recordCount = countRecords(sections);
  const suffix =
    recordCount > 0 ? ` (${recordCount} records across ${sections.length} sections)` : "";

  switch (format) {
    case "PDF":
      await exportSectionsToPdf(title, sections);
      toast.success(`Exported "${title}" as PDF${suffix}.`);
      break;
    case "Word":
    case "DOCX":
      await exportSectionsToDocx(title, sections);
      toast.success(`Exported "${title}" as Word (.docx)${suffix}.`);
      break;
    case "CSV":
      exportSectionsToCsv(title, sections);
      toast.success(`Exported "${title}" as CSV${suffix}.`);
      break;
    case "Excel":
      await exportSectionsToXlsx(title, sections);
      toast.success(`Exported "${title}" as Excel (.xlsx)${suffix}.`);
      break;
    case "JSON":
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        `${slugify(title)}.json`,
      );
      toast.success(`Exported "${title}" as JSON${suffix}.`);
      break;
    case "PowerPoint":
      downloadBlob(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
        `${slugify(title)}.json`,
      );
      toast.info(
        `PowerPoint rendering isn't built yet — exported the underlying data as JSON instead.`,
      );
      break;
  }
}

function ReportsPage() {
  const reports = [
    {
      icon: BriefcaseBusiness,
      title: "Executive policy brief",
      format: "PDF / Word",
      desc: "Country risk, intervention priorities, funding gap and assumptions.",
    },
    {
      icon: FileText,
      title: "Scientific report",
      format: "PDF / DOCX",
      desc: "Methods, validation logs, model comparison, sensitivity analysis and figures.",
    },
    {
      icon: Presentation,
      title: "Challenge demo deck",
      format: "PowerPoint",
      desc: "Boardroom-ready visuals for WHO, funders and institutional review.",
    },
    {
      icon: Table2,
      title: "Analytical exports",
      format: "CSV / Excel / JSON",
      desc: "Country-year data, pathogen-drug tables, recommendations and metadata.",
    },
  ];
  return (
    <CommandPage
      icon={FileText}
      eyebrow="Research Reports"
      title="Generate publication-grade outputs"
      subtitle="One-click executive summaries, country reports, scientific appendices, policy briefs, R&D funding reports, figures and tables."
      kpis={[
        {
          label: "Formats",
          value: "6",
          color: "var(--accent)",
          sub: "PDF · Word · PPTX · CSV · XLSX · JSON",
        },
        { label: "Templates", value: "4", color: "var(--status-info)" },
        {
          label: "Reproducible",
          value: "Yes",
          color: "var(--status-ok)",
          sub: "Versioned methods",
        },
        { label: "Audience", value: "WHO", color: "var(--status-warn)", sub: "Policy-ready" },
      ]}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {reports.map((r) => (
          <ReportCard key={r.title} {...r} />
        ))}
      </div>
      <GlassCard
        title="Report generation workflow"
        subtitle="Designed for automatic refresh after every dataset upload."
      >
        <div className="grid gap-3 md:grid-cols-5">
          {[
            "Select scope",
            "Run validation",
            "Render figures",
            "Write recommendations",
            "Export bundle",
          ].map((step, i) => (
            <div key={step} className="rounded-xl border border-border/60 bg-background/30 p-4">
              <div className="font-mono text-lg text-[color:var(--accent)]">0{i + 1}</div>
              <div className="mt-2 text-sm font-medium">{step}</div>
            </div>
          ))}
        </div>
      </GlassCard>
    </CommandPage>
  );
}

function ReportCard({
  icon: Icon,
  title,
  format,
  desc,
}: {
  icon: typeof FileText;
  title: string;
  format: string;
  desc: string;
}) {
  const [pending, setPending] = useState<ReportFormat | null>(null);
  const tokens = formatTokens(format);

  const handleClick = async (token: ReportFormat) => {
    if (pending) return;
    setPending(token);
    try {
      await runExport(token, title);
    } catch (err) {
      toast.error(`Export failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="rounded-2xl vt-glass p-5 hover:vt-neon-border transition">
      <Icon className="h-6 w-6 text-[color:var(--accent)]" />
      <h3 className="mt-4 text-base font-medium">{title}</h3>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-[color:var(--status-info)]">
        {format}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {tokens.map((token) => (
          <button
            key={token}
            disabled={pending !== null}
            onClick={() => {
              void handleClick(token);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs hover:border-[color:var(--accent)]/60 disabled:opacity-50 disabled:hover:border-border"
          >
            {pending === token ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            {token}
          </button>
        ))}
      </div>
    </div>
  );
}
