import {
  Activity,
  Dna,
  Droplet,
  Globe2,
  ShieldAlert,
  Sparkles,
  FlaskConical,
  Brain,
} from "lucide-react";
import { useEffect, useState } from "react";

type Kpi = {
  icon: React.ElementType;
  label: string;
  value: number;
  suffix?: string;
  color: string;
  trend: "up" | "down" | "flat";
};

function useCounter(target: number, ms = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function KpiCell({ k }: { k: Kpi }) {
  const v = useCounter(k.value);
  return (
    <div className="flex items-center gap-3 px-4 py-3 min-w-[170px]">
      <div
        className="w-9 h-9 rounded-lg grid place-items-center"
        style={{ background: `${k.color}1f`, color: k.color }}
      >
        <k.icon className="w-4 h-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          {k.label}
        </div>
        <div className="font-display text-lg leading-tight tabular-nums">
          {v.toLocaleString()}
          {k.suffix && <span className="text-xs text-muted-foreground ml-1">{k.suffix}</span>}
        </div>
      </div>
    </div>
  );
}

export function KpiStrip() {
  const kpis: Kpi[] = [
    { icon: Dna, label: "Sequences", value: 184392, color: "#22d3ee", trend: "up" },
    { icon: ShieldAlert, label: "Active outbreaks", value: 27, color: "#f97316", trend: "up" },
    { icon: Globe2, label: "Countries", value: 54, color: "#a78bfa", trend: "flat" },
    { icon: FlaskConical, label: "Pathogens", value: 38, color: "#34d399", trend: "up" },
    { icon: Activity, label: "Variants of concern", value: 12, color: "#f43f5e", trend: "up" },
    { icon: Droplet, label: "Wastewater sites", value: 412, color: "#38bdf8", trend: "up" },
    {
      icon: Brain,
      label: "AI risk score",
      value: 74,
      suffix: "/100",
      color: "#facc15",
      trend: "up",
    },
  ];
  return (
    <div className="vt-glass rounded-2xl overflow-hidden mb-5">
      <div className="flex items-stretch divide-x divide-border/40 overflow-x-auto">
        {kpis.map((k) => (
          <KpiCell key={k.label} k={k} />
        ))}
        <div className="flex items-center gap-2 px-4 ml-auto text-[11px] text-muted-foreground whitespace-nowrap">
          <Sparkles className="w-3.5 h-3.5 text-[color:var(--accent)]" />
          Live · updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>
    </div>
  );
}

export function InsightPanel({
  items,
}: {
  items: { title: string; body: string; tag?: string }[];
}) {
  return (
    <div className="vt-glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Brain className="w-4 h-4 text-[color:var(--accent)]" />
        <h3 className="text-sm font-medium tracking-tight">AI Intelligence Brief</h3>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
          auto-generated
        </span>
      </div>
      <ul className="space-y-3">
        {items.map((i) => (
          <li key={i.title} className="border-l-2 border-[color:var(--accent)]/60 pl-3">
            <div className="flex items-center gap-2">
              <div className="text-sm font-medium">{i.title}</div>
              {i.tag && (
                <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/60">
                  {i.tag}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{i.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
