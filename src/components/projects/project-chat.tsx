import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, Lightbulb, Loader2, X, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type {
  ContextNode,
  Project,
  ProjectExcerpt,
} from "@/features/projects/types";
import { localProjects } from "@/features/projects/api";
import { templates } from "@/features/projects/context";
import { platform } from "@/platform";
import { useVisionDictation } from "@/hooks/use-vision-dictation";
export function ProjectChat({
  project,
  busy,
  onSend,
  onAccept,
  onDismiss,
  selected,
  onClose,
}: {
  project: Project;
  busy: boolean;
  onSend: (message: string, excerpts: ProjectExcerpt[]) => Promise<void>;
  onAccept: (n: ContextNode, messageId: string) => Promise<void>;
  onDismiss: (nodeId: string, messageId: string) => Promise<void>;
  selected: ContextNode | null;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [share, setShare] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const dictation = useVisionDictation((text) =>
    setDraft((d) => `${d}${d ? " " : ""}${text}`),
  );
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [project.data.messages.length, busy]);
  const send = async () => {
    if (!draft.trim() || busy || sending) return;
    setSending(true);
    setError("");
    dictation.stop();
    try {
      const excerpts: ProjectExcerpt[] = [];
      if (share) {
        excerpts.push(
          ...(await localProjects().retrieve(
            project.id,
            draft.trim(),
            selected?.citations[0]?.source_id,
          )),
        );
      }
      await onSend(draft.trim(), excerpts);
      setDraft("");
    } catch (e) {
      setError(String(e));
    } finally {
      setSending(false);
    }
  };
  const run = async (fn: () => Promise<void>) => {
    try {
      setError("");
      await fn();
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <aside className="project-ideation flex min-h-0 flex-col border-l bg-background">
      <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Lightbulb className="size-4" />
          Ideate
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Close ideation panel"
          onClick={onClose}
        >
          <X className="size-4" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 py-5">
        {!project.data.messages.length && (
          <div className="project-ideation-welcome">
            <div className="project-ideation-icon">
              <Lightbulb className="size-6" />
            </div>
            <h2 className="text-2xl font-medium tracking-tight">
              Think it through with Vox.
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {templates.find((t) => t.id === project.data.template)?.prompt ??
                "What would you like to explore?"}
            </p>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
              Ideas stay here. Useful decisions can become project context; a
              concrete direction can become a Plan.
            </p>
            <div className="project-ideation-prompts">
              {[
                "Help me understand this project",
                "Explore an idea for this project",
                "Turn my next step into a plan",
              ].map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={busy || sending}
                  onClick={() => setDraft(prompt)}
                >
                  {prompt}
                  <ArrowUp className="size-3.5 rotate-45" />
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-6">
          {project.data.messages.map((m) => (
            <div
              key={m.id}
              className={
                m.role === "user"
                  ? "ml-5 rounded-lg border bg-muted/30 p-3"
                  : "py-1"
              }
            >
              <span className="mb-2 block text-xs text-muted-foreground">
                {m.role === "user" ? "You" : "Vox"}
              </span>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                {m.body}
              </p>
              {m.proposals.map((n) => (
                <div key={n.id} className="mt-3 rounded-lg border p-3">
                  <strong className="text-xs">{n.title}</strong>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                    {n.body}
                  </p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {n.citations.length
                      ? `${n.citations.length} source references · inferred`
                      : "Assumption · no source cited"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => void run(() => onAccept(n, m.id))}
                    >
                      <Check className="size-3" />
                      Save to context
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void run(() => onDismiss(n.id, m.id))}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        {(busy || sending) && (
          <p
            className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2 className="size-3 animate-spin" />
            Thinking…
          </p>
        )}
        <div ref={end} />
      </div>
      <div className="shrink-0 space-y-3 border-t p-4">
        {selected && (
          <p className="truncate text-xs text-muted-foreground">
            Discussing: {selected.title}
          </p>
        )}
        <label className="flex items-start gap-2 text-[11px] leading-4 text-muted-foreground">
          <input
            type="checkbox"
            checked={share}
            onChange={(e) => setShare(e.target.checked)}
            disabled={
              !project.data.sources.length ||
              !platform().projects ||
              busy ||
              sending
            }
          />
          <span>
            Include relevant local excerpts for this message (up to 8
            references, 24,000 characters)
          </span>
        </label>
        <Textarea
          aria-label="Project idea"
          placeholder="Ask a question, explore an idea, or change direction…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={12000}
          className="min-h-24 resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {(error || dictation.error) && (
          <p role="alert" className="text-xs text-destructive">
            {error || dictation.error}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">
            Context summaries shared · files stay local
          </span>
          <div className="flex gap-1">
            {dictation.available && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={
                  dictation.listening ? "Stop dictation" : "Dictate idea"
                }
                aria-pressed={dictation.listening}
                onClick={dictation.toggle}
              >
                <Mic className="size-4" />
              </Button>
            )}
            <Button
              size="icon-sm"
              aria-label="Send idea"
              disabled={busy || sending || !draft.trim()}
              onClick={() => void send()}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
