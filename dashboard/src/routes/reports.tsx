import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download, Presentation, Table2, BriefcaseBusiness } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/reports")({
  component: ReportsPage,
  head: () => ({ meta: [{ title: "Research Reports — AMR LifeIntel" }] }),
});

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
  return (
    <div className="rounded-2xl vt-glass p-5 hover:vt-neon-border transition">
      <Icon className="h-6 w-6 text-[color:var(--accent)]" />
      <h3 className="mt-4 text-base font-medium">{title}</h3>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-[color:var(--status-info)]">
        {format}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{desc}</p>
      <button className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1.5 text-xs hover:border-[color:var(--accent)]/60">
        <Download className="h-3.5 w-3.5" /> Prepare export
      </button>
    </div>
  );
}
