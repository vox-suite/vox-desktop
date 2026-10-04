import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, type LocalEvent } from "@/lib/tauri";
import { cn } from "@/lib/utils";

const KIND: Record<LocalEvent["kind"], { glyph: string; tone: string }> = {
  command: { glyph: "$", tone: "text-foreground" },
  output: { glyph: "", tone: "text-muted-foreground" },
  success: { glyph: "✓", tone: "text-foreground" },
  error: { glyph: "✗", tone: "text-destructive" },
  system: { glyph: "→", tone: "text-muted-foreground" },
  status: { glyph: "•", tone: "text-muted-foreground italic" },
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
      className="pointer-events-auto absolute right-4 top-4 z-30 w-85 gap-0 p-0 select-text"
    >
      <ScrollArea className="max-h-[50vh]">
        <div className="flex flex-col gap-1.5 p-3 font-mono text-xs">
          {[...events].reverse().map((ev) => {
            const { glyph, tone } = KIND[ev.kind] ?? KIND.status;
            const text =
              ev.kind === "command" && ev.text.startsWith("$ ")
                ? ev.text.slice(2)
                : ev.text;
            return (
              <div key={ev.id} className="flex items-baseline justify-between gap-2">
                <span className={cn("min-w-0 flex-1 break-words", tone)}>
                  {glyph ? <span className="mr-1.5 select-none">{glyph}</span> : null}
                  {text}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {ev.timestamp}
                </span>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
