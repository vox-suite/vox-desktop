import { useDesktopContext } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer, PageBody } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, X } from "lucide-react";
import { AddTimelineEntryDialog, TimelineEntryDialog } from "@/components/timeline-entry-dialogs";
import { PlanningTimeline } from "@/components/planning-timeline";
import { SpanMonthCounts } from "@/components/span-month-counts";
import { daysFrom } from "@/lib/span-format";
import type { DateRange } from "react-day-picker";
import { addDays, addMonths, monthGridDays, startOfDay, startOfMonth } from "@/lib/span-layout";
import type { Collection, Span } from "@/features/spans/types";
import { TIMELINE_PAGE_SIZE, timelineApi, type TimelineEntry, type TimelineGroup, type TimelineEventType } from "@/features/timeline/api";
import { timelineDays } from "@/features/timeline/day-store";
import { loadMoreDay, useTimelineDays } from "@/hooks/use-timeline-days";
import { TimelineHeader, type ViewMode } from "./spans";

const DAY_WIDTH = 1600;
const WINDOW_STEP = 3;
const WINDOW_MAX = 30;

function toSpan(entry: TimelineEntry, groups: TimelineGroup[]): Span {
  const { event: e, evidence } = entry;
  return {
    id: e.id, user_id: e.user_id, title: e.title, notes: e.summary ?? "", category: groups.find((g) => g.id === e.group_id)?.value ?? "personal",
    start_at: e.occurred_at, end_at: e.ended_at ?? null, due_at: null, completed_at: null, status: "done", priority: 0,
    data: { ...(typeof e.content === "object" && e.content ? e.content : {}), time_precision: e.time_precision },
    schema_id: e.event_type_id, schema_color_token: null, schema_icon_token: null, parent_id: null, source: evidence[0]?.source_type ?? "timeline",
    source_event_id: null, source_ref: evidence[0]?.source_id ?? null, execution_type: null, execution_result: null, collection_ids: [], version: e.revision, created_at: e.created_at, updated_at: e.updated_at,
  };
}

