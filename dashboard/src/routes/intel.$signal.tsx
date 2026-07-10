import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, TrendingUp, ArrowUpRight, Activity, MapPin, Brain, Layers, Zap, Sparkles, Clock, FlaskConical, Dna, Globe2 } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export const Route = createFileRoute("/intel/$signal")({
  component: IntelDetail,
  head: ({ params }) => ({ meta: [
    { title: `${pretty(params.signal)} — Intelligence Detail` },
    { name: "description", content: `Drill-down intelligence context for ${pretty(params.signal)} including outbreaks, variants and confidence.` },
  ]}),
});

const SIGNALS: Record<string, {
  title: string; eyebrow: string; color: string; value: string; trend: string;
  series: { d: string; v: number }[];
  outbreaks: { country: string; pathogen: string; score: number; trend: number }[];
  variants: { name: string; freq: number; growth: number; flag: string }[];
  confidence: { feature: string; weight: number }[];
  narrative: string;
}> = {
  "active-outbreaks": {
    title: "Active Outbreaks", eyebrow: "Epidemiological signal", color: "oklch(0.7 0.22 25)", value: "47", trend: "+12.4% vs 7d",
    series: spark([12,14,13,18,17,22,21,26,28,31,35,40,42,47]),
    outbreaks: [
      { country: "DR Congo", pathogen: "Cholera", score: 94, trend: 31 },
      { country: "Nigeria", pathogen: "Mpox clade Ib", score: 87, trend: 18 },
      { country: "Namibia", pathogen: "Marburg", score: 81, trend: 22 },
    ],
    variants: [
      { name: "JN.1.42", freq: 0.34, growth: 12, flag: "🇿🇦" },
      { name: "Mpox Ib.3", freq: 0.18, growth: 28, flag: "🇨🇩" },
    ],
    confidence: [
      { feature: "Sentinel reporting cadence", weight: 0.32 },
      { feature: "Wastewater corroboration", weight: 0.28 },
      { feature: "Genomic confirmation", weight: 0.24 },
      { feature: "Cross-source agreement", weight: 0.16 },
    ],
    narrative: "Outbreak count is climbing fastest in Central & Southern Africa, led by wastewater-confirmed Mpox clade Ib and post-cyclone cholera signals in DR Congo and Mozambique.",
  },
  "emerging-threats": {
    title: "Emerging Threats", eyebrow: "Predictive signal", color: "oklch(0.78 0.19 60)", value: "9", trend: "+28.6% vs 7d",
    series: spark([2,3,3,4,3,5,4,6,5,7,7,8,9,9]),
    outbreaks: [{ country: "Burundi", pathogen: "Mpox Ib", score: 73, trend: 19 }],
    variants: [{ name: "BA.2.86.4", freq: 0.07, growth: 41, flag: "🇪🇬" }],
    confidence: [
      { feature: "Anomaly z-score", weight: 0.4 }, { feature: "Phylogenetic novelty", weight: 0.3 }, { feature: "Mobility convergence", weight: 0.3 },
    ],
    narrative: "Two novel lineages crossed the emergence threshold this week; both show >0.85 phylogenetic novelty against the continental reference set.",
  },
  "variant-emergence-index": {
    title: "Variant Emergence Index", eyebrow: "Genomic signal", color: "oklch(0.78 0.19 60)", value: "3.7", trend: "+14.3% vs 14d",
    series: spark([2.1,2.3,2.4,2.6,2.7,2.9,3.0,3.1,3.2,3.3,3.4,3.5,3.6,3.7]),
    outbreaks: [],
    variants: [
      { name: "JN.1.42", freq: 0.34, growth: 12, flag: "🇿🇦" },
      { name: "BA.2.86.4", freq: 0.07, growth: 41, flag: "🇪🇬" },
      { name: "Mpox Ib.3", freq: 0.18, growth: 28, flag: "🇨🇩" },
    ],
    confidence: [
      { feature: "Sequence depth", weight: 0.35 }, { feature: "Geographic diversity", weight: 0.25 }, { feature: "S-gene mutation density", weight: 0.4 },
    ],
    narrative: "Emergence index trending up driven by S-gene mutation accumulation in JN.1 sublineages and growing Mpox Ib.3 dominance.",
  },
};

function spark(arr: number[]) { return arr.map((v, i) => ({ d: `t${i}`, v })); }
function pretty(s: string) { return s.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" "); }

