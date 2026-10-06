import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { discoveryApi } from "@/features/pulse/api";
import type { PulseSuggestion } from "@/features/pulse/discovery-types";
import { PulseChartSkeleton } from "./chart-card";
import { ChartEditor } from "./chart-editor";
import { Suggestion } from "./suggestions-view";

type Turn = {
  id: number;
  ask: string;
  pending: boolean;
  error?: string;
  suggestions: PulseSuggestion[];
};

const examples = [
  "My top artists this month",
  "How many hours do I play each week?",
  "Where does my money go?",
];

export function AskView({ onSaved }: { onSaved: () => void }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<PulseSuggestion | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = turns.some((t) => t.pending);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function send(ask: string) {
    const prompt = ask.trim();
    if (!prompt || busy) return;
    const id = Date.now();
    setText("");
    setTurns((t) => [...t, { id, ask: prompt, pending: true, suggestions: [] }]);
    const patch = (change: Partial<Turn>) =>
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...change } : x)));
    try {
      const data = await discoveryApi.discover({ prompt });
      patch({ pending: false, suggestions: data.suggestions });
    } catch (e) {
      patch({ pending: false, error: String(e) });
    }
  }

  if (editing)
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
          <ArrowLeft className="h-3 w-3" />
          Back to chat
        </Button>
        <ChartEditor
          initialDefinition={editing.definition}
          initialPreview={editing.preview}
          initialTitle={editing.title}
          measurement={editing.measurement}
          onSaved={onSaved}
        />
      </div>
    );

  return (
    <div className="flex min-h-[60vh] flex-col">
      <div className="flex-1 space-y-8 pb-6">
        {turns.length === 0 && (
          <div className="mx-auto max-w-md py-16 text-center">
            <Sparkles className="mx-auto mb-4 h-6 w-6 text-muted-foreground" />
            <h2 className="text-base font-medium">What do you want to see?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Describe a chart in plain words and Pulse will build it from your
              data.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
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
        {turns.map((turn) => (
          <div key={turn.id} className="space-y-4">
            <div className="flex justify-end">
              <p className="max-w-[80%] rounded-2xl rounded-br-sm border border-border bg-muted px-4 py-2 text-sm">
                {turn.ask}
              </p>
            </div>
            {turn.pending ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Looking through your data…
                </p>
                <div className="pulse-chart-grid">
                  <PulseChartSkeleton />
                  <PulseChartSkeleton />
                </div>
              </div>
            ) : turn.error ? (
              <p role="alert" className="text-sm text-destructive">
                {turn.error}
              </p>
            ) : turn.suggestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                I couldn’t find data that fits that. Try naming an app or a
                topic, like “Spotify artists” or “spending by merchant”.
              </p>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Here’s what I found. Preview, then add what you like.
                </p>
                <div className="pulse-chart-grid">
                  {turn.suggestions.map((s) => (
                    <Suggestion
                      key={JSON.stringify(s.definition)}
                      suggestion={s}
                      onSaved={onSaved}
                      onEdit={() => setEditing(s)}
                      onDismiss={() =>
                        setTurns((all) =>
                          all.map((x) =>
                            x.id === turn.id
                              ? {
                                  ...x,
                                  suggestions: x.suggestions.filter(
                                    (y) => y !== s,
                                  ),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="sticky bottom-0 -mx-1 bg-background px-1 pb-2 pt-3"
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
            placeholder="Ask for a chart, e.g. “hours I spent gaming each week”"
            aria-label="Describe the chart you want"
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
    </div>
  );
}
