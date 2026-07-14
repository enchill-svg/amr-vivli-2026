import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/hooks/use-admin";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/roles")({
  component: RolesPage,
  head: () => ({ meta: [{ title: "Roles & Permissions — Admin" }] }),
});

const ROLES = [
  "super_admin",
  "admin",
  "analyst",
  "public_health_officer",
  "researcher",
  "viewer",
] as const;
type Role = (typeof ROLES)[number];

const PERMISSIONS: { key: string; label: string; roles: readonly Role[] }[] = [
  { key: "users.approve", label: "Approve / reject users", roles: ["super_admin", "admin"] },
  { key: "users.suspend", label: "Suspend users", roles: ["super_admin", "admin"] },
  { key: "users.delete", label: "Delete user accounts", roles: ["super_admin"] },
  { key: "roles.manage", label: "Manage roles & permissions", roles: ["super_admin"] },
  {
    key: "alerts.manage",
    label: "Create & resolve alerts",
    roles: ["super_admin", "admin", "analyst"],
  },
  {
    key: "forecasts.run",
    label: "Run AI forecasting jobs",
    roles: ["super_admin", "admin", "analyst"],
  },
  {
    key: "data.upload",
    label: "Upload sequences / metadata",
    roles: ["super_admin", "admin", "analyst", "researcher"],
  },
  {
    key: "reports.publish",
    label: "Publish reports",
    roles: ["super_admin", "admin", "public_health_officer"],
  },
  { key: "audit.view", label: "View audit log", roles: ["super_admin", "admin"] },
  { key: "platform.read", label: "View surveillance dashboards", roles: ROLES },
];

function RolesPage() {
  const qc = useQueryClient();
  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [p, r] = await Promise.all([
        supabase.from("profiles").select("id,full_name,email,status"),
        supabase.from("user_roles").select("user_id,role"),
      ]);
      const roleMap = new Map<string, string[]>();
      (r.data ?? []).forEach((row: { user_id: string; role: string }) =>
        roleMap.set(row.user_id, [...(roleMap.get(row.user_id) ?? []), row.role]),
      );
      return (p.data ?? []).map((u) => ({ ...u, roles: roleMap.get(u.id) ?? [] }));
    },
  });

  const setRole = async (userId: string, role: Role, add: boolean) => {
    if (add) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: role as never });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role as never);
      if (error) return toast.error(error.message);
    }
    await logAudit(`role.${add ? "grant" : "revoke"}`, "user_role", userId, { role });
    toast.success(`${add ? "Granted" : "Revoked"} ${role.replace(/_/g, " ")}`);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-light tracking-tight flex items-center gap-3">
          <KeyRound className="w-6 h-6 text-cyan-300" /> Roles & Permissions
        </h1>
        <p className="text-sm text-white/50 mt-1">
          Granular access control across the ViralTrack platform.
        </p>
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <h2 className="p-4 text-sm font-medium border-b border-white/10">Permission matrix</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-white/40">
              <tr>
                <th className="p-3 text-left">Capability</th>
                {ROLES.map((r) => (
                  <th key={r} className="p-3 text-center capitalize">
                    {r.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key} className="border-t border-white/5">
                  <td className="p-3 text-white/80">
                    {p.label} <span className="text-white/30 text-[11px] ml-1">{p.key}</span>
                  </td>
                  {ROLES.map((r) => (
                    <td key={r} className="p-3 text-center">
                      {p.roles.includes(r) ? (
                        <span className="inline-block w-4 h-4 rounded-full bg-emerald-400/20 border border-emerald-400/40" />
                      ) : (
                        <span className="text-white/20">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl overflow-hidden">
        <h2 className="p-4 text-sm font-medium border-b border-white/10">Assign roles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest text-white/40">
              <tr>
                <th className="p-3 text-left">User</th>
                {ROLES.map((r) => (
                  <th key={r} className="p-3 text-center capitalize">
                    {r.replace(/_/g, " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="p-3">
                    <div className="text-white">{u.full_name ?? "—"}</div>
                    <div className="text-[11px] text-white/50">{u.email}</div>
                  </td>
                  {ROLES.map((r) => {
                    const has = u.roles.includes(r);
                    return (
                      <td key={r} className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={has}
                          onChange={(e) => setRole(u.id, r, e.target.checked)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
