import { createFileRoute } from "@tanstack/react-router";
import { Activity, ExternalLink } from "lucide-react";
import { useState } from "react";
import { PageShell, SectionCard } from "@/components/vt/PageShell";
import { AuthGate } from "@/components/vt/AuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/structural-biology")({
  component: StructuralBiologyPage,
  head: () => ({
    meta: [
      { title: "Structural Biology — ViralTrack-Afrika" },
      { name: "description", content: "3D protein structure viewer for variants of concern." },
    ],
  }),
});

type Target = {
  pdb: string;
  name: string;
  pathogen: string;
  muts: string[];
  risk: "low" | "moderate" | "high";
};

const TARGETS: Target[] = [
  {
    pdb: "6VXX",
    name: "SARS-CoV-2 Spike trimer (closed)",
    pathogen: "SARS-CoV-2",
    muts: ["D614G", "L452R", "E484K"],
    risk: "high",
  },
  {
    pdb: "6M0J",
    name: "Spike RBD ↔ ACE2 complex",
    pathogen: "SARS-CoV-2",
    muts: ["K417N", "N501Y"],
    risk: "high",
  },
  {
    pdb: "7VNF",
    name: "Mpox A29 surface protein",
    pathogen: "Mpox",
    muts: ["D86Y"],
    risk: "moderate",
  },
  {
    pdb: "5W6N",
    name: "Influenza A H3 hemagglutinin",
    pathogen: "Influenza A",
    muts: ["T160K"],
    risk: "moderate",
  },
  {
    pdb: "6LU7",
    name: "SARS-CoV-2 Main protease (Mpro)",
    pathogen: "SARS-CoV-2",
    muts: ["E166V"],
    risk: "low",
  },
  {
    pdb: "7BV2",
    name: "RNA-dependent RNA polymerase",
    pathogen: "SARS-CoV-2",
    muts: ["P323L"],
    risk: "moderate",
  },
];

const RISK_COLOR: Record<string, string> = {
  low: "var(--status-ok)",
  moderate: "var(--status-warn)",
  high: "var(--status-alert)",
};

function StructuralBiologyPage() {
  const [selected, setSelected] = useState<Target>(TARGETS[0]);
  const [pdbInput, setPdbInput] = useState("");

  const molstarUrl = `https://molstar.org/viewer/?pdb=${selected.pdb.toLowerCase()}&hide-controls=0`;

  return (
    <PageShell>
      <div className="space-y-5">
        <header className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-[color:var(--accent)]" />
          <h1 className="text-2xl font-light tracking-tight">Structural Biology</h1>
        </header>

        <AuthGate>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <div className="lg:col-span-3">
              <SectionCard
                title={`3D viewer · ${selected.name}`}
                subtitle={`PDB ${selected.pdb} — live from RCSB Protein Data Bank via Mol*.`}
                action={
                  <a
                    href={`https://www.rcsb.org/structure/${selected.pdb}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs inline-flex items-center gap-1 text-[color:var(--accent)]"
                  >
                    Open on RCSB <ExternalLink className="w-3 h-3" />
                  </a>
                }
              >
                <div className="rounded-lg overflow-hidden border border-border bg-black aspect-[16/10]">
                  <iframe
                    key={selected.pdb}
                    src={molstarUrl}
                    title={`Mol* viewer ${selected.pdb}`}
                    className="w-full h-full"
                    allow="fullscreen"
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2 items-center">
                  <Input
                    placeholder="Load any PDB ID (e.g. 7K3N)…"
                    value={pdbInput}
                    onChange={(e) => setPdbInput(e.target.value.toUpperCase())}
                    className="max-w-xs"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      pdbInput.length >= 4 &&
                      setSelected({
                        pdb: pdbInput,
                        name: `Custom structure ${pdbInput}`,
                        pathogen: "user upload",
                        muts: [],
                        risk: "low",
                      })
                    }
                  >
                    Load structure
                  </Button>
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Surveillance targets" subtitle="Click to load a structure.">
              <ul className="space-y-2">
                {TARGETS.map((t) => (
                  <li key={t.pdb}>
                    <button
                      onClick={() => setSelected(t)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        selected.pdb === t.pdb
                          ? "border-[color:var(--accent)] bg-secondary/40"
                          : "border-border/60 bg-secondary/10 hover:bg-secondary/30"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs text-[color:var(--accent)]">
                          {t.pdb}
                        </span>
                        <span
                          className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                          style={{
                            background: `${RISK_COLOR[t.risk]}33`,
                            color: RISK_COLOR[t.risk],
                          }}
                        >
                          {t.risk}
                        </span>
                      </div>
                      <div className="text-xs mt-1">{t.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{t.pathogen}</div>
                      {t.muts.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {t.muts.map((m) => (
                            <span
                              key={m}
                              className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </AuthGate>
      </div>
    </PageShell>
  );
}
