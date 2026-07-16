import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { SESSION_COOKIE_NAME } from "@/lib/session-cookie.functions";

function syncSessionCookie(hasUser: boolean) {
  if (typeof document === "undefined") return;
  document.cookie = hasUser
    ? `${SESSION_COOKIE_NAME}=1; path=/; max-age=2592000; samesite=lax`
    : `${SESSION_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      syncSessionCookie(!!sess?.user);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
      syncSessionCookie(!!data.session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  return { session, user, loading, isAuthenticated: !!user };
}
