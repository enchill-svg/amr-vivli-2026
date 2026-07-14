import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { getLiveCountryTrends, getPathogenSignals } from "@/lib/amr-data.functions";

const SYSTEM = `You are the AI assistant inside the AMR Life Expectancy Intelligence Platform.
You are an expert AMR epidemiologist, clinical microbiologist, bioinformatician, biostatistician, and health-policy analyst.
Your role is to explain which antimicrobial resistance patterns are associated with lower life expectancy, which countries are high risk, which pathogens are evolving fastest, where funding is misaligned, and which interventions may produce the largest public-health benefit.
Be concise, scientific, and transparent. Always separate observed evidence from model-based estimates. Mention uncertainty, limitations, breakpoints, sparse data, and identifiability issues when relevant.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages))
          return new Response("messages required", { status: 400 });
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response(
            "LOVABLE_API_KEY not configured. The UI is ready; configure the key to enable streaming AI responses.",
            { status: 500 },
          );
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          getLiveCountryTrends: tool({
            description:
              "Fetch country-level AMR risk, resistance, trajectory and intervention fields from the published dashboard bundle.",
            inputSchema: z.object({
              country: z.string().optional(),
              pathogen_type: z.enum(["bacterial", "fungal", "all"]).optional(),
            }),
            execute: async ({ country, pathogen_type }) => {
              try {
                let rows = await getLiveCountryTrends(pathogen_type ?? "all");
                if (country) {
                  const needle = country.toLowerCase();
                  rows = rows.filter((r) => r.country.toLowerCase().includes(needle));
                }
                return { rows: rows.slice(0, 50) };
              } catch (err) {
                return {
                  error: err instanceof Error ? err.message : "Failed to load country trends",
                  rows: [],
                };
              }
            },
          }),
          getPathogenSignals: tool({
            description:
              "Fetch organism-drug AMR signals from the published bundle, including resistance, MIC drift, and evolutionary fitness.",
            inputSchema: z.object({
              organism: z.string().optional(),
              country: z.string().optional(),
            }),
            execute: async ({ organism, country }) => {
              try {
                let rows = await getPathogenSignals("all");
                if (organism) {
                  const needle = organism.toLowerCase();
                  rows = rows.filter((r) => r.organism.toLowerCase().includes(needle));
                }
                if (country) {
                  const needle = country.toLowerCase();
                  rows = rows.filter((r) => r.country.toLowerCase().includes(needle));
                }
                return { rows: rows.slice(0, 50) };
              } catch (err) {
                return {
                  error: err instanceof Error ? err.message : "Failed to load pathogen signals",
                  rows: [],
                };
              }
            },
          }),
        };

        const result = streamText({
          model,
          system: SYSTEM,
          tools,
          stopWhen: stepCountIs(16),
          messages: await convertToModelMessages(body.messages),
        });
        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
