import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
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

const examples = [
  "Hours I game each week",
  "My top artists this month",
  "Daily Spotify listening, last 30 days",
];
const ranges = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];
const fmt = (d: Date) =>
  d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
function windowLabel(d: PulseDefinition) {
  const end = new Date();
  end.setDate(end.getDate() - (d.offset_days ?? 0));
  const start = new Date(end);
  start.setDate(start.getDate() - (d.period_days - 1));
  return `${fmt(start)} – ${fmt(end)}`;
}

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

  const shift = (dir: 1 | -1) =>
    definition &&
    tweak({
      offset_days: Math.max(
        0,
        (definition.offset_days ?? 0) + dir * definition.period_days,
      ),
    });
  const buckets: Bucket[] = measurement?.buckets ?? [];

  return (
    <div className="grid min-h-[70vh] gap-6 lg:grid-cols-[minmax(300px,2fr)_3fr]">
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

      <section className="min-w-0" aria-label="Preview">
        {busy && !preview ? (
          <PulseChartSkeleton />
        ) : definition && preview && title ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {definition.bucket && (
                <>
                  <div className="pulse-seg" role="group" aria-label="Range">
                    {ranges.map((r) => (
                      <button
                        key={r.days}
                        aria-pressed={definition.period_days === r.days}
                        onClick={() =>
                          void tweak({
                            period_days: r.days,
                            offset_days: 0,
                            bucket:
                              r.days > 60 && definition.bucket === "day"
                                ? "week"
                                : definition.bucket,
                          })
                        }
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Earlier"
                      onClick={() => void shift(1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-28 text-center font-mono">
                      {windowLabel(definition)}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Later"
                      disabled={(definition.offset_days ?? 0) === 0}
                      onClick={() => void shift(-1)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                  {buckets.length > 1 && (
                    <div className="pulse-seg" role="group" aria-label="Group by">
                      {buckets.map((b) => (
                        <button
                          key={b}
                          aria-pressed={definition.bucket === b}
                          onClick={() => void tweak({ bucket: b })}
                        >
                          {b[0].toUpperCase() + b.slice(1)}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
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
          <div className="flex h-full min-h-72 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground">
            Your chart will appear here
          </div>
        )}
      </section>
    </div>
  );
}
