import { Link } from "@tanstack/react-router";
import { Moon, Sun, Globe2 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
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
        </div>
        <div className="leading-tight">
          <h1 className="text-[17px] font-semibold tracking-tight">
            AMR<span className="text-[color:var(--accent)]">·LifeIntel</span>
          </h1>
          <p className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
            Resistance · Life Expectancy Intelligence
          </p>
        </div>
      </Link>

      <SearchBar />

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={toggle}
          className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
          aria-label="Toggle theme"
        >
          {theme === "dark" ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
        </button>
      </div>
    </header>
  );
}
