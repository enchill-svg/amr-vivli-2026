import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/")({
  loader: () => {
    if (typeof window !== "undefined") window.location.replace("/admin/dashboard");
    return null;
  },
  component: () => null,
});