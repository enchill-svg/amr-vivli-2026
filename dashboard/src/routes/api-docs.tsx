import { createFileRoute } from "@tanstack/react-router";
import { Code2 } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/api-docs")({
  component: ApiDocsPage,
  head: () => ({ meta: [{ title: "API Documentation — AMR LifeIntel" }] }),
});

const endpoints = [
  {
    m: "POST",
    p: "/api/v1/uploads",
    d: "Upload CSV/XLSX surveillance datasets and create a processing job.",
  },
  {
    m: "GET",
    p: "/api/v1/data-quality/{batch_id}",
    d: "Return profiling, validation logs and harmonization warnings.",
  },
  {
    m: "GET",
    p: "/api/v1/countries/risk",
    d: "List country-level AMR risk, life expectancy and intervention estimates.",
  },
  {
    m: "GET",
    p: "/api/v1/resistance/signals",
    d: "Return organism–drug resistance and MIC trajectory signals.",
  },
  {
    m: "POST",
    p: "/api/v1/interventions/simulate",
    d: "Estimate resistance, mortality and life-expectancy impact for policy scenarios.",
  },
  {
    m: "GET",
    p: "/api/v1/reports/{type}",
    d: "Generate policy briefs, scientific reports, funding reports and exports.",
  },
];

function ApiDocsPage() {
  return (
    <CommandPage
      icon={Code2}
      eyebrow="Developer Portal"
      title="AMR LifeIntel API"
      subtitle="REST and analytical-view contract for ingestion, validation, risk scoring, intervention simulation, exports and AI assistant tools."
    >
      <GlassCard
        title="Core endpoints"
        subtitle="Backend implementation can be FastAPI/PostgreSQL or Supabase Edge Functions. This frontend consumes the same analytical contract."
      >
        <div className="space-y-2">
          {endpoints.map((e) => (
            <div
              key={e.p}
              className="grid gap-2 rounded-xl border border-border/60 bg-background/30 p-3 text-sm md:grid-cols-[80px_280px_1fr]"
            >
              <span className="font-mono text-[color:var(--accent)]">{e.m}</span>
              <code className="text-xs text-foreground/90">{e.p}</code>
              <span className="text-xs text-muted-foreground">{e.d}</span>
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard title="Example" subtitle="Country risk API call.">
        <pre className="overflow-x-auto rounded-xl border border-border/60 bg-background/50 p-4 text-xs">
          <code>{`curl https://api.amr-lifeintel.org/v1/countries/risk?pathogen_type=fungal`}</code>
        </pre>
      </GlassCard>
    </CommandPage>
  );
}
