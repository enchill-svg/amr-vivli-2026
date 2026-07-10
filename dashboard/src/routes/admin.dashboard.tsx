import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, ShieldAlert, Activity, Database, FileText, AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/dashboard")({
  component: DashboardPage,
  head: () => ({ meta: [{ title: "Command Center — Admin" }] }),
});

function DashboardPage() {
  const metrics = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: async () => {
      const [profiles, alerts, samples, sequences, audits] = await Promise.all([
        supabase.from("profiles").select("id,status,country,created_at"),
        supabase.from("alerts").select("id,severity,status"),
        supabase.from("samples").select("id"),
        supabase.from("sequences").select("id"),
        supabase.from("audit_logs").select("id,action,actor_email,created_at").order("created_at", { ascending: false }).limit(8),
      ]);
      const rows = profiles.data ?? [];
      const bucket = (s: string) => rows.filter((r) => r.status === s).length;
      return {
        totalUsers: rows.length,
        pending: bucket("pending"),
        approved: bucket("approved"),
        rejected: bucket("rejected"),
        suspended: bucket("suspended"),
        activeAlerts: (alerts.data ?? []).filter((a) => a.status === "active" || a.status === "investigating").length,
        totalAlerts: (alerts.data ?? []).length,
        samples: (samples.data ?? []).length,
        sequences: (sequences.data ?? []).length,
        recentAudits: audits.data ?? [],
        countries: new Set(rows.map((r) => r.country).filter(Boolean)).size,
      };
    },
    refetchInterval: 30_000,
  });

  const m = metrics.data;

  const userStats = [
    { label: "Total Users", value: m?.totalUsers ?? 0, icon: Users, tone: "text-cyan-300" },
    { label: "Pending Approvals", value: m?.pending ?? 0, icon: ShieldAlert, tone: "text-amber-300", accent: true },
    { label: "Approved", value: m?.approved ?? 0, icon: Sparkles, tone: "text-emerald-300" },
    { label: "Rejected", value: m?.rejected ?? 0, icon: AlertTriangle, tone: "text-rose-400" },
    { label: "Suspended", value: m?.suspended ?? 0, icon: ShieldAlert, tone: "text-orange-300" },
    { label: "Countries", value: m?.countries ?? 0, icon: TrendingUp, tone: "text-cyan-300" },
  ];
  const platform = [
    { label: "Active Alerts", value: m?.activeAlerts ?? 0, icon: AlertTriangle, tone: "text-rose-400" },
    { label: "Total Alerts", value: m?.totalAlerts ?? 0, icon: Activity, tone: "text-cyan-300" },
    { label: "Samples", value: m?.samples ?? 0, icon: Database, tone: "text-emerald-300" },
    { label: "Sequences", value: m?.sequences ?? 0, icon: FileText, tone: "text-cyan-300" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-light tracking-tight">Command Center</h1>
        <p className="text-sm text-white/50 mt-1">Real-time posture across users, surveillance, and security.</p>
      </header>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3">Users</h2>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
          {userStats.map((s) => <Metric key={s.label} {...s} />)}
        </div>
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-widest text-white/40 mb-3">Platform</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {platform.map((s) => <Metric key={s.label} {...s} />)}
        </div>
      </section>

      <section className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Approval Queue</h3>
            <Link to="/admin/users" className="text-xs text-cyan-300 hover:underline">Review pending →</Link>
          </div>
          <div className="text-4xl font-light text-amber-300">{m?.pending ?? 0}</div>
          <p className="text-xs text-white/50 mt-1">Applications awaiting review.</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Recent admin actions</h3>
            <Link to="/admin/audit" className="text-xs text-cyan-300 hover:underline">Full log →</Link>
          </div>
          <ul className="space-y-2 text-xs">
            {(m?.recentAudits ?? []).map((a) => (
              <li key={a.id} className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-0">
                <div>
                  <div className="text-white">{a.action}</div>
                  <div className="text-white/40">{a.actor_email ?? "system"}</div>
                </div>
                <div className="text-white/40 whitespace-nowrap">
                  {new Date(a.created_at as string).toLocaleTimeString()}
                </div>
              </li>
            ))}
            {(!m?.recentAudits || m.recentAudits.length === 0) && (
              <li className="text-white/40">No recorded actions yet.</li>
            )}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon: Icon, tone, accent }: { label: string; value: number; icon: React.ElementType; tone: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border ${accent ? "border-amber-400/30 bg-amber-500/5" : "border-white/10 bg-white/[0.03]"} backdrop-blur-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
        <Icon className={`w-3.5 h-3.5 ${tone}`} />
      </div>
      <div className="text-2xl font-light text-white">{value}</div>
    </div>
  );
}