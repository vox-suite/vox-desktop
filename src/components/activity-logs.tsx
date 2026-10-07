import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type LocalEvent } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const KIND: Record<LocalEvent["kind"], { glyph: string; tone: string }> = {
  command: { glyph: "$", tone: "text-foreground/60" },
  output: { glyph: "", tone: "text-muted-foreground/70" },
  success: { glyph: "✓", tone: "text-foreground/60" },
  error: { glyph: "✗", tone: "text-destructive" },
  system: { glyph: "→", tone: "text-muted-foreground/70" },
  status: { glyph: "•", tone: "text-muted-foreground/70 italic" },
};

export function ActivityLogs() {
  const [events, setEvents] = useState<LocalEvent[]>([]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void api
      .getLocalEvents()
      .then((initial) => {
        if (initial?.length) setEvents(initial);
      })
      .catch(() => undefined);
    void listen<LocalEvent>("local-agent-event", (event) => {
      setEvents((prev) => [...prev.slice(-150), event.payload]);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, []);

  if (events.length === 0) return null;

  return (
    <Card
      aria-label="Activity Logs"
      className="pointer-events-auto fixed right-2 top-2 z-30 w-85 max-w-[calc(100vw-1rem)] gap-0 rounded-none border-0 bg-transparent p-0 shadow-none ring-0 select-text"
    >
      <ScrollArea className="max-h-[50vh] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]">
        <div className="flex flex-col gap-1 p-1 font-mono text-[9px] leading-snug">
          {[...events].reverse().map((ev) => {
            const { glyph, tone } = KIND[ev.kind] ?? KIND.status;
            const text =
              ev.kind === "command" && ev.text.startsWith("$ ")
                ? ev.text.slice(2)
                : ev.text;
            return (
              <div key={ev.id} className="flex items-baseline gap-2">
                <span className="shrink-0 text-[8px] text-muted-foreground/50">
                  {ev.timestamp}
                </span>
                <span className={cn("min-w-0 flex-1 break-words", tone)}>
                  {glyph ? (
                    <span className="mr-1.5 select-none">{glyph}</span>
                  ) : null}
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
