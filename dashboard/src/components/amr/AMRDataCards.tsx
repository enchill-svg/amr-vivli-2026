import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color = "var(--accent)",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-2xl vt-glass p-4 transition hover:vt-neon-border">
      <div className="flex items-start justify-between gap-3">
        <div
          className="rounded-xl border p-2"
          style={{ color, borderColor: `${color}55`, background: `${color}14` }}
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="rounded-full bg-secondary/50 px-2 py-0.5 text-[9px] font-mono text-muted-foreground">
          LIVE
        </span>
      </div>
      <div className="mt-3 text-3xl font-light tracking-tight" style={{ color }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground/80">{sub}</div>}
    </div>
  );
}

export function TinyBar({ value, color = "var(--accent)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

export function RiskPill({ value }: { value: number | null }) {
  if (value == null) {
    return (
      <span
        className="rounded-full px-2 py-0.5 text-[10px] font-mono text-muted-foreground"
        style={{ background: "color-mix(in srgb, var(--muted-foreground) 12%, transparent)" }}
        title="Withheld or bounds-only — insufficient evidence for a scored ranking"
      >
        N/A
      </span>
    );
  }
  const color =
    value >= 85 ? "var(--status-alert)" : value >= 70 ? "var(--status-warn)" : "var(--status-ok)";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-mono"
      style={{ color, background: `${color}1f` }}
    >
      {value.toFixed(0)}
    </span>
  );
}
