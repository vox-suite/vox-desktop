import { platform } from "@/platform";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer, PageBody } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PlanningTimeline } from "@/components/planning-timeline";
import { SpanMonthCounts } from "@/components/span-month-counts";
import { daysFrom } from "@/lib/span-format";
import { addDays, addMonths, monthGridDays, startOfDay, startOfMonth } from "@/lib/span-layout";
import type { Collection, Span, SpanDaySummary } from "@/features/spans/types";
import { timelineApi, type TimelineEntry, type TimelineGroup, type TimelineEventType } from "@/features/timeline/api";
import { TimelineHeader, type ViewMode } from "./spans";

export function TimelineView({ onBack }: { collection?: Collection | null; collections: Collection[]; onBack?: () => void; onCollapse?: () => void }) {
  const [mode, setMode] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [types, setTypes] = useState<TimelineEventType[]>([]);
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [counts, setCounts] = useState<Map<string, SpanDaySummary>>(new Map());
  const [cursor, setCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const ticket = useRef(0);
  const days = useMemo(() => mode === "day" ? [anchor] : mode === "month" ? monthGridDays(anchor) : daysFrom(anchor, 7), [anchor, mode]);
  const start = days[0].toISOString();
  const end = addDays(days[days.length - 1], 1).toISOString();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = platform().live.subscribe(event => {
      if (event.type === "timeline_updated" || event.type === "live_reconnected") {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { setRevision(r => r + 1); }, 350);
      }
    });
    return () => { unsubscribe(); if (timer) clearTimeout(timer); };
  }, []);
  useEffect(() => {
    let active = true;
    Promise.all([timelineApi.groups(), timelineApi.types()]).then(([g, t]) => { if (active) { setGroups(g); setTypes(t); } }).catch((e: unknown) => { if (active) setError(String(e)); });
    return () => { active = false; };
  }, [revision]);
  useEffect(() => {
    const current = ++ticket.current;
    setLoading(true); setError(""); setEntries([]); setCursor(null);
    const filter = { start_at: start, end_at: end, group_value: group || null };
    const request = mode === "month"
      ? timelineApi.counts({ ...filter, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }).then((rows) => {
          const byDay = new Map<string, SpanDaySummary>();
          for (const row of rows) { const day = byDay.get(row.day) ?? { day: row.day, count: 0, categories: [] }; day.count += row.count; day.categories.push({ category: row.category, count: row.count }); byDay.set(row.day, day); }
          if (ticket.current === current) setCounts(byDay);
        })
      : timelineApi.query({ ...filter, limit: 100 }).then((page) => { if (ticket.current === current) { setEntries(page.events); setCursor(page.next_cursor ?? null); } });
    request.catch((e: unknown) => { if (ticket.current === current) setError(String(e)); }).finally(() => { if (ticket.current === current) setLoading(false); });
    return () => { ticket.current++; };
  }, [start, end, group, mode, revision]);
  async function more() {
    if (!cursor || loading) return;
    const current = ticket.current; setLoading(true);
    try { const page = await timelineApi.query({ start_at: start, end_at: end, group_value: group || null, cursor, limit: 100 }); if (ticket.current === current) { setEntries((all) => [...all, ...page.events]); setCursor(page.next_cursor ?? null); } }
    catch (e) { if (ticket.current === current) setError(String(e)); }
    finally { if (ticket.current === current) setLoading(false); }
  }
  const spans: Span[] = entries.map(({ event: e, evidence }) => ({
    id: e.id, user_id: e.user_id, title: e.title, notes: e.summary ?? "", category: groups.find((g) => g.id === e.group_id)?.value ?? "personal",
    start_at: e.occurred_at, end_at: e.ended_at ?? null, due_at: null, completed_at: null, status: "done", priority: 0,
    data: { ...(typeof e.content === "object" && e.content ? e.content : {}), time_precision: e.time_precision },
    schema_id: e.event_type_id, schema_color_token: null, schema_icon_token: null, parent_id: null, source: evidence[0]?.source_type ?? "timeline",
    source_event_id: null, source_ref: evidence[0]?.source_id ?? null, execution_type: null, execution_result: null, collection_ids: [], version: e.revision, created_at: e.created_at, updated_at: e.updated_at,
  }));
  return <PageContainer><TimelineHeader anchor={anchor} days={days} mode={mode} onBack={onBack} loading={loading} onReload={() => setRevision((r) => r + 1)}
    onModeChange={(next) => { setMode(next); setAnchor((date) => next === "month" ? startOfMonth(date) : next === "week" ? addDays(date, -date.getDay()) : date); }}
    onPrev={() => setAnchor((date) => mode === "month" ? addMonths(date, -1) : addDays(date, mode === "week" ? -7 : -1))}
    onNext={() => setAnchor((date) => mode === "month" ? addMonths(date, 1) : addDays(date, mode === "week" ? 7 : 1))} />
    <div className="flex shrink-0 flex-wrap gap-2 border-b border-border px-6 py-2" role="group" aria-label="Timeline groups">
      <Button size="sm" variant={!group ? "secondary" : "ghost"} onClick={() => setGroup("")}>All</Button>
      {groups.map((g) => <Button key={g.id} size="sm" variant={group === g.value ? "secondary" : "ghost"} onClick={() => setGroup(g.value)}>{g.label}</Button>)}
    </div>
    {error && <p role="alert" className="px-6 py-2 text-xs text-destructive">{error}</p>}
    <PageBody scroll={false} className="flex flex-col">
      {mode === "month" ? <SpanMonthCounts anchorDate={anchor} counts={counts} loading={loading} onSelectDay={(date) => { setMode("day"); setAnchor(startOfDay(date)); }} />
        : <PlanningTimeline days={days} spans={spans} loading={loading} unavailable={!!error} onSelect={(span) => setSelected(entries.find((e) => e.event.id === span.id) ?? null)} />}
      {mode !== "month" && cursor && <Button variant="ghost" disabled={loading} onClick={() => void more()}>Load more entries</Button>}
    </PageBody>
    <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}><DialogContent className="max-h-[80vh] overflow-y-auto"><DialogHeader><DialogTitle>{selected?.event.title}</DialogTitle><DialogDescription>{selected?.event.summary || types.find((t) => t.id === selected?.event.event_type_id)?.label || "Timeline entry"}</DialogDescription></DialogHeader>
      {selected && <><p className="text-xs text-muted-foreground">{["year", "month", "day"].includes(selected.event.time_precision) ? new Date(selected.event.occurred_at).toLocaleDateString() : new Date(selected.event.occurred_at).toLocaleString()} · {selected.event.time_precision} precision</p>
      <dl className="space-y-2 text-sm">{Object.entries((selected.event.content ?? {}) as Record<string, unknown>).filter(([, v]) => v != null).map(([key, value]) => <div key={key}><dt className="text-xs text-muted-foreground">{key.replaceAll("_", " ")}</dt><dd className="break-words">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>
      <div className="border-t border-border pt-3 text-xs text-muted-foreground">{selected.evidence.map((ev) => <p key={ev.id}>{ev.source_type} · {ev.source_id ?? ev.raw_reference ?? "Recorded evidence"}</p>)}</div></>}
    </DialogContent></Dialog>
  </PageContainer>;
}
