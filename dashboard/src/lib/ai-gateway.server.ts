import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const createLovableAiGatewayProvider = (lovableApiKey: string) =>
  createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });

export const createGeminiProvider = (geminiApiKey: string) =>
  createGoogleGenerativeAI({ apiKey: geminiApiKey });

export const resolveChatModel = () => {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const provider = createGeminiProvider(geminiKey);
    return provider(process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite");
  }

  const lovableKey = process.env.LOVABLE_API_KEY;
  if (lovableKey) {
    const provider = createLovableAiGatewayProvider(lovableKey);
    return provider(process.env.LOVABLE_MODEL ?? "google/gemini-3-flash-preview");
  }

  return null;
};
