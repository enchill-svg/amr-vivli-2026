import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { Bot, Send, Sparkles, User as UserIcon, X } from "lucide-react";

export function FloatingCopilot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, sendMessage, status } = useChat({ transport: new DefaultChatTransport({ api: "/api/chat" }) });
  const busy = status === "submitted" || status === "streaming";

  const examples = [
    "Which country has the fastest-growing resistance?",
    "What intervention gives the biggest life expectancy gain?",
    "Compare Turkey and Greece.",
    "Show fungal resistance signals.",
    "Explain the current risk map.",
  ];

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open AMR AI assistant" className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-4 py-3 text-[color:var(--accent-foreground)] shadow-[0_0_24px_-4px_var(--accent)] transition-transform hover:scale-105">
          <Sparkles className="h-4 w-4" />
          <span className="hidden text-sm font-medium sm:inline">AMR AI</span>
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex max-h-[70vh] w-[92vw] flex-col rounded-xl border border-[color:var(--accent)]/40 bg-[color:var(--popover)]/95 shadow-[0_0_40px_-8px_var(--accent)] backdrop-blur-xl sm:w-[420px]">
          <header className="flex items-center justify-between border-b border-border/50 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--accent)]/20"><Bot className="h-4 w-4 text-[color:var(--accent)]" /></div>
              <div>
                <div className="text-sm font-medium">AMR Intelligence Assistant</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Evidence · policy · explainability</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3 text-sm">
            {messages.length === 0 && (
              <div className="space-y-2 text-xs text-muted-foreground">
                <p className="text-foreground">Ask questions about AMR burden, country risk, MIC trajectory, funding gaps, or interventions.</p>
                <ul className="space-y-1">
                  {examples.map((q) => (
                    <li key={q}>
                      <button onClick={() => sendMessage({ text: q })} className="w-full rounded-md border border-border/60 px-2 py-1.5 text-left transition-colors hover:border-[color:var(--accent)]/60 hover:bg-secondary/40">{q}</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m) => {
              const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
              return (
                <div key={m.id} className="flex gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary">
                    {m.role === "user" ? <UserIcon className="h-3 w-3" /> : <Bot className="h-3 w-3 text-[color:var(--accent)]" />}
                  </div>
                  <div className="flex-1 whitespace-pre-wrap leading-relaxed">{text}</div>
                </div>
              );
            })}
            {busy && <div className="animate-pulse pl-8 text-xs text-muted-foreground">Analyzing AMR evidence…</div>}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); if (!input.trim() || busy) return; sendMessage({ text: input.trim() }); setInput(""); }} className="flex gap-2 border-t border-border/50 p-3">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask about countries, resistance, funding, interventions…" disabled={busy} className="h-9 flex-1 rounded-md border border-input bg-transparent px-3 text-sm" />
            <button type="submit" disabled={busy || !input.trim()} className="rounded-md bg-[color:var(--accent)] px-3 text-[color:var(--accent-foreground)] disabled:opacity-50"><Send className="h-4 w-4" /></button>
          </form>
        </div>
      )}
    </>
  );
}
