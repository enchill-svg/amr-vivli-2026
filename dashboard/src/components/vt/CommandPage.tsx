import type { LucideIcon } from "lucide-react";
import { PageShell } from "./PageShell";

export type Kpi = { label: string; value: string; color?: string; sub?: string };

export function CommandPage({
  icon: Icon,
  eyebrow,
  title,
  subtitle,
  kpis,
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  subtitle: string;
  kpis?: Kpi[];
  children: React.ReactNode;
}) {
  return (
    <PageShell>
      <div className="space-y-5">
        <header className="relative overflow-hidden rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-6">
          <div
            className="absolute inset-0 pointer-events-none opacity-50"
            style={{
              background:
                "radial-gradient(500px 240px at 10% 20%, oklch(0.55 0.2 200 / 0.2), transparent 60%)",
            }}
          />
          <div className="relative flex items-start gap-4">
            <div
              className="w-12 h-12 rounded-xl border border-[color:var(--accent)]/40 flex items-center justify-center bg-background/40"
              style={{
                boxShadow:
                  "0 0 18px oklch(0.78 0.18 200 / 0.25), inset 0 0 10px oklch(0.78 0.18 200 / 0.15)",
              }}
            >
              <Icon className="w-6 h-6 text-[color:var(--accent)]" />
            </div>
            <div className="flex-1">
              <div className="text-[10px] tracking-[0.2em] uppercase text-[color:var(--accent)]">
                {eyebrow}
              </div>
              <h1 className="text-2xl font-light tracking-tight mt-1">{title}</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{subtitle}</p>
            </div>
          </div>
          {kpis && kpis.length > 0 && (
            <div className="relative mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {kpis.map((k) => (
                <div
                  key={k.label}
                  className="rounded-lg border border-border/60 bg-background/30 p-3"
                >
                  <div
                    className="text-2xl font-light"
                    style={{ color: k.color ?? "var(--accent)" }}
                  >
                    {k.value}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
                    {k.label}
                  </div>
                  {k.sub && (
                    <div className="text-[10px] text-muted-foreground/80 mt-0.5">{k.sub}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </header>
        {children}
      </div>
    </PageShell>
  );
}

export function GlassCard({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-border bg-card/60 backdrop-blur-sm p-5 ${className}`}>
      {(title || action) && (
        <div className="flex items-start justify-between mb-4">
          <div>
            {title && <h2 className="text-sm font-medium tracking-wide">{title}</h2>}
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
