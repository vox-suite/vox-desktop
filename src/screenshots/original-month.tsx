import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SpanMonthView } from "@/components/span-month-view";
import { monthGridDays } from "@/lib/span-layout";
import type { Span } from "@/features/spans/types";
import { entries, purchaseSpan } from "./fixtures";

/** Render the existing event-chip month implementation in the capture shell. */
export function OriginalMonth({
  onSelectSpan,
}: {
  onSelectSpan: (span: Span) => void;
}) {
  const [target, setTarget] = useState<Element | null>(null);
  const [month, setMonth] = useState("August 2026");
  useEffect(() => {
    const sync = () => {
      const active = [
        ...document.querySelectorAll('[role="tab"][data-state="active"]'),
      ].some((el) => el.textContent === "Month");
      setTarget(active ? document.querySelector("[data-page-body]") : null);
      const label = document.querySelector(
        "[data-page-header] h1",
      )?.textContent;
      if (active && label) setMonth(label);
    };
    const observer = new MutationObserver(sync);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    });
    sync();
    return () => observer.disconnect();
  }, []);
  const date = useMemo(() => new Date(`${month} 1 12:00:00`), [month]);
  const spans = useMemo(
    () =>
      monthGridDays(date).flatMap((day) => {
        const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
        const list = entries(key);
        const offset = day.getDate() % 4;
        return list
          .slice(offset, offset + 6 + (day.getDate() % 3))
          .map(({ event, evidence }): Span => ({
            ...purchaseSpan,
            id: event.id,
            title: event.title,
            notes: event.summary ?? "",
            category: event.group_id,
            start_at: event.occurred_at,
            end_at: event.ended_at ?? null,
            source: evidence[0].source_type,
            source_ref: evidence[0].source_id ?? null,
            data: {
              ...(event.content as Record<string, unknown>),
              time_precision: event.time_precision,
            },
          }));
      }),
    [date],
  );
  if (!target) return null;
  return createPortal(
    <div
      data-original-month
      className="absolute inset-0 z-10 flex flex-col bg-background"
    >
      <SpanMonthView
        anchorDate={date}
        spans={spans}
        onSelectSpan={onSelectSpan}
        onSelectDay={(day) => {
          const original = target.querySelector(
            ":scope > div:not([data-original-month])",
          );
          const cells = original?.querySelectorAll("button[data-no-drag]");
          const index = monthGridDays(date).findIndex(
            (d) => d.toDateString() === day.toDateString(),
          );
          (cells?.[index] as HTMLButtonElement | undefined)?.click();
        }}
      />
    </div>,
    target,
  );
}
