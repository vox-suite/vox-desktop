import { useEffect, useRef, useState } from "react";
import { ArrowUp, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ComposeMessage } from "@/features/pulse/discovery-types";
import {
  goalsApi,
  type GoalDraft,
  type GoalView,
} from "@/features/pulse/goals";
import { GoalCard } from "./goal-card";
import { PulseChartSkeleton } from "./chart-card";

const examples = [
  "Save ₹80,000 for a bike by December",
  "Play under 10 hours of games a week",
  "Spend less than ₹20k on food this month",
];

export function GoalComposer({ onSaved }: { onSaved: () => void }) {
  const [messages, setMessages] = useState<ComposeMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<GoalDraft | null>(null);
  const [preview, setPreview] = useState<GoalView | null>(null);
  const [saving, setSaving] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  async function send(ask: string) {
    const content = ask.trim();
    if (!content || busy) return;
    const next: ComposeMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setText("");
    setBusy(true);
    setError("");
    try {
      const res = await goalsApi.compose(next, draft);
      setMessages([...next, { role: "assistant", content: res.reply }]);
      if (res.draft && res.preview) {
        setDraft(res.draft);
        setPreview(res.preview);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await goalsApi.create(draft);
      onSaved();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(300px,2fr)_3fr] lg:grid-rows-[minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col" aria-label="Chat">
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="py-10">
              <Target className="mb-3 h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-medium">
                What do you want to achieve?
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Tell me a goal. I’ll track it from your data, or let you log
                progress yourself for things like savings.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    onClick={() => void send(example)}
                    className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={m.role === "user" ? "flex justify-end" : "flex"}
            >
              <p
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm border border-border bg-muted px-4 py-2 text-sm"
                    : "max-w-[90%] text-sm text-muted-foreground"
                }
              >
                {m.content}
              </p>
            </div>
          ))}
          {busy && (
            <p className="text-sm text-muted-foreground">Working on it…</p>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div ref={end} />
        </div>
        <form
          className="bg-background pb-2 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2">
            <textarea
              value={text}
              rows={1}
              maxLength={500}
              placeholder={
                draft
                  ? "Adjust it: “make it ₹100k by January”"
                  : "Describe your goal"
              }
              aria-label="Message"
              className="max-h-32 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground"
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(text);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              aria-label="Send"
              disabled={busy || !text.trim()}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </section>

      <section
        className="flex min-h-0 min-w-0 items-center justify-center overflow-y-auto rounded-xl border border-dashed border-border p-6"
        aria-label="Preview"
      >
        {busy && !preview ? (
          <div className="w-full max-w-md">
            <PulseChartSkeleton />
          </div>
        ) : preview ? (
          <div className="w-full max-w-md space-y-3">
            <GoalCard goal={preview} preview />
            <Button disabled={saving} onClick={() => void create()}>
              {saving ? "Creating…" : "Create goal"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your goal will appear here
          </p>
        )}
      </section>
    </div>
  );
}
