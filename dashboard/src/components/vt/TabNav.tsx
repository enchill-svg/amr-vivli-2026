import { Link } from "@tanstack/react-router";
import { AlertTriangle, BarChart3, Brain, Database, Dna, FileText, FlaskConical, GitCompare, Globe2, HeartPulse, LineChart, Landmark, Upload } from "lucide-react";

const tabs = [
  { to: "/", icon: BarChart3, label: "Overview" },
  { to: "/alerts", icon: Globe2, label: "Risk Map" },
  { to: "/countries", icon: Landmark, label: "Countries" },
  { to: "/pathogens", icon: FlaskConical, label: "Resistance" },
  { to: "/lineages", icon: Dna, label: "Evolution" },
  { to: "/epidemiology", icon: HeartPulse, label: "Life Exp." },
  { to: "/policy", icon: GitCompare, label: "Simulator" },
  { to: "/marketplace", icon: LineChart, label: "Funding" },
  { to: "/forecasting", icon: Brain, label: "ML" },
  { to: "/ingest", icon: Upload, label: "Ingest" },
  { to: "/reports", icon: FileText, label: "Reports" },
  { to: "/methodology", icon: Database, label: "Methods" },
] as const;

export function TabNav() {
  return (
    <nav className="px-6 pb-4">
      <div className="vt-glass grid grid-cols-4 gap-1 rounded-2xl p-1.5 md:grid-cols-12">
        {tabs.map((t) => (
          <Link
            key={t.to}
            to={t.to}
            activeOptions={{ exact: true }}
            className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium text-muted-foreground transition-all hover:bg-secondary/40 hover:text-foreground"
            activeProps={{ className: "flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13px] font-medium bg-[color:var(--accent)]/15 text-[color:var(--accent)] shadow-[0_0_18px_-8px_var(--accent)]" }}
          >
            <t.icon className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden md:inline">{t.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
