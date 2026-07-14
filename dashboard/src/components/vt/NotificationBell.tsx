import { Bell, AlertCircle, Settings } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { getLiveCountryTrends } from "@/lib/amr-data.functions";

type Alert = {
  id: string;
  title: string;
  country: string;
  signal: string;
  severity: string;
  detected_at: string;
};

const severityColor = (severity: string) =>
  severity === "critical"
    ? "#ff3d6e"
    : severity === "high"
      ? "#ff8a3d"
      : severity === "moderate"
        ? "#f5c451"
        : "#3ee6a8";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data: alerts = [] } = useQuery({
    queryKey: ["amr-notifications"],
    queryFn: async (): Promise<Alert[]> => {
      const rows = await getLiveCountryTrends("all");
      return rows
        .filter((row) => row.riskScore >= 75 || row.trendLabel === "surging")
        .sort((a, b) => b.riskScore - a.riskScore)
        .slice(0, 10)
        .map((row) => ({
          id: `${row.iso3}-${row.pathogenType}`,
          title: `${row.trendLabel.toUpperCase()} AMR signal`,
          country: row.country,
          signal: `${row.dominantOrganism} · ${row.dominantDrug}`,
          severity: row.riskScore >= 88 ? "critical" : row.riskScore >= 78 ? "high" : "moderate",
          detected_at: `${row.latestYear}-12-31T00:00:00Z`,
        }));
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 text-muted-foreground hover:text-foreground"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {alerts.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--status-alert)] px-1 text-[10px] text-white">
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[1000] mt-2 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="text-sm font-medium">AMR alerts</div>
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings className="h-3.5 w-3.5" />
            </Link>
          </div>
          <ul className="divide-y divide-border">
            {alerts.map((a) => (
              <li key={a.id} className="p-3 hover:bg-secondary/40">
                <Link to="/alerts" onClick={() => setOpen(false)} className="flex gap-3">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    style={{ color: severityColor(a.severity) }}
                  />
                  <div className="min-w-0">
                    <div className="truncate text-sm">{a.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {a.signal} · {a.country}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
