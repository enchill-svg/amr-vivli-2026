import { createFileRoute, Link, useRouter, redirect } from "@tanstack/react-router";
import { Clock, LogOut, ShieldCheck, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAdmin } from "@/hooks/use-admin";
import { useAuth } from "@/hooks/use-auth";
import { hasSessionCookie } from "@/lib/session-cookie.functions";

export const Route = createFileRoute("/pending")({
  beforeLoad: async () => {
    if (!(await hasSessionCookie())) {
      throw redirect({ to: "/login" });
    }
  },
  component: PendingPage,
  head: () => ({ meta: [{ title: "Approval pending — AMR Life Expectancy Intelligence" }] }),
});

function PendingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { status, isAdmin } = useAdmin();

  if (!loading && !user) {
    return <Navigate />;
  }

  if (status === "approved" || isAdmin) {
    router.navigate({ to: "/" });
  }

  const rejected = status === "rejected";
  const suspended = status === "suspended";

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 text-center">
        <div className="mx-auto w-14 h-14 rounded-full bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center mb-4">
          {rejected ? (
            <ShieldCheck className="w-6 h-6 text-rose-400" />
          ) : (
            <Clock className="w-6 h-6 text-cyan-300" />
          )}
        </div>
        <h1 className="text-2xl font-light tracking-tight mb-2">
          {rejected
            ? "Application not approved"
            : suspended
              ? "Account suspended"
              : "Awaiting administrator approval"}
        </h1>
        <p className="text-sm text-white/60 leading-relaxed mb-6">
          {rejected
            ? "Your AMR Life Expectancy Intelligence research access request was declined. Contact the AMR Life Expectancy Intelligence administrators if you believe this is an error."
            : suspended
              ? "Your account has been suspended. Please reach out to your administrator for reinstatement."
              : "Thanks for signing up. A super administrator will review your credentials shortly. You'll receive an email as soon as your account is approved."}
        </p>
        <div className="grid grid-cols-3 gap-3 text-left mb-6 text-[11px]">
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="uppercase tracking-wider text-white/40">Status</div>
            <div className="text-cyan-300 mt-1 capitalize">{status ?? "…"}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="uppercase tracking-wider text-white/40">Account</div>
            <div className="text-white mt-1 truncate">{user?.email ?? "—"}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="uppercase tracking-wider text-white/40">Contact</div>
            <div className="text-white mt-1 inline-flex items-center gap-1">
              <Mail className="w-3 h-3" /> admin
            </div>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Link
            to="/"
            className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-sm hover:bg-white/10"
          >
            Public site
          </Link>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 text-black text-sm font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

function Navigate() {
  if (typeof window !== "undefined") window.location.replace("/login");
  return null;
}
