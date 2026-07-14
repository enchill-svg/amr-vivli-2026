import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

export type AdminInfo = {
  loading: boolean;
  roles: string[];
  status: "pending" | "approved" | "rejected" | "suspended" | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  profile: {
    full_name: string | null;
    email: string | null;
    country: string | null;
    institution: string | null;
  } | null;
};

export function useAdmin(): AdminInfo {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<AdminInfo>({
    loading: true,
    roles: [],
    status: null,
    isAdmin: false,
    isSuperAdmin: false,
    profile: null,
  });

  useEffect(() => {
    let alive = true;
    if (authLoading) return;
    if (!user) {
      setState({
        loading: false,
        roles: [],
        status: null,
        isAdmin: false,
        isSuperAdmin: false,
        profile: null,
      });
      return;
    }
    (async () => {
      const [rolesRes, profileRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase
          .from("profiles")
          .select("status,full_name,email,country,institution")
          .eq("id", user.id)
          .maybeSingle(),
      ]);
      if (!alive) return;
      const roles = (rolesRes.data ?? []).map((r: { role: string }) => r.role);
      const isSuperAdmin = roles.includes("super_admin");
      const isAdmin = isSuperAdmin || roles.includes("admin");
      setState({
        loading: false,
        roles,
        status: (profileRes.data?.status as AdminInfo["status"]) ?? null,
        isAdmin,
        isSuperAdmin,
        profile: profileRes.data
          ? {
              full_name: profileRes.data.full_name,
              email: profileRes.data.email,
              country: profileRes.data.country,
              institution: profileRes.data.institution,
            }
          : null,
      });
    })();
    return () => {
      alive = false;
    };
  }, [user, authLoading]);

  return state;
}

export async function logAudit(
  action: string,
  entity?: string,
  entityId?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action,
      entity: entity ?? null,
      entity_id: entityId ?? null,
      device: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
      metadata: (metadata ?? {}) as never,
    });
  } catch {
    /* non-blocking */
  }
}
