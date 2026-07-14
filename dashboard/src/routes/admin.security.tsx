import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Lock, AlertTriangle, Activity } from "lucide-react";

export const Route = createFileRoute("/admin/security")({
  component: SecurityPage,
  head: () => ({ meta: [{ title: "Security — Admin" }] }),
});

function SecurityPage() {
  const { data } = useQuery({
    queryKey: ["admin-security"],
    queryFn: async () => {
      const { data: audits } = await supabase.from("audit_logs").select("action").limit(500);
      const rows = audits ?? [];
      return {
        failedLogins: rows.filter((r) => r.action === "auth.login.failed").length,
        suspicious: rows.filter((r) => r.action.startsWith("security.")).length,
        approvals: rows.filter((r) => r.action.startsWith("user.")).length,
        totalEvents: rows.length,
      };
    },
    refetchInterval: 20_000,
  });

  const cards = [
    {
      label: "Failed Login Attempts",
      value: data?.failedLogins ?? 0,
      icon: Lock,
      tone: "text-rose-400",
    },
    {
      label: "Suspicious Events",
      value: data?.suspicious ?? 0,
      icon: AlertTriangle,
      tone: "text-amber-300",
    },
    { label: "Admin Actions", value: data?.approvals ?? 0, icon: Shield, tone: "text-cyan-300" },
    {
      label: "Audit Events",
      value: data?.totalEvents ?? 0,
      icon: Activity,
      tone: "text-emerald-300",
    },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-3xl font-light tracking-tight flex items-center gap-3">
          <Shield className="w-6 h-6 text-cyan-300" /> Security
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Authentication, access control, and platform integrity signals.
        </p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-widest text-white/40">{c.label}</div>
              <c.icon className={`w-3.5 h-3.5 ${c.tone}`} />
            </div>
            <div className="text-2xl font-light">{c.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 space-y-3 text-sm">
        <h2 className="text-sm font-medium">Active security controls</h2>
        <ul className="space-y-2 text-white/70 text-[13px]">
          <li>✓ Row-level security enforced on every user-owned table</li>
          <li>✓ Passwords hashed by Supabase Auth (bcrypt/argon2 via GoTrue)</li>
          <li>✓ JWT session tokens with automatic refresh & revocation on sign-out</li>
          <li>
            ✓ Role-based access control (super_admin, admin, analyst, researcher, viewer,
            public_health_officer)
          </li>
          <li>
            ✓ Approval workflow — new signups start in{" "}
            <span className="text-amber-300">pending</span> until reviewed
          </li>
          <li>✓ Audit log of every administrative decision</li>
          <li>✓ Origin-bound HTTP calls (CSRF safe by same-origin policy)</li>
          <li>✓ Leaked-password protection (HIBP) available in auth settings</li>
        </ul>
      </div>
    </div>
  );
}
