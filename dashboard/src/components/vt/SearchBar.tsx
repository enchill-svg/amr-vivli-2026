import { Search } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export function SearchBar() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!q.trim()) return;
        navigate({ to: "/search", search: { q: q.trim() } });
      }}
      className="flex-1 max-w-xl mx-auto relative"
    >
      <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full h-11 pl-11 pr-4 rounded-full bg-card/60 border border-border/70 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        placeholder="Search country, organism, drug, intervention, or report…"
      />
    </form>
  );
}
