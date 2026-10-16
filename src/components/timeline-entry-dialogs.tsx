import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
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

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
const fromLocalInput = (value: string) => new Date(value).toISOString();
const label = (key: string) =>
  key.replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase());

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
    return /^\d{4}-\d{2}-\d{2}T/.test(value)
      ? new Date(value).toLocaleString()
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

type SchemaProp = { type?: string | string[] };
function requiredFields(type: TimelineEventType | undefined) {
  const schema = (type?.content_schema ?? {}) as {
    required?: string[];
    properties?: Record<string, SchemaProp>;
  };
  return (schema.required ?? []).map((name) => {
    const raw = schema.properties?.[name]?.type;
    const kind =
      (Array.isArray(raw) ? raw.find((t) => t !== "null") : raw) ?? "string";
    return { name, kind };
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
  const dayOnly = e && ["year", "month", "day"].includes(e.time_precision);

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
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
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
            <p className="text-xs text-muted-foreground">
              {dayOnly
                ? new Date(e.occurred_at).toLocaleDateString()
                : new Date(e.occurred_at).toLocaleString()}
              {e.ended_at && ` – ${new Date(e.ended_at).toLocaleString()}`}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {Object.entries(content)
                .filter(
                  ([key, v]) => v != null && v !== "" && key !== "currency",
                )
                .map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-xs leading-5 text-muted-foreground">
                      {label(key)}
                    </dt>
                    <dd className="break-words">
                      {formatValue(key, value, content)}
                    </dd>
                  </div>
                ))}
            </dl>
            {entry.evidence.length > 0 && (
              <div className="space-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Sources</p>
                {entry.evidence.map((ev) => {
                  const ref = ev.raw_reference ?? "";
                  return (
                    <p key={ev.id}>
                      {label(ev.source_type)}
                      {/^https?:\/\//.test(ref) ? (
                        <>
                          {" · "}
                          <button
                            type="button"
                            className="underline underline-offset-2 hover:text-foreground"
                            onClick={() =>
                              void platform().browser?.openExternal(ref)
                            }
                          >
                            Open source
                          </button>
                        </>
                      ) : ev.source_id || ref ? (
                        ` · ${ev.source_id ?? ref}`
                      ) : null}
                    </p>
                  );
                })}
              </div>
            )}
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
  const type = types.find((t) => t.id === typeId) ?? types[0];
  const fields = requiredFields(type);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to timeline</DialogTitle>
          <DialogDescription>Record something that happened.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (ev) => {
            ev.preventDefault();
            if (!type) return;
            const form = new FormData(ev.currentTarget);
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
            const end = String(form.get("ended_at") ?? "");
            setBusy(true);
            setError("");
            try {
              await timelineApi.create({
                event_type_id: type.id,
                group_id: type.group_id,
                title: String(form.get("title")),
                summary: String(form.get("summary")) || null,
                occurred_at: fromLocalInput(String(form.get("occurred_at"))),
                ended_at: end ? fromLocalInput(end) : null,
                time_precision: "minute",
                source_timezone:
                  Intl.DateTimeFormat().resolvedOptions().timeZone,
                content,
                evidence: [{ source_type: "manual", observation_metadata: {} }],
              });
              onCreated();
              onClose();
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="block text-xs text-muted-foreground">
            Type
            <select
              value={type?.id ?? ""}
              onChange={(e) => setTypeId(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground"
            >
              {groups.map((g) => (
                <optgroup key={g.id} label={g.label}>
                  {types
                    .filter((t) => t.group_id === g.id && t.state === "active")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
          <Input
            name="title"
            aria-label="Title"
            placeholder="Title"
            required
            maxLength={500}
          />
          <Textarea
            name="summary"
            aria-label="Notes"
            placeholder="Notes (optional)"
          />
          <label className="block text-xs text-muted-foreground">
            When
            <Input
              name="occurred_at"
              type="datetime-local"
              required
              defaultValue={toLocalInput(new Date().toISOString())}
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Ends (optional)
            <Input name="ended_at" type="datetime-local" />
          </label>
          {fields.map(({ name, kind }) =>
            kind === "boolean" ? (
              <label
                key={`${type?.id}-${name}`}
                className="flex items-center gap-2 text-sm"
              >
                <input type="checkbox" name={`field_${name}`} /> {label(name)}
              </label>
            ) : (
              <label
                key={`${type?.id}-${name}`}
                className="block text-xs text-muted-foreground"
              >
                {label(name)}
                <Input
                  name={`field_${name}`}
                  required
                  type={
                    kind === "number" || kind === "integer" ? "number" : "text"
                  }
                  step="any"
                />
              </label>
            ),
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !type}>
              {busy ? "Adding…" : "Add entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
