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

const PRIMARY = [
  "SOAR 201818 / 201910 / 207965 — primary bacterial master",
  "Vivli/SENTRY Antifungals — primary fungal master",
];

const INTEGRITY = [
  "ATLAS Antibiotics — integrity / Manski bounds only (not in LE master)",
  "PLEA Study I — sampling / allocator pilot only (not in LE master)",
];

const EXTERNAL = [
  "WHO / World Bank life expectancy & health indicators",
  "World Bank hospital beds",
  "GBD 2023 SDI (+ GBD LRI context)",
  "WHO/UNICEF Hib3 & PCV",
  "ECDC ESAC-Net (Europe, partial)",
  "Global AMR R&D Hub funding",
  "EUCAST / CLSI breakpoints",
];

function PartnersPage() {
  return (
    <CommandPage
      icon={Handshake}
      eyebrow="Acknowledgments"
      title="Data sources & acknowledgments"
      subtitle="This submission does not claim institutional partnerships beyond the data providers named below. Roles match the Vivli cover disclosure."
      kpis={[
        { label: "Primary cohorts", value: "4", color: "var(--accent)" },
        { label: "Integrity-only", value: "2", color: "var(--status-info)" },
        { label: "Challenge", value: "Vivli 2026", color: "var(--status-ok)" },
        { label: "Public API", value: "None (static)", color: "var(--status-warn)" },
      ]}
    >
      <GlassCard title="Primary surveillance (harmonized master table)">
        <ul className="space-y-2 text-sm text-foreground/85">
          {PRIMARY.map((p) => (
            <li key={p} className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
              {p}
            </li>
          ))}
        </ul>
      </GlassCard>
      <GlassCard title="Integrity / evidence-gate only (not in LE master)">
        <ul className="space-y-2 text-sm text-foreground/85">
          {INTEGRITY.map((p) => (
            <li key={p} className="rounded-lg border border-border/60 bg-secondary/20 px-4 py-3">
              {p}
            </li>
          ))}
        </ul>
      </GlassCard>
      <GlassCard title="External joins & references">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {EXTERNAL.map((p) => (
            <div
              key={p}
              className="rounded-lg border border-border/60 bg-secondary/20 p-3 text-sm text-foreground/85"
            >
              {p}
            </div>
          ))}
        </div>
      </GlassCard>
      <GlassCard title="Challenge context">
        <p className="text-sm text-foreground/85 leading-relaxed">
          Built for the Vivli 2026 AMR Surveillance Data Challenge (Data Request 00013346). Access to
          Register cohorts was provided through Vivli under challenge terms. External covariates are
          joined from public releases cited in the analysis README and submission report.
        </p>
      </GlassCard>
    </CommandPage>
  );
}
