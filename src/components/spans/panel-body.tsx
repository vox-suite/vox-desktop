import { useState } from "react";
import {
  CalendarClock,
  Check,
  Clock,
  FolderOpen,
  Info,
  Layers,
  Pencil,
  StickyNote,
  Tag,
  Timer,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CategoryIndicator } from "@/components/category-indicator";
import { spansApi } from "@/features/spans/api";
import type {
  Collection,
  Span,
  SpanPatch,
  SpanStatus,
} from "@/features/spans/types";
import { errorMessage } from "@/lib/errors";
import {
  displayTitle,
  formatAmount,
  isEstimated,
  spanCover,
  spanStyle,
} from "@/lib/span-format";
import { cn } from "@/lib/utils";
import {
  CATEGORIES,
  PROVIDER_OWNED,
  SOURCE_LABELS,
  STATUSES,
} from "./constants";
import { formatDate, formatDuration } from "./span-date-utils";
import { DateTimeField } from "./datetime-field";
import { PanelRow } from "./panel-row";

export function PanelBody({
  initial,
  collections,
  onClose,
  onSaved,
}: {
  initial: Span;
  collections: Collection[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [span, setSpan] = useState(initial);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(initial.title);
  const [notes, setNotes] = useState(initial.notes);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const style = spanStyle(span);
  const providerOwned = PROVIDER_OWNED.has(span.source);
  const sourceLabel =
    SOURCE_LABELS[span.source] ?? span.source.replace(/_/g, " ");
  const cover = spanCover(span);
  const status = STATUSES.find((s) => s.value === span.status) ?? STATUSES[0];
  const category = CATEGORIES.find((c) => c.value === span.category);
  const amount = formatAmount(span);
  const duration =
    span.start_at && span.end_at
      ? formatDuration(span.start_at, span.end_at)
      : null;

  async function save(patch: SpanPatch) {
    setError("");
    setBusy(true);
    try {
      const updated = await spansApi.updateSpan(span.id, patch);
      setSpan(updated);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveTime(patch: {
    start_at?: string | null;
    end_at?: string | null;
  }) {
    if (
      patch.start_at &&
      patch.end_at === undefined &&
      span.start_at &&
      span.end_at
    ) {
      const length =
        new Date(span.end_at).getTime() - new Date(span.start_at).getTime();
      if (length >= 0) {
        patch = {
          ...patch,
          end_at: new Date(
            new Date(patch.start_at).getTime() + length,
          ).toISOString(),
        };
      }
    }
    const start = patch.start_at !== undefined ? patch.start_at : span.start_at;
    const end = patch.end_at !== undefined ? patch.end_at : span.end_at;
    if (start && end && new Date(end) < new Date(start)) {
      setError("End must be after start");
      return;
    }
    await save(patch);
  }

  async function commitTitle() {
    const next = title.trim();
    setEditingTitle(false);
    if (!next) {
      setTitle(span.title);
      return;
    }
    if (next !== span.title) await save({ title: next });
  }

  async function toggleCollection(id: string, on: boolean) {
    setBusy(true);
    setError("");
    try {
      await spansApi.setSpanCollection(id, span.id, on);
      setSpan({
        ...span,
        collection_ids: on
          ? [...span.collection_ids, id]
          : span.collection_ids.filter((c) => c !== id),
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await spansApi.deleteSpan(span.id);
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="relative isolate flex min-h-full flex-1 shrink-0 flex-col gap-4 px-5 pb-6 pt-6">
      {cover ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <img
            src={cover}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 size-full scale-110 object-cover opacity-15 blur-xl"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c0d10]/75 via-[#0c0d10]/85 to-[#0c0d10]/95" />
        </div>
      ) : span.source !== "spotify" ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden"
          style={{
            maskImage:
              "linear-gradient(to bottom, #000 0%, #000 40%, transparent 100%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, #000 0%, #000 40%, transparent 100%)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse 75% 70% at 34px 38px, ${style.dot}40 0%, ${style.dot}1f 35%, ${style.dot}0a 60%, transparent 85%)`,
            }}
          />
        </div>
      ) : null}
      <div
        aria-hidden
        className="sign-in-noise pointer-events-none absolute inset-0 -z-20"
        style={{
          opacity: 0.05,
          filter: "brightness(0.4) contrast(1.3)",
          backgroundSize: "130px 130px",
          maskImage:
            "linear-gradient(to bottom, #000 0%, #000 60%, rgba(0,0,0,0.4) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 0%, #000 60%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      <SheetHeader className="space-y-0 p-0">
        <div className="flex items-start gap-3">
          <div
            className="grid size-7 shrink-0 place-items-center rounded-lg border"
            style={{ background: style.bg, borderColor: style.border }}
          >
            <CategoryIndicator
              span={span}
              color={style.dot}
              dotSizeClass="size-2.5"
            />
          </div>
          <div
            className={cn("min-w-0 flex-1", providerOwned ? "pr-16" : "pr-9")}
          >
            {editingTitle ? (
              <>
                <SheetTitle className="sr-only">
                  {displayTitle(span)}
                </SheetTitle>
                <div className="flex items-center gap-1.5">
                  <Input
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitTitle();
                      if (e.key === "Escape") {
                        setTitle(span.title);
                        setEditingTitle(false);
                      }
                    }}
                    className="h-7 bg-white/[0.04] font-heading text-base"
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Save title"
                    onClick={() => void commitTitle()}
                  >
                    <Check />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    title="Cancel"
                    onClick={() => {
                      setTitle(span.title);
                      setEditingTitle(false);
                    }}
                  >
                    <X />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-start gap-1.5">
                <SheetTitle className="font-heading text-lg leading-7">
                  {displayTitle(span)}
                </SheetTitle>
                {!providerOwned && (
                  <Button
                    size="icon-xs"
                    variant="ghost"
                    title="Edit title"
                    className="mt-0.5 shrink-0 text-muted-foreground"
                    onClick={() => setEditingTitle(true)}
                  >
                    <Pencil />
                  </Button>
                )}
              </div>
            )}
            {amount || isEstimated(span) ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {amount ? <Badge variant="secondary">{amount}</Badge> : null}
                {isEstimated(span) ? (
                  <Badge variant="outline" className="font-normal">
                    Estimated time
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <SheetDescription className="sr-only">
          Details and attributes for this timeline entry.
        </SheetDescription>
      </SheetHeader>

      {providerOwned && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Managed by ${sourceLabel}`}
              className="absolute top-6 right-12 text-muted-foreground"
            >
              <Info />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" className="max-w-56">
            Title, time and status are managed by {sourceLabel}. You can edit
            notes, category and collections.
          </TooltipContent>
        </Tooltip>
      )}

      <div className="flex flex-col">
        <PanelRow icon={status.icon} label="Status">
          <Select
            disabled={providerOwned || busy}
            value={span.status}
            onValueChange={(v) => v && void save({ status: v as SpanStatus })}
          >
            <SelectTrigger className="h-8 w-full border-transparent bg-transparent px-2 hover:bg-white/[0.05]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  <span className="flex items-center gap-2">
                    <s.icon className={cn("size-3.5", s.tone)} />
                    {s.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelRow>

        <PanelRow icon={category?.icon ?? Tag} label="Category">
          <Select
            disabled={busy}
            value={span.category}
            onValueChange={(v) => v && void save({ category: v })}
          >
            <SelectTrigger className="h-8 w-full border-transparent bg-transparent px-2 capitalize hover:bg-white/[0.05]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {!category && (
                <SelectItem value={span.category}>
                  <span className="flex items-center gap-2 capitalize">
                    <Tag className="size-3.5" />
                    {span.category}
                  </span>
                </SelectItem>
              )}
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  <span className="flex items-center gap-2">
                    <c.icon className="size-3.5" />
                    {c.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </PanelRow>

        <PanelRow icon={Clock} label="Start">
          <DateTimeField
            value={span.start_at}
            disabled={providerOwned || busy}
            placeholder="Add start"
            onCommit={(iso) => void saveTime({ start_at: iso })}
          />
        </PanelRow>

        <PanelRow icon={Clock} label="End">
          <DateTimeField
            clearable
            value={span.end_at}
            disabled={providerOwned || busy}
            placeholder="No end time"
            onCommit={(iso) => void saveTime({ end_at: iso })}
          />
        </PanelRow>

        {duration && (
          <PanelRow icon={Timer} label="Duration">
            <span className="px-0">{duration}</span>
          </PanelRow>
        )}

        <PanelRow icon={Layers} label="Source">
          <span className="flex items-center gap-2">
            <span className="capitalize">{sourceLabel}</span>
          </span>
        </PanelRow>

        <PanelRow icon={StickyNote} label="Notes">
          <Textarea
            rows={3}
            placeholder="Add notes"
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== span.notes && void save({ notes })}
            className="min-h-0 resize-none border-transparent bg-transparent px-2 py-1 hover:bg-white/[0.05] focus-visible:bg-white/[0.05]"
          />
        </PanelRow>

        {collections.length > 0 && (
          <PanelRow icon={FolderOpen} label="Collections">
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {collections.map((c) => {
                const on = span.collection_ids.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => void toggleCollection(c.id, !on)}
                    className={cn(
                      "rounded-full border px-2.5 py-0.5 text-xs transition",
                      on
                        ? "border-white/30 bg-white/10 text-foreground"
                        : "border-white/10 text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                  </button>
                );
              })}
            </div>
          </PanelRow>
        )}

        <PanelRow icon={CalendarClock} label="Created">
          <span className="text-muted-foreground">
            {formatDate(span.created_at).date} at{" "}
            {formatDate(span.created_at).time}
          </span>
        </PanelRow>
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Button
        variant="ghost"
        className="w-fit gap-1.5 text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => void remove()}
      >
        <Trash2 className="size-3.5" />
        Delete entry
      </Button>
    </div>
  );
}
