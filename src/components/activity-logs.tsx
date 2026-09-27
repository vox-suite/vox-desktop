import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { api, type LocalEvent } from "@/lib/tauri";

export function ActivityLogs() {
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isScrolledDown, setIsScrolledDown] = useState(false);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    // Load initial events from recent command history or buffer
    void api
      .getLocalEvents()
      .then((initial) => {
        if (initial && initial.length > 0) {
          setEvents(initial);
        }
      })
      .catch(() => undefined);

    // Listen to real-time events emitted by the backend
    void listen<LocalEvent>("local-agent-event", (event) => {
      setEvents((prev) => [...prev.slice(-150), event.payload]);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // When latest logs are at the top, keep scroll at top unless user has scrolled down
  useEffect(() => {
    if (!isScrolledDown && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, isScrolledDown]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop } = scrollRef.current;
    setIsScrolledDown(scrollTop > 20);
  };

  if (events.length === 0) return null;

  const displayEvents = [...events].reverse();

  return (
    <div
      aria-label="Activity Logs"
      className="pointer-events-auto absolute right-4 top-0 z-30 flex max-h-[50vh] w-[340px] flex-col overflow-hidden bg-transparent select-text opacity-60 transition-opacity duration-300 hover:opacity-95"
      style={{
        maskImage:
          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,1) 50%, rgba(0,0,0,0) 100%)",
      }}
    >
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 pt-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex flex-col space-y-1.5 pb-10">
          {displayEvents.map((ev) => {
            if (ev.kind === "command") {
              const cleanCmd = ev.text.startsWith("$ ")
                ? ev.text.slice(2)
                : ev.text;
              return (
                <div
                  key={ev.id}
                  className="flex items-baseline justify-between gap-2.5 font-mono text-[11px] leading-relaxed"
                >
                  <div className="min-w-0 flex-1 break-words text-zinc-300">
                    <span className="text-[#ff6363] font-semibold mr-1.5 select-none">
                      $
                    </span>
                    <span className="font-medium text-white">{cleanCmd}</span>
                  </div>
                  <span className="shrink-0 text-right font-sans text-[9px] text-zinc-500/80 select-none">
                    {ev.timestamp}
                  </span>
                </div>
              );
            }

            if (ev.kind === "output") {
              return (
                <div
                  key={ev.id}
                  className="flex items-baseline justify-between gap-2.5 font-mono text-[10.5px] leading-snug"
                >
                  <div className="min-w-0 flex-1 break-words text-zinc-400 pl-2 border-l border-white/15 ml-0.5">
                    <span>{ev.text}</span>
                  </div>
                  <span className="shrink-0 text-right font-sans text-[9px] text-zinc-600/70 select-none">
                    {ev.timestamp}
                  </span>
                </div>
              );
            }

            if (ev.kind === "success") {
              return (
                <div
                  key={ev.id}
                  className="flex items-baseline justify-between gap-2.5 font-mono text-[10.5px] leading-relaxed"
                >
                  <div className="min-w-0 flex-1 break-words text-emerald-400/90">
                    <span className="mr-1.5 text-emerald-400 select-none">
                      ✓
                    </span>
                    <span>{ev.text}</span>
                  </div>
                  <span className="shrink-0 text-right font-sans text-[9px] text-zinc-600/70 select-none">
                    {ev.timestamp}
                  </span>
                </div>
              );
            }

            if (ev.kind === "error") {
              return (
                <div
                  key={ev.id}
                  className="flex items-baseline justify-between gap-2.5 font-mono text-[10.5px] leading-relaxed"
                >
                  <div className="min-w-0 flex-1 break-words text-[#ff6363]">
                    <span className="mr-1.5 select-none">✗</span>
                    <span>{ev.text}</span>
                  </div>
                  <span className="shrink-0 text-right font-sans text-[9px] text-zinc-600/70 select-none">
                    {ev.timestamp}
                  </span>
                </div>
              );
            }

            if (ev.kind === "system") {
              return (
                <div
                  key={ev.id}
                  className="flex items-baseline justify-between gap-2.5 font-mono text-[10.5px] leading-relaxed"
                >
                  <div className="min-w-0 flex-1 break-words text-zinc-400">
                    <span className="text-zinc-500 mr-1.5 select-none">→</span>
                    <span>{ev.text}</span>
                  </div>
                  <span className="shrink-0 text-right font-sans text-[9px] text-zinc-600/70 select-none">
                    {ev.timestamp}
                  </span>
                </div>
              );
            }

            // Default: status or info
            return (
              <div
                key={ev.id}
                className="flex items-baseline justify-between gap-2.5 font-mono text-[10.5px] leading-relaxed"
              >
                <div className="min-w-0 flex-1 break-words text-zinc-400 italic">
                  <span className="text-zinc-500 mr-1.5 select-none">•</span>
                  <span>{ev.text}</span>
                </div>
                <span className="shrink-0 text-right font-sans text-[9px] text-zinc-600/70 select-none">
                  {ev.timestamp}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
