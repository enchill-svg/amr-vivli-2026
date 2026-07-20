import { createFileRoute } from "@tanstack/react-router";
import { PageShell, SectionCard } from "@/components/vt/PageShell";

export const Route = createFileRoute("/team")({
  component: TeamPage,
  head: () => ({
    meta: [
      { title: "Team — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content: "Vivli 2026 AMR Surveillance Data Challenge submission team.",
      },
    ],
  }),
});

function TeamPage() {
  return (
    <PageShell showTabs={false}>
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="text-3xl font-light tracking-tight">Team</h1>
        <SectionCard title="Vivli 2026 AMR Surveillance Data Challenge">
          <p className="text-sm text-foreground/85">
            This dashboard and its underlying analysis pipeline were built as a submission to the
            Vivli 2026 AMR Surveillance Data Challenge. This page is intentionally minimal —
            individual submission-team names and roles are not published here.
          </p>
        </SectionCard>
      </div>
    </PageShell>
  );
}
