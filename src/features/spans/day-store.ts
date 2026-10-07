import { spansApi } from "@/features/spans/api";
import type { Span, SpanDaySummary } from "@/features/spans/types";

export type DayEntry = {
  items: Span[];
  cursor: string | null;
  done: boolean;
  loading: boolean;
  error: string;
};

const EMPTY_ENTRY: DayEntry = {
  items: [],
  cursor: null,
  done: false,
  loading: false,
  error: "",
};

export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

class SpanDayStore {
  private counts = new Map<string, SpanDaySummary>();
  private entries = new Map<string, DayEntry>();
  private loadedRanges = new Set<string>();
  private inflight = new Map<string, Promise<void>>();
  private listeners = new Set<() => void>();
  private tick = 0;
  epoch = 0;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  version = () => this.tick;

  private emit() {
    this.tick++;
    this.listeners.forEach((l) => l());
  }

  count(day: string): SpanDaySummary | undefined {
    return this.counts.get(day);
  }

  entry(day: string): DayEntry {
    return this.entries.get(day) ?? EMPTY_ENTRY;
  }

  hasLoadedCounts(fromDay: string, toDay: string): boolean {
    return this.loadedRanges.has(`${fromDay}:${toDay}`);
  }

  invalidate() {
    this.epoch++;
    this.emit();
  }

  private once(key: string, run: () => Promise<void>): Promise<void> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = run().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  loadCounts(fromDay: string, toDay: string): Promise<void> {
    return this.once(`counts:${fromDay}:${toDay}`, async () => {
      const days = await spansApi.getDays(fromDay, toDay, timezone());
      const found = new Map(days.map((d) => [d.day, d]));
      for (
        let d = new Date(`${fromDay}T00:00:00`);
        dayKey(d) <= toDay;
        d.setDate(d.getDate() + 1)
      ) {
        const key = dayKey(d);
        const summary = found.get(key);
        if (summary) this.counts.set(key, summary);
        else this.counts.delete(key);
      }
      this.loadedRanges.add(`${fromDay}:${toDay}`);
      this.emit();
    });
  }

  private patch(day: string, next: Partial<DayEntry>) {
    this.entries.set(day, { ...this.entry(day), ...next });
    this.emit();
  }

  loadFirst(day: string): Promise<void> {
    return this.once(`day:${day}`, async () => {
      this.patch(day, { loading: true, error: "" });
      try {
        const page = await spansApi.getDayPage(day, timezone(), null);
        this.patch(day, {
          items: page.items,
          cursor: page.next_cursor,
          done: !page.next_cursor,
          loading: false,
        });
      } catch (err) {
        this.patch(day, {
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }

  loadMore(day: string): Promise<void> {
    const current = this.entry(day);
    if (current.done || !current.cursor) return Promise.resolve();
    return this.once(`more:${day}`, async () => {
      this.patch(day, { loading: true });
      try {
        const page = await spansApi.getDayPage(day, timezone(), current.cursor);
        const seen = new Set(this.entry(day).items.map((s) => s.id));
        this.patch(day, {
          items: [
            ...this.entry(day).items,
            ...page.items.filter((s) => !seen.has(s.id)),
          ],
          cursor: page.next_cursor,
          done: !page.next_cursor,
          loading: false,
        });
      } catch (err) {
        this.patch(day, {
          loading: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }
}

export const spanDays = new SpanDayStore();
