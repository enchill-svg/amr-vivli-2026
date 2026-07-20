import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { LegacyDemoBanner } from "@/components/vt/LegacyDemoBanner";

export const Route = createFileRoute("/biosecurity")({
  component: BioPage,
  head: () => ({
    meta: [
      { title: "Biosecurity Threat Monitoring — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "Continental biosecurity threat board with AMR, spillover, and bioterror watch indicators.",
      },
    ],
  }),
});

const threats = [
  {
    name: "Antimicrobial resistance — Klebsiella CR",
    level: "Critical",
    region: "East Africa",
    trend: "▲ 23%",
  },
  {
    name: "Zoonotic spillover risk — Marburg",
    level: "Elevated",
    region: "Equatorial belt",
    trend: "▲ 11%",
  },
  { name: "Vector range shift — Aedes aegypti", level: "Elevated", region: "Sahel", trend: "▲ 8%" },
  {
    name: "Vaccine-derived poliovirus",
    level: "Moderate",
    region: "Lake Chad basin",
    trend: "▼ 4%",
  },
  {
    name: "Veterinary H5N1 incursion",
    level: "Critical",
    region: "Coastal West Africa",
    trend: "▲ 19%",
  },
];
const COLOR: Record<string, string> = {
  Critical: "var(--status-alert)",
  Elevated: "var(--status-warn)",
  Moderate: "var(--status-info)",
};

function BioPage() {
  return (
    <CommandPage
      icon={ShieldAlert}
      eyebrow="Continental Biosecurity"
      title="Threat Monitoring Board"
      subtitle="Cross-domain biothreat fusion: AMR, zoonosis, vector ecology, and intentional release indicators."
      kpis={[
        { label: "Active threats", value: "14", color: "var(--status-alert)" },
        { label: "AMR signals", value: "6", color: "var(--status-warn)" },
        { label: "Spillover watches", value: "9", color: "var(--status-info)" },
        { label: "Response readiness", value: "73%", color: "var(--status-ok)" },
      ]}
    >
      <LegacyDemoBanner detail="The threat board and KPI figures above are hardcoded sample values." />
      <GlassCard title="Active threat board">
        <ul className="space-y-2">
          {threats.map((t) => (
            <li
              key={t.name}
              className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5"
            >
              <span className="w-1.5 h-10 rounded" style={{ background: COLOR[t.level] }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{t.name}</div>
                <div className="text-[11px] text-muted-foreground">{t.region}</div>
              </div>
              <span className="text-xs" style={{ color: COLOR[t.level] }}>
                {t.trend}
              </span>
              <span
                className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ background: `${COLOR[t.level]}22`, color: COLOR[t.level] }}
              >
                {t.level}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </CommandPage>
  );
}
