import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollText, Search } from "lucide-react";

export const Route = createFileRoute("/admin/audit")({
  component: AuditPage,
  head: () => ({ meta: [{ title: "Audit Log — Admin" }] }),
});

function AuditPage() {
  const [q, setQ] = useState("");
  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });

  const filtered = data.filter((r) => {
    const s = q.toLowerCase();
    if (!s) return true;
    return [r.action, r.entity, r.actor_email, r.ip_address]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(s));
  });

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight flex items-center gap-3">
            <ScrollText className="w-6 h-6 text-cyan-300" /> Audit Log
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Every administrative and security-relevant action.
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter action / actor…"
            className="pl-8 pr-3 py-2 w-72 rounded-lg bg-white/[0.04] border border-white/10 text-sm placeholder:text-white/40 focus:outline-none focus:border-cyan-400/40"
          />
        </div>
      </header>

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-white/40">
            <tr>
              <th className="p-3 text-left">Timestamp</th>
              <th className="p-3 text-left">Action</th>
              <th className="p-3 text-left">Actor</th>
              <th className="p-3 text-left">Entity</th>
              <th className="p-3 text-left">Device</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-white/50">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-white/50">
                  No events.
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-white/5">
                <td className="p-3 text-white/60 whitespace-nowrap font-mono text-[11px]">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="p-3">
                  <span className="inline-block px-2 py-0.5 rounded-full bg-cyan-400/10 border border-cyan-400/20 text-cyan-200 text-[11px]">
                    {r.action}
                  </span>
                </td>
                <td className="p-3 text-white/70">{r.actor_email ?? "system"}</td>
                <td className="p-3 text-white/60">
                  {r.entity ?? "—"}{" "}
                  {r.entity_id && (
                    <span className="text-white/40">· {String(r.entity_id).slice(0, 8)}</span>
                  )}
                </td>
                <td className="p-3 text-white/40 text-[11px] truncate max-w-[240px]">
                  {r.device ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
