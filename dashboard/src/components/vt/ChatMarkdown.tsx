import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Strip accidental whole-reply wrappers the model sometimes emits. */
function cleanAssistantText(raw: string): string {
  let text = raw.trim();
  if (
    (text.startsWith('"""') && text.endsWith('"""')) ||
    (text.startsWith("'''") && text.endsWith("'''"))
  ) {
    text = text.slice(3, -3).trim();
  }
  if (text.startsWith("```") && text.endsWith("```")) {
    text = text.replace(/^```(?:markdown|md|text)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return text;
}

type Props = {
  children: string;
  className?: string;
};

export function ChatMarkdown({ children, className = "" }: Props) {
  const text = cleanAssistantText(children);
  return (
    <div
      className={`chat-md text-sm leading-relaxed text-foreground [&_a]:text-[color:var(--accent)] [&_a]:underline [&_code]:rounded [&_code]:bg-secondary/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:mt-2.5 [&_h3]:text-[13px] [&_h3]:font-semibold [&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_strong]:font-semibold [&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[12px] [&_td]:border [&_td]:border-border/50 [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:border-border/50 [&_th]:bg-secondary/40 [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}
