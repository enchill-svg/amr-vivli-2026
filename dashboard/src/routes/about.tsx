import { createFileRoute } from "@tanstack/react-router";
import { PageShell, SectionCard } from "@/components/vt/PageShell";

export const Route = createFileRoute("/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "AMR Life Expectancy Intelligence is the operational dashboard for the AMR, Life Expectancy, and Intervention Impact project.",
      },
    ],
  }),
});

function AboutPage() {
  return (
    <PageShell showTabs={false}>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-2xl border border-border bg-gradient-to-br from-card/80 to-card/30 p-8">
          <p className="text-[11px] tracking-[0.2em] text-[color:var(--accent)] mb-3">
            PAN-AFRICAN VIRAL INTELLIGENCE
          </p>
          <h1 className="text-4xl font-light tracking-tight leading-tight">
            Sequencing the continent's water,
            <br />
            <span className="text-[color:var(--accent)]">so outbreaks stop being surprises.</span>
          </h1>
          <p className="text-sm text-foreground/80 mt-5 max-w-2xl leading-relaxed">
            AMR Life Expectancy Intelligence is the operational platform for an integrated
            wastewater genomics and epidemiological intelligence network covering 47 countries. We
            sequence what communities shed, in near real-time, so ministries of health get a
            14-to-21 day head start on the next outbreak.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["47", "Countries"],
            ["72", "Sentinel sites"],
            ["8.6M", "People surveilled"],
            ["31", "Variants tracked"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl border border-border bg-card/60 p-4 text-center">
              <div className="text-3xl font-light text-[color:var(--accent)]">{v}</div>
              <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">
                {l}
              </div>
            </div>
          ))}
        </div>

        <SectionCard title="What the platform delivers">
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-foreground/85">
            {[
              [
                "Continuous wastewater sampling",
                "Twice-weekly collection at sentinel sites in 22 African cities, processed within 48 hours.",
              ],
              [
                "Whole-genome sequencing",
                "Oxford Nanopore MinION/PromethION flow cells, ARTIC v5 + Midnight tiling for >95% genome recovery.",
              ],
              [
                "Variant & lineage calling",
                "Pangolin, Nextclade, freyja for deconvolution of mixed wastewater signals.",
              ],
              ["Phylogenetics", "IQ-TREE2 maximum-likelihood with daily Nextstrain integration."],
              ["Structural biology", "AlphaFold3 + RCSB PDB pipeline for variants of concern."],
              [
                "Policy briefs",
                "Auto-generated PDF reports for national public-health institutes.",
              ],
            ].map(([t, d]) => (
              <div key={t}>
                <div className="font-medium">{t}</div>
                <div className="text-xs text-muted-foreground mt-1">{d}</div>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Data sources">
          <p className="text-sm text-foreground/85 mb-3">
            We integrate the world's open viral databases so every alert can be triangulated against
            the global signal:
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              "NCBI GenBank",
              "NCBI Virus",
              "EBI ENA",
              "Nextstrain",
              "GISAID (institutional)",
              "Pathoplexus",
              "WHO PHSM",
              "Africa CDC PGI",
            ].map((s) => (
              <span key={s} className="px-3 py-1 rounded-full bg-secondary/60 border border-border">
                {s}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Partners">
          <p className="text-sm text-foreground/85">
            AMR Life Expectancy Intelligence works alongside Africa CDC, national public-health
            institutes (NICD, NPHI Kenya, NCDC Nigeria, IPS Senegal), African bioinformatics hubs
            (H3ABioNet, KRISP, ACEGID), and community-based sampling teams across the continent.
          </p>
        </SectionCard>
      </div>
    </PageShell>
  );
}
