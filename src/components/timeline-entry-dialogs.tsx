import { useId, useState, type CSSProperties, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Dumbbell,
  Gamepad2,
  Heart,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Wallet,
  Briefcase,
  UserRound,
  X,
} from "lucide-react";
import "./timeline-entry-dialog.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  timelineApi,
  type TimelineEntry,
  type TimelineEventType,
  type TimelineGroup,
} from "@/features/timeline/api";
import { platform } from "@/platform";
import { BrandMark } from "@/components/connected-apps/brand-mark";
import { BRANDS, FALLBACK_BRAND } from "@/components/connected-apps/brands";
import { fade, token } from "@/lib/theme";

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const fromLocalInput = (value: string) => new Date(value).toISOString();
const label = (key: string) =>
  key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

function formatAttributeDate(value: string, precision = "minute"): string {
  // Calendar dates must not shift to the previous day in western time zones.
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  const calendarOnly = dateOnly || ["year", "month", "day"].includes(precision);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    ...(precision !== "year" ? { month: "short" as const } : {}),
    ...(!["year", "month"].includes(precision)
      ? { day: "numeric" as const }
      : {}),
    ...(!calendarOnly
      ? { hour: "numeric" as const, minute: "2-digit" as const }
      : {}),
  }).format(date);
}

function ExpandableAttributeText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > 180;
  return (
    <div className="min-w-0">
      <span id={id} className="whitespace-pre-wrap [overflow-wrap:anywhere]">
        {long && !expanded ? `${text.slice(0, 180).trimEnd()}…` : text}
      </span>
      {long && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-1 block rounded-sm text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-ring"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function formatValue(
  key: string,
  value: unknown,
  content: Record<string, unknown>,
): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (
      /amount|price|total|cost/.test(key) &&
      typeof content.currency === "string"
    )
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: content.currency,
        }).format(value);
      } catch {
        return value.toLocaleString();
      }
    if (key === "duration_seconds") {
      const h = Math.floor(value / 3600);
      const m = Math.round((value % 3600) / 60);
      return h ? `${h}h ${m}m` : `${m}m`;
    }
    if (key === "distance_meters")
      return value >= 1000
        ? `${(value / 1000).toFixed(1)} km`
        : `${Math.round(value)} m`;
    return value.toLocaleString();
  }
  if (typeof value === "string")
    return /^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)
      ? formatAttributeDate(value)
      : value;
  if (Array.isArray(value))
    return value.map((v) => formatValue(key, v, content)).join(", ");
  if (value && typeof value === "object")
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${label(k)}: ${formatValue(k, v, content)}`)
      .join(" · ");
  return String(value);
}

type SchemaProp = { type?: string | string[]; enum?: string[] };
function requiredFields(type: TimelineEventType | undefined) {
  const schema = (type?.content_schema ?? {}) as {
    required?: string[];
    properties?: Record<string, SchemaProp>;
  };
  return (schema.required ?? []).map((name) => {
    const raw = schema.properties?.[name]?.type;
    const kind =
      (Array.isArray(raw) ? raw.find((t) => t !== "null") : raw) ?? "string";
    return { name, kind, options: schema.properties?.[name]?.enum };
  });
}

export function TimelineEntryDialog({
  entry,
  types,
  onClose,
  onChanged,
}: {
  entry: TimelineEntry | null;
  types: TimelineEventType[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const e = entry?.event;
  const content = (e?.content ?? {}) as Record<string, unknown>;
  const brand = BRANDS[entry?.evidence[0]?.source_type ?? ""] ?? {
    ...FALLBACK_BRAND,
    icon: CalendarDays,
  };

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setEditing(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={!!entry}
      onOpenChange={(open) => {
        if (!open) {
          setEditing(false);
          setError("");
          onClose();
        }
      }}
    >
      <DialogContent
        className="timeline-entry-panel"
        style={{ "--entry-glow": fade(brand.color, 28) } as CSSProperties}
      >
        <DialogHeader>
          <BrandMark brand={brand} className="mb-2 size-11" />
          <DialogTitle>{e?.title}</DialogTitle>
          <DialogDescription>
            {e?.summary ||
              types.find((t) => t.id === e?.event_type_id)?.label ||
              "Timeline entry"}
          </DialogDescription>
        </DialogHeader>
        {e && editing ? (
          <form
            className="space-y-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              const form = new FormData(ev.currentTarget);
              const start = String(form.get("occurred_at"));
              const end = String(form.get("ended_at") ?? "");
              void run(() =>
                timelineApi.update(e.id, {
                  title: String(form.get("title")),
                  summary: String(form.get("summary")),
                  occurred_at: fromLocalInput(start),
                  ...(end ? { ended_at: fromLocalInput(end) } : {}),
                }),
              );
            }}
          >
            <Input
              name="title"
              aria-label="Title"
              defaultValue={e.title}
              required
              maxLength={500}
            />
            <Textarea
              name="summary"
              aria-label="Notes"
              placeholder="Notes"
              defaultValue={e.summary ?? ""}
            />
            <label className="block text-xs text-muted-foreground">
              Starts
              <Input
                name="occurred_at"
                type="datetime-local"
                required
                defaultValue={toLocalInput(e.occurred_at)}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Ends
              <Input
                name="ended_at"
                type="datetime-local"
                defaultValue={e.ended_at ? toLocalInput(e.ended_at) : ""}
              />
            </label>
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                Save
              </Button>
            </DialogFooter>
          </form>
        ) : e ? (
          <>
            <section aria-labelledby="entry-attributes" className="space-y-3">
              <h3
                id="entry-attributes"
                className="text-[15px] font-semibold tracking-tight"
              >
                Attributes
              </h3>
              <dl className="grid grid-cols-[minmax(96px,38%)_1fr] items-start gap-x-4 gap-y-3.5 text-[13px]">
                <AttributeRow name="When">
                  {formatAttributeDate(e.occurred_at, e.time_precision)}
                  {e.ended_at && (
                    <span className="block text-muted-foreground">
                      until {formatAttributeDate(e.ended_at, e.time_precision)}
                    </span>
                  )}
                </AttributeRow>
                {Object.entries(content)
                  .filter(
                    ([key, v]) => v != null && v !== "" && key !== "currency",
                  )
                  .map(([key, value]) => (
                    <AttributeRow key={`${e.id}:${key}`} name={label(key)}>
                      <AttributeValue
                        name={key}
                        value={value}
                        content={content}
                      />
                    </AttributeRow>
                  ))}
                {entry.evidence.length > 0 && (
                  <AttributeRow name="Sources">
                    <div className="flex flex-col gap-1.5">
                      {entry.evidence.map((ev) => {
                        const ref = ev.raw_reference ?? "";
                        const id = ev.source_id ?? ref;
                        return (
                          <span
                            key={ev.id}
                            className="flex min-w-0 items-center gap-2"
                          >
                            <BrandMark
                              brand={BRANDS[ev.source_type] ?? brand}
                              className="size-5 rounded-md [&>img]:size-3.5 [&>svg]:size-3"
                            />
                            {label(ev.source_type)}
                            {/^https?:\/\//.test(ref) ? (
                              <button
                                type="button"
                                className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                onClick={() =>
                                  void platform().browser?.openExternal(ref)
                                }
                              >
                                Open
                              </button>
                            ) : id ? (
                              <span className="truncate font-mono text-[11px] text-muted-foreground">
                                {id}
                              </span>
                            ) : null}
                          </span>
                        );
                      })}
                    </div>
                  </AttributeRow>
                )}
              </dl>
            </section>
            <DialogFooter>
              <Button
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={() => {
                  if (window.confirm(`Delete “${e.title}” from your timeline?`))
                    void run(() => timelineApi.remove(e.id));
                }}
              >
                <Trash2 /> Delete
              </Button>
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                <Pencil /> Edit
              </Button>
            </DialogFooter>
          </>
        ) : null}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AttributeRow({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="contents">
      <dt className="min-h-6 py-0.5 leading-5 text-muted-foreground">{name}</dt>
      <dd className="flex min-h-6 min-w-0 flex-col justify-center break-words leading-5">
        {children}
      </dd>
    </div>
  );
}

const TAG_COLORS = [
  "coral",
  "sky",
  "mint",
  "gold",
  "violet",
  "pink",
  "teal",
  "orange",
] as const;
const tagColor = (text: string) =>
  token(
    TAG_COLORS[
      [...text].reduce((h, c) => h + c.charCodeAt(0), 0) % TAG_COLORS.length
    ],
  );

function AttributeValue({
  name,
  value,
  content,
}: {
  name: string;
  value: unknown;
  content: Record<string, unknown>;
}) {
  if (typeof value === "boolean")
    return (
      <span
        role="img"
        aria-label={value ? "Yes" : "No"}
        className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${value ? "bg-primary" : "bg-muted ring-1 ring-border"}`}
      >
        <span
          className={`absolute top-0.5 size-4 rounded-full bg-background shadow-sm ${value ? "left-[18px]" : "left-0.5"}`}
        />
      </span>
    );
  if (Array.isArray(value) && value.every((v) => typeof v !== "object"))
    return (
      <span className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span
            key={String(v)}
            className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-0.5 text-xs"
          >
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full"
              style={{ background: tagColor(String(v)) }}
            />
            {formatValue(name, v, content)}
          </span>
        ))}
      </span>
    );
  const text = formatValue(name, value, content);
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$|^(?=.*\d)[A-Z0-9_-]{8,}$/i.test(text))
    return (
      <span
        className="truncate font-mono text-xs text-muted-foreground"
        title={text}
      >
        {text}
      </span>
    );
  return <ExpandableAttributeText key={text} text={text} />;
}

