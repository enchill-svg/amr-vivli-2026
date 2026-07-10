import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Brain, Upload, Eye, FileText, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

function useCounter(target: number, duration = 1200) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setV(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

export function HeroBanner() {
  const { data: stats } = useQuery({
    queryKey: ["hero-stats"],
    queryFn: async () => {
      const [{ count: alerts }, { count: sites }, { count: seq }, { data: highSev }] = await Promise.all([
        supabase.from("alerts").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("sentinel_sites").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("sequences").select("*", { count: "exact", head: true }),
        supabase.from("alerts").select("severity").eq("status", "active"),
      ]);
      const sev = (highSev ?? []) as Array<{ severity: string }>;
      const sevMap: Record<string, number> = { low: 1, moderate: 2, high: 4, critical: 7, extreme: 10 };
      const weight = sev.reduce((acc, s) => acc + (sevMap[s.severity] ?? 1), 0);
      const risk = Math.min(98, Math.round(28 + weight * 2.1));
      return { alerts: alerts ?? 0, sites: sites ?? 0, seq: seq ?? 0, risk };
    },
    refetchInterval: 60_000,
  });

  const risk = useCounter(stats?.risk ?? 0);
  const alerts = useCounter(stats?.alerts ?? 0);
  const sites = useCounter(stats?.sites ?? 0);
  const seq = useCounter(stats?.seq ?? 0);

  const riskColor = risk > 75 ? "var(--status-alert)" : risk > 50 ? "var(--status-warn)" : "var(--status-ok)";
  const riskLabel = risk > 75 ? "ELEVATED" : risk > 50 ? "MODERATE" : "BASELINE";

  return (
    <section className="relative rounded-2xl border border-border bg-card/40 backdrop-blur-sm overflow-hidden mb-4">
      <div
        className="absolute inset-0 opacity-60 pointer-events-none"
        style={{
          background:
            "radial-gradient(600px 280px at 15% 20%, oklch(0.55 0.2 200 / 0.25), transparent 60%), radial-gradient(500px 300px at 85% 80%, oklch(0.55 0.22 320 / 0.18), transparent 65%)",
        }}
      />
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
        backgroundImage: "linear-gradient(oklch(0.78 0.18 200) 1px, transparent 1px), linear-gradient(90deg, oklch(0.78 0.18 200) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
      }} />

      <div className="relative grid md:grid-cols-[1fr_280px] gap-6 p-6">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase text-[color:var(--accent)] border border-[color:var(--accent)]/40 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--accent)] animate-pulse" />
            Pan-African Biosurveillance Network · Realtime
          </div>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight leading-tight">
            Genomic & epidemiological intelligence for{" "}
            <span className="text-[color:var(--accent)] font-normal">54 African nations</span>.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Wastewater signals, viral sequencing, lineage tracking, and AI outbreak forecasting — fused into a single command center for public health response.
          </p>

          <div className="flex flex-wrap gap-2 pt-2">
            <Link to="/" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[color:var(--accent)] text-[color:var(--accent-foreground)] text-xs font-medium hover:opacity-90">
              <Eye className="w-3.5 h-3.5" /> Explore Surveillance
            </Link>
            <Link to="/uploads" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card/60 text-xs font-medium hover:border-[color:var(--accent)]/60">
              <Upload className="w-3.5 h-3.5" /> Upload Genomic Data
            </Link>
            <Link to="/forecasting" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card/60 text-xs font-medium hover:border-[color:var(--accent)]/60">
              <Brain className="w-3.5 h-3.5" /> AI Forecast
            </Link>
            <Link to="/reports" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-card/60 text-xs font-medium hover:border-[color:var(--accent)]/60">
              <FileText className="w-3.5 h-3.5" /> Generate Report <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-3 max-w-md">
            <Mini value={alerts} label="Active alerts" color="oklch(0.7 0.22 25)" />
            <Mini value={sites} label="Sentinel sites" color="oklch(0.78 0.17 155)" />
            <Mini value={seq} label="Sequences" color="oklch(0.78 0.18 200)" />
          </div>
        </div>

        {/* Risk gauge */}
        <div className="relative rounded-xl border border-border bg-background/40 p-4 flex flex-col items-center justify-center">
          <div className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground mb-1">AI Outbreak Risk Score</div>
          <RiskRing value={risk} color={riskColor} />
          <div className="mt-2 text-[11px] tracking-wider font-medium" style={{ color: riskColor }}>{riskLabel}</div>
          <div className="mt-3 text-[10px] text-muted-foreground text-center leading-snug px-2">
            Composite signal from wastewater · sequencing · clinical alerts, refreshed continuously.
          </div>
          <Link to="/forecasting" className="mt-3 text-[10px] tracking-wider text-[color:var(--accent)] inline-flex items-center gap-1">
            <Activity className="w-3 h-3" /> VIEW FORECAST
          </Link>
        </div>
      </div>
    </section>
  );
}

function Mini({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/30 px-3 py-2">
      <div className="text-xl font-light" style={{ color }}>{value.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  );
}

function RiskRing({ value, color }: { value: number; color: string }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150">
      <circle cx="75" cy="75" r={r} fill="none" stroke="oklch(0.3 0.04 250)" strokeWidth="8" />
      <circle
        cx="75" cy="75" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 75 75)"
        style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 1s ease" }}
      />
      <text x="75" y="78" textAnchor="middle" fontSize="32" fill={color} fontWeight="300">{value}</text>
      <text x="75" y="98" textAnchor="middle" fontSize="9" fill="oklch(0.68 0.03 230)" letterSpacing="2">/ 100</text>
    </svg>
  );
}