export function TimelineView({ onBack }: { collection?: Collection | null; collections: Collection[]; onBack?: () => void; onCollapse?: () => void }) {
  const voiceContext = useDesktopContext().timeline;
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);
  // Typed search always spans every category and date, including a prior voice selection.
  const searching = !!searchInput.trim();
  const searchPending = searchInput.trim() !== search;
  const voiceFilter = searching ? { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, spendingOnly: false, category: null } : voiceContext;
  const [mode, setMode] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [range, setRange] = useState<DateRange | null>(null);
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [types, setTypes] = useState<TimelineEventType[]>([]);
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const [windowState, setWindowState] = useState({ key: anchor.getTime(), before: 2, after: 2 });
  const [metaError, setMetaError] = useState("");
  const [groupsLoading, setGroupsLoading] = useState(true);
  const win = windowState.key === anchor.getTime() ? windowState : { key: anchor.getTime(), before: 2, after: 2 };

  const customRange = !!(range?.from && range.to);
  const days = useMemo(() => {
    if (range?.from && range.to)
      return daysFrom(range.from, Math.min(31, Math.round((startOfDay(range.to).getTime() - startOfDay(range.from).getTime()) / 864e5) + 1));
    if (mode === "day") return daysFrom(addDays(anchor, -win.before), win.before + win.after + 1);
    if (mode === "month") return monthGridDays(anchor);
    return daysFrom(anchor, 7);
  }, [anchor, mode, range, win.before, win.after]);

  const store = useTimelineDays(days, group, !voiceFilter, mode === "month" && !customRange);

  useEffect(() => {
    let active = true;
    timelineApi.groups()
      .then((g) => { if (active) setGroups(g); })
      .catch((e: unknown) => { if (active) setMetaError(String(e)); })
      .finally(() => { if (active) setGroupsLoading(false); });
    timelineApi.types()
      .then((t) => { if (active) setTypes(t); })
      .catch((e: unknown) => { if (active) setMetaError(String(e)); });
    return () => { active = false; };
  }, []);

  const [voiceEntries, setVoiceEntries] = useState<TimelineEntry[]>([]);
  const [voiceCursor, setVoiceCursor] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const voiceTicket = useRef(0);
  const voiceStart = searching ? null : voiceContext?.startAt ?? null;
  const voiceEnd = searching ? null : voiceContext?.endAt ?? null;
  const spending = { spending_only: searching ? undefined : voiceContext?.spendingOnly || undefined, merchant: searching ? null : voiceContext?.merchant, category: searching ? null : voiceContext?.category, search: searching ? search || null : null };
  const queryGroup = searching ? null : group || null;
  useEffect(() => {
    if (!voiceFilter || searchPending) return;
    const current = ++voiceTicket.current;
    setVoiceLoading(true); setVoiceError(""); setVoiceEntries([]); setVoiceCursor(null);
    timelineApi.query({ start_at: voiceStart, end_at: voiceEnd, group_value: queryGroup, limit: TIMELINE_PAGE_SIZE, ...spending })
      .then((page) => { if (voiceTicket.current === current) { setVoiceEntries(page.events); setVoiceCursor(page.next_cursor ?? null); } })
      .catch((e: unknown) => { if (voiceTicket.current === current) setVoiceError(String(e)); })
      .finally(() => { if (voiceTicket.current === current) setVoiceLoading(false); });
    return () => { voiceTicket.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceContext, voiceStart, voiceEnd, queryGroup, search, searching, searchPending, refresh]);
  async function voiceMore() {
    if (!voiceCursor || voiceLoading || searchPending) return;
    const current = voiceTicket.current;
    setVoiceLoading(true);
    try {
      const page = await timelineApi.query({ start_at: voiceStart, end_at: voiceEnd, group_value: queryGroup, cursor: voiceCursor, limit: TIMELINE_PAGE_SIZE, ...spending });
      if (voiceTicket.current === current) { setVoiceEntries((all) => [...all, ...page.events]); setVoiceCursor(page.next_cursor ?? null); }
    } catch (e) {
      if (voiceTicket.current === current) setVoiceError(String(e));
    } finally {
      if (voiceTicket.current === current) setVoiceLoading(false);
    }
  }

  const entries = voiceFilter ? voiceEntries : store.entries;
  const loading = voiceFilter ? voiceLoading || searchPending : store.loading || store.countsLoading;
  const error = metaError || (voiceFilter ? voiceError : store.error);
  const spans = useMemo(() => entries.map((entry) => toSpan(entry, groups)), [entries, groups]);
  const reload = () => (voiceFilter ? setRefresh((n) => n + 1) : timelineDays.invalidate());
  const changed = () => { timelineDays.invalidate(); setRefresh((n) => n + 1); setSelected(null); };
  const clearFilters = () => { desktopStore.patch({ timeline: null }); setSearchInput(""); setSearch(""); };
  const select = (span: Span) => setSelected(entries.find((e) => e.event.id === span.id) ?? null);
  const extend = (side: "before" | "after") =>
    setWindowState({ ...win, [side]: Math.min(WINDOW_MAX, win[side] + WINDOW_STEP) });

  return <PageContainer><TimelineHeader range={range} onRangeChange={(next) => { setRange(next); if (next?.from) { setAnchor(startOfDay(next.from)); setMode(next.to && startOfDay(next.to).getTime() !== startOfDay(next.from).getTime() ? "week" : "day"); } }} anchor={anchor} days={mode === "day" && !customRange ? [anchor] : days} mode={mode} onBack={onBack} loading={loading} onReload={reload}
    onModeChange={(next) => { setRange(null); setMode(next); setAnchor((date) => next === "month" ? startOfMonth(date) : next === "week" ? addDays(date, -date.getDay()) : date); }}
    onPrev={() => { if (range) setRange(null); setAnchor((date) => mode === "month" ? addMonths(date, -1) : addDays(date, mode === "week" ? -7 : -1)); }}
    onNext={() => { if (range) setRange(null); setAnchor((date) => mode === "month" ? addMonths(date, 1) : addDays(date, mode === "week" ? 7 : 1)); }} />
    <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border px-6 py-2" role="group" aria-label="Timeline groups">
      <Button size="sm" variant={!group ? "secondary" : "ghost"} onClick={() => setGroup("")}>All</Button>
      {groupsLoading ? <div role="status" aria-label="Loading categories" className="flex h-8 shrink-0 items-center gap-2">
        <Loader2 aria-hidden="true" className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
        <span className="text-xs text-muted-foreground">Loading categories…</span>
      </div> : groups.map((g) => <Button key={g.id} size="sm" variant={group === g.value ? "secondary" : "ghost"} onClick={() => setGroup(g.value)}>{g.label}</Button>)}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="relative">
          <Input type="search" aria-label="Search all timeline data" placeholder="Search all data…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="h-8 w-56 pr-8 text-xs" />
          {searching && <button type="button" aria-label="Clear search" onClick={() => { setSearchInput(""); setSearch(""); }} className="absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-2"><X className="size-3.5" /></button>}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus /> Add</Button>
      </div>
    </div>
    {error && <p role="alert" className="px-6 py-2 text-xs text-destructive">{error}</p>}
    <PageBody scroll={false} className="flex flex-col">
      {voiceFilter ? <div className="overflow-auto p-6"><div className="mb-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{searching ? "Search results" : voiceFilter.spendingOnly ? "Spending" : "Entries"} · {voiceStart && voiceEnd ? `${new Date(voiceStart).toLocaleDateString()} – ${new Date(voiceEnd).toLocaleDateString()} · ${voiceFilter.timezone}` : "All time"}</span><Button variant="ghost" size="sm" onClick={clearFilters}>{searching ? "Clear search" : "Clear selection"}</Button></div>{searchPending || (voiceLoading && !voiceEntries.length) ? <div role="status" aria-label="Searching timeline" className="flex h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />Loading entries…</div> : voiceEntries.length ? voiceEntries.map(entry => <button key={entry.event.id} onClick={() => setSelected(entry)} className="flex w-full justify-between border-b border-border py-4 text-left text-sm"><span>{entry.event.title}{entry.event.summary && <span className="block text-xs text-muted-foreground">{entry.event.summary}</span>}</span><span className="text-xs text-muted-foreground">{new Date(entry.event.occurred_at).toLocaleString()}</span></button>) : <p className="text-sm text-muted-foreground">No matching entries.</p>}{voiceCursor && !searchPending && <Button variant="ghost" disabled={voiceLoading} onClick={() => void voiceMore()}>Load more entries</Button>}</div>
        : mode === "month" && !customRange ? <SpanMonthCounts anchorDate={anchor} counts={store.counts} loading={store.countsLoading && store.counts.size === 0} onSelectDay={(date) => { setMode("day"); setAnchor(startOfDay(date)); }} />
        : <PlanningTimeline key={mode === "day" && !customRange ? "day" : `${mode}-${days[0].getTime()}`} days={days} spans={spans} loading={loading} unavailable={!!error} onSelect={select} frontiers={store.frontiers} onLoadMore={(day) => loadMoreDay(group, day)}
            {...(mode === "day" && !customRange ? { dayWidth: DAY_WIDTH, hourly: true, anchorDay: anchor, onReachStart: win.before < WINDOW_MAX ? () => extend("before") : undefined, onReachEnd: win.after < WINDOW_MAX ? () => extend("after") : undefined } : {})} />}
    </PageBody>
    <TimelineEntryDialog entry={selected} types={types} onClose={() => setSelected(null)} onChanged={changed} />
    <AddTimelineEntryDialog open={adding} types={types} groups={groups} onClose={() => setAdding(false)} onCreated={changed} />
  </PageContainer>;
}
