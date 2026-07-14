import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dna, Search, ExternalLink, Download } from "lucide-react";
import { KpiStrip, InsightPanel } from "@/components/vt/KpiStrip";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";
import { useState } from "react";
import { PageShell, SectionCard } from "@/components/vt/PageShell";
import { AuthGate } from "@/components/vt/AuthGate";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ncbiSearch } from "@/lib/ncbi.functions";
import { importNcbiHit } from "@/lib/ncbi-import.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/genomics")({
  component: GenomicsPage,
  head: () => ({
    meta: [
      { title: "Genomics — ViralTrack-Afrika" },
      {
        name: "description",
        content: "Whole-genome viral sequencing across African sentinel sites.",
      },
    ],
  }),
});

function GenomicsPage() {
  return (
    <PageShell>
      <div className="space-y-5">
        <header className="flex items-center gap-3">
          <Dna className="w-6 h-6 text-[color:var(--accent)]" />
          <div>
            <h1 className="text-2xl font-light tracking-tight">Genomics</h1>
            <p className="text-xs text-muted-foreground">
              Genome quality · ORF coverage · mutation distribution · NCBI live
            </p>
          </div>
        </header>
        <AuthGate>
          <div className="space-y-5">
            <KpiStrip />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 space-y-5">
                <GenomeViewer />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <MutationDistribution />
                  <QualityDistribution />
                </div>
                <NcbiPanel />
                <SequencesTable />
              </div>
              <div className="space-y-5">
                <InsightPanel
                  items={[
                    {
                      title: "Spike mutations rising in West Africa",
                      tag: "Signal",
                      body: "Nigeria & Ghana show 3.2× enrichment for S:F456L in recent 14-day window across 412 sequences.",
                    },
                    {
                      title: "Mpox clade Ib genome quality improving",
                      tag: "QC",
                      body: "Median Phred score up from 28 to 34; reduced ambiguity bases (<1.2%) across sentinel labs.",
                    },
                    {
                      title: "Lineage cluster detected — DRC",
                      tag: "Cluster",
                      body: "Phylogenetic clustering of 18 sequences within 0.4 substitutions/site suggests sustained transmission chain.",
                    },
                  ]}
                />
                <GenomicsMeta />
              </div>
            </div>
          </div>
        </AuthGate>
      </div>
    </PageShell>
  );
}

const ORFS = [
  { name: "ORF1ab", start: 266, end: 21555, color: "#22d3ee" },
  { name: "S", start: 21563, end: 25384, color: "#a78bfa" },
  { name: "ORF3a", start: 25393, end: 26220, color: "#34d399" },
  { name: "E", start: 26245, end: 26472, color: "#facc15" },
  { name: "M", start: 26523, end: 27191, color: "#f97316" },
  { name: "ORF6", start: 27202, end: 27387, color: "#60a5fa" },
  { name: "ORF7a", start: 27394, end: 27759, color: "#fb7185" },
  { name: "ORF8", start: 27894, end: 28259, color: "#f43f5e" },
  { name: "N", start: 28274, end: 29533, color: "#38bdf8" },
];
const GENOME_LEN = 29903;
const MUTATIONS = [
  { pos: 23012, label: "S:E484K" },
  { pos: 23063, label: "S:N501Y" },
  { pos: 22995, label: "S:K417N" },
  { pos: 22577, label: "S:Q493E" },
  { pos: 14408, label: "ORF1ab:P323L" },
  { pos: 28881, label: "N:R203K" },
];

