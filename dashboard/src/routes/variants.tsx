import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";
import { Atom, ShieldAlert } from "lucide-react";
import { PageShell, SectionCard } from "@/components/vt/PageShell";
import { AuthGate } from "@/components/vt/AuthGate";
import { KpiStrip, InsightPanel } from "@/components/vt/KpiStrip";
import { supabase } from "@/integrations/supabase/client";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
} from "recharts";

export const Route = createFileRoute("/variants")({
  component: VariantsPage,
  head: () => ({
    meta: [
      { title: "Variants — AMR Life Expectancy Intelligence" },
      { name: "description", content: "Tracked viral variants and mutations of concern." },
    ],
  }),
});

const impactColor: Record<string, string> = {
  low: "var(--status-ok)",
  moderate: "var(--status-warn)",
  high: "var(--status-alert)",
  critical: "var(--status-alert)",
};

const radarData = [
  { trait: "Transmissibility", "JN.1": 88, "KP.3": 82, "BA.2.86": 70 },
  { trait: "Immune escape", "JN.1": 76, "KP.3": 84, "BA.2.86": 68 },
  { trait: "Severity", "JN.1": 48, "KP.3": 50, "BA.2.86": 52 },
  { trait: "Growth rate", "JN.1": 90, "KP.3": 88, "BA.2.86": 32 },
  { trait: "Geographic spread", "JN.1": 84, "KP.3": 64, "BA.2.86": 58 },
];

const trendData = Array.from({ length: 16 }, (_, i) => ({
  wk: `W${i + 1}`,
  "JN.1": Math.round(8 + i * 4 + Math.random() * 3),
  "KP.3": Math.round(2 + Math.pow(i, 1.4) * 0.8),
  "BA.2.86": Math.max(0, Math.round(45 - i * 3 + Math.random() * 3)),
}));

const COUNTRIES = [
  "Nigeria",
  "DRC",
  "South Africa",
  "Kenya",
  "Ghana",
  "Egypt",
  "Ethiopia",
  "Uganda",
];
const MUTS = ["S:F456L", "S:Q493E", "S:L455S", "S:V1104L", "N:P13L", "ORF1a:T170I"];
const heatRows = MUTS.map((m) => ({
  mut: m,
  cells: COUNTRIES.map((c) => ({ c, v: Math.round(Math.random() * 100) })),
}));

