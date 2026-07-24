import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Search as SearchIcon } from "lucide-react";
import { PageShell, SectionCard } from "@/components/vt/PageShell";
import {
  getLiveCountryTrends,
  getPathogenSignals,
  getFundingGapRows,
} from "@/lib/amr-data.functions";

const searchSchema = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/search")({
  validateSearch: (s) => searchSchema.parse(s),
  component: SearchPage,
  head: () => ({ meta: [{ title: "Search — AMR Life Expectancy Intelligence" }] }),
});

function SearchPage() {
  const { q } = Route.useSearch();
  const query = (q ?? "").trim().toLowerCase();

  const { data: countries = [], isLoading: loadingCountries } = useQuery({
    queryKey: ["search-countries"],
    queryFn: () => getLiveCountryTrends("all"),
  });
  const { data: signals = [], isLoading: loadingSignals } = useQuery({
    queryKey: ["search-signals"],
    queryFn: () => getPathogenSignals("all"),
  });
  const { data: funding = [], isLoading: loadingFunding } = useQuery({
    queryKey: ["search-funding"],
    queryFn: getFundingGapRows,
  });

  const countryHits = !query
    ? []
    : countries
        .filter((r) =>
          `${r.country} ${r.iso3} ${r.dominantOrganism} ${r.dominantDrug}`
            .toLowerCase()
            .includes(query),
        )
        .slice(0, 20);
  const signalHits = !query
    ? []
    : signals
        .filter((r) =>
          `${r.organism} ${r.drug} ${r.country} ${r.recommendation}`.toLowerCase().includes(query),
        )
        .slice(0, 20);
  const fundingHits = !query
    ? []
    : funding
        .filter((r) => `${r.organism} ${r.pathogenType}`.toLowerCase().includes(query))
        .slice(0, 20);

  const loading = loadingCountries || loadingSignals || loadingFunding;

  return (
    <PageShell showTabs={false}>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex items-center gap-3">
          <SearchIcon className="h-5 w-5 text-[color:var(--accent)]" />
          <h1 className="text-2xl font-light tracking-tight">
            Results for <span className="text-[color:var(--accent)]">"{query || "…"}"</span>
          </h1>
        </div>

        {!query && (
          <p className="text-sm text-muted-foreground">
            Search the published pipeline bundle for country, organism, drug, or funding-gap
            organism names.
          </p>
        )}

        {query && loading && <p className="text-xs text-muted-foreground">Searching published data…</p>}

        {query && !loading && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <SectionCard title="Countries" subtitle={`${countryHits.length} matches`}>
              {countryHits.length === 0 ? (
                <p className="text-xs text-muted-foreground">No country matches.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {countryHits.map((r) => (
                    <li key={`${r.iso3}-${r.pathogenType}`}>
                      <Link to="/countries" className="hover:text-[color:var(--accent)]">
                        {r.country} ({r.iso3}) · {r.pathogenType}
                        {r.riskScore != null ? ` · risk ${r.riskScore.toFixed(0)}` : ""}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Organism–drug signals" subtitle={`${signalHits.length} matches`}>
              {signalHits.length === 0 ? (
                <p className="text-xs text-muted-foreground">No signal matches.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {signalHits.map((r) => (
                    <li key={r.id}>
                      <Link to="/pathogens" className="hover:text-[color:var(--accent)]">
                        {r.organism} · {r.drug} ({r.country})
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
            <SectionCard title="Funding gap" subtitle={`${fundingHits.length} matches`}>
              {fundingHits.length === 0 ? (
                <p className="text-xs text-muted-foreground">No funding matches.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {fundingHits.map((r) => (
                    <li key={`${r.pathogenType}-${r.organism}`}>
                      <Link to="/marketplace" className="hover:text-[color:var(--accent)]">
                        {r.organism} · {r.pathogenType} · gap {(r.gap * 100).toFixed(1)} pp
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>
        )}
      </div>
    </PageShell>
  );
}
