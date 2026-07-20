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
          "A Manski partial-identification bounds and evidence-gated analysis pipeline linking AMR surveillance to life expectancy, built for the Vivli 2026 AMR Surveillance Data Challenge.",
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
            VIVLI 2026 AMR SURVEILLANCE DATA CHALLENGE
          </p>
          <h1 className="text-4xl font-light tracking-tight leading-tight">
            Risk scores that say
            <br />
            <span className="text-[color:var(--accent)]">
              "we don't know" when that's the truth.
            </span>
          </h1>
          <p className="text-sm text-foreground/80 mt-5 max-w-2xl leading-relaxed">
            This platform is a Manski partial-identification bounds and evidence-gated analysis
            pipeline over multi-cohort antimicrobial resistance surveillance data, linking
            resistance trajectories to life expectancy and funding-allocation decisions.
            Country-drug-organism estimates that don't clear the pipeline's evidence-gate checks are
            withheld or shown only as bounds — never backfilled with a fabricated point estimate.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            ["57", "Countries represented"],
            ["34,174", "Isolates analyzed"],
            ["343,236", "Master analytical rows"],
            ["4", "Surveillance cohorts"],
          ].map(([v, l]) => (
            <div key={l} className="rounded-xl border border-border bg-card/60 p-4 text-center">
              <div className="text-3xl font-light text-[color:var(--accent)]">{v}</div>
              <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">
                {l}
              </div>
            </div>
          ))}
        </div>

        <SectionCard title="What the pipeline delivers">
          <div className="grid sm:grid-cols-2 gap-4 text-sm text-foreground/85">
            {[
              [
                "Evidence-gated risk scoring",
                "Composite country risk scores are computed only from quality_gate = pass strata; bounds-only or withheld rows never carry a live score.",
              ],
              [
                "Manski partial-identification bounds",
                "Detection-only genotype fields (e.g. ATLAS carbapenemase) get tier-1/tier-2 bounds instead of a false point prevalence.",
              ],
              [
                "EUCAST/CLSI breakpoint harmonization",
                "Resistance classification is unified across cohort-specific breakpoint versions and organism/drug vocabularies.",
              ],
              [
                "Cluster typology",
                "Unsupervised clustering (k selected by silhouette score) over combined static-burden and evolutionary-trajectory features.",
              ],
              [
                "External data joins",
                "World Bank WDI, WHO/UNICEF immunization coverage, GBD 2021 SDI, and ESAC-Net consumption joined per country-year.",
              ],
              [
                "Association analysis",
                "Cluster-robust country-year OLS of life expectancy on burden and health-system covariates — suggestive association only, no causal claims.",
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
            Every figure in this dashboard traces back to one of these inputs:
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            {[
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
            ].map((s) => (
              <span key={s} className="px-3 py-1 rounded-full bg-secondary/60 border border-border">
                {s}
              </span>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Acknowledgments">
          <p className="text-sm text-foreground/85">
            This submission uses surveillance and reference data made available through Vivli and
            the antimicrobial surveillance programs above, alongside public World Bank, WHO/UNICEF,
            and ESAC-Net indicators. All analysis, modeling choices, and conclusions are the work of
            this submission's authors — no partnership with, review by, or endorsement from any data
            provider or public-health institute is claimed.
          </p>
        </SectionCard>
      </div>
    </PageShell>
  );
}
