import { registerCacheReset } from "@/features/cache-reset";
import { readPersisted, schedulePersist } from "@/features/persist";
import {
  TIMELINE_PAGE_SIZE,
  timelineApi,
  type TimelineDaySummary,
  type TimelineEntry,
} from "@/features/timeline/api";

export type TimelineDayEntry = {
  items: TimelineEntry[];
  cursor: string | null;
  done: boolean;
  loading: boolean;
  error: string;
  rev: string | null;
};

const EMPTY_ENTRY: TimelineDayEntry = {
  items: [],
  cursor: null,
  done: false,
  loading: false,
  error: "",
  rev: null,
};

export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

export function dayStart(day: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function nextDay(day: string): string {
  const date = dayStart(day);
  date.setDate(date.getDate() + 1);
  return dayKey(date);
}

const errorText = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

async function pool<T>(
  items: T[],
  size: number,
  run: (item: T) => Promise<void>,
) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(size, items.length) },
    async () => {
      while (next < items.length) await run(items[next++]);
    },
  );
  await Promise.all(workers);
}

const MAX_PERSISTED_DAYS = 90;
const MAX_PERSISTED_COUNTS = 800;

type Persisted = {
  counts: [string, TimelineDaySummary][];
  entries: [string, TimelineDayEntry][];
};

class TimelineDayStore {
  private touched = new Map<string, number>();
  private hydrating: Promise<void> | null = null;
  private counts = new Map<string, TimelineDaySummary>();
  private entries = new Map<string, TimelineDayEntry>();
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

  count(scope: string, day: string): TimelineDaySummary | undefined {
    return this.counts.get(`${scope}|${day}`);
  }

  entry(scope: string, day: string): TimelineDayEntry {
    return this.entries.get(`${scope}|${day}`) ?? EMPTY_ENTRY;
  }

  hasLoadedCounts(scope: string, fromDay: string, toDay: string): boolean {
    return this.loadedRanges.has(`${scope}|${fromDay}:${toDay}`);
  }

  private ready(): Promise<void> {
    this.hydrating ??= readPersisted<Persisted>("timeline").then((data) => {
      if (!data) return;
      for (const [key, summary] of data.counts)
        if (!this.counts.has(key)) this.counts.set(key, summary);
      for (const [key, entry] of data.entries)
        if (!this.entries.has(key)) {
          this.entries.set(key, { ...entry, loading: false, error: "" });
          this.touched.set(key, 0);
        }
      this.emit();
    });
    return this.hydrating;
  }

  private persist() {
    schedulePersist("timeline", () => {
      const keys = [...this.entries.keys()]
        .filter((key) => (this.entries.get(key)?.rev ?? "0") !== "0")
        .sort((a, b) => (this.touched.get(b) ?? 0) - (this.touched.get(a) ?? 0))
        .slice(0, MAX_PERSISTED_DAYS);
      const counts = [...this.counts.entries()]
        .sort((a, b) => (a[0] < b[0] ? 1 : -1))
        .slice(0, MAX_PERSISTED_COUNTS);
      return {
        counts,
        entries: keys.map((key) => [key, this.entries.get(key)!]),
      } satisfies Persisted;
    });
  }

  reset() {
    this.hydrating = null;
    this.touched.clear();
    this.counts.clear();
    this.entries.clear();
    this.loadedRanges.clear();
    this.invalidate();
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

  private patch(scope: string, day: string, next: Partial<TimelineDayEntry>) {
    this.entries.set(`${scope}|${day}`, { ...this.entry(scope, day), ...next });
    if (next.items) {
      this.touched.set(`${scope}|${day}`, Date.now());
      this.persist();
    }
    this.emit();
  }

  loadCounts(scope: string, fromDay: string, toDay: string): Promise<void> {
    return this.once(
      `counts:${scope}:${fromDay}:${toDay}:${this.epoch}`,
      async () => {
        const result = await timelineApi.days({
          start_at: dayStart(fromDay).toISOString(),
          end_at: dayStart(nextDay(toDay)).toISOString(),
          timezone: timezone(),
          group_value: scope || null,
        });
        const found = new Map(result.days.map((d) => [d.day, d]));
        for (let d = fromDay; d <= toDay; d = nextDay(d)) {
          const summary = found.get(d);
          if (summary) this.counts.set(`${scope}|${d}`, summary);
          else this.counts.delete(`${scope}|${d}`);
        }
        this.loadedRanges.add(`${scope}|${fromDay}:${toDay}`);
        this.persist();
        this.emit();
      },
    );
  }

  loadFirst(scope: string, day: string): Promise<void> {
    const summary = this.count(scope, day);
    const current = this.entry(scope, day);
    if (!summary) {
      if (current.rev !== "0")
        this.patch(scope, day, {
          items: [],
          cursor: null,
          done: true,
          loading: false,
          error: "",
          rev: "0",
        });
      return Promise.resolve();
    }
    if (current.rev === summary.rev && !current.error) return Promise.resolve();
    return this.once(`day:${scope}:${day}:${summary.rev}`, async () => {
      this.patch(scope, day, { loading: true, error: "" });
      try {
        const page = await timelineApi.query({
          start_at: dayStart(day).toISOString(),
          end_at: dayStart(nextDay(day)).toISOString(),
          group_value: scope || null,
          limit: TIMELINE_PAGE_SIZE,
        });
        this.patch(scope, day, {
          items: page.events,
          cursor: page.next_cursor ?? null,
          done: !page.next_cursor,
          loading: false,
          rev: summary.rev,
        });
      } catch (err) {
        this.patch(scope, day, { loading: false, error: errorText(err) });
      }
    });
  }

  loadMore(scope: string, day: string): Promise<void> {
    const current = this.entry(scope, day);
    if (current.done || !current.cursor) return Promise.resolve();
    return this.once(`more:${scope}:${day}:${current.cursor}`, async () => {
      this.patch(scope, day, { loading: true });
      try {
        const page = await timelineApi.query({
          start_at: dayStart(day).toISOString(),
          end_at: dayStart(nextDay(day)).toISOString(),
          group_value: scope || null,
          limit: TIMELINE_PAGE_SIZE,
          cursor: current.cursor,
        });
        const latest = this.entry(scope, day);
        const seen = new Set(latest.items.map((e) => e.event.id));
        this.patch(scope, day, {
          items: [
            ...latest.items,
            ...page.events.filter((e) => !seen.has(e.event.id)),
          ],
          cursor: page.next_cursor ?? null,
          done: !page.next_cursor,
          loading: false,
        });
      } catch (err) {
        this.patch(scope, day, { loading: false, error: errorText(err) });
      }
    });
  }

  async loadRange(scope: string, days: string[]) {
    if (!days.length) return;
    await this.ready();
    await this.loadCounts(scope, days[0], days[days.length - 1]);
    await pool(days, 6, (day) => this.loadFirst(scope, day));
  }

  async prefetch(scope: string, days: string[]) {
    if (!days.length) return;
    await this.ready();
    await this.loadCounts(scope, days[0], days[days.length - 1]);
    for (let i = 0; i < days.length; i += 7) {
      const batch = days.slice(i, i + 7).filter((d) => this.count(scope, d));
      await pool(batch, 3, (day) => this.loadFirst(scope, day));
    }
  }
}

export const timelineDays = new TimelineDayStore();
registerCacheReset(() => timelineDays.reset());
