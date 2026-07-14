import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { logAudit } from "@/hooks/use-admin";
import heroImg from "@/assets/auth-hero.jpg";
import { Activity, Globe2, Dna, Radio } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Sign in — AMR Life Expectancy Intelligence" }] }),
});

function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [institution, setInstitution] = useState("");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, institution, country, role },
          },
        });
        if (error) throw error;
        await logAudit("auth.signup", "user", undefined, { email, role, country });
        router.navigate({ to: "/pending" });
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          await logAudit("auth.login.failed", "user", undefined, { email });
          throw error;
        }
        await logAudit("auth.login", "user", undefined, { email });

        // Route based on status / role
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const [{ data: profile }, { data: roles }] = await Promise.all([
            supabase.from("profiles").select("status").eq("id", user.id).maybeSingle(),
            supabase.from("user_roles").select("role").eq("user_id", user.id),
          ]);
          const roleList = (roles ?? []).map((r) => r.role);
          const isAdmin = roleList.includes("super_admin") || roleList.includes("admin");
          if (isAdmin) {
            router.navigate({ to: "/admin/dashboard" });
            return;
          }
          if (profile?.status !== "approved") {
            router.navigate({ to: "/pending" });
            return;
          }
        }
      }
      router.navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setError(result.error.message);
  };

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-[#05070A] text-foreground overflow-hidden">
      {/* Left — cinematic hero */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden">
        <img
          src={heroImg}
          alt="African genomic intelligence command center"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/85" />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px 400px at 70% 20%, oklch(0.55 0.18 200 / 0.5), transparent 60%), radial-gradient(700px 500px at 20% 90%, oklch(0.55 0.18 165 / 0.4), transparent 60%)",
          }}
        />
        {/* scanning line */}
        <div className="absolute inset-x-0 top-1/2 h-px bg-cyan-400/40 animate-pulse" />

        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-white">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center text-black font-bold">
              A
            </div>
            AMR Life Expectancy Intelligence
          </Link>
        </div>

        <div className="relative space-y-6 max-w-lg">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur text-[11px] uppercase tracking-widest text-cyan-300 border border-cyan-400/30">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Pan-African Genomic Intelligence
          </div>
          <h1 className="text-4xl xl:text-5xl font-light tracking-tight text-white leading-tight">
            Predict outbreaks{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-emerald-300">
              before they spread.
            </span>
          </h1>
          <p className="text-sm text-white/70 leading-relaxed">
            Genomic surveillance, wastewater intelligence, AI forecasting, and real-time outbreak
            intelligence — powered by the ViGOR Consortium.
          </p>

          <div className="grid grid-cols-4 gap-3 pt-4">
            {[
              { i: Globe2, v: "54", l: "Countries" },
              { i: Dna, v: "182k", l: "Sequences" },
              { i: Activity, v: "27", l: "Pathogens" },
              { i: Radio, v: "412", l: "Nodes" },
            ].map(({ i: Icon, v, l }) => (
              <div
                key={l}
                className="rounded-lg bg-white/5 border border-white/10 backdrop-blur p-3"
              >
                <Icon className="w-3.5 h-3.5 text-cyan-300 mb-1.5" />
                <div className="text-lg font-medium text-white">{v}</div>
                <div className="text-[10px] uppercase tracking-wider text-white/50">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative text-[11px] text-white/40">
          © {new Date().getFullYear()} ViGOR Consortium · Africa CDC · WHO AFRO partners
        </div>
      </div>

      {/* Right — auth card */}
      <div className="relative flex items-center justify-center px-6 py-10 bg-[#05070A]">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(500px 400px at 80% 10%, oklch(0.4 0.15 200 / 0.3), transparent 60%)",
          }}
        />
        <div className="relative w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 shadow-2xl">
            <h2 className="text-2xl font-light tracking-tight text-white">
              {mode === "login"
                ? "Access Command Center"
                : "Join Africa's Disease Intelligence Network"}
            </h2>
            <p className="text-sm text-white/60 mt-1.5 mb-6">
              {mode === "login"
                ? "Sign in to your researcher workspace."
                : "Collaborate with epidemiologists, genomic scientists, and public health teams across the continent."}
            </p>

            <button
              onClick={handleGoogle}
              className="w-full mb-4 py-2.5 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 text-sm font-medium text-white transition"
            >
              Continue with Google
            </button>

            <div className="flex items-center gap-3 my-4 text-[11px] uppercase tracking-widest text-white/40">
              <div className="flex-1 h-px bg-white/10" />
              or with email
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5">
              {mode === "signup" && (
                <>
                  <input
                    required
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={fieldCls}
                  />
                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      placeholder="Organization"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className={fieldCls}
                    />
                    <input
                      placeholder="Country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className={fieldCls}
                    />
                  </div>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className={fieldCls}
                  >
                    <option value="">Select role…</option>
                    <option>Researcher</option>
                    <option>Epidemiologist</option>
                    <option>Lab director</option>
                    <option>Public health official</option>
                    <option>Policy / WHO partner</option>
                  </select>
                </>
              )}
              <input
                required
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldCls}
              />
              <input
                required
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                className={fieldCls}
              />

              {error && <p className="text-xs text-rose-400">{error}</p>}

              <button
                disabled={loading}
                type="submit"
                className="w-full py-2.5 mt-1 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 text-black text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition"
              >
                {loading
                  ? "Please wait…"
                  : mode === "login"
                    ? "Access Command Center"
                    : "Create Research Account"}
              </button>
            </form>

            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="w-full mt-4 text-xs text-white/60 hover:text-white"
            >
              {mode === "login"
                ? "Need an account? Request research access"
                : "Already registered? Sign in"}
            </button>

            <p className="text-[11px] text-white/40 mt-6 text-center leading-relaxed">
              By signing in you agree to ViGOR consortium data-use and research policies.{" "}
              <Link to="/about" className="underline hover:text-white/70">
                Learn more
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

const fieldCls =
  "w-full px-4 py-2.5 rounded-lg bg-white/[0.04] border border-white/10 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 focus:border-cyan-400/40 transition";
