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

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

class SpanDayStore {
  private counts = new Map<string, SpanDaySummary>();
  private entries = new Map<string, DayEntry>();
  private loadedRanges = new Set<string>();
  private inflight = new Map<string, Promise<void>>();
  private listeners = new Set<() => void>();
  private revision: number | null = null;
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

  count(scope: string, day: string): SpanDaySummary | undefined {
    return this.counts.get(`${scope}|${day}`);
  }

  entry(scope: string, day: string): DayEntry {
    return this.entries.get(`${scope}|${day}`) ?? EMPTY_ENTRY;
  }

  hasLoadedCounts(scope: string, fromDay: string, toDay: string): boolean {
    return this.loadedRanges.has(`${scope}|${fromDay}:${toDay}`);
  }

  invalidate() {
    this.epoch++;
    this.emit();
  }

  async revalidate() {
    if (!this.revision) return;
    const today = dayKey(new Date());
    try {
      const result = await spansApi.getDays(today, today, timezone(), {
        ifRevision: this.revision,
      });
      if (!result.unchanged) this.invalidate();
    } catch {
      return;
    }
  }

  private once(key: string, run: () => Promise<void>): Promise<void> {
    const existing = this.inflight.get(key);
    if (existing) return existing;
    const promise = run().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  loadCounts(scope: string, fromDay: string, toDay: string): Promise<void> {
    return this.once(`counts:${scope}:${fromDay}:${toDay}`, async () => {
      const result = await spansApi.getDays(fromDay, toDay, timezone(), {
        collectionId: scope || undefined,
      });
      if (!scope) this.revision = result.revision;
      const found = new Map(result.days.map((d) => [d.day, d]));
      for (
        let d = new Date(`${fromDay}T00:00:00`);
        dayKey(d) <= toDay;
        d.setDate(d.getDate() + 1)
      ) {
        const key = dayKey(d);
        const summary = found.get(key);
        if (summary) this.counts.set(`${scope}|${key}`, summary);
        else this.counts.delete(`${scope}|${key}`);
      }
      this.loadedRanges.add(`${scope}|${fromDay}:${toDay}`);
      this.emit();
    });
  }

  private patch(scope: string, day: string, next: Partial<DayEntry>) {
    this.entries.set(`${scope}|${day}`, {
      ...this.entry(scope, day),
      ...next,
    });
    this.emit();
  }

  loadFirst(scope: string, day: string): Promise<void> {
    return this.once(`day:${scope}:${day}`, async () => {
      this.patch(scope, day, { loading: true, error: "" });
      try {
        const page = await spansApi.getDayPage(
          day,
          timezone(),
          null,
          scope || undefined,
        );
        this.patch(scope, day, {
          items: page.items,
          cursor: page.next_cursor,
          done: !page.next_cursor,
          loading: false,
        });
      } catch (err) {
        this.patch(scope, day, { loading: false, error: errorText(err) });
      }
    });
  }

  loadMore(scope: string, day: string): Promise<void> {
    const current = this.entry(scope, day);
    if (current.done || !current.cursor) return Promise.resolve();
    return this.once(`more:${scope}:${day}`, async () => {
      this.patch(scope, day, { loading: true });
      try {
        const page = await spansApi.getDayPage(
          day,
          timezone(),
          current.cursor,
          scope || undefined,
        );
        const latest = this.entry(scope, day);
        const seen = new Set(latest.items.map((s) => s.id));
        this.patch(scope, day, {
          items: [
            ...latest.items,
            ...page.items.filter((s) => !seen.has(s.id)),
          ],
          cursor: page.next_cursor,
          done: !page.next_cursor,
          loading: false,
        });
      } catch (err) {
        this.patch(scope, day, { loading: false, error: errorText(err) });
      }
    });
  }
}

export const spanDays = new SpanDayStore();
