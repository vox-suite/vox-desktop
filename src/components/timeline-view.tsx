import { useDesktopContext } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageContainer, PageBody } from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";
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
  const [typeFilter, setTypeFilter] = useState("");
  const [merchantInput, setMerchantInput] = useState("");
  const [merchant, setMerchant] = useState("");
  const [spendingOnly, setSpendingOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => { setSearch(searchInput.trim()); setMerchant(merchantInput.trim()); }, 300);
    return () => clearTimeout(id);
  }, [searchInput, merchantInput]);
  const manualFilter = !!(search || typeFilter || merchant || spendingOnly);
  const voiceFilter = voiceContext ?? (manualFilter ? { timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, spendingOnly, category: null } : null);
  const [mode, setMode] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [range, setRange] = useState<DateRange | null>(null);
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<TimelineGroup[]>([]);
  const [types, setTypes] = useState<TimelineEventType[]>([]);
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const [windowState, setWindowState] = useState({ key: anchor.getTime(), before: 2, after: 2 });
  const [metaError, setMetaError] = useState("");
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
    Promise.all([timelineApi.groups(), timelineApi.types()])
      .then(([g, t]) => { if (active) { setGroups(g); setTypes(t); } })
      .catch((e: unknown) => { if (active) setMetaError(String(e)); });
    return () => { active = false; };
  }, []);

  const [voiceEntries, setVoiceEntries] = useState<TimelineEntry[]>([]);
  const [voiceCursor, setVoiceCursor] = useState<string | null>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const voiceTicket = useRef(0);
  const voiceStart = voiceContext?.startAt ?? null;
  const voiceEnd = voiceContext?.endAt ?? null;
  const spending = { spending_only: voiceFilter?.spendingOnly || spendingOnly || undefined, merchant: voiceContext?.merchant || merchant || null, category: voiceContext?.category, search: search || null, event_type_id: typeFilter || null };
  useEffect(() => {
    if (!voiceFilter) return;
    const current = ++voiceTicket.current;
    setVoiceLoading(true); setVoiceError(""); setVoiceEntries([]); setVoiceCursor(null);
    timelineApi.query({ start_at: voiceStart, end_at: voiceEnd, group_value: group || null, limit: TIMELINE_PAGE_SIZE, ...spending })
      .then((page) => { if (voiceTicket.current === current) { setVoiceEntries(page.events); setVoiceCursor(page.next_cursor ?? null); } })
      .catch((e: unknown) => { if (voiceTicket.current === current) setVoiceError(String(e)); })
      .finally(() => { if (voiceTicket.current === current) setVoiceLoading(false); });
    return () => { voiceTicket.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceContext, voiceStart, voiceEnd, group, search, typeFilter, merchant, spendingOnly, refresh]);
  async function voiceMore() {
    if (!voiceCursor || voiceLoading) return;
    const current = voiceTicket.current;
    setVoiceLoading(true);
    try {
      const page = await timelineApi.query({ start_at: voiceStart, end_at: voiceEnd, group_value: group || null, cursor: voiceCursor, limit: TIMELINE_PAGE_SIZE, ...spending });
      if (voiceTicket.current === current) { setVoiceEntries((all) => [...all, ...page.events]); setVoiceCursor(page.next_cursor ?? null); }
    } catch (e) {
      if (voiceTicket.current === current) setVoiceError(String(e));
    } finally {
      if (voiceTicket.current === current) setVoiceLoading(false);
    }
  }

  const entries = voiceFilter ? voiceEntries : store.entries;
  const loading = voiceFilter ? voiceLoading : store.loading || store.countsLoading;
  const error = metaError || (voiceFilter ? voiceError : store.error);
  const spans = useMemo(() => entries.map((entry) => toSpan(entry, groups)), [entries, groups]);
  const reload = () => (voiceFilter ? setRefresh((n) => n + 1) : timelineDays.invalidate());
  const changed = () => { timelineDays.invalidate(); setRefresh((n) => n + 1); setSelected(null); };
  const clearFilters = () => { desktopStore.patch({ timeline: null }); setSearchInput(""); setSearch(""); setTypeFilter(""); setMerchantInput(""); setMerchant(""); setSpendingOnly(false); };
  const select = (span: Span) => setSelected(entries.find((e) => e.event.id === span.id) ?? null);
  const extend = (side: "before" | "after") =>
    setWindowState({ ...win, [side]: Math.min(WINDOW_MAX, win[side] + WINDOW_STEP) });

  return <PageContainer><TimelineHeader range={range} onRangeChange={(next) => { setRange(next); if (next?.from) { setAnchor(startOfDay(next.from)); setMode(next.to && startOfDay(next.to).getTime() !== startOfDay(next.from).getTime() ? "week" : "day"); } }} anchor={anchor} days={mode === "day" && !customRange ? [anchor] : days} mode={mode} onBack={onBack} loading={loading} onReload={reload}
    onModeChange={(next) => { setRange(null); setMode(next); setAnchor((date) => next === "month" ? startOfMonth(date) : next === "week" ? addDays(date, -date.getDay()) : date); }}
    onPrev={() => { if (range) setRange(null); setAnchor((date) => mode === "month" ? addMonths(date, -1) : addDays(date, mode === "week" ? -7 : -1)); }}
    onNext={() => { if (range) setRange(null); setAnchor((date) => mode === "month" ? addMonths(date, 1) : addDays(date, mode === "week" ? 7 : 1)); }} />
    <div className="flex shrink-0 gap-2 overflow-x-auto border-b border-border px-6 py-2" role="group" aria-label="Timeline groups">
      <Button size="sm" variant={!group ? "secondary" : "ghost"} onClick={() => setGroup("")}>All</Button>
      {groups.map((g) => <Button key={g.id} size="sm" variant={group === g.value ? "secondary" : "ghost"} onClick={() => setGroup(g.value)}>{g.label}</Button>)}
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <Input aria-label="Search timeline" placeholder="Search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="h-8 w-40 text-xs" />
        <select aria-label="Event type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-8 rounded-md border border-border bg-background px-2 text-xs">
          <option value="">All types</option>
          {types.filter((t) => !group || groups.find((g) => g.id === t.group_id)?.value === group).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <Input aria-label="Merchant" placeholder="Merchant" value={merchantInput} onChange={(e) => setMerchantInput(e.target.value)} className="h-8 w-28 text-xs" />
        <Button size="sm" variant={spendingOnly ? "secondary" : "ghost"} aria-pressed={spendingOnly} onClick={() => setSpendingOnly((v) => !v)}>Spending</Button>
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}><Plus /> Add</Button>
      </div>
    </div>
    {error && <p role="alert" className="px-6 py-2 text-xs text-destructive">{error}</p>}
    <PageBody scroll={false} className="flex flex-col">
      {voiceFilter ? <div className="overflow-auto p-6"><div className="mb-4 flex items-center justify-between"><span className="text-xs text-muted-foreground">{voiceFilter.spendingOnly ? "Spending" : "Entries"} · {voiceStart && voiceEnd ? `${new Date(voiceStart).toLocaleDateString()} – ${new Date(voiceEnd).toLocaleDateString()} · ${voiceFilter.timezone}` : "All time"}</span><Button variant="ghost" size="sm" onClick={clearFilters}>Clear filter</Button></div>{voiceLoading && !voiceEntries.length ? <div className="h-32 animate-pulse rounded bg-muted"/> : voiceEntries.length ? voiceEntries.map(entry => <button key={entry.event.id} onClick={() => setSelected(entry)} className="flex w-full justify-between border-b border-border py-4 text-left text-sm"><span>{entry.event.title}{entry.event.summary && <span className="block text-xs text-muted-foreground">{entry.event.summary}</span>}</span><span className="text-xs text-muted-foreground">{new Date(entry.event.occurred_at).toLocaleString()}</span></button>) : <p className="text-sm text-muted-foreground">No matching entries.</p>}{voiceCursor && <Button variant="ghost" disabled={voiceLoading} onClick={() => void voiceMore()}>Load more entries</Button>}</div>
        : mode === "month" && !customRange ? <SpanMonthCounts anchorDate={anchor} counts={store.counts} loading={store.countsLoading && store.counts.size === 0} onSelectDay={(date) => { setMode("day"); setAnchor(startOfDay(date)); }} />
        : <PlanningTimeline key={mode === "day" && !customRange ? "day" : `${mode}-${days[0].getTime()}`} days={days} spans={spans} loading={loading} unavailable={!!error} onSelect={select} frontiers={store.frontiers} onLoadMore={(day) => loadMoreDay(group, day)}
            {...(mode === "day" && !customRange ? { dayWidth: DAY_WIDTH, hourly: true, anchorDay: anchor, onReachStart: win.before < WINDOW_MAX ? () => extend("before") : undefined, onReachEnd: win.after < WINDOW_MAX ? () => extend("after") : undefined } : {})} />}
    </PageBody>
    <TimelineEntryDialog entry={selected} types={types} onClose={() => setSelected(null)} onChanged={changed} />
    <AddTimelineEntryDialog open={adding} types={types} groups={groups} onClose={() => setAdding(false)} onCreated={changed} />
  </PageContainer>;
}
