import { useMemo, useState, useEffect } from "react";
import { startOfDay, monthGridDays } from "@/lib/span-layout";
import { categoryStyle, formatAmount, formatTime } from "@/lib/span-format";
import type { Span } from "@/lib/tauri";
import { cn } from "@/lib/utils";

function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

export function SpanMonthView({
  anchorDate,
  spans,
  onSelectSpan,
  onSelectDay,
}: {
  anchorDate: Date;
  spans: Span[];
  onSelectSpan: (span: Span) => void;
  onSelectDay: (day: Date) => void;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const currentMonth = anchorDate.getMonth();
  const gridDays = useMemo(() => monthGridDays(anchorDate), [anchorDate]);

  // Group spans by date string (YYYY-MM-DD)
  const spansByDay = useMemo(() => {
    const map = new Map<string, Span[]>();
    for (const span of spans) {
      if (!span.start_at) continue;
      const dayKey = startOfDay(new Date(span.start_at)).toISOString();
      const list = map.get(dayKey) ?? [];
      list.push(span);
      map.set(dayKey, list);
    }
    // Sort each day's spans by start time
    for (const list of map.values()) {
      list.sort((a, b) => {
        const tA = new Date(a.start_at!).getTime();
        const tB = new Date(b.start_at!).getTime();
        return tA - tB;
      });
    }
    return map;
  }, [spans]);

  const weekDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[#07080a] select-none">
      {/* Weekday Column Headers */}
      <div className="grid grid-cols-7 border-b border-white/[0.06] bg-ink/75">
        {weekDayNames.map((name) => (
          <div
            key={name}
            className="py-2.5 text-center font-mono text-[11px] font-semibold tracking-wider text-white/45 uppercase"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div
        className="grid flex-1 min-h-0 grid-cols-7 divide-x divide-white/[0.04] overflow-y-auto [scrollbar-width:thin] [scrollbar-color:theme(colors.white/15)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/15 hover:[&::-webkit-scrollbar-thumb]:bg-white/25"
        style={{
          gridTemplateRows: `repeat(${gridDays.length / 7}, minmax(110px, 1fr))`,
        }}
      >
        {gridDays.map((day) => {
          const isToday = isSameDay(day, now);
          const isCurrentMonth = day.getMonth() === currentMonth;
          const dayKey = startOfDay(day).toISOString();
          const daySpans = spansByDay.get(dayKey) ?? [];
          const visibleSpans = daySpans.slice(0, 3);
          const overflowCount = daySpans.length - 3;

          return (
            <div
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "group relative flex flex-col border-b border-white/[0.04] p-1.5 transition-colors cursor-pointer",
                isCurrentMonth
                  ? "bg-transparent hover:bg-white/[0.02]"
                  : "bg-white/[0.005] opacity-40 hover:opacity-65 hover:bg-white/[0.02]",
                isToday && "bg-white/[0.015]",
              )}
            >
              {/* Day Header with Date Number */}
              <div className="mb-1 flex items-center justify-between px-1">
                <span
                  className={cn(
                    "font-mono text-[11.5px] transition",
                    isToday
                      ? "flex size-6 items-center justify-center rounded-md bg-white/15 px-1 py-0.5 text-white ring-1 ring-white/20 font-bold shadow-sm"
                      : isCurrentMonth
                        ? "font-medium text-white/80 group-hover:text-white"
                        : "text-white/35",
                  )}
                >
                  {day.getDate()}
                </span>

                {daySpans.length > 0 ? (
                  <span className="font-mono text-[9px] text-white/30 group-hover:text-white/50">
                    {daySpans.length} {daySpans.length === 1 ? "item" : "items"}
                  </span>
                ) : null}
              </div>

              {/* Event Chips List */}
              <div className="flex flex-col gap-1 overflow-hidden">
                {visibleSpans.map((s) => {
                  const style = categoryStyle(s.category);
                  const amount = formatAmount(s);
                  const time = formatTime(s.start_at);

                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-no-drag
                      title={`${s.title}${time ? ` · ${time}` : ""}${amount ? ` · ${amount}` : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectSpan(s);
                      }}
                      className="group/chip flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition hover:brightness-125 shadow-sm"
                      style={{
                        backgroundColor: style.bg,
                        border: `1px solid ${style.border}`,
                      }}
                    >
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ background: style.dot }}
                      />
                      <span className="truncate text-[11px] font-medium text-pure-white">
                        {s.title}
                      </span>
                      {amount ? (
                        <span className="ml-auto shrink-0 font-mono text-[9px] text-white/60">
                          {amount}
                        </span>
                      ) : null}
                    </button>
                  );
                })}

                {/* +N More indicator */}
                {overflowCount > 0 ? (
                  <button
                    type="button"
                    data-no-drag
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDay(day);
                    }}
                    className="self-start rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-smoke transition hover:bg-white/[0.08] hover:text-white"
                  >
                    +{overflowCount} more
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
