import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Dna } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { getPathogenSignals, getResistanceSeries } from "@/lib/amr-data.functions";

export const Route = createFileRoute("/lineages")({ component: EvolutionPage, head: () => ({ meta: [{ title: "Evolution Explorer — AMR LifeIntel" }] }) });

function EvolutionPage() {
  const { data: series = [] } = useQuery({ queryKey: ["evo-series"], queryFn: getResistanceSeries });
  const { data: signals = [] } = useQuery({ queryKey: ["evo-signals"], queryFn: () => getPathogenSignals("all") });
  const best = [...signals].sort((a, b) => b.evolutionaryFitness - a.evolutionaryFitness)[0];
  const evoRows = signals.map((s) => ({ ...s, failureRisk: Math.round((1 - s.distanceToFailure) * 100) })).sort((a, b) => b.evolutionaryFitness - a.evolutionaryFitness);

  return (
    <CommandPage icon={Dna} eyebrow="Evolution Explorer" title="Detect resistance before it crosses clinical failure" subtitle="Evolutionary Fitness Score and Evolutionary Distance-to-Failure convert MIC distribution drift into early-warning evidence." kpis={[
      { label: "Top EFS", value: best ? String(best.evolutionaryFitness) : "—", color: "var(--status-alert)", sub: best?.organism },
      { label: "Tracked signals", value: String(signals.length), color: "var(--accent)" },
      { label: "MIC-aware", value: "log₂", color: "var(--status-info)", sub: "Dilution-scale normalization" },
      { label: "Output", value: "EDTF", color: "var(--status-warn)", sub: "Distance-to-failure" },
    ]}>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard title="Resistance trajectory stream" subtitle="Bacterial and fungal AMR burden trend; line should be replaced by live country–organism–drug time series after loading data.">
          <div className="h-80"><ResponsiveContainer><LineChart data={series}><CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" /><XAxis dataKey="year" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.05 250)", fontSize: 11 }} /><Line type="monotone" dataKey="bacterial" stroke="oklch(0.68 0.24 25)" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="fungal" stroke="oklch(0.78 0.18 200)" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer></div>
        </GlassCard>
        <GlassCard title="Evolutionary failure leaderboard" subtitle="High EFS + low distance-to-failure = early intervention priority.">
          <div className="space-y-3">
            {evoRows.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/60 bg-card/45 p-3">
                <div className="flex items-center justify-between"><div><div className="text-sm font-medium">{r.organism}</div><div className="text-xs text-muted-foreground">{r.country} · {r.drug}</div></div><div className="font-mono text-lg text-[color:var(--status-alert)]">{r.evolutionaryFitness}</div></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-[color:var(--status-alert)]" style={{ width: `${r.failureRisk}%` }} /></div>
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>Failure pressure {r.failureRisk}%</span><span>Confidence {Math.round(r.confidence * 100)}%</span></div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
      <GlassCard title="Method logic" subtitle="Transparent scientific definitions used by the platform.">
        <div className="grid gap-3 md:grid-cols-3">
          <Method title="Evolutionary Fitness Score" text="Composite score from resistance-rate slope, log₂ MIC distribution shift, acceleration, and cross-year consistency." />
          <Method title="Distance-to-Failure" text="How close the MIC distribution is to a resistance breakpoint or empirically defined failure zone." />
          <Method title="Identifiability ledger" text="Signals with missing breakpoints, detection-only genotype fields, or sparse testing are reported with uncertainty bounds." />
        </div>
      </GlassCard>
    </CommandPage>
  );
}

function Method({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-border/60 bg-background/30 p-4"><div className="text-sm font-medium text-[color:var(--accent)]">{title}</div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p></div>;
}
