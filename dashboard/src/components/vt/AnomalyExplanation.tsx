import { Brain, TrendingUp, AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

export type AnomalyFeature = {
  name: string;
  contribution: number; // 0..1
  direction: "up" | "down";
  value?: string;
};

export type AnomalyExplanation = {
  id: string;
  title: string;
  site?: string;
  pathogen?: string;
  zScore: number;
  confidence: number; // 0..1
  severity: "low" | "moderate" | "high" | "critical";
  detectedAt: string;
  summary: string;
  features: AnomalyFeature[];
  actions: { label: string; priority: "now" | "24h" | "72h" }[];
};

const SEV: Record<AnomalyExplanation["severity"], { color: string; label: string }> = {
  low: { color: "#3ee6a8", label: "Low" },
  moderate: { color: "#f5c451", label: "Moderate" },
  high: { color: "#ff8a3d", label: "High" },
  critical: { color: "#ff3d6e", label: "Critical" },
};

export function AnomalyExplanationCard({ a }: { a: AnomalyExplanation }) {
  const sev = SEV[a.severity];
  return (
    <div className="vt-glass rounded-xl p-4 border border-border/60 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div
            className="mt-0.5 rounded-lg p-1.5"
            style={{ background: `${sev.color}22`, color: sev.color }}
          >
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-medium leading-tight">{a.title}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {a.site ? `${a.site} · ` : ""}
              {a.pathogen ? `${a.pathogen} · ` : ""}
              {new Date(a.detectedAt).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full inline-block"
            style={{ background: `${sev.color}22`, color: sev.color }}
          >
            {sev.label} · z {a.zScore.toFixed(1)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-1">
            confidence {(a.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      <p className="text-xs text-foreground/85 leading-relaxed">{a.summary}</p>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" /> Top contributing features
        </div>
        <div className="space-y-1.5">
          {a.features.slice(0, 5).map((f) => (
            <div key={f.name} className="flex items-center gap-2 text-[11px]">
              <div className="w-32 truncate text-muted-foreground">{f.name}</div>
              <div className="flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, f.contribution * 100)}%`,
                    background: f.direction === "up" ? sev.color : "#5cb8ff",
                  }}
                />
              </div>
              <div className="w-12 text-right tabular-nums text-foreground/80">
                {(f.contribution * 100).toFixed(0)}%
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Recommended actions
        </div>
        <ul className="space-y-1">
          {a.actions.map((act, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-2 text-[11px] rounded-md border border-border/50 bg-background/40 px-2 py-1.5"
            >
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3 text-[color:var(--accent)]" />
                {act.label}
              </div>
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                {act.priority} <ArrowRight className="w-3 h-3" />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export const DEMO_ANOMALIES: AnomalyExplanation[] = [
  {
    id: "a1",
    title: "Cholera signal surge — Lusaka catchment",
    site: "Lusaka WWTP-3",
    pathogen: "Vibrio cholerae",
    zScore: 3.8,
    confidence: 0.93,
    severity: "critical",
    detectedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    summary:
      "Wastewater concentration jumped 4.2× over 14-day baseline, coincident with 38% rainfall increase and 2 reported clinical cases. Pattern matches early 2024 outbreak signature.",
    features: [
      { name: "qPCR copies/L (14d Δ)", contribution: 0.92, direction: "up" },
      { name: "Rainfall anomaly", contribution: 0.71, direction: "up" },
      { name: "Clinic case reports", contribution: 0.58, direction: "up" },
      { name: "Chlorination index", contribution: 0.41, direction: "down" },
      { name: "Cross-site correlation", contribution: 0.33, direction: "up" },
    ],
    actions: [
      { label: "Deploy rapid response team to catchment", priority: "now" },
      { label: "Notify Zambia MoH + WHO AFRO desk", priority: "now" },
      { label: "Initiate door-to-door active case finding", priority: "24h" },
      { label: "Pre-position oral rehydration salts", priority: "24h" },
    ],
  },
  {
    id: "a2",
    title: "Mpox clade Ib rising signal — Kinshasa",
    site: "INRB N'Djili",
    pathogen: "MPXV clade Ib",
    zScore: 2.6,
    confidence: 0.81,
    severity: "high",
    detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    summary:
      "Genomic surveillance shows 12 new clade Ib sequences in 7 days from 3 distinct quartiers, suggesting community transmission beyond known clusters.",
    features: [
      { name: "New sequences (7d)", contribution: 0.88, direction: "up" },
      { name: "Geographic spread index", contribution: 0.74, direction: "up" },
      { name: "Contact-tracing coverage", contribution: 0.52, direction: "down" },
      { name: "Lineage diversity (π)", contribution: 0.39, direction: "up" },
    ],
    actions: [
      { label: "Expand sequencing throughput at INRB", priority: "24h" },
      { label: "Ring vaccination in affected quartiers", priority: "24h" },
      { label: "Coordinate cross-border alert (RoC, Angola)", priority: "72h" },
    ],
  },
];