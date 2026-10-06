import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { discoveryApi } from "@/features/pulse/api";
import type {
  Bucket,
  ComposeMessage,
  Measurement,
  PulseDefinition,
  PulseResult,
} from "@/features/pulse/discovery-types";
import { PulseChartCard, PulseChartSkeleton } from "./chart-card";
import { RangeControls } from "./range-controls";

const examples = [
  "Hours I game each week",
  "My top artists this month",
  "Daily Spotify listening, last 30 days",
];
export function AskView({ onSaved }: { onSaved: () => void }) {
  const [messages, setMessages] = useState<ComposeMessage[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState<string | null>(null);
  const [definition, setDefinition] = useState<PulseDefinition | null>(null);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [preview, setPreview] = useState<PulseResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const ticket = useRef(0);
  const key = useRef(crypto.randomUUID());
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
      const res = await discoveryApi.compose(next, definition, title);
      setMessages([...next, { role: "assistant", content: res.reply }]);
      if (res.definition && res.preview && res.measurement) {
        ticket.current++;
        setDefinition(res.definition);
        setMeasurement(res.measurement);
        setPreview(res.preview);
        if (res.title) setTitle(res.title);
        key.current = crypto.randomUUID();
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function tweak(change: Partial<PulseDefinition>) {
    if (!definition) return;
    const next = { ...definition, ...change };
    const mine = ++ticket.current;
    setDefinition(next);
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (mine !== ticket.current) return;
    try {
      const result = await discoveryApi.preview(next);
      if (mine === ticket.current) setPreview(result);
    } catch (e) {
      if (mine === ticket.current) setError(String(e));
    } finally {
      if (mine === ticket.current) setRefreshing(false);
    }
  }

  async function save() {
    if (!definition || !title || saving) return;
    setSaving(true);
    try {
      await discoveryApi.save(title, definition, key.current);
      onSaved();
    } catch (e) {
      setError(String(e));
      setSaving(false);
    }
  }

  const buckets: Bucket[] = measurement?.buckets ?? [];

  return (
    <div className="grid h-full min-h-0 gap-6 lg:grid-cols-[minmax(300px,2fr)_3fr] lg:grid-rows-[minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col" aria-label="Chat">
        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.length === 0 && (
            <div className="py-10">
              <Sparkles className="mb-3 h-5 w-5 text-muted-foreground" />
              <h2 className="text-base font-medium">Build a chart by chatting</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Describe it, then refine: change the time range, switch to
                weeks, make it a line. Your chart updates on the right.
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
          className="sticky bottom-0 bg-background pb-2 pt-2"
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
                definition
                  ? "Refine it: “show last month instead”"
                  : "Describe the chart you want"
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
          <div className="w-full max-w-xl">
            <PulseChartSkeleton />
          </div>
        ) : definition && preview && title ? (
          <div className="w-full max-w-xl space-y-3">
            <RangeControls
              definition={definition}
              buckets={buckets}
              onChange={(p) => void tweak(p)}
            />
            <div className={refreshing ? "opacity-60 transition-opacity" : ""}>
              <PulseChartCard
                title={title}
                definition={definition}
                result={preview}
                source={measurement?.profile.source}
                compact
              >
                <Button disabled={saving} onClick={() => void save()}>
                  {saving ? "Adding…" : "Add to Pulse"}
                </Button>
              </PulseChartCard>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your chart will appear here
          </p>
        )}
      </section>
    </div>
  );
}