function IntelDetail() {
  const { signal } = Route.useParams();
  const sig = SIGNALS[signal] ?? {
    title: pretty(signal), eyebrow: "Signal", color: "oklch(0.78 0.18 200)", value: "—", trend: "",
    series: spark([5,6,7,6,8,9,11,10,12,13]),
    outbreaks: [], variants: [], confidence: [{ feature: "Composite model", weight: 1 }],
    narrative: "Detailed drill-down view. Underlying data sources are streaming and the AI engine is recalculating the confidence breakdown.",
  };

  return (
    <CommandPage
      icon={TrendingUp}
      eyebrow={sig.eyebrow}
      title={sig.title}
      subtitle={`Drill-down intelligence · linked outbreaks, variants, and AI confidence breakdown.`}
      kpis={[
        { label: "Current", value: sig.value, color: sig.color },
        { label: "Trend", value: sig.trend || "—", color: "var(--status-warn)" },
        { label: "Linked outbreaks", value: String(sig.outbreaks.length), color: "var(--status-alert)" },
        { label: "Linked variants", value: String(sig.variants.length), color: "oklch(0.7 0.2 300)" },
      ]}
    >
      <Link to="/" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-3 h-3" /> back to command center
      </Link>

      <GlassCard title="Signal trajectory" subtitle="Last 14 reporting cycles">
        <div className="h-56">
          <ResponsiveContainer>
            <AreaChart data={sig.series}>
              <defs>
                <linearGradient id="sig" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={sig.color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={sig.color} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="oklch(0.3 0.04 250 / 0.3)" />
              <XAxis dataKey="d" stroke="#94a3b8" fontSize={10} />
              <YAxis stroke="#94a3b8" fontSize={10} />
              <Tooltip contentStyle={{ background: "oklch(0.22 0.04 250)", border: "1px solid oklch(0.3 0.05 250)", fontSize: 11 }} />
              <Area type="monotone" dataKey="v" stroke={sig.color} strokeWidth={2} fill="url(#sig)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid lg:grid-cols-3 gap-4">
        <GlassCard title="Linked outbreaks" subtitle="Underlying epidemiological events">
          {sig.outbreaks.length === 0 ? <p className="text-xs text-muted-foreground">No active outbreaks linked.</p> :
            <ul className="space-y-2">
              {sig.outbreaks.map((o) => (
                <li key={o.country + o.pathogen} className="rounded-lg border border-border/50 bg-background/30 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="flex-1">{o.country}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[color:var(--status-alert)]/15 text-[color:var(--status-alert)]">{o.score}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground flex items-center gap-2">
                    <FlaskConical className="w-3 h-3" /> {o.pathogen}
                    <span className="ml-auto inline-flex items-center gap-1 text-[color:var(--status-warn)]"><ArrowUpRight className="w-3 h-3" />+{o.trend}%</span>
                  </div>
                </li>
              ))}
            </ul>}
        </GlassCard>

        <GlassCard title="Linked variants" subtitle="Lineages amplifying this signal">
          {sig.variants.length === 0 ? <p className="text-xs text-muted-foreground">No genomic linkage yet.</p> :
            <ul className="space-y-2">
              {sig.variants.map((v) => (
                <li key={v.name} className="rounded-lg border border-border/50 bg-background/30 p-3 text-sm">
                  <div className="flex items-center gap-2">
                    <Dna className="w-3.5 h-3.5 text-[color:oklch(0.7_0.2_300)]" />
                    <span className="font-mono">{v.name}</span>
                    <span className="ml-auto">{v.flag}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>Freq {(v.freq * 100).toFixed(1)}%</span>
                    <span className="ml-auto text-[color:var(--status-warn)]">+{v.growth}% growth</span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                    <div className="h-full" style={{ width: `${v.freq * 100}%`, background: "oklch(0.7 0.2 300)" }} />
                  </div>
                </li>
              ))}
            </ul>}
        </GlassCard>

        <GlassCard title="Confidence breakdown" subtitle="Top contributing features">
          <ul className="space-y-2.5">
            {sig.confidence.map((c) => (
              <li key={c.feature} className="text-xs">
                <div className="flex justify-between"><span className="text-foreground/90">{c.feature}</span><span className="font-mono text-muted-foreground">{Math.round(c.weight * 100)}%</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                  <div className="h-full" style={{ width: `${c.weight * 100}%`, background: sig.color }} />
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <GlassCard title="AI intelligence brief" subtitle="Narrative for response teams">
        <div className="flex gap-3">
          <Sparkles className="w-5 h-5 shrink-0 text-[color:var(--accent)]" />
          <p className="text-sm text-foreground/90 leading-relaxed">{sig.narrative}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <Link to="/forecast-compare" className="px-3 py-1.5 rounded-md bg-[color:var(--accent)]/15 text-[color:var(--accent)] inline-flex items-center gap-1"><Globe2 className="w-3 h-3" /> Compare countries</Link>
          <Link to="/alerts" className="px-3 py-1.5 rounded-md border border-border text-muted-foreground inline-flex items-center gap-1"><Activity className="w-3 h-3" /> Open alert timeline</Link>
          <Link to="/forecasting" className="px-3 py-1.5 rounded-md border border-border text-muted-foreground inline-flex items-center gap-1"><Brain className="w-3 h-3" /> Forecast engine</Link>
        </div>
      </GlassCard>

      <GlassCard title="Driver lattice" subtitle="What's pushing the signal right now">
        <div className="grid sm:grid-cols-2 gap-2 text-xs">
          {["Wastewater corroboration","Genomic novelty","Mobility convergence","Climate anomaly","Sentinel cadence","Cross-border events"].map((d, i) => (
            <div key={d} className="rounded-lg border border-border/50 bg-background/30 p-2.5 flex items-center gap-2">
              <Layers className="w-3 h-3 text-muted-foreground" />
              <span className="flex-1">{d}</span>
              <Zap className="w-3 h-3 text-[color:var(--accent)]" />
              <span className="font-mono text-muted-foreground">{Math.round(20 + (i * 11) % 60)}%</span>
              <Clock className="w-3 h-3 text-muted-foreground" />
            </div>
          ))}
        </div>
      </GlassCard>
    </CommandPage>
  );
}