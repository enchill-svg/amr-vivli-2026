import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/partnerships")({
  component: PartnersPage,
  head: () => ({
    meta: [
      { title: "Data sources & acknowledgments — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "Surveillance and reference inputs used by the Vivli 2026 AMR Surveillance Data Challenge submission.",
      },
    ],
  }),
});

const DATA_SOURCES = [
  "ATLAS",
  "PLEA",
  "SOAR",
  "SENTRY",
  "GBD 2021 / 2023",
  "World Bank WDI",
  "WHO/UNICEF WUENIC",
  "ESAC-Net",
  "EUCAST",
  "CLSI",
  "Global AMR R&D Hub",
];

function PartnersPage() {
  return (
    <CommandPage
      icon={Handshake}
      eyebrow="Acknowledgments"
      title="Data sources & acknowledgments"
      subtitle="This submission does not claim institutional partnerships beyond the data providers named below. Every dashboard figure traces to these inputs."
      kpis={[
        { label: "Named data sources", value: String(DATA_SOURCES.length), color: "var(--accent)" },
        { label: "Challenge", value: "Vivli 2026", color: "var(--status-info)" },
        { label: "Pipeline", value: "Evidence-gated", color: "var(--status-ok)" },
        { label: "Public API", value: "None (static)", color: "var(--status-warn)" },
      ]}
    >
      <GlassCard title="Surveillance & reference inputs">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {DATA_SOURCES.map((p) => (
            <div
              key={p}
              className="rounded-lg border border-border/60 bg-secondary/20 p-4 text-sm text-center"
            >
              {p}
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard title="Challenge context">
        <p className="text-sm text-foreground/85 leading-relaxed">
          Built for the Vivli 2026 AMR Surveillance Data Challenge. Access to ATLAS, PLEA, SOAR, and
          SENTRY isolate-level data was provided through Vivli under challenge terms. External
          covariates (WDI, WUENIC, GBD SDI, ESAC-Net, Global AMR R&D Hub) are joined from public
          releases cited in the pipeline README.
        </p>
      </GlassCard>
    </CommandPage>
  );
}
