import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { resolveChatModel } from "@/lib/ai-gateway.server";
import { getLiveCountryTrends, getPathogenSignals } from "@/lib/amr-data.functions";

const SYSTEM = `You are the AI assistant inside the AMR Life Expectancy Intelligence Platform.
You are an expert AMR epidemiologist, clinical microbiologist, bioinformatician, biostatistician, and health-policy analyst.
Your role is to explain which antimicrobial resistance patterns are associated with lower life expectancy, which countries are high risk, which pathogens are evolving fastest, where funding is misaligned, and which interventions may produce the largest public-health benefit.
Be concise, scientific, and transparent. Always separate observed evidence from model-based estimates. Mention uncertainty, limitations, breakpoints, sparse data, and identifiability issues when relevant.
Tool budget is limited: call each data tool at most once per answer, prefer one unfiltered call and filter the returned rows yourself, and never repeat a call that returned no rows.`;

/** Lightweight per-isolate token bucket to protect free-tier Gemini keys. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const rateBuckets = new Map<string, number[]>();

function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "anonymous"
  );
}

function allowRequest(key: string): boolean {
  const now = Date.now();
  const recent = (rateBuckets.get(key) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (recent.length >= RATE_MAX) {
    rateBuckets.set(key, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(key, recent);
  return true;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!allowRequest(clientKey(request))) {
          return new Response("Too many AI requests. Please wait a minute and try again.", {
            status: 429,
          });
        }
        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages))
          return new Response("messages required", { status: 400 });
        const model = resolveChatModel();
        if (!model) {
          return new Response(
            "No AI provider configured. Set GEMINI_API_KEY (or LOVABLE_API_KEY) to enable streaming AI responses.",
            { status: 500 },
          );
        }

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
          stopWhen: stepCountIs(6),
          messages: await convertToModelMessages(body.messages),
        });
        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onError: (error) => {
            const message = error instanceof Error ? error.message : String(error);
            if (/quota|rate limit|RESOURCE_EXHAUSTED|429/i.test(message)) {
              return "The AI service is rate limited right now (free tier). Please wait a few seconds and ask again.";
            }
            return "The assistant could not complete this answer. Please try rephrasing your question.";
          },
        });
      },
    },
  },
});