function VariantsPage() {
  return (
    <PageShell>
      <div className="space-y-5">
        <header className="flex items-center gap-3">
          <Atom className="w-6 h-6 text-[color:var(--accent)]" />
          <div>
            <h1 className="text-2xl font-light tracking-tight">Variants</h1>
            <p className="text-xs text-muted-foreground">
              Variant of concern monitoring · phenotype radar · risk scoring
            </p>
          </div>
        </header>
        <AuthGate>
          <KpiStrip />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
            <SectionCard
              title="Phenotype radar"
              subtitle="Comparative profile of currently tracked variants"
            >
              <div className="h-72">
                <ResponsiveContainer>
                  <RadarChart data={radarData} outerRadius="75%">
                    <PolarGrid stroke="rgba(255,255,255,0.1)" />
                    <PolarAngleAxis
                      dataKey="trait"
                      tick={{ fill: "rgba(255,255,255,0.65)", fontSize: 10 }}
                    />
                    <PolarRadiusAxis tick={false} axisLine={false} />
                    <Radar
                      name="JN.1"
                      dataKey="JN.1"
                      stroke="#22d3ee"
                      fill="#22d3ee"
                      fillOpacity={0.35}
                    />
                    <Radar
                      name="KP.3"
                      dataKey="KP.3"
                      stroke="#a78bfa"
                      fill="#a78bfa"
                      fillOpacity={0.3}
                    />
                    <Radar
                      name="BA.2.86"
                      dataKey="BA.2.86"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.25}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="Variant trends" subtitle="Detection share across sentinel networks">
              <div className="h-72">
                <ResponsiveContainer>
                  <LineChart data={trendData}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="wk" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(15,20,30,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line
                      type="monotone"
                      dataKey="JN.1"
                      stroke="#22d3ee"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="KP.3"
                      stroke="#a78bfa"
                      strokeWidth={2.5}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="BA.2.86"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
            <SectionCard title="AI risk score" subtitle="Composite spread × escape × growth">
              <ul className="space-y-3 mt-1">
                {[
                  { v: "JN.1.11", risk: 86, conf: 0.92, level: "high" },
                  { v: "KP.3", risk: 78, conf: 0.88, level: "high" },
                  { v: "XEC", risk: 62, conf: 0.74, level: "moderate" },
                  { v: "BA.2.86", risk: 31, conf: 0.81, level: "low" },
                ].map((r) => (
                  <li key={r.v} className="rounded-lg border border-border/40 bg-secondary/20 p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-sm flex items-center gap-1.5">
                        <ShieldAlert
                          className="w-3.5 h-3.5"
                          style={{ color: impactColor[r.level] }}
                        />{" "}
                        {r.v}
                      </span>
                      <span className="text-xs tabular-nums">{r.risk}/100</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${r.risk}%`, background: impactColor[r.level] }}
                      />
                    </div>
                    <div className="mt-1.5 text-[10px] text-muted-foreground">
                      confidence {(r.conf * 100).toFixed(0)}%
                    </div>
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>

          <SectionCard
            title="Mutation × Geography heatmap"
            subtitle="Prevalence of selected spike/ORF mutations across countries"
          >
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `120px repeat(${COUNTRIES.length}, 1fr)` }}
                >
                  <div />
                  {COUNTRIES.map((c) => (
                    <div
                      key={c}
                      className="text-[10px] uppercase tracking-wider text-muted-foreground text-center pb-2"
                    >
                      {c}
                    </div>
                  ))}
                  {heatRows.map((row) => (
                    <Fragment key={row.mut}>
                      <div className="font-mono text-xs text-[color:var(--accent)] py-1.5 pr-2">
                        {row.mut}
                      </div>
                      {row.cells.map((cell) => (
                        <div
                          key={`${row.mut}-${cell.c}`}
                          className="m-0.5 h-8 rounded grid place-items-center text-[10px] tabular-nums"
                          style={{
                            background: `rgba(34, 211, 238, ${0.08 + (cell.v / 100) * 0.7})`,
                            color: cell.v > 55 ? "#0b1320" : "rgba(255,255,255,0.85)",
                          }}
                        >
                          {cell.v}
                        </div>
                      ))}
                    </Fragment>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
            <div className="lg:col-span-2">
              <VariantsTable />
            </div>
            <InsightPanel
              items={[
                {
                  title: "Lineage chain BA.2.86 → JN.1 → JN.1.11",
                  tag: "Evolution",
                  body: "Three-step accumulation of S:L455S + S:F456L drives current immune-escape advantage.",
                },
                {
                  title: "KP.3 doubling weekly",
                  tag: "Watch",
                  body: "Recombinant signal in West African sequences; estimated +14% growth rate per generation.",
                },
                {
                  title: "Mpox D86Y stable",
                  tag: "Mpox",
                  body: "No phenotypic shift over last 6 weeks despite expanding case load.",
                },
              ]}
            />
          </div>
        </AuthGate>
      </div>
    </PageShell>
  );
}

function VariantsTable() {
  const { data, isLoading } = useQuery({
    queryKey: ["variants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("variants")
        .select("id, gene, position, ref_aa, alt_aa, mutation, impact, notes, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  return (
    <SectionCard
      title="Mutations of interest"
      subtitle="Variants called from sentinel-site sequences."
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">No variants.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {data.map((v) => (
            <div key={v.id} className="rounded-lg border border-border/60 bg-secondary/20 p-4">
              <div className="flex items-center justify-between">
                <div className="font-mono text-base">
                  {v.gene}:{v.mutation}
                </div>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: `${impactColor[v.impact]}33`, color: impactColor[v.impact] }}
                >
                  {v.impact}
                </span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Position {v.position} · {v.ref_aa}→{v.alt_aa}
              </div>
              {v.notes && <p className="text-xs mt-2 text-foreground/80">{v.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
