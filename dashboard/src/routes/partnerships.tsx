import { createFileRoute } from "@tanstack/react-router";
import { Handshake } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/partnerships")({
  component: PartnersPage,
  head: () => ({
    meta: [
      { title: "Funding & Partnerships — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content: "Institutional partners, funders, and consortia powering the network.",
      },
    ],
  }),
});

const partners = [
  "Africa CDC",
  "WHO AFRO",
  "Wellcome Trust",
  "Gates Foundation",
  "EDCTP3",
  "PEPFAR",
  "ANDI",
  "GISAID",
  "Institut Pasteur",
  "ILRI",
  "KEMRI-Wellcome",
  "NICD South Africa",
];

function PartnersPage() {
  return (
    <CommandPage
      icon={Handshake}
      eyebrow="Network"
      title="Funding & Partnerships"
      subtitle="Institutions, agencies, and consortia that sustain pan-African genomic surveillance."
      kpis={[
        { label: "Partner institutions", value: String(partners.length), color: "var(--accent)" },
        { label: "Active grants", value: "23", color: "var(--status-info)" },
        { label: "Funding pipeline", value: "$48M", color: "var(--status-ok)" },
        { label: "MoUs in review", value: "7", color: "var(--status-warn)" },
      ]}
    >
      <GlassCard title="Partners">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {partners.map((p) => (
            <div
              key={p}
              className="rounded-lg border border-border/60 bg-secondary/20 p-4 text-sm text-center hover:border-[color:var(--accent)]/60"
            >
              {p}
            </div>
          ))}
        </div>
      </GlassCard>
    </CommandPage>
  );
}
