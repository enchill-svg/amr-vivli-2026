import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { getFundingGapRows } from "@/lib/amr-data.functions";

export const Route = createFileRoute("/marketplace")({ component: FundingPage, head: () => ({ meta: [{ title: "Funding Gap Explorer — AMR LifeIntel" }] }) });

function FundingPage() {
  const { data: fundingRows = [] } = useQuery({ queryKey: ["funding-gap"], queryFn: getFundingGapRows });
  const underfunded = fundingRows.filter((r) => r.gap < 0).sort((a, b) => a.gap - b.gap);
  const chart = fundingRows.map((r) => ({
    organism: r.organism.split(" ").slice(0, 2).join(" "),
    burden: Math.round(r.burdenShare * 1000) / 10,
    funding: Math.round(r.fundingShare * 1000) / 10,
    gap: Math.round(r.gap * 1000) / 10,
  }));

  return (
    <CommandPage icon={Landmark} eyebrow="Funding Gap Explorer" title="AMR R&D investment vs surveillance burden" subtitle="Organism-level burden share vs Global AMR R&D Hub funding share (pro-rated)." kpis={[
      { label: "Organisms", value: String(fundingRows.length), color: "var(--accent)" },
      { label: "Underfunded", value: String(underfunded.length), color: "var(--status-alert)" },
      { label: "Top gap", value: underfunded[0] ? String(underfunded[0].gap) : "—", color: "var(--status-alert)", sub: underfunded[0]?.organism },
      { label: "Source", value: "Hub", color: "var(--status-info)", sub: "funding_gap_summary_v1" },
    ]}>
      <div className="grid gap-4 xl:grid-cols-3">
        <GlassCard className="xl:col-span-2" title="Burden–funding share" subtitle="Negative gap = funding share below burden share.">
          <div className="h-96"><ResponsiveContainer><BarChart data={chart}><CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" /><XAxis dataKey="organism" stroke="#94a3b8" fontSize={10} angle={-20} height={60} textAnchor="end" /><YAxis stroke="#94a3b8" fontSize={10} /><Tooltip contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.05 250)", fontSize: 11 }} /><Bar dataKey="burden" fill="oklch(0.68 0.24 25)" radius={[6,6,0,0]} /><Bar dataKey="funding" fill="oklch(0.78 0.18 200)" radius={[6,6,0,0]} /></BarChart></ResponsiveContainer></div>
        </GlassCard>
        <GlassCard title="Largest funding gaps" subtitle="From pipeline Stage 6 alignment.">
          <div className="space-y-3">
            {underfunded.slice(0, 6).map((r) => (
              <div key={r.organism} className="rounded-xl border border-border/60 bg-card/45 p-4"><div className="flex items-center justify-between"><div><div className="text-sm font-medium">{r.organism}</div><div className="text-xs text-muted-foreground">{r.pathogenType}</div></div><div className="font-mono text-[color:var(--status-alert)]">{r.gap.toFixed(3)}</div></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.alignmentDirection.replace(/_/g, " ")}</p></div>
            ))}
          </div>
        </GlassCard>
      </div>
    </CommandPage>
  );
}