function GenomeViewer() {
  return (
    <SectionCard
      title="Genome coverage viewer"
      subtitle="SARS-CoV-2 reference (29,903 bp) — annotated ORFs with mutation positions"
    >
      <div className="space-y-3">
        <div className="relative h-24 rounded-lg bg-secondary/30 border border-border/40 overflow-hidden">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border" />
          {ORFS.map((o) => {
            const left = (o.start / GENOME_LEN) * 100;
            const width = ((o.end - o.start) / GENOME_LEN) * 100;
            return (
              <div
                key={o.name}
                className="absolute top-1/2 -translate-y-1/2 h-9 rounded grid place-items-center text-[10px] font-mono"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: `${o.color}55`,
                  borderTop: `2px solid ${o.color}`,
                  borderBottom: `2px solid ${o.color}`,
                  color: "white",
                }}
                title={`${o.name} · ${o.start.toLocaleString()}–${o.end.toLocaleString()}`}
              >
                {width > 4 ? o.name : ""}
              </div>
            );
          })}
          {MUTATIONS.map((m) => (
            <div
              key={m.label}
              className="absolute -top-1 h-[110%]"
              style={{ left: `${(m.pos / GENOME_LEN) * 100}%` }}
            >
              <div className="w-px h-full bg-[color:var(--status-alert)]" />
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-[color:var(--status-alert)]" />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MUTATIONS.map((m) => (
            <span
              key={m.label}
              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[color:var(--status-alert)]/15 text-[color:var(--status-alert)]"
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function MutationDistribution() {
  const data = ORFS.map((o) => ({
    gene: o.name,
    mutations: Math.round(Math.random() * 30 + (o.name === "S" ? 38 : 5)),
  }));
  return (
    <SectionCard title="Mutation distribution" subtitle="Calls per gene region">
      <div className="h-56">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="gene" stroke="rgba(255,255,255,0.4)" fontSize={10} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
            <Tooltip
              contentStyle={{
                background: "rgba(15,20,30,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar dataKey="mutations" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function QualityDistribution() {
  const buckets = ["<70", "70–80", "80–85", "85–90", "90–95", "95–100"];
  const data = buckets.map((b, i) => ({ b, n: Math.round(8 + i * i * 6 + Math.random() * 10) }));
  return (
    <SectionCard title="Quality distribution" subtitle="Phred-equivalent quality score">
      <div className="h-56">
        <ResponsiveContainer>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="q-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.6} />
                <stop offset="100%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="b" stroke="rgba(255,255,255,0.4)" fontSize={10} />
            <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
            <Tooltip
              contentStyle={{
                background: "rgba(15,20,30,0.95)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="n"
              stroke="#a78bfa"
              fill="url(#q-fill)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </SectionCard>
  );
}

function GenomicsMeta() {
  const stats = [
    { l: "Avg quality", v: "94.2%" },
    { l: "Avg length", v: "29,712 bp" },
    { l: "Coverage depth", v: "1,124×" },
    { l: "Completeness", v: "98.6%" },
    { l: "Median Ns", v: "0.9%" },
    { l: "Mutations / genome", v: "47.3" },
  ];
  return (
    <SectionCard title="Genome QC summary" subtitle="Continental rolling average">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.l} className="rounded-lg border border-border/40 bg-secondary/20 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="font-display text-base tabular-nums">{s.v}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function SequencesTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequences")
        .select("id, pathogen, lineage, accession, length_bp, quality_score, sequenced_at")
        .order("sequenced_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  return (
    <SectionCard
      title="Recent sequences"
      subtitle="Quality-controlled consensus genomes from sentinel samples."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading sequences…</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No sequences yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 font-medium">Accession</th>
                <th className="text-left font-medium">Pathogen</th>
                <th className="text-left font-medium">Lineage</th>
                <th className="text-right font-medium">Length (bp)</th>
                <th className="text-right font-medium">Quality</th>
                <th className="text-right font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-secondary/30">
                  <td className="py-2.5 font-mono text-xs">{s.accession}</td>
                  <td>{s.pathogen}</td>
                  <td className="text-[color:var(--accent)]">{s.lineage}</td>
                  <td className="text-right tabular-nums">{s.length_bp?.toLocaleString()}</td>
                  <td className="text-right tabular-nums">
                    {((s.quality_score ?? 0) * 100).toFixed(1)}%
                  </td>
                  <td className="text-right text-muted-foreground text-xs">
                    {new Date(s.sequenced_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}

function NcbiPanel() {
  const [query, setQuery] = useState("SARS-CoV-2 Africa complete genome");
  const [pathogen, setPathogen] = useState("SARS-CoV-2");
  const search = useServerFn(ncbiSearch);
  const importFn = useServerFn(importNcbiHit);
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: (q: string) => search({ data: { query: q, db: "nuccore", retmax: 15 } }),
  });
  const importMut = useMutation({
    mutationFn: (r: {
      uid: string;
      accession: string;
      organism: string;
      title: string;
      length: number;
    }) => importFn({ data: { ...r, pathogen } }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`Imported ${res.length_bp?.toLocaleString() ?? "?"} bp into library`);
        qc.invalidateQueries({ queryKey: ["sequences"] });
      } else toast.error(res.error ?? "Import failed");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  return (
    <SectionCard
      title="NCBI live search"
      subtitle="Pull sequences in real time from NCBI Nucleotide (Entrez E-utilities)."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          m.mutate(query);
        }}
        className="flex gap-2 mb-3"
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. Mpox clade IIb Nigeria"
          className="flex-1"
        />
        <Input
          value={pathogen}
          onChange={(e) => setPathogen(e.target.value)}
          placeholder="Pathogen tag"
          className="w-40"
        />
        <Button type="submit" disabled={m.isPending}>
          <Search className="w-4 h-4" /> {m.isPending ? "Searching…" : "Search NCBI"}
        </Button>
      </form>

      {m.isError && (
        <p className="text-xs text-[color:var(--status-alert)]">NCBI request failed. Try again.</p>
      )}

      {m.data?.summaries && m.data.summaries.length > 0 && (
        <div className="overflow-x-auto">
          <div className="text-[11px] text-muted-foreground mb-2">
            {m.data.total?.toLocaleString()} total hits · showing {m.data.summaries.length}
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b border-border">
              <tr>
                <th className="text-left py-2 font-medium">Accession</th>
                <th className="text-left font-medium">Title</th>
                <th className="text-left font-medium">Organism</th>
                <th className="text-right font-medium">Length</th>
                <th className="text-right font-medium">Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {m.data.summaries.map((r) => (
                <tr key={r.uid} className="border-b border-border/40 hover:bg-secondary/30">
                  <td className="py-2 font-mono text-xs text-[color:var(--accent)]">
                    {r.accession}
                  </td>
                  <td className="text-xs max-w-md truncate" title={r.title}>
                    {r.title}
                  </td>
                  <td className="text-xs">{r.organism}</td>
                  <td className="text-right tabular-nums text-xs">
                    {r.length?.toLocaleString() || "—"}
                  </td>
                  <td className="text-right text-muted-foreground text-xs">{r.update_date}</td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      onClick={() =>
                        importMut.mutate({
                          uid: String(r.uid),
                          accession: r.accession ?? String(r.uid),
                          organism: r.organism ?? "",
                          title: r.title ?? "",
                          length: r.length ?? 0,
                        })
                      }
                      disabled={importMut.isPending}
                      className="text-xs inline-flex items-center gap-1 text-[color:var(--accent)] hover:opacity-80 mr-3 disabled:opacity-50"
                    >
                      <Download className="w-3 h-3" /> Import
                    </button>
                    <a
                      href={`https://www.ncbi.nlm.nih.gov/nuccore/${r.uid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs inline-flex items-center gap-1 text-[color:var(--accent)]"
                    >
                      Open <ExternalLink className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {m.data && m.data.summaries.length === 0 && (
        <p className="text-xs text-muted-foreground">No NCBI records matched that query.</p>
      )}
    </SectionCard>
  );
}
