import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { discoveryApi } from "@/features/pulse/api";
import type {
  DiscoveryResponse,
  PulseSuggestion,
} from "@/features/pulse/discovery-types";
import { PulseChartCard, PulseChartSkeleton } from "./chart-card";
import { ChartEditor } from "./chart-editor";
export function SuggestionsView({ onSaved }: { onSaved: () => void }) {
  const [response, setResponse] = useState<DiscoveryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<PulseSuggestion | null>(null);
  const active = useRef(true);
  async function load(more: boolean) {
    setLoading(true);
    setError("");
    try {
      const data = await discoveryApi.discover({ more });
      if (active.current) setResponse(data);
    } catch (e) {
      if (active.current) setError(String(e));
    } finally {
      if (active.current) setLoading(false);
    }
  }
  useEffect(() => {
    active.current = true;
    queueMicrotask(() => void load(false));
    return () => {
      active.current = false;
    };
  }, []);
  async function dismiss(s: PulseSuggestion) {
    try {
      await discoveryApi.dismiss(s.definition);
      setResponse((current) =>
        current
          ? {
              ...current,
              suggestions: current.suggestions.filter(
                (item) => item.definition !== s.definition,
              ),
            }
          : current,
      );
    } catch (e) {
      setError(String(e));
    }
  }
  if (editing)
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
          <ArrowLeft className="h-3 w-3" />
          Suggestions
        </Button>
        <ChartEditor
          initialDefinition={editing.definition}
          initialPreview={editing.preview}
          initialTitle={editing.title}
          measurement={editing.measurement}
          onSaved={onSaved}
        />
      </div>
    );
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {loading
            ? "Generating suggestions from your activity — this can take a minute…"
            : response
            ? `Based on ${response.record_count.toLocaleString()} recorded entries across ${response.source_count} data ${response.source_count === 1 ? "source" : "sources"}.`
            : "Looking through your activity…"}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={() => void load(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Generate more
        </Button>
      </div>
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 text-xs text-destructive"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load(false)}>
            Retry
          </Button>
        </div>
      )}
      {!loading && response && response.suggestions.length === 0 && (
        <div className="py-8 text-sm text-muted-foreground">
          <p>No new charts with enough recorded data yet.</p>
          <p className="mt-2 text-xs">
            Sync your connected apps or add dated entries. Saved and dismissed
            charts are excluded.
          </p>
          {response.connections.length > 0 && (
            <p className="mt-3 text-xs">
              Connections:{" "}
              {response.connections
                .map(
                  (c) =>
                    `${c.connector_id.replaceAll("_", " ")}${c.authorization_state !== "authorized" ? " (reconnect needed)" : !c.sync_timeline || !c.assistant_read ? " (capture or read access off)" : ""}`,
                )
                .join(", ")}
            </p>
          )}
        </div>
      )}
      <div className="pulse-chart-grid" aria-busy={loading}>
        {response?.suggestions.map((s) => (
          <Suggestion
            key={s.definition.measurement_id + JSON.stringify(s.definition)}
            suggestion={s}
            onSaved={onSaved}
            onEdit={() => setEditing(s)}
            onDismiss={() => void dismiss(s)}
          />
        ))}
        {loading &&
          Array.from({ length: response ? 2 : 8 }, (_, i) => (
            <PulseChartSkeleton key={`s${i}`} />
          ))}
      </div>
    </div>
  );
}
export function Suggestion({
  suggestion: s,
  onSaved,
  onEdit,
  onDismiss,
}: {
  suggestion: PulseSuggestion;
  onSaved: () => void;
  onEdit: () => void;
  onDismiss: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await discoveryApi.save(s.title, s.definition, key.current);
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <PulseChartCard
      title={s.title}
      definition={s.definition}
      result={s.preview}
      source={s.measurement.profile.source}
    >
      <p className="mb-3 text-xs text-muted-foreground">{s.reason}</p>
      {error && (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={saving} onClick={() => void save()}>
          {saving ? "Adding…" : "Add to Pulse"}
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onEdit}>
          Customize
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </PulseChartCard>
  );
}
