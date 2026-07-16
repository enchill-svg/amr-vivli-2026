import { createFileRoute } from "@tanstack/react-router";
import { PageShell, SectionCard } from "@/components/vt/PageShell";

export const Route = createFileRoute("/team")({
  component: TeamPage,
  head: () => ({
    meta: [
      { title: "Team — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content: "The researchers and partners behind AMR Life Expectancy Intelligence.",
      },
    ],
  }),
});

const team = [
  {
    name: "Principal Investigator",
    role: "Programme Lead",
    focus: "Genomic surveillance strategy",
  },
  {
    name: "Bioinformatics Lead",
    role: "Pipelines & Phylogenetics",
    focus: "Variant calling, Nextstrain integration",
  },
  {
    name: "Field Coordinator",
    role: "Sentinel Network",
    focus: "Sampling logistics across six sentinel sites",
  },
  {
    name: "Structural Biologist",
    role: "Mutation Impact",
    focus: "AlphaFold-based hotspot modelling",
  },
  {
    name: "Epidemiologist",
    role: "Outbreak Signals",
    focus: "Population-level signal interpretation",
  },
  { name: "Policy Liaison", role: "Africa CDC", focus: "Translating data into ministerial briefs" },
];

function TeamPage() {
  return (
    <PageShell showTabs={false}>
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="text-3xl font-light tracking-tight">Team</h1>
        <p className="text-sm text-muted-foreground">
          AMR Life Expectancy Intelligence brings together genomic, computational, and field
          expertise from across Africa.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {team.map((m) => (
            <SectionCard key={m.name} title={m.name} subtitle={m.role}>
              <p className="text-sm text-foreground/85">{m.focus}</p>
            </SectionCard>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
