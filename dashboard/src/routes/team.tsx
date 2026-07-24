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

const TEAM = [
  {
    name: "Justice Ohene Amofa",
    affiliation: "Noguchi Memorial Institute for Medical Research (NMIMR)",
    email: "justiceoheneamofa@gmail.com",
    role: "Lead Applicant",
  },
  {
    name: "Erica Akanko",
    affiliation: "West African Centre for Cell Biology of Infectious Pathogens (WACCBIP)",
    email: "eakanko15@gmail.com",
    role: "Team member",
  },
  {
    name: "Yewku Enchill-Yawson",
    affiliation: "Noguchi Memorial Institute for Medical Research (NMIMR)",
    email: "enchillyawson@gmail.com",
    role: "Team member",
  },
  {
    name: "William Boateng",
    affiliation: "Noguchi Memorial Institute for Medical Research (NMIMR)",
    email: "boatengwilliam72@gmail.com",
    role: "Team member",
  },
  {
    name: "Humphrey P. K. Addy",
    affiliation: "Kwame Nkrumah University of Science and Technology (KNUST)",
    email: "addy.p.humphrey@gmail.com",
    role: "Team member",
  },
] as const;

function TeamPage() {
  return (
    <PageShell showTabs={false}>
      <div className="max-w-4xl mx-auto space-y-5">
        <h1 className="text-3xl font-light tracking-tight">Team</h1>
        <SectionCard title="Vivli 2026 AMR Surveillance Data Challenge">
          <p className="text-sm text-foreground/85 mb-4">
            Non-student team. Lead Applicant is the primary Vivli contact for Data Request 00013346.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Affiliation</th>
                  <th className="py-2 pr-4 font-medium">Role</th>
                  <th className="py-2 font-medium">Contact</th>
                </tr>
              </thead>
              <tbody>
                {TEAM.map((member) => (
                  <tr key={member.email} className="border-b border-border/60">
                    <td className="py-2.5 pr-4 text-foreground">{member.name}</td>
                    <td className="py-2.5 pr-4 text-foreground/85">{member.affiliation}</td>
                    <td className="py-2.5 pr-4 text-foreground/85">{member.role}</td>
                    <td className="py-2.5">
                      <a
                        href={`mailto:${member.email}`}
                        className="text-foreground/85 underline-offset-2 hover:underline"
                      >
                        {member.email}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </PageShell>
  );
}
