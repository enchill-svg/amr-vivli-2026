import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Database,
  FileText,
  Filter,
  Radar,
  ShieldCheck,
  Layers,
  GitBranch,
} from "lucide-react";
import { PageShell } from "@/components/vt/PageShell";
import { useQuery } from "@tanstack/react-query";
import { loadDashboardBundle } from "@/lib/published-data";

export const Route = createFileRoute("/news")({
  component: NewsPage,
  head: () => ({
    meta: [
      { title: "Pipeline Activity — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "Real evidence-gate outcomes, data-quality ledger, and deliverable index from this submission's AMR analysis pipeline — no external news wire, no simulated alerts.",
      },
    ],
  }),
});

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v);
}
function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function humanize(s: string): string {
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

type PathogenFilter = "all" | "bacterial" | "fungal";

const PATHOGEN_TABS: { key: PathogenFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "bacterial", label: "Bacterial" },
  { key: "fungal", label: "Fungal" },
];

function matchesPathogen(pathogenType: string, filter: PathogenFilter): boolean {
  if (filter === "all") return true;
  return pathogenType === filter || pathogenType === "both";
}

function NewsPage() {
  const [pathogen, setPathogen] = useState<PathogenFilter>("all");

  const { data: bundle } = useQuery({
    queryKey: ["dashboard-bundle"],
    queryFn: loadDashboardBundle,
  });

  const gatingRows = useMemo(
    () =>
      (bundle?.gatingComparison ?? [])
        .map((r) => ({
          deliverable: str(r.deliverable),
          pathogenType: str(r.pathogen_type),
          nRows: num(r.n_rows),
          nPass: num(r.n_pass),
          nBoundsOnly: num(r.n_bounds_only),
          nWithhold: num(r.n_withhold),
        }))
        .filter((r) => matchesPathogen(r.pathogenType, pathogen)),
    [bundle, pathogen],
  );

  const ledgerRows = useMemo(
    () =>
      (bundle?.identifiabilityLedger ?? [])
        .map((r) => ({
          id: str(r.ledger_id),
          pathogenType: str(r.pathogen_type),
          gapCategory: str(r.gap_category),
          field: str(r.field_or_drug),
          description: str(r.description),
          sourceArtifact: str(r.source_artifact),
          nStrataOrRows: str(r.n_strata_or_rows),
          justiceReference: str(r.justice_reference),
        }))
        .filter((r) => matchesPathogen(r.pathogenType, pathogen)),
    [bundle, pathogen],
  );

  const deliverables = useMemo(
    () =>
      (bundle?.deliverablesIndex ?? []).map((r) => ({
        number: num(r.justice_output_number),
        text: str(r.justice_output_text),
        file: str(r.deliverable_file),
        stage: str(r.source_stage),
      })),
    [bundle],
  );

  const totalGatedAway = gatingRows.reduce((s, r) => s + r.nBoundsOnly + r.nWithhold, 0);
  const runId = bundle?.pipeline_run?.run_id ?? "—";
  const runStatus = bundle?.pipeline_run?.status ?? "—";
  const isolates = bundle?.pipelineSummary?.master_isolate_count;
  const masterRows = bundle?.pipelineSummary?.master_row_count;
  const generated = bundle?.generated_at;

  return (
    <PageShell>
      <div className="space-y-4">
        {/* Hero header */}
        <div className="rounded-2xl border border-border bg-gradient-to-br from-cyan-500/[0.06] to-emerald-500/[0.04] p-6 relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
          <div className="relative flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-[11px] uppercase tracking-widest text-cyan-300 mb-3">
                <Radar className="w-3 h-3" /> Pipeline Activity Log
              </div>
              <h1 className="text-3xl font-light tracking-tight">
                Evidence Gate &amp; Pipeline Activity
              </h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Every entry below is generated directly from this submission's own pipeline run and
                its evidence-gate ledger — no external news wire, no simulated alerts.
              </p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                {
                  i: GitBranch,
                  l: "Run status",
                  v: str(runStatus, "—").toUpperCase(),
                  c: "#34d399",
                },
                {
                  i: Database,
                  l: "Isolates analyzed",
                  v: isolates != null ? isolates.toLocaleString() : "—",
                  c: "#22d3ee",
                },
                {
                  i: Layers,
                  l: "Master rows",
                  v: masterRows != null ? masterRows.toLocaleString() : "—",
                  c: "#a78bfa",
                },
                {
                  i: ShieldCheck,
                  l: "Rows gated (by design)",
                  v: totalGatedAway.toLocaleString(),
                  c: "#fbbf24",
                },
              ].map(({ i: Icon, l, v, c }) => (
                <div
                  key={l}
                  className="rounded-lg border border-border bg-card/60 p-3 min-w-[110px]"
                >
                  <Icon className="w-3.5 h-3.5 mb-1.5" style={{ color: c }} />
                  <div className="text-xl font-semibold">{v}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {l}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative mt-4 text-[11px] text-muted-foreground">
            Run {runId}
            {generated ? ` · bundle generated ${generated.slice(0, 10)}` : ""}
          </div>
        </div>

        {/* Pathogen filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          {PATHOGEN_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setPathogen(t.key)}
              className={`px-3 py-1 rounded-full text-xs border whitespace-nowrap transition ${
                pathogen === t.key
                  ? "bg-cyan-500/15 border-cyan-400/50 text-cyan-300"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Command grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* LEFT — Evidence Gate Outcomes */}
          <section className="col-span-12 lg:col-span-3 rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-300" />
              <h2 className="text-sm font-medium">Evidence Gate Outcomes</h2>
            </div>
            <div className="divide-y divide-border/50 overflow-y-auto max-h-[720px]">
              {gatingRows.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">
                  No deliverables match this filter.
                </div>
              )}
              {gatingRows.map((r, idx) => {
                const passPct = r.nRows ? (r.nPass / r.nRows) * 100 : 0;
                const boundsPct = r.nRows ? (r.nBoundsOnly / r.nRows) * 100 : 0;
                const withholdPct = r.nRows ? (r.nWithhold / r.nRows) * 100 : 0;
                return (
                  <article key={`${r.deliverable}-${r.pathogenType}-${idx}`} className="p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="text-sm font-semibold">{humanize(r.deliverable)}</h3>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {r.pathogenType}
                      </span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary/40 mb-2">
                      <div style={{ width: `${passPct}%`, background: "#34d399" }} />
                      <div style={{ width: `${boundsPct}%`, background: "#fbbf24" }} />
                      <div style={{ width: `${withholdPct}%`, background: "#f87171" }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {r.nPass} pass · {r.nBoundsOnly} bounds-only · {r.nWithhold} withheld
                      <span className="text-foreground/60"> (of {r.nRows})</span>
                    </p>
                  </article>
                );
              })}
            </div>
          </section>

          {/* CENTER — Data-Quality Ledger */}
          <section className="col-span-12 lg:col-span-6 rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-300" />
                <h2 className="text-sm font-medium">Data-Quality Ledger</h2>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Documented gaps, not silent omissions
              </span>
            </div>
            <div className="divide-y divide-border/50 overflow-y-auto max-h-[720px]">
              {ledgerRows.length === 0 && (
                <div className="p-4 text-xs text-muted-foreground">
                  No ledger entries match this filter.
                </div>
              )}
              {ledgerRows.map((r) => (
                <article key={r.id} className="p-4">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300">
                      {humanize(r.gapCategory)}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {r.pathogenType}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold mb-1">{r.field}</h3>
                  <p className="text-xs text-foreground/75 leading-relaxed mb-2">{r.description}</p>
                  <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span className="font-mono">{r.sourceArtifact}</span>
                    {r.nStrataOrRows && <span>{r.nStrataOrRows}</span>}
                    {r.justiceReference && <span className="italic">{r.justiceReference}</span>}
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* RIGHT — Deliverables Index */}
          <section className="col-span-12 lg:col-span-3 rounded-2xl border border-border bg-card/60 backdrop-blur-sm overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-border flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-300" />
              <h2 className="text-sm font-medium">Deliverables Index</h2>
            </div>
            <div className="p-3 space-y-2 overflow-y-auto max-h-[720px]">
              {deliverables.map((d) => (
                <div
                  key={d.number}
                  className="rounded-lg border border-border/60 bg-background/30 p-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                      #{d.number}
                    </span>
                    <Activity className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <p className="text-xs text-foreground/85 leading-snug mb-1">{d.text}</p>
                  <div
                    className="text-[10px] text-muted-foreground font-mono truncate"
                    title={d.file}
                  >
                    {d.file}
                  </div>
                  <div className="text-[10px] text-muted-foreground/80 mt-0.5">{d.stage}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageShell>
  );
}
