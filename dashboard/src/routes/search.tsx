import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { Search as SearchIcon, ExternalLink } from "lucide-react";
import { PageShell, SectionCard } from "@/components/vt/PageShell";
import { ncbiSearch } from "@/lib/ncbi.functions";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SearchPage,
  head: () => ({ meta: [{ title: "Search — ViralTrack-Afrika" }] }),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const query = (q ?? "").trim();
  const runNcbi = useServerFn(ncbiSearch);

  const local = useQuery({
    queryKey: ["search", "local", query],
    enabled: !!query,
    queryFn: async () => {
      const [{ data: sites }, { data: alerts }, { data: seqs }] = await Promise.all([
        supabase
          .from("sentinel_sites")
          .select("id,name,country,city")
          .or(`country.ilike.%${query}%,name.ilike.%${query}%,city.ilike.%${query}%`)
          .limit(15),
        supabase
          .from("alerts")
          .select("id,title,country,pathogen,severity,detected_at")
          .or(`country.ilike.%${query}%,pathogen.ilike.%${query}%,title.ilike.%${query}%`)
          .limit(15),
        supabase
          .from("sequences")
          .select("id,pathogen,lineage,accession")
          .or(`pathogen.ilike.%${query}%,lineage.ilike.%${query}%,accession.ilike.%${query}%`)
          .limit(15),
      ]);
      return { sites: sites ?? [], alerts: alerts ?? [], sequences: seqs ?? [] };
    },
  });

  const ncbi = useQuery({
    queryKey: ["search", "ncbi", query],
    enabled: !!query,
    queryFn: () => runNcbi({ data: { query, db: "nuccore" as const, retmax: 15 } }),
  });

  return (
    <PageShell showTabs={false}>
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <SearchIcon className="w-5 h-5 text-[color:var(--accent)]" />
          <h1 className="text-2xl font-light tracking-tight">
            Results for <span className="text-[color:var(--accent)]">"{query || "…"}"</span>
          </h1>
        </div>

        {!query && (
          <p className="text-sm text-muted-foreground">
            Type a country, pathogen, lineage, or NCBI accession in the search bar above.
          </p>
        )}

        {query && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SectionCard
              title="Surveillance data"
              subtitle="From sentinel sites, alerts and sequenced samples."
            >
              {local.isLoading ? (
                <p className="text-xs text-muted-foreground">Searching…</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <ResultGroup
                    label="Sentinel sites"
                    rows={
                      local.data?.sites?.map((s) => `${s.name} — ${s.city ?? ""} ${s.country}`) ??
                      []
                    }
                  />
                  <ResultGroup
                    label="Active alerts"
                    rows={
                      local.data?.alerts?.map(
                        (a) =>
                          `${a.severity.toUpperCase()} · ${a.pathogen} in ${a.country} — ${a.title}`,
                      ) ?? []
                    }
                  />
                  <ResultGroup
                    label="Sequences"
                    rows={
                      local.data?.sequences?.map(
                        (s) =>
                          `${s.pathogen} · ${s.lineage ?? "unassigned"} · ${s.accession ?? s.id.slice(0, 8)}`,
                      ) ?? []
                    }
                  />
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="NCBI Nucleotide"
              subtitle="Live results from NCBI Entrez E-utilities."
            >
              {ncbi.isLoading ? (
                <p className="text-xs text-muted-foreground">Querying NCBI…</p>
              ) : ncbi.data?.summaries?.length ? (
                <ul className="space-y-2 text-sm">
                  {ncbi.data.summaries.map((r) => (
                    <li key={r.uid} className="border-b border-border/40 pb-2">
                      <a
                        href={`https://www.ncbi.nlm.nih.gov/nuccore/${r.accession}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[color:var(--accent)] inline-flex items-center gap-1 text-xs"
                      >
                        {r.accession} <ExternalLink className="w-3 h-3" />
                      </a>
                      <div className="text-xs">{r.title}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {r.organism} · {r.length.toLocaleString()} bp · {r.update_date}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No NCBI results.</p>
              )}
              <div className="mt-3 text-[11px] text-muted-foreground">
                Try the{" "}
                <Link to="/genomics" className="text-[color:var(--accent)] underline">
                  Genomics tab
                </Link>{" "}
                for advanced NCBI queries.
              </div>
            </SectionCard>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function ResultGroup({ label, rows }: { label: string; rows: string[] }) {
  return (
    <div>
      <div className="text-[11px] tracking-wider text-muted-foreground mb-1">
        {label.toUpperCase()} · {rows.length}
      </div>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No matches.</p>
      ) : (
        <ul className="space-y-1">
          {rows.map((r, i) => (
            <li key={i} className="text-xs">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
