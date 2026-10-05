import { useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  Ban,
  Bell,
  CalendarClock,
  Car,
  Check,
  CheckCircle2,
  CircleDashed,
  Clock,
  FolderOpen,
  Hourglass,
  Layers,
  MapPin,
  Music,
  Pencil,
  Phone,
  Plane,
  StickyNote,
  Tag,
  Timer,
  Trash2,
  Users,
  Utensils,
  Wallet,
  X,
  XCircle,
  type LucideProps,
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CategoryIndicator } from "@/components/category-indicator";
import { spansApi } from "@/features/spans/api";
import type {
  Collection,
  Span,
  SpanPatch,
  SpanStatus,
} from "@/features/spans/types";
import { errorMessage } from "@/lib/errors";
import { formatAmount, spanStyle } from "@/lib/span-format";
import { cn } from "@/lib/utils";

type Icon = ComponentType<LucideProps>;

const STATUSES: { value: SpanStatus; label: string; icon: Icon; tone: string }[] =
  [
    { value: "planned", label: "Planned", icon: CalendarClock, tone: "text-sky-300" },
    { value: "active", label: "In progress", icon: Activity, tone: "text-amber-300" },
    { value: "waiting_user", label: "Waiting for you", icon: Hourglass, tone: "text-violet-300" },
    { value: "done", label: "Done", icon: CheckCircle2, tone: "text-emerald-300" },
    { value: "failed", label: "Failed", icon: XCircle, tone: "text-red-400" },
    { value: "cancelled", label: "Cancelled", icon: Ban, tone: "text-zinc-400" },
  ];

const CATEGORIES: { value: string; label: string; icon: Icon }[] = [
  { value: "todo", label: "To-do", icon: CircleDashed },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "call", label: "Call", icon: Phone },
  { value: "meal", label: "Meal", icon: Utensils },
  { value: "expense", label: "Expense", icon: Wallet },
  { value: "ride", label: "Ride", icon: Car },
  { value: "travel", label: "Travel", icon: Plane },
  { value: "visit", label: "Visit", icon: MapPin },
  { value: "reminder", label: "Reminder", icon: Bell },
  { value: "music", label: "Music", icon: Music },
];

const SOURCE_LABELS: Record<string, string> = {
  spotify: "Spotify",
  google_calendar: "Google Calendar",
  playstation: "PlayStation",
  youtube: "YouTube",
  swiggy: "Swiggy",
  zomato: "Zomato",
};

