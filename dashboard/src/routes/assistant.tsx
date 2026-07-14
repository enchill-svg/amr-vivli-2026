import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Brain, Send } from "lucide-react";
import { CommandPage, GlassCard } from "@/components/vt/CommandPage";

export const Route = createFileRoute("/assistant")({
  component: AssistantPage,
  head: () => ({ meta: [{ title: "AI Assistant — AMR LifeIntel" }] }),
});

function AssistantPage() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });
  const busy = status === "submitted" || status === "streaming";
  const prompts = [
    "Which country has the fastest-growing resistance?",
    "What intervention gives the biggest benefit?",
    "Compare Turkey and Greece.",
    "Show fungal resistance.",
    "Explain this chart for policymakers.",
  ];
  return (
    <CommandPage
      icon={Brain}
      eyebrow="AI Assistant"
      title="Ask natural-language questions about AMR evidence"
      subtitle="Designed to explain trends, compare countries, summarize evidence, generate policy recommendations and describe visualizations."
      kpis={[
        { label: "Mode", value: "RAG", color: "var(--accent)", sub: "Database-aware" },
        { label: "Explainability", value: "On", color: "var(--status-ok)" },
        { label: "Audience", value: "Policy", color: "var(--status-info)" },
        { label: "Tools", value: "SQL", color: "var(--status-warn)" },
      ]}
    >
      <GlassCard
        title="AMR Intelligence Assistant"
        subtitle="Ask about countries, pathogens, interventions, funding mismatch or methodology."
      >
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="min-h-[480px] rounded-xl border border-border/60 bg-background/30 p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="rounded-xl border border-[color:var(--accent)]/25 bg-[color:var(--accent)]/10 p-4 text-sm text-muted-foreground">
                  Start with a question. The production assistant can query live analytical views
                  and return citations, assumptions and recommendation logic.
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div className="mt-1 grid h-7 w-7 place-items-center rounded-full bg-secondary">
                    <Bot className="h-4 w-4 text-[color:var(--accent)]" />
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="animate-pulse text-xs text-muted-foreground">
                  Thinking through AMR evidence…
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {prompts.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage({ text: p })}
                className="w-full rounded-xl border border-border/60 bg-card/45 p-3 text-left text-xs hover:border-[color:var(--accent)]/50"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim() || busy) return;
            sendMessage({ text: input.trim() });
            setInput("");
          }}
          className="mt-4 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about AMR trends, countries, interventions, funding, or reports…"
            className="h-11 flex-1 rounded-xl border border-input bg-background/40 px-4 text-sm"
          />
          <button
            disabled={!input.trim() || busy}
            className="rounded-xl bg-[color:var(--accent)] px-4 text-[color:var(--accent-foreground)] disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </GlassCard>
    </CommandPage>
  );
}
