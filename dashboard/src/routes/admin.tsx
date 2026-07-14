import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Shield,
  ScrollText,
  KeyRound,
  LogOut,
  Activity,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin } from "@/hooks/use-admin";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
  head: () => ({ meta: [{ title: "Admin — ViralTrack-Afrika" }] }),
});

function AdminLayout() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { isAdmin, loading: adminLoading, isSuperAdmin, profile } = useAdmin();

  if (!loading && !user) {
    if (typeof window !== "undefined") window.location.replace("/login");
    return null;
  }

  if (loading || adminLoading) {
    return (
      <div className="min-h-screen bg-[#05070A] text-white/60 flex items-center justify-center text-sm">
        Verifying credentials…
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#05070A] text-white flex items-center justify-center p-6">
        <div className="max-w-md text-center rounded-2xl border border-rose-400/20 bg-rose-500/5 p-8">
          <Shield className="w-8 h-8 text-rose-400 mx-auto mb-3" />
          <h1 className="text-lg font-medium">Restricted area</h1>
          <p className="text-sm text-white/60 mt-2">
            You need administrator privileges to access the ViralTrack Afrika command center.
          </p>
          <Link to="/" className="inline-block mt-5 text-cyan-300 text-sm hover:underline">
            ← Back to platform
          </Link>
        </div>
      </div>
    );
  }

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  const nav = [
    { to: "/admin/dashboard", label: "Command Center", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/roles", label: "Roles & Permissions", icon: KeyRound },
    { to: "/admin/security", label: "Security", icon: Shield },
    { to: "/admin/audit", label: "Audit Log", icon: ScrollText },
  ];

  return (
    <div className="min-h-screen bg-[#05070A] text-white flex">
      <div
        className="pointer-events-none fixed inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(700px 500px at 15% 10%, oklch(0.4 0.16 200 / 0.25), transparent 60%), radial-gradient(700px 500px at 85% 90%, oklch(0.4 0.16 165 / 0.18), transparent 60%)",
        }}
      />
      <aside className="relative w-64 shrink-0 border-r border-white/10 bg-white/[0.02] backdrop-blur-xl flex flex-col">
        <Link
          to="/admin/dashboard"
          className="p-5 flex items-center gap-2.5 border-b border-white/10"
        >
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-400 to-emerald-400 text-black font-bold flex items-center justify-center">
            V
          </div>
          <div>
            <div className="text-sm font-medium leading-none">ViralTrack</div>
            <div className="text-[10px] uppercase tracking-widest text-cyan-300 mt-1">
              Admin Console
            </div>
          </div>
        </Link>
        <nav className="p-3 space-y-1 flex-1">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeProps={{
                className:
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm bg-cyan-400/10 text-cyan-100 border border-cyan-400/20",
              }}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/[0.04] border border-transparent"
            >
              <n.icon className="w-4 h-4" /> {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="rounded-lg bg-white/[0.03] border border-white/10 p-3 mb-2">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-1">
              Signed in as
            </div>
            <div className="text-sm truncate">{profile?.full_name ?? user?.email}</div>
            <div className="text-[10px] text-white/50 truncate">{user?.email}</div>
            <div className="mt-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-300">
              <Sparkles className="w-3 h-3" />
              {isSuperAdmin ? "Super Admin" : "Administrator"}
            </div>
          </div>
          <div className="flex gap-1.5">
            <Link
              to="/"
              className="flex-1 px-2.5 py-1.5 rounded-md text-xs text-center border border-white/10 hover:bg-white/[0.04]"
            >
              Platform
            </Link>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-white/10 hover:bg-white/[0.04]"
            >
              <LogOut className="w-3 h-3" /> Out
            </button>
          </div>
        </div>
      </aside>
      <main className="relative flex-1 min-w-0">
        <div className="sticky top-0 z-10 flex items-center gap-3 px-6 py-3.5 border-b border-white/10 bg-[#05070A]/70 backdrop-blur-xl">
          <Activity className="w-4 h-4 text-cyan-300" />
          <div className="text-xs uppercase tracking-widest text-white/50">
            ViralTrack·Afrika · Administration
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live systems
          </span>
        </div>
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
