import { Link } from "@tanstack/react-router";
import { Lock, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAdmin } from "@/hooks/use-admin";

export function AuthGate({ children, message }: { children: React.ReactNode; message?: string }) {
  const { user, loading } = useAuth();
  const { status, isAdmin, loading: adminLoading } = useAdmin();
  if (loading || (user && adminLoading)) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }
  if (!user) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-secondary flex items-center justify-center mb-3">
          <Lock className="w-5 h-5 text-[color:var(--accent)]" />
        </div>
        <h3 className="text-base font-medium mb-1">Researcher access required</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {message ?? "Sign in to view and manage surveillance datasets."}
        </p>
        <Link
          to="/login"
          className="inline-block px-5 py-2 rounded-full bg-[color:var(--accent)] text-[color:var(--accent-foreground)] text-sm font-medium hover:opacity-90"
        >
          Sign in to continue
        </Link>
      </div>
    );
  }
  if (!isAdmin && status && status !== "approved") {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-500/5 p-8 text-center">
        <div className="w-12 h-12 mx-auto rounded-full bg-amber-500/10 border border-amber-400/30 flex items-center justify-center mb-3">
          <Clock className="w-5 h-5 text-amber-300" />
        </div>
        <h3 className="text-base font-medium mb-1 capitalize">Account {status}</h3>
        <p className="text-xs text-muted-foreground mb-4">
          {status === "pending"
            ? "Your account is awaiting administrator approval."
            : status === "rejected"
              ? "Your access request was declined."
              : "Your account is currently suspended."}
        </p>
        <Link to="/pending" className="inline-block px-5 py-2 rounded-full bg-amber-400/20 text-amber-100 text-sm font-medium border border-amber-400/30">
          View status
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}