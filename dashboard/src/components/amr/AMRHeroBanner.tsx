import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  Brain,
  Database,
  FileText,
  Globe2,
  ShieldAlert,
} from "lucide-react";
import { getExecutiveKpis } from "@/lib/amr-data.functions";

export function AMRHeroBanner() {
  const { data } = useQuery({
    queryKey: ["amr-executive-kpis"],
    queryFn: getExecutiveKpis,
    refetchInterval: 60_000,
  });
  const kpis = data ?? {
    countries: 0,
    highRisk: 0,
    rising: 0,
    avgResistance: 0,
    avgRiskScore: 0,
    avgLifeGain: null as number | null,
    lifeGainSampleCount: 0,
    fundingGap: 0,
    isolates: 0,
  };
  const platformRisk = Math.round(kpis.avgRiskScore);
  const color =
    platformRisk >= 80
      ? "var(--status-alert)"
      : platformRisk >= 65
        ? "var(--status-warn)"
        : "var(--status-ok)";

  return (
    <section className="relative mb-4 overflow-hidden rounded-2xl border border-border bg-card/40 p-6 backdrop-blur-sm">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(650px 300px at 12% 12%, oklch(0.56 0.18 200 / 0.26), transparent 65%), radial-gradient(600px 300px at 88% 78%, oklch(0.66 0.2 25 / 0.16), transparent 65%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 vt-grid-bg opacity-40" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr_330px]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--accent)]/40 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-[color:var(--accent)]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[color:var(--accent)]" />
            AMR · Life expectancy · intervention intelligence
          </div>
          <h1 className="mt-4 max-w-4xl text-3xl font-light leading-tight tracking-tight md:text-5xl">
            A scientific command center for identifying where{" "}
            <span className="font-normal text-[color:var(--accent)]">
              resistance is shortening lives
            </span>{" "}
            and which interventions can reverse it.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Integrates bacterial and fungal surveillance, MIC trajectories, external health
            indicators, R&D funding, statistical models, and explainable policy recommendations in
            one reproducible platform.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/alerts"
              className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--accent)] px-4 py-2 text-xs font-medium text-[color:var(--accent-foreground)] hover:opacity-90"
            >
              <Globe2 className="h-3.5 w-3.5" /> Open live map
            </Link>
            <Link
              to="/policy"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-medium hover:border-[color:var(--accent)]/60"
            >
              <Brain className="h-3.5 w-3.5" /> View intervention rankings
            </Link>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-4 py-2 text-xs font-medium hover:border-[color:var(--accent)]/60"
            >
              <FileText className="h-3.5 w-3.5" /> Generate reports{" "}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="mt-6 grid max-w-3xl grid-cols-2 gap-3 md:grid-cols-4">
            <HeroMini
              icon={Globe2}
              value={kpis.countries.toLocaleString()}
              label="Countries monitored"
              color="var(--accent)"
            />
            <HeroMini
              icon={ShieldAlert}
              value={String(kpis.highRisk)}
              label="High-risk countries"
              color="var(--status-alert)"
            />
            <HeroMini
              icon={Activity}
              value={`${Math.round(kpis.avgResistance * 100)}%`}
              label="Mean resistance"
              color="var(--status-warn)"
            />
            <HeroMini
              icon={Database}
              value={kpis.isolates.toLocaleString()}
              label="Isolate signals"
              color="var(--status-info)"
            />
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background/45 p-5 backdrop-blur-sm">
          <div className="text-center text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Composite AMR impact score
          </div>
          <RiskRing value={platformRisk} color={color} />
          <div
            className="text-center text-xs font-medium uppercase tracking-[0.18em]"
            style={{ color }}
          >
            {platformRisk >= 80
              ? "Critical attention"
              : platformRisk >= 65
                ? "Elevated"
                : "Monitored"}
          </div>
          <p className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">
            Equal-weight average of resistance burden, evolutionary trajectory, and health-system
            capacity percentiles, across all countries.
          </p>
          <div className="mt-4 rounded-xl border border-border/60 bg-secondary/20 p-3 text-xs text-muted-foreground">
            <b className="text-foreground">Illustrative framing:</b> diagnostics and stewardship
            remain the usual first levers in high-trajectory settings — not a ranked claim from this
            run&apos;s gated intervention table (all measured LE scenarios are currently withheld).
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroMini({
  icon: Icon,
  value,
  label,
  color,
}: {
  icon: typeof Globe2;
  value: string;
  label: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/35 p-3">
      <Icon className="h-4 w-4" style={{ color }} />
      <div className="mt-2 text-2xl font-light" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function RiskRing({ value, color }: { value: number; color: string }) {
  const r = 64;
  const c = 2 * Math.PI * r;
  const dash = (value / 100) * c;
  return (
    <svg className="mx-auto mt-4" width="180" height="180" viewBox="0 0 180 180">
      <circle cx="90" cy="90" r={r} fill="none" stroke="oklch(0.3 0.04 250)" strokeWidth="9" />
      <circle
        cx="90"
        cy="90"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${c - dash}`}
        transform="rotate(-90 90 90)"
        style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dasharray 1s ease" }}
      />
      <text x="90" y="93" textAnchor="middle" fontSize="40" fill={color} fontWeight="300">
        {value}
      </text>
      <text
        x="90"
        y="116"
        textAnchor="middle"
        fontSize="10"
        fill="oklch(0.68 0.03 230)"
        letterSpacing="2"
      >
        / 100
      </text>
    </svg>
  );
}
