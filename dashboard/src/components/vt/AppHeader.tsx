import { Link } from "@tanstack/react-router";
import { Moon, Sun, Globe2, ChevronDown, Sparkles, ShieldCheck, Upload, Brain } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { NotificationBell } from "./NotificationBell";
import { SearchBar } from "./SearchBar";

export function AppHeader() {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex items-center gap-6 border-b border-border/60 bg-background/70 px-6 py-3.5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/50">
      <Link to="/" className="group flex items-center gap-3">
        <div
          className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-[color:var(--ring)]/40 bg-gradient-to-br from-[color:var(--accent)]/15 to-transparent transition-transform group-hover:scale-105"
          style={{ boxShadow: "0 0 24px -6px var(--accent), inset 0 0 14px -8px var(--accent)" }}
        >
          <Globe2 className="h-5 w-5 text-[color:var(--accent)]" strokeWidth={1.75} />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[color:var(--status-ok)] ring-2 ring-background" />
        </div>
        <div className="leading-tight">
          <h1 className="text-[17px] font-semibold tracking-tight">
            AMR<span className="text-[color:var(--accent)]">·LifeIntel</span>
          </h1>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Resistance · Life Expectancy Command
          </p>
        </div>
      </Link>

      <SearchBar />

      <nav className="hidden items-center gap-1 text-sm lg:flex">
        {[
          { to: "/alerts", label: "Risk Map" },
          { to: "/countries", label: "Countries" },
          { to: "/pathogens", label: "Resistance" },
          { to: "/lineages", label: "Evolution" },
          { to: "/policy", label: "Interventions" },
          { to: "/reports", label: "Reports" },
        ].map((l) => (
          <Link
            key={l.to}
            to={l.to}
            activeProps={{ className: "rounded-md bg-secondary/60 px-3 py-1.5 text-foreground" }}
            className="rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
          >
            {l.label}
          </Link>
        ))}
        <div className="group relative">
          <button type="button" className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-muted-foreground hover:bg-secondary/40 hover:text-foreground">
            More <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <div className="absolute right-0 top-full z-50 hidden pt-2 group-hover:block">
            <div className="vt-glass min-w-[240px] rounded-xl p-2 shadow-2xl">
              <Link to="/epidemiology" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">Life Expectancy Explorer</Link>
              <Link to="/marketplace" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">Funding Gap Explorer</Link>
              <Link to="/forecasting" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">ML Insights</Link>
              <Link to="/ingest" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">Data Ingestion</Link>
              <Link to="/methodology" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">Methodology</Link>
              <Link to="/api-docs" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">API Docs</Link>
              <Link to="/assistant" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">AI Assistant</Link>
              <Link to="/admin/dashboard" className="block rounded px-3 py-1.5 text-sm hover:bg-secondary/60">Admin Console</Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <Link to="/ingest" className="hidden items-center gap-1.5 rounded-md border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/10 px-2.5 py-1.5 text-xs font-medium text-[color:var(--accent)] hover:bg-[color:var(--accent)]/20 md:inline-flex">
          <Upload className="h-3.5 w-3.5" /> Upload
        </Link>
        <Link to="/forecasting" className="hidden items-center gap-1.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-400/20 md:inline-flex">
          <Brain className="h-3.5 w-3.5" /> ML
        </Link>
        <div className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-mono xl:flex">
          <kbd className="rounded bg-secondary/60 px-1 py-0.5 text-foreground">⌘</kbd>
          <kbd className="rounded bg-secondary/60 px-1 py-0.5 text-foreground">K</kbd>
        </div>
        <NotificationBell />
        <Link to="/admin/dashboard" className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-card/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground md:inline-flex">
          <ShieldCheck className="h-3.5 w-3.5" /> Secure
        </Link>
        <button onClick={toggle} className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground" aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </button>
        <Link to="/assistant" className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--primary)] px-4 py-2 text-sm font-medium text-[color:var(--accent-foreground)] shadow-lg shadow-[color:var(--accent)]/20 hover:opacity-90">
          <Sparkles className="h-3.5 w-3.5" /> Ask AI
        </Link>
      </div>
    </header>
  );
}
