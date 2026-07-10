import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/hooks/use-admin";
import { Check, X, Ban, Search, Download, Filter, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/users")({
  component: UsersPage,
  head: () => ({ meta: [{ title: "Users — Admin" }] }),
});

type Status = "pending" | "approved" | "rejected" | "suspended" | "all";
type Action = "approved" | "rejected" | "suspended";

function UsersPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<{ ids: string[]; action: Action } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const roleMap = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach((r: { user_id: string; role: string }) => {
        roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
      });
      return (profilesRes.data ?? []).map((p) => ({ ...p, roles: roleMap.get(p.id) ?? [] }));
    },
  });

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (status !== "all" && u.status !== status) return false;
      if (!needle) return true;
      return [u.full_name, u.email, u.country, u.institution, u.profession]
        .filter(Boolean)
        .some((s) => (s as string).toLowerCase().includes(needle));
    });
  }, [users, status, q]);

  const setAction = async (ids: string[], newStatus: Action) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ status: newStatus, status_changed_at: new Date().toISOString(), status_changed_by: user?.id ?? null })
      .in("id", ids);
    if (error) return toast.error(error.message);
    await supabase.from("approval_requests").insert(
      ids.map((id) => ({ user_id: id, status: newStatus, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })) as never,
    );
    await logAudit(`user.${newStatus}`, "user", ids.join(","), { count: ids.length });
    toast.success(`${ids.length} user${ids.length > 1 ? "s" : ""} → ${newStatus}`);
    setSelected(new Set());
    setConfirm(null);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-metrics"] });
  };

  const exportCsv = () => {
    const cols = ["full_name", "email", "institution", "country", "profession", "status", "created_at"];
    const rows = [cols.join(","), ...filtered.map((u) => cols.map((c) => JSON.stringify((u as never)[c] ?? "")).join(","))];
    const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `viraltrack-users-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const toggleAll = () => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((u) => u.id)));

  const tabs: { key: Status; label: string; count?: number }[] = [
    { key: "pending", label: "Pending", count: users.filter((u) => u.status === "pending").length },
    { key: "approved", label: "Approved", count: users.filter((u) => u.status === "approved").length },
    { key: "rejected", label: "Rejected", count: users.filter((u) => u.status === "rejected").length },
    { key: "suspended", label: "Suspended", count: users.filter((u) => u.status === "suspended").length },
    { key: "all", label: "All", count: users.length },
  ];

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Users</h1>
          <p className="text-sm text-white/50 mt-1">Approve, reject, or suspend researcher access requests.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, country…"
              className="pl-8 pr-3 py-2 w-64 rounded-lg bg-white/[0.04] border border-white/10 text-sm placeholder:text-white/40 focus:outline-none focus:border-cyan-400/40" />
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/[0.03] text-sm hover:bg-white/[0.06]">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </header>

      <div className="flex items-center gap-1 border-b border-white/10 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => { setStatus(t.key); setSelected(new Set()); }}
            className={`px-4 py-2 text-sm border-b-2 -mb-px whitespace-nowrap ${
              status === t.key ? "border-cyan-400 text-white" : "border-transparent text-white/50 hover:text-white/80"}`}>
            {t.label} <span className="text-white/40">({t.count ?? 0})</span>
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 p-3 text-sm">
          <Filter className="w-3.5 h-3.5 text-cyan-300" />
          <span>{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setConfirm({ ids: [...selected], action: "approved" })} className="px-3 py-1.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs inline-flex items-center gap-1"><Check className="w-3 h-3" /> Approve</button>
            <button onClick={() => setConfirm({ ids: [...selected], action: "rejected" })} className="px-3 py-1.5 rounded-md bg-rose-500/20 border border-rose-400/30 text-rose-200 text-xs inline-flex items-center gap-1"><X className="w-3 h-3" /> Reject</button>
            <button onClick={() => setConfirm({ ids: [...selected], action: "suspended" })} className="px-3 py-1.5 rounded-md bg-orange-500/20 border border-orange-400/30 text-orange-200 text-xs inline-flex items-center gap-1"><Ban className="w-3 h-3" /> Suspend</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-white/40">
            <tr>
              <th className="p-3 w-8"><input type="checkbox" checked={selected.size > 0 && selected.size === filtered.length} onChange={toggleAll} /></th>
              <th className="p-3 text-left">User</th>
              <th className="p-3 text-left">Organization</th>
              <th className="p-3 text-left">Country</th>
              <th className="p-3 text-left">Role</th>
              <th className="p-3 text-left">Registered</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="p-6 text-center text-white/50">Loading…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-white/50">No users match this filter.</td></tr>}
            {filtered.map((u) => (
              <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="p-3"><input type="checkbox" checked={selected.has(u.id)} onChange={() => toggle(u.id)} /></td>
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center"><UserIcon className="w-3.5 h-3.5 text-white/60" /></div>
                    <div>
                      <div className="text-white">{u.full_name ?? "—"}</div>
                      <div className="text-[11px] text-white/50">{u.email ?? "—"}</div>
                    </div>
                  </div>
                </td>
                <td className="p-3 text-white/70">{u.institution ?? "—"}</td>
                <td className="p-3 text-white/70">{u.country ?? "—"}</td>
                <td className="p-3 text-white/70 capitalize">{(u.roles ?? []).join(", ").replace(/_/g, " ") || "—"}</td>
                <td className="p-3 text-white/60">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="p-3"><StatusPill status={u.status as string} /></td>
                <td className="p-3 text-right">
                  <div className="inline-flex gap-1">
                    {u.status !== "approved" && <button onClick={() => setConfirm({ ids: [u.id], action: "approved" })} className="p-1.5 rounded-md hover:bg-emerald-500/20 text-emerald-300" title="Approve"><Check className="w-3.5 h-3.5" /></button>}
                    {u.status !== "rejected" && <button onClick={() => setConfirm({ ids: [u.id], action: "rejected" })} className="p-1.5 rounded-md hover:bg-rose-500/20 text-rose-300" title="Reject"><X className="w-3.5 h-3.5" /></button>}
                    {u.status !== "suspended" && <button onClick={() => setConfirm({ ids: [u.id], action: "suspended" })} className="p-1.5 rounded-md hover:bg-orange-500/20 text-orange-300" title="Suspend"><Ban className="w-3.5 h-3.5" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setConfirm(null)}>
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0A0D12] p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium capitalize">{confirm.action} {confirm.ids.length} user{confirm.ids.length > 1 ? "s" : ""}?</h3>
            <p className="text-sm text-white/60 mt-2">
              {confirm.action === "approved" && "Approved users get immediate access to protected surveillance data."}
              {confirm.action === "rejected" && "Rejected users can no longer request access without administrator intervention."}
              {confirm.action === "suspended" && "Suspended users lose platform access until they are reinstated."}
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 rounded-lg border border-white/10 text-sm">Cancel</button>
              <button onClick={() => setAction(confirm.ids, confirm.action)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-400 to-emerald-400 text-black text-sm font-semibold">
                Confirm {confirm.action}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    approved: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    rejected: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    suspended: "bg-orange-500/15 text-orange-300 border-orange-400/30",
  };
  return <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${map[status] ?? "bg-white/5 border-white/10"}`}>{status}</span>;
}