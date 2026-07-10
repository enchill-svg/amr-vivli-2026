import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { GitCompare } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { interventionLevers } from "@/lib/amr-demo-data";

export const Route = createFileRoute("/policy")({ component: InterventionPage, head: () => ({ meta: [{ title: "Intervention Simulator — AMR LifeIntel" }] }) });

function InterventionPage() {
  const [values, setValues] = useState<Record<string, number>>(() => Object.fromEntries(interventionLevers.map((x) => [x.key, x.defaultValue])));
  const impact = useMemo(() => {
    const resistanceReduction = interventionLevers.reduce((s, l) => s + (values[l.key] ?? 0) * l.effect, 0);
    const mortalityReduction = resistanceReduction * 0.62;
    const lifeGain = resistanceReduction * 0.045;
    const low = lifeGain * 0.72;
    const high = lifeGain * 1.28;
    return { resistanceReduction, mortalityReduction, lifeGain, low, high };
  }, [values]);
  const chart = interventionLevers.map((l) => ({ lever: l.label.replace("Increase ", "").replace("Improve ", ""), impact: Number(((values[l.key] ?? 0) * l.effect).toFixed(2)) }));

  return (
    <CommandPage icon={GitCompare} eyebrow="Intervention Simulator" title="Estimate life-expectancy gain from intervention portfolios" subtitle="Point-and-click scenario builder for vaccination, stewardship, diagnostics, IPC, R&D and health expenditure. Outputs are transparent assumptions, not hidden black boxes." kpis={[
      { label: "Resistance reduction", value: `${impact.resistanceReduction.toFixed(1)}%`, color: "var(--status-ok)" },
      { label: "Mortality reduction", value: `${impact.mortalityReduction.toFixed(1)}%`, color: "var(--status-info)" },
      { label: "Life gain", value: `+${impact.lifeGain.toFixed(2)}y`, color: "var(--status-ok)" },
      { label: "95% interval", value: `${impact.low.toFixed(2)}–${impact.high.toFixed(2)}y`, color: "var(--status-warn)" },
    ]}>
      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard title="Policy lever controls" subtitle="Adjust plausible scale-up intensity. Each lever has an explicit assumed effect coefficient.">
          <div className="space-y-4">
            {interventionLevers.map((lever) => (
              <div key={lever.key} className="rounded-xl border border-border/60 bg-card/45 p-4">
                <div className="flex items-center justify-between"><div><div className="text-sm font-medium">{lever.label}</div><div className="text-[11px] text-muted-foreground">{lever.appliesTo}</div></div><div className="font-mono text-sm text-[color:var(--accent)]">{values[lever.key]}%</div></div>
                <input type="range" min="0" max="100" value={values[lever.key]} onChange={(e) => setValues((v) => ({ ...v, [lever.key]: Number(e.target.value) }))} className="mt-3 w-full accent-cyan-300" />
                <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>0</span><span>Effect coefficient {lever.effect.toFixed(3)}</span><span>100</span></div>
              </div>
            ))}
          </div>
        </GlassCard>
        <GlassCard title="Contribution by intervention" subtitle="Relative contribution to predicted resistance reduction.">
          <div className="h-96"><ResponsiveContainer><BarChart data={chart}><CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" /><XAxis dataKey="lever" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.05 250)", fontSize: 11 }} /><Bar dataKey="impact" fill="oklch(0.78 0.17 155)" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div>
          <div className="rounded-xl border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 p-4 text-sm leading-relaxed">
            Recommended scenario: prioritize diagnostics and stewardship first, then IPC for hospital-dominant fungal and Gram-negative signals. Vaccination applies only to bacterial respiratory pathogens with relevant vaccines.
          </div>
        </GlassCard>
      </div>
    </CommandPage>
  );
}
