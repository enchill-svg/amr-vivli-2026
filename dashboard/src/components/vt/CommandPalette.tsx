import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Activity,
  Bot,
  Brain,
  Database,
  FileText,
  FlaskConical,
  GitCompare,
  Globe2,
  HeartPulse,
  Home,
  Landmark,
  LineChart,
  Map,
  Sparkles,
  Upload,
} from "lucide-react";

type Item = {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  hint?: string;
};

const ITEMS: Item[] = [
  { label: "Executive Overview", to: "/", icon: Home, group: "Command" },
  { label: "Live Global Risk Map", to: "/alerts", icon: Map, group: "Command", hint: "WFP-style" },
  { label: "Country Explorer", to: "/countries", icon: Globe2, group: "Explore" },
  { label: "Resistance Explorer", to: "/pathogens", icon: FlaskConical, group: "Explore" },
  { label: "Evolution Explorer", to: "/lineages", icon: Activity, group: "Explore" },
  { label: "Life Expectancy Explorer", to: "/epidemiology", icon: HeartPulse, group: "Explore" },
  { label: "Intervention Simulator", to: "/policy", icon: GitCompare, group: "Policy" },
  { label: "Funding Gap Explorer", to: "/marketplace", icon: Landmark, group: "Policy" },
  { label: "Machine Learning Insights", to: "/forecasting", icon: Brain, group: "Modeling" },
  { label: "Data Ingestion", to: "/ingest", icon: Upload, group: "Workflow" },
  { label: "Reports and Downloads", to: "/reports", icon: FileText, group: "Workflow" },
  { label: "Methodology", to: "/methodology", icon: Database, group: "Workflow" },
  { label: "AI Assistant", to: "/assistant", icon: Bot, group: "Workflow" },
  { label: "API Documentation", to: "/api-docs", icon: LineChart, group: "Developer" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const groups = Array.from(new Set(ITEMS.map((i) => i.group)));
  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Jump to country, risk map, resistance, intervention, report…" />
      <CommandList>
        <CommandEmpty>No matching AMR module.</CommandEmpty>
        {groups.map((g, idx) => (
          <div key={g}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={g}>
              {ITEMS.filter((i) => i.group === g).map((i) => (
                <CommandItem
                  key={i.label}
                  value={`${i.label} ${i.group}`}
                  onSelect={() => {
                    setOpen(false);
                    navigate({ to: i.to });
                  }}
                >
                  <i.icon className="mr-2 h-4 w-4 text-[color:var(--accent)]" />
                  <span>{i.label}</span>
                  {i.hint && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                      {i.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </div>
        ))}
        <CommandSeparator />
        <CommandGroup heading="Tips">
          <CommandItem disabled>
            <Sparkles className="mr-2 h-4 w-4 text-[color:var(--accent)]" />
            Press <kbd className="mx-1 rounded bg-secondary px-1.5 py-0.5 text-[10px]">⌘K</kbd>{" "}
            anywhere to reopen
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
