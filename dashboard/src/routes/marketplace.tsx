import { createFileRoute } from "@tanstack/react-router";
import { Landmark } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { fundingRows } from "@/lib/amr-demo-data";

export const Route = createFileRoute("/marketplace")({ component: FundingPage, head: () => ({ meta: [{ title: "Funding Gap Explorer — AMR LifeIntel" }] }) });

function FundingPage() {
  const underfunded = fundingRows.filter((r) => r.gap > 0).sort((a, b) => b.gap - a.gap);
  const overfunded = fundingRows.filter((r) => r.gap < 0);
  return (
    <CommandPage icon={Landmark} eyebrow="Funding Gap Explorer" title="Find where AMR R&D investment is misaligned with burden" subtitle="Compares observed AMR burden and trajectory against R&D funding concentration by country and pathogen arm." kpis={[
      { label: "Underfunded", value: String(underfunded.length), color: "var(--status-alert)" },
      { label: "Overfunded", value: String(overfunded.length), color: "var(--status-info)" },
      { label: "Top gap", value: underfunded[0] ? String(underfunded[0].gap) : "—", color: "var(--status-alert)", sub: underfunded[0]?.country },
      { label: "View", value: "R&D", color: "var(--accent)", sub: "input allocation" },
    ]}>
      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2" title="Burden–funding mismatch" subtitle="Positive gap indicates burden exceeds funding concentration.">
          <div className="h-96"><ResponsiveContainer><BarChart data={fundingRows}><CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" /><XAxis dataKey="country" stroke="#94a3b8" fontSize={10} /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.05 250)", fontSize: 11 }} /><Bar dataKey="burden" fill="oklch(0.68 0.24 25)" radius={[6,6,0,0]} /><Bar dataKey="funding" fill="oklch(0.78 0.18 200)" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div>
        </GlassCard>
        <GlassCard title="Priority funding recommendations" subtitle="Generated from mismatch score.">
          <div className="space-y-3">
            {underfunded.map((r) => (
              <div key={r.country} className="rounded-xl border border-border/60 bg-card/45 p-4"><div className="flex items-center justify-between"><div><div className="text-sm font-medium">{r.country}</div><div className="text-xs text-muted-foreground">{r.pathogenType}</div></div><div className="font-mono text-[color:var(--status-alert)]">+{r.gap}</div></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Increase targeted R&D, diagnostics, and surveillance support; current burden exceeds mapped funding intensity.</p></div>
            ))}
          </div>
        </GlassCard>
      </div>
    </CommandPage>
  );
}