function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(value: string): { date: string; time: string } {
  const d = new Date(value);
  return {
    date: d.toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    time: d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function formatDuration(start: string, end: string): string | null {
  const minutes = Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 60_000,
  );
  if (!Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

function Row({
  icon: RowIcon,
  label,
  children,
}: {
  icon: Icon;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[132px_minmax(0,1fr)] items-start gap-3 py-3">
      <div className="flex items-center gap-2 pt-1 text-[13px] text-muted-foreground">
        <RowIcon className="size-3.5 shrink-0" />
        {label}
      </div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function DateField({
  value,
  disabled,
  placeholder,
  onCommit,
}: {
  value: string | null | undefined;
  disabled: boolean;
  placeholder: string;
  onCommit: (iso: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const shown = value ? formatDate(value) : null;

  const commit = () => {
    setEditing(false);
    const next = draft ? new Date(draft).toISOString() : null;
    if (next !== (value ?? null)) onCommit(next);
  };

  if (editing) {
    return (
      <Input
        autoFocus
        type="datetime-local"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }}
        className="h-8 bg-white/[0.04]"
      />
    );
  }
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setDraft(toLocalInput(value));
        setEditing(true);
      }}
      className={cn(
        "group -mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1 text-left transition",
        !disabled && "hover:bg-white/[0.05]",
      )}
    >
      {shown ? (
        <span className="min-w-0">
          <span className="font-medium">{shown.date}</span>
          <span className="text-muted-foreground"> at {shown.time}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">{placeholder}</span>
      )}
      {!disabled && (
        <Pencil className="ml-auto size-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
      )}
    </button>
  );
}

function PanelBody({
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
  const calendarOwned = span.source === "google_calendar";
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
    <div className="relative isolate flex min-h-full shrink-0 flex-col gap-6 px-8 pb-10 pt-9">
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
            background: `radial-gradient(ellipse 100% 85% at 100% 0%, ${style.dot}88 0%, ${style.dot}3d 40%, ${style.dot}14 62%, transparent 85%)`,
          }}
        />
      </div>
      <div
        aria-hidden
        className="sign-in-noise pointer-events-none absolute inset-0 -z-20"
        style={{
          opacity: 0.05,
          filter: "brightness(0.4) contrast(1.3)",
          backgroundSize: "130px 130px",
          maskImage:
            "linear-gradient(to bottom, #000 0%, #000 45%, rgba(0,0,0,0.35) 100%)",
          WebkitMaskImage:
            "linear-gradient(to bottom, #000 0%, #000 45%, rgba(0,0,0,0.35) 100%)",
        }}
      />

      <SheetHeader className="space-y-0 p-0">
        <div className="flex items-start gap-3">
          <div
            className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border"
            style={{ background: style.bg, borderColor: style.border }}
          >
            <CategoryIndicator
              span={span}
              color={style.dot}
              dotSizeClass="size-2.5"
            />
          </div>
          <div className="min-w-0 flex-1 pr-8">
            {editingTitle ? (
              <>
                <SheetTitle className="sr-only">{span.title}</SheetTitle>
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
                    className="h-9 bg-white/[0.04] font-heading text-base"
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
                <SheetTitle className="font-heading text-xl leading-snug">
                  {span.title}
                </SheetTitle>
                {!calendarOwned && (
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
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="gap-1.5 font-normal">
                <status.icon className={cn("size-3", status.tone)} />
                {status.label}
              </Badge>
              {amount ? <Badge variant="secondary">{amount}</Badge> : null}
            </div>
          </div>
        </div>
        <SheetDescription className="sr-only">
          Details and attributes for this timeline entry.
        </SheetDescription>
      </SheetHeader>

      {calendarOwned && (
        <p className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-muted-foreground">
          Title, time and status are managed by Google Calendar. You can edit
          notes, category and collections.
        </p>
      )}

      <div className="divide-y divide-white/[0.06] border-y border-white/[0.06]">
        <Row icon={status.icon} label="Status">
          <Select
            disabled={calendarOwned || busy}
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
        </Row>

        <Row icon={category?.icon ?? Tag} label="Category">
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
        </Row>

        <Row icon={Clock} label="Start">
          <DateField
            value={span.start_at}
            disabled={calendarOwned || busy}
            placeholder="Add start"
            onCommit={(iso) => void save({ start_at: iso })}
          />
        </Row>

        <Row icon={Clock} label="End">
          <DateField
            value={span.end_at}
            disabled={calendarOwned || busy}
            placeholder="No end time"
            onCommit={(iso) => void save({ end_at: iso })}
          />
        </Row>

        {duration && (
          <Row icon={Timer} label="Duration">
            <span className="px-0">{duration}</span>
          </Row>
        )}

        <Row icon={Layers} label="Source">
          <span className="flex items-center gap-2">
            <span className="capitalize">
              {SOURCE_LABELS[span.source] ?? span.source.replace(/_/g, " ")}
            </span>
          </span>
        </Row>

        <Row icon={StickyNote} label="Notes">
          <Textarea
            rows={3}
            placeholder="Add notes"
            value={notes}
            disabled={busy}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => notes !== span.notes && void save({ notes })}
            className="min-h-0 resize-none border-transparent bg-transparent px-2 py-1 hover:bg-white/[0.05] focus-visible:bg-white/[0.05]"
          />
        </Row>

        {collections.length > 0 && (
          <Row icon={FolderOpen} label="Collections">
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
          </Row>
        )}

        <Row icon={CalendarClock} label="Created">
          <span className="text-muted-foreground">
            {formatDate(span.created_at).date} at{" "}
            {formatDate(span.created_at).time}
          </span>
        </Row>
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

export function SpanPanel({
  span,
  collections,
  onClose,
  onSaved,
}: {
  span: Span | null;
  collections: Collection[];
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet open={!!span} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        overlay={false}
        onInteractOutside={(e) => e.preventDefault()}
        className="vox-scroll w-full overflow-y-auto border-white/10 bg-[#0c0d10] sm:max-w-lg"
      >
        {span ? (
          <PanelBody
            key={span.id}
            initial={span}
            collections={collections}
            onClose={onClose}
            onSaved={onSaved}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
