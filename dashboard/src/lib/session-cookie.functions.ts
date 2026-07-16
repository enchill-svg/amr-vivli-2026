import { createServerFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

// Non-sensitive presence signal mirrored from the Supabase (localStorage-only)
// session by useAuth(), so beforeLoad can gate routes during SSR — the real
// security boundary remains Supabase RLS + requireSupabaseAuth, not this cookie.
export const SESSION_COOKIE_NAME = "amr-session";

const readServerSessionCookie = createServerFn({ method: "GET" }).handler(
  async () => getCookie(SESSION_COOKIE_NAME) === "1",
);

export async function hasSessionCookie(): Promise<boolean> {
  if (typeof document !== "undefined") {
    return document.cookie.split("; ").some((c) => c === `${SESSION_COOKIE_NAME}=1`);
  }
  return readServerSessionCookie();
}
