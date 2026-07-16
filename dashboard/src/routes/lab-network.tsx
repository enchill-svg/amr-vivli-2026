import { createFileRoute, redirect } from "@tanstack/react-router";
import { FlaskConical } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { AuthGate } from "@/components/vt/AuthGate";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { hasSessionCookie } from "@/lib/session-cookie.functions";

export const Route = createFileRoute("/lab-network")({
  beforeLoad: async () => {
    if (!(await hasSessionCookie())) {
      throw redirect({ to: "/login" });
    }
  },
  component: LabPage,
  head: () => ({
    meta: [
      { title: "Laboratory Network — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content: "Active sentinel & sequencing laboratories across the continent.",
      },
    ],
  }),
});

function LabPage() {
  const { data: sites = [] } = useQuery({
    queryKey: ["lab-network"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sentinel_sites")
        .select("*")
        .eq("status", "active")
        .order("country");
      return data ?? [];
    },
  });

  return (
    <CommandPage
      icon={FlaskConical}
      eyebrow="Network Operations"
      title="Laboratory Network"
      subtitle="Sentinel and sequencing capacity contributing to the Pan-African surveillance network."
      kpis={[
        { label: "Active labs", value: String(sites.length), color: "var(--accent)" },
        {
          label: "Countries",
          value: String(new Set(sites.map((s) => s.country)).size),
          color: "var(--status-info)",
        },
        { label: "Avg turnaround", value: "3.2d", color: "var(--status-ok)" },
        {
          label: "Catchment",
          value: `${(sites.reduce((s, x) => s + (x.population_served ?? 0), 0) / 1e6).toFixed(1)}M`,
          color: "var(--status-warn)",
        },
      ]}
    >
      <AuthGate message="Sign in to view the sentinel laboratory network.">
        <GlassCard title="Sentinel laboratories">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {sites.map((s) => (
              <div key={s.id} className="rounded-lg border border-border/60 bg-secondary/20 p-3">
                <div className="text-sm font-medium">{s.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {s.city ? `${s.city}, ` : ""}
                  {s.country}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] uppercase tracking-wider">
                  <span className="text-[color:var(--status-ok)] flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[color:var(--status-ok)] animate-pulse" />{" "}
                    Online
                  </span>
                  <span className="text-muted-foreground">
                    Pop {(s.population_served ?? 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
            {!sites.length && <p className="text-xs text-muted-foreground">Loading lab network…</p>}
          </div>
        </GlassCard>
      </AuthGate>
    </CommandPage>
  );
}
