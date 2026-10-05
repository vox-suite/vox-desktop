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
  Gamepad2,
  Info,
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
  Video,
  Utensils,
  Wallet,
  X,
  XCircle,
  type LucideProps,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import { useOutsideGuard } from "@/hooks/use-outside-guard";
import { errorMessage } from "@/lib/errors";
import {
  displayTitle,
  formatAmount,
  spanCover,
  spanStyle,
} from "@/lib/span-format";
import { cn } from "@/lib/utils";

type Icon = ComponentType<LucideProps>;

const STATUSES: {
  value: SpanStatus;
  label: string;
  icon: Icon;
  tone: string;
}[] = [
  {
    value: "planned",
    label: "Planned",
    icon: CalendarClock,
    tone: "text-sky-300",
  },
  {
    value: "active",
    label: "In progress",
    icon: Activity,
    tone: "text-amber-300",
  },
  {
    value: "waiting_user",
    label: "Waiting for you",
    icon: Hourglass,
    tone: "text-violet-300",
  },
  {
    value: "done",
    label: "Done",
    icon: CheckCircle2,
    tone: "text-emerald-300",
  },
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
  { value: "gaming", label: "Gaming", icon: Gamepad2 },
  { value: "video", label: "Video", icon: Video },
];

// The server rejects title/time/status edits for these sources.
const PROVIDER_OWNED = new Set(["google_calendar", "spotify", "youtube"]);

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
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-3 py-2">
      <div className="flex items-center gap-2 pt-1 text-[13px] text-muted-foreground">
        <RowIcon className="size-3.5 shrink-0" />
        {label}
      </div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}

function DateTimeField({
  value,
  disabled,
  placeholder,
  clearable,
  onCommit,
}: {
  value: string | null | undefined;
  disabled: boolean;
  placeholder: string;
  clearable?: boolean;
  onCommit: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date | undefined>();
  const [time, setTime] = useState("00:00");
  const shown = value ? formatDate(value) : null;

  const onOpenChange = (next: boolean) => {
    if (next) {
      const d = value ? new Date(value) : new Date();
      setDay(d);
      setTime(toLocalInput(d.toISOString()).slice(11));
    }
    setOpen(next);
  };

  const apply = () => {
    if (!day) return;
    const [h, m] = time.split(":").map(Number);
    const next = new Date(day);
    next.setHours(h || 0, m || 0, 0, 0);
    setOpen(false);
    if (!value || next.getTime() !== new Date(value).getTime()) {
      onCommit(next.toISOString());
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
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
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={day}
          onSelect={setDay}
          defaultMonth={day}
        />
        <div className="flex items-center gap-2 bg-white/[0.03] p-3">
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-8 w-32"
          />
          {clearable && value ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onCommit(null);
              }}
            >
              Clear
            </Button>
          ) : null}
          <Button size="sm" className="ml-auto" disabled={!day} onClick={apply}>
            Set
          </Button>
        </div>
      </PopoverContent>
    </Popover>
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
    // Moving the start carries the end along so the duration is kept.
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
            className="absolute inset-0 size-full scale-110 object-cover opacity-30 blur-xl saturate-125"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0c0d10]/50 via-[#0c0d10]/70 to-[#0c0d10]/90" />
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
              background: `radial-gradient(ellipse 100% 85% at 100% 0%, ${style.dot}88 0%, ${style.dot}3d 40%, ${style.dot}14 62%, transparent 85%)`,
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
            {amount ? (
              <Badge variant="secondary" className="mt-2">
                {amount}
              </Badge>
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
        <Row icon={status.icon} label="Status">
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
          <DateTimeField
            value={span.start_at}
            disabled={providerOwned || busy}
            placeholder="Add start"
            onCommit={(iso) => void saveTime({ start_at: iso })}
          />
        </Row>

        <Row icon={Clock} label="End">
          <DateTimeField
            clearable
            value={span.end_at}
            disabled={providerOwned || busy}
            placeholder="No end time"
            onCommit={(iso) => void saveTime({ end_at: iso })}
          />
        </Row>

        {duration && (
          <Row icon={Timer} label="Duration">
            <span className="px-0">{duration}</span>
          </Row>
        )}

        <Row icon={Layers} label="Source">
          <span className="flex items-center gap-2">
            <span className="capitalize">{sourceLabel}</span>
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
  const outsideGuard = useOutsideGuard();
  return (
    <Sheet open={!!span} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        overlay={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={outsideGuard}
        className="vox-scroll w-full overflow-y-auto border-white/10 bg-[#0c0d10] sm:max-w-lg [&_[data-slot=sheet-close]]:top-6"
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
