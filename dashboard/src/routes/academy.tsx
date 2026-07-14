import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, BookOpen, Beaker, Cpu, Check } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";
import { toast } from "sonner";

export const Route = createFileRoute("/academy")({
  component: AcademyPage,
  head: () => ({
    meta: [
      { title: "Bioinformatics Academy — AMR Life Expectancy Intelligence" },
      {
        name: "description",
        content:
          "Training pathways in genomic surveillance, phylogenetics, and outbreak analytics.",
      },
    ],
  }),
});

const tracks = [
  {
    icon: Beaker,
    title: "Wastewater Surveillance Foundations",
    level: "Beginner",
    hrs: 8,
    color: "var(--status-info)",
  },
  {
    icon: BookOpen,
    title: "Viral Sequencing & QC",
    level: "Intermediate",
    hrs: 14,
    color: "var(--status-warn)",
  },
  {
    icon: Cpu,
    title: "Phylogenetic Analysis with Nextstrain",
    level: "Advanced",
    hrs: 20,
    color: "var(--accent)",
  },
  {
    icon: Beaker,
    title: "Outbreak Epidemiology & R₀",
    level: "Intermediate",
    hrs: 12,
    color: "var(--status-info)",
  },
  {
    icon: Cpu,
    title: "AI for Pandemic Forecasting",
    level: "Advanced",
    hrs: 18,
    color: "var(--accent)",
  },
  {
    icon: BookOpen,
    title: "Public Health Data Communication",
    level: "Beginner",
    hrs: 6,
    color: "var(--status-ok)",
  },
];

function AcademyPage() {
  const [enrolled, setEnrolled] = useState<Set<string>>(new Set());

  const handleEnrol = (title: string) => {
    setEnrolled((prev) => {
      const next = new Set(prev);
      next.add(title);
      return next;
    });
    toast.success(`Enrolled in "${title}". This records your interest locally in this session.`);
  };

  return (
    <CommandPage
      icon={GraduationCap}
      eyebrow="Training & Capacity Building"
      title="Bioinformatics Academy"
      subtitle="Curriculum for the next generation of African genomic surveillance scientists, in partnership with regional CDCs."
      kpis={[
        { label: "Active learners", value: "2,341", color: "var(--accent)" },
        { label: "Tracks", value: String(tracks.length), color: "var(--status-info)" },
        { label: "Certifications", value: "187", color: "var(--status-warn)" },
        { label: "Partner unis", value: "23", color: "var(--status-ok)" },
      ]}
    >
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
        {tracks.map((t) => (
          <GlassCard key={t.title}>
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ background: `${t.color}22`, color: t.color }}
              >
                <t.icon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-medium">{t.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {t.level} · {t.hrs}h
                </p>
              </div>
            </div>
            <button
              onClick={() => handleEnrol(t.title)}
              disabled={enrolled.has(t.title)}
              className="mt-3 w-full text-xs px-3 py-2 rounded border border-border/60 hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-70 disabled:hover:border-border/60 disabled:hover:text-inherit flex items-center justify-center gap-1.5"
            >
              {enrolled.has(t.title) ? (
                <>
                  <Check className="w-3.5 h-3.5" /> Enrolled
                </>
              ) : (
                "Enrol"
              )}
            </button>
          </GlassCard>
        ))}
      </div>
    </CommandPage>
  );
}
