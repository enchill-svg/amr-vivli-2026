import { createFileRoute } from "@tanstack/react-router";
import { Siren, PhoneCall, Plane, Truck } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/emergency")({
  component: EmergencyPage,
  head: () => ({
    meta: [
      { title: "Emergency Response Center — ViralTrack-Afrika" },
      {
        name: "description",
        content:
          "Activation status, deployable assets, and incident command for outbreak response.",
      },
    ],
  }),
});

function EmergencyPage() {
  return (
    <CommandPage
      icon={Siren}
      eyebrow="Activation"
      title="Emergency Response Center"
      subtitle="Coordinated activation surface for rapid response teams, lab deployment, and stockpile logistics."
      kpis={[
        { label: "Activations (active)", value: "3", color: "var(--status-alert)" },
        { label: "Response teams", value: "9 on standby", color: "var(--status-warn)" },
        { label: "Mobile labs", value: "5 ready", color: "var(--status-info)" },
        { label: "Avg dispatch", value: "<6h", color: "var(--status-ok)" },
      ]}
    >
      <div className="grid md:grid-cols-2 gap-3">
        <GlassCard title="Active activations">
          <ul className="space-y-2">
            {[
              { c: "DRC — Mpox cluster, North Kivu", s: "Level 2", color: "var(--status-warn)" },
              { c: "Sudan — Cholera surge, Khartoum", s: "Level 3", color: "var(--status-alert)" },
              { c: "Madagascar — Plague monitoring", s: "Level 1", color: "var(--status-info)" },
            ].map((x) => (
              <li
                key={x.c}
                className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/20 px-3 py-2.5"
              >
                <Siren className="w-4 h-4" style={{ color: x.color }} />
                <span className="text-sm flex-1">{x.c}</span>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: `${x.color}22`, color: x.color }}
                >
                  {x.s}
                </span>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard title="Asset readiness">
          {[
            { icon: Truck, l: "Mobile BSL-3 lab — Nairobi hub", v: "Ready" },
            { icon: Plane, l: "Sample transport — AU charter", v: "Ready" },
            { icon: PhoneCall, l: "24/7 EOC hotline", v: "Online" },
            { icon: Truck, l: "Cold-chain stockpile — Addis", v: "92%" },
          ].map((r) => (
            <div
              key={r.l}
              className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0"
            >
              <r.icon className="w-4 h-4 text-[color:var(--accent)]" />
              <span className="text-sm flex-1">{r.l}</span>
              <span className="text-xs text-[color:var(--status-ok)]">{r.v}</span>
            </div>
          ))}
        </GlassCard>
      </div>
    </CommandPage>
  );
}
