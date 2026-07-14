import { useQuery } from "@tanstack/react-query";
import { AppHeader } from "./AppHeader";
import { TabNav } from "./TabNav";
import { OutbreakTicker } from "./OutbreakTicker";
import { Info } from "lucide-react";
import { loadDashboardBundle } from "@/lib/published-data";

export function PageShell({
  children,
  showTabs = true,
}: {
  children: React.ReactNode;
  showTabs?: boolean;
}) {
  const { data: bundle } = useQuery({
    queryKey: ["dashboard-bundle"],
    queryFn: loadDashboardBundle,
  });
  const runId = bundle?.pipeline_run?.run_id;
  const generated = bundle?.generated_at;

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div
        className="pointer-events-none fixed inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(800px 500px at 20% 10%, oklch(0.3 0.1 200 / 0.25), transparent 60%), radial-gradient(700px 400px at 90% 90%, oklch(0.3 0.12 25 / 0.16), transparent 60%)",
        }}
      />
      <div className="relative">
        <AppHeader />
        <OutbreakTicker />
        {showTabs && <TabNav />}
        <main className="px-6 py-5">{children}</main>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 px-6 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            AMR Life Expectancy Intelligence <Info className="h-3 w-3" />
          </div>
          <div>Publication-grade decision support · transparent assumptions</div>
          <div>
            {runId ? `Pipeline ${runId}` : "Pipeline —"}
            {generated ? ` · bundle ${generated.slice(0, 10)}` : ""}
          </div>
        </footer>
      </div>
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur-sm">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h2 className="text-base font-medium">{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
