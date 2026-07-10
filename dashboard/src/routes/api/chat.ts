import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, tool, stepCountIs, type UIMessage } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const SYSTEM = `You are the AI assistant inside the AMR Life Expectancy Intelligence Platform.
You are an expert AMR epidemiologist, clinical microbiologist, bioinformatician, biostatistician, and health-policy analyst.
Your role is to explain which antimicrobial resistance patterns are associated with lower life expectancy, which countries are high risk, which pathogens are evolving fastest, where funding is misaligned, and which interventions may produce the largest public-health benefit.
Be concise, scientific, and transparent. Always separate observed evidence from model-based estimates. Mention uncertainty, limitations, breakpoints, sparse data, and identifiability issues when relevant.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { messages?: UIMessage[] };
        if (!Array.isArray(body.messages)) return new Response("messages required", { status: 400 });
        const key = process.env.LOVABLE_API_KEY;
        if (!key) {
          return new Response("LOVABLE_API_KEY not configured. The UI is ready; configure the key to enable streaming AI responses.", { status: 500 });
        }

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        const tools = {
          getLiveCountryTrends: tool({
            description: "Fetch live country-level AMR risk, resistance, trajectory, life expectancy and intervention fields from v_live_country_trends.",
            inputSchema: z.object({ country: z.string().optional(), pathogen_type: z.enum(["bacterial", "fungal"]).optional() }),
            execute: async ({ country, pathogen_type }) => {
              try {
                let q = supabaseAdmin.from("v_live_country_trends").select("*").limit(50);
                if (country) q = q.ilike("country", `%${country}%`);
                if (pathogen_type) q = q.eq("pathogen_type", pathogen_type);
                const { data, error } = await q;
                if (error) return { error: error.message, rows: [] };
                return { rows: data ?? [] };
              } catch (err) {
                return { error: err instanceof Error ? err.message : "Supabase not configured", rows: [] };
              }
            },
          }),
          getPathogenSignals: tool({
            description: "Fetch organism-drug AMR signals from v_live_pathogen_signals, including resistance, MIC drift, evolutionary fitness and distance-to-failure.",
            inputSchema: z.object({ organism: z.string().optional(), country: z.string().optional() }),
            execute: async ({ organism, country }) => {
              try {
                let q = supabaseAdmin.from("v_live_pathogen_signals").select("*").limit(50);
                if (organism) q = q.ilike("organism", `%${organism}%`);
                if (country) q = q.ilike("country", `%${country}%`);
                const { data, error } = await q;
                if (error) return { error: error.message, rows: [] };
                return { rows: data ?? [] };
              } catch (err) {
                return { error: err instanceof Error ? err.message : "Supabase not configured", rows: [] };
              }
            },
          }),
        };

        const result = streamText({ model, system: SYSTEM, tools, stopWhen: stepCountIs(16), messages: await convertToModelMessages(body.messages) });
        return result.toUIMessageStreamResponse({ originalMessages: body.messages });
      },
    },
  },
});