function CategoryIcon({ value }: { value: string }) {
  if (/finance|expense|money/.test(value)) return <Wallet aria-hidden="true" />;
  if (/work|meeting/.test(value)) return <Briefcase aria-hidden="true" />;
  if (/health/.test(value)) return <Heart aria-hidden="true" />;
  if (/activity|fitness/.test(value)) return <Dumbbell aria-hidden="true" />;
  if (/entertainment|gaming|music/.test(value))
    return <Gamepad2 aria-hidden="true" />;
  return <UserRound aria-hidden="true" />;
}

export function AddTimelineEntryDialog({
  open,
  types,
  groups,
  onClose,
  onCreated,
}: {
  open: boolean;
  types: TimelineEventType[];
  groups: TimelineGroup[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [typeId, setTypeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [hasEnd, setHasEnd] = useState(false);
  const [start, setStart] = useState(() =>
    toLocalInput(new Date().toISOString()),
  );
  const id = useId();
  const activeTypes = types.filter((t) => t.state === "active");
  const type = activeTypes.find((t) => t.id === typeId) ?? activeTypes[0];
  const group = groups.find((g) => g.id === type?.group_id);
  const fields = requiredFields(type);
  const close = () => {
    if (!busy) {
      setError("");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent
        className="timeline-composer"
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          document.getElementById(`${id}-title`)?.focus();
        }}
        onEscapeKeyDown={(event) => {
          if (busy) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (busy) event.preventDefault();
        }}
      >
        <DialogHeader className="timeline-composer-header">
          <div className="timeline-composer-mark" aria-hidden="true">
            <CalendarDays />
          </div>
          <div>
            <DialogTitle className="text-lg font-semibold tracking-tight">
              Add to timeline
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs">
              Record something that happened.
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="ml-auto self-start"
            aria-label="Close"
            disabled={busy}
            onClick={close}
          >
            <X />
          </Button>
        </DialogHeader>
        <form
          className="timeline-composer-form"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!type || busy) return;
            const form = new FormData(ev.currentTarget);
            const title = String(form.get("title")).trim();
            const end = String(form.get("ended_at") ?? "");
            if (!title) {
              setError("Give your entry a title.");
              return;
            }
            if (end && new Date(end) < new Date(start)) {
              setError("End time must be after the start time.");
              return;
            }
            const content: Record<string, unknown> = {};
            for (const { name, kind } of fields) {
              const raw = form.get(`field_${name}`);
              content[name] =
                kind === "boolean"
                  ? raw === "on"
                  : kind === "number" || kind === "integer"
                    ? Number(raw)
                    : String(raw ?? "");
            }
            setBusy(true);
            setError("");
            try {
              await timelineApi.create({
                event_type_id: type.id,
                group_id: type.group_id,
                title,
                summary: String(form.get("summary")) || null,
                occurred_at: fromLocalInput(start),
                ended_at: end ? fromLocalInput(end) : null,
                time_precision: "minute",
                source_timezone:
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                content,
                evidence: [{ source_type: "manual", observation_metadata: {} }],
              });
              setTypeId("");
              setHasEnd(false);
              setStart(toLocalInput(new Date().toISOString()));
              onCreated();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <fieldset disabled={busy} className="timeline-composer-body">
            <div className="timeline-composer-story">
              <label
                htmlFor={`${id}-title`}
                className="timeline-composer-label"
              >
                What happened?
              </label>
              <Input
                id={`${id}-title`}
                name="title"
                placeholder="Give this moment a title"
                required
                maxLength={500}
                className="timeline-composer-title"
              />
              <label htmlFor={`${id}-notes`} className="sr-only">
                Notes (optional)
              </label>
              <Textarea
                id={`${id}-notes`}
                name="summary"
                placeholder="Add a little context… (optional)"
                className="timeline-composer-notes"
              />
            </div>

            <fieldset className="timeline-composer-category">
              <legend className="timeline-composer-label">Category</legend>
              <div className="timeline-composer-categories">
                {groups
                  .filter((g) => activeTypes.some((t) => t.group_id === g.id))
                  .map((g) => {
                    return (
                      <label
                        key={g.id}
                        className="timeline-composer-category-option"
                      >
                        <input
                          type="radio"
                          name="category"
                          value={g.id}
                          checked={type?.group_id === g.id}
                          onChange={() => {
                            setTypeId(
                              activeTypes.find((t) => t.group_id === g.id)!.id,
                            );
                            setError("");
                          }}
                        />
                        <span>
                          <CategoryIcon value={g.value} />
                          {g.label}
                          {type?.group_id === g.id && (
                            <Check
                              aria-hidden="true"
                              className="timeline-composer-check"
                            />
                          )}
                        </span>
                      </label>
                    );
                  })}
              </div>
              <div className="timeline-composer-type">
                <span className="text-muted-foreground [&>svg]:size-4">
                  <CategoryIcon value={group?.value ?? ""} />
                </span>
                <label
                  htmlFor={`${id}-type`}
                  className="text-xs text-muted-foreground"
                >
                  Entry type
                </label>
                <select
                  id={`${id}-type`}
                  value={type?.id ?? ""}
                  onChange={(e) => {
                    setTypeId(e.target.value);
                    setError("");
                  }}
                  disabled={!activeTypes.length}
                  required
                >
                  {!activeTypes.length && (
                    <option value="">No entry types available</option>
                  )}
                  {activeTypes
                    .filter((t) => t.group_id === type?.group_id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="pointer-events-none size-3.5 text-muted-foreground"
                />
              </div>
              {!activeTypes.length && (
                <p role="status" className="mt-2 text-xs text-muted-foreground">
                  Entry types are unavailable. Close and refresh the timeline to
                  try again.
                </p>
              )}
            </fieldset>

            <fieldset className="timeline-composer-when">
              <legend className="timeline-composer-label">
                <Clock3 aria-hidden="true" />
                When it happened
              </legend>
              <div className="timeline-composer-dates">
                <label
                  className="timeline-composer-date-label"
                  htmlFor={`${id}-start`}
                >
                  Starts
                  <Input
                    id={`${id}-start`}
                    name="occurred_at"
                    type="datetime-local"
                    required
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      setError("");
                    }}
                  />
                </label>
                {hasEnd ? (
                  <label
                    className="timeline-composer-date-label"
                    htmlFor={`${id}-end`}
                  >
                    <span className="flex items-center justify-between">
                      Ends{" "}
                      <button
                        type="button"
                        aria-label="Remove end time"
                        onClick={() => setHasEnd(false)}
                      >
                        <X className="size-3.5" />
                      </button>
                    </span>
                    <Input
                      id={`${id}-end`}
                      name="ended_at"
                      type="datetime-local"
                      min={start}
                    />
                  </label>
                ) : (
                  <button
                    type="button"
                    className="timeline-composer-add-end"
                    onClick={() => setHasEnd(true)}
                  >
                    <Plus aria-hidden="true" className="size-3.5" />
                    Add end time<span>Optional</span>
                  </button>
                )}
              </div>
            </fieldset>

            {fields.length > 0 && (
              <fieldset key={type?.id} className="timeline-composer-details">
                <legend className="timeline-composer-label">
                  {type?.label} details
                </legend>
                <div className="timeline-composer-fields">
                  {fields.map(({ name, kind, options }) =>
                    kind === "boolean" ? (
                      <label key={name} className="timeline-composer-toggle">
                        <span>{label(name)}</span>
                        <input type="checkbox" name={`field_${name}`} />
                        <span
                          className="timeline-composer-switch"
                          aria-hidden="true"
                        />
                      </label>
                    ) : (
                      <label
                        key={name}
                        className="timeline-composer-detail-label"
                        htmlFor={`${id}-${name}`}
                      >
                        {label(name)}
                        {options?.length ? (
                          <select
                            id={`${id}-${name}`}
                            name={`field_${name}`}
                            required
                            defaultValue=""
                          >
                            <option value="" disabled>
                              Select {label(name).toLowerCase()}
                            </option>
                            {options.map((value) => (
                              <option key={value} value={value}>
                                {label(value)}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <Input
                            id={`${id}-${name}`}
                            name={`field_${name}`}
                            required
                            type={
                              kind === "number" || kind === "integer"
                                ? "number"
                                : "text"
                            }
                            step={kind === "integer" ? "1" : "any"}
                            placeholder={
                              /amount|price|cost/.test(name)
                                ? "0.00"
                                : undefined
                            }
                          />
                        )}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
            )}
            {error && (
              <p role="alert" className="timeline-composer-error">
                {error}
              </p>
            )}
          </fieldset>
          <div className="timeline-composer-footer">
            <span className="timeline-composer-footer-note">
              <span aria-hidden="true" className="timeline-composer-dot" />
              Manual entry
            </span>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={close}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !type}>
              {busy ? (
                <Loader2 className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Plus />
              )}
              {busy ? "Adding…" : "Add entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
