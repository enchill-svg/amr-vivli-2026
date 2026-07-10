import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { getLiveCountryTrends } from "@/lib/amr-data.functions";

const colorFor = (score: number) => score >= 85 ? "var(--status-alert)" : score >= 72 ? "var(--status-warn)" : "var(--status-info)";

export function OutbreakTicker() {
  const { data = [] } = useQuery({
    queryKey: ["amr-ticker"],
    queryFn: () => getLiveCountryTrends("all"),
    refetchInterval: 60_000,
  });

  const items = data
    .filter((row) => row.riskScore >= 68)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 14);
  const loop = [...items, ...items];

  return (
    <div className="overflow-hidden border-y border-border/60 bg-card/40 backdrop-blur-sm">
      <div className="flex items-stretch">
        <div className="flex shrink-0 items-center gap-2 border-r border-border/60 bg-[color:var(--accent)]/10 px-4 py-2 text-[11px] font-medium tracking-wider text-[color:var(--accent)]">
          <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE AMR
        </div>
        <div className="relative flex-1 overflow-hidden">
          <div className="flex animate-[ticker_70s_linear_infinite] items-center gap-8 whitespace-nowrap py-2 hover:[animation-play-state:paused]">
            {loop.map((t, i) => {
              const c = colorFor(t.riskScore);
              return (
                <div key={`${t.iso3}-${t.pathogenType}-${i}`} className="flex items-center gap-2 text-xs">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />
                  <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: c }}>{t.trendLabel}</span>
                  <span className="text-foreground/90">{t.country}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-foreground/70">{t.dominantOrganism}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{t.dominantDrug} risk {t.riskScore.toFixed(0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
