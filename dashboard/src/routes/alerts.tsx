import { createFileRoute } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { ClientAMRWorldMap } from "@/components/amr/ClientAMRWorldMap";

export const Route = createFileRoute("/alerts")({
  component: RiskMapPage,
  head: () => ({
    meta: [
      { title: "Live Global AMR Risk Map — AMR LifeIntel" },
      {
        name: "description",
        content:
          "WFP HungerMap-style live AMR risk map with country trends, early warnings, and intervention priorities.",
      },
    ],
  }),
});

function RiskMapPage() {
  return (
    <CommandPage
      icon={Globe2}
      eyebrow="Live Global Risk Map"
      title="World AMR situation map"
      subtitle="Interactive country-level AMR risk, resistance prevalence, evolutionary trajectory, life-expectancy signal, funding mismatch, and intervention priority. The map refreshes from analytical views every 60 seconds."
      kpis={[
        {
          label: "Live layers",
          value: "4",
          color: "var(--accent)",
          sub: "Risk · warning · burden · funding",
        },
        {
          label: "Signal types",
          value: "2",
          color: "var(--status-info)",
          sub: "Bacterial + fungal",
        },
        { label: "Refresh", value: "60s", color: "var(--status-ok)", sub: "Database view polling" },
        { label: "Evidence", value: "CI", color: "var(--status-warn)", sub: "Confidence-aware" },
      ]}
    >
      <GlassCard
        title="AMR HungerMap-style operating picture"
        subtitle="Click a country bubble to inspect the dominant organism–drug signal, confidence, predicted life-expectancy gain, and policy recommendation."
      >
        <div className="h-[760px]">
          <ClientAMRWorldMap />
        </div>
      </GlassCard>
    </CommandPage>
  );
}
