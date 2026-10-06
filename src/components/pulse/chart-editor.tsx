import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoveryApi } from "@/features/pulse/api";
import type {
  Measurement,
  PulseDefinition,
  PulseResult,
} from "@/features/pulse/discovery-types";
import { LatestRequest } from "@/features/pulse/settings";
import { PulseChartCard } from "./chart-card";
const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-xs";
export function ChartEditor({
  measurement,
  initialDefinition,
  initialPreview,
  initialTitle,
  onSaved,
}: {
  measurement: Measurement;
  initialDefinition: PulseDefinition;
  initialPreview?: PulseResult;
  initialTitle?: string;
  onSaved: () => void;
}) {
  const [definition, setDefinition] = useState(initialDefinition);
  const [title, setTitle] = useState(initialTitle ?? measurement.title);
  const [preview, setPreview] = useState<PulseResult | null>(
    initialPreview ?? null,
  );
  const [loading, setLoading] = useState(!initialPreview);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const requests = useRef(new LatestRequest());
  const key = useRef(crypto.randomUUID());
  const inFlight = useRef(false);
  useEffect(() => {
    const ticket = requests.current.start();
    const requestState = requests.current;
    if (!initialPreview)
      void discoveryApi
        .preview(initialDefinition)
        .then((result) => {
          if (requestState.isCurrent(ticket)) {
            setPreview(result);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (requestState.isCurrent(ticket)) {
            setError(String(e));
            setLoading(false);
          }
        });
    return () => requestState.cancel();
  }, [initialDefinition, initialPreview]);
  async function change(next: PulseDefinition) {
    setDefinition(next);
    setLoading(true);
    setError("");
    key.current = crypto.randomUUID();
    const ticket = requests.current.start();
    try {
      const result = await discoveryApi.preview(next);
      if (requests.current.isCurrent(ticket)) {
        setPreview(result);
        setLoading(false);
      }
    } catch (e) {
      if (requests.current.isCurrent(ticket)) {
        setError(String(e));
        setLoading(false);
        setPreview(null);
      }
    }
  }
  async function save() {
    if (inFlight.current || loading || !preview || !title.trim()) return;
    inFlight.current = true;
    setSaving(true);
    setError("");
    try {
      await discoveryApi.save(title, definition, key.current);
      onSaved();
    } catch (e) {
      setError(String(e));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="pulse-editor">
      <label className="block space-y-1 text-xs">
        <span>Chart name</span>
        <Input
          value={title}
          maxLength={120}
          disabled={saving}
          onChange={(e) => {
            setTitle(e.target.value);
            key.current = crypto.randomUUID();
          }}
        />
      </label>
      <div className="pulse-editor-fields">
        <label className="flex flex-col gap-1 text-xs">
          Group by
          <select
            className={selectClass}
            disabled={saving}
            value={
              definition.bucket
                ? `time:${definition.bucket}`
                : `field:${definition.dimension}`
            }
            onChange={(e) => {
              const [kind, value] = e.target.value.split(":");
              void change({
                ...definition,
                bucket:
                  kind === "time" ? (value as PulseDefinition["bucket"]) : null,
                dimension: kind === "field" ? value : null,
                chart_type: kind === "field" ? "bar" : definition.chart_type,
              });
            }}
          >
            {measurement.buckets.map((b) => (
              <option key={b} value={`time:${b}`}>
                {b[0].toUpperCase() + b.slice(1)}
              </option>
            ))}
            {measurement.dimensions.map((d) => (
              <option key={d} value={`field:${d}`}>
                {d.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Period
          <select
            className={selectClass}
            disabled={
              saving ||
              measurement.kind === "recurring_cost_projection" ||
              measurement.profile.timing === "first_to_last_played"
            }
            value={definition.period_days}
            onChange={(e) =>
              void change({
                ...definition,
                period_days: Number(e.target.value),
              })
            }
          >
            {[7, 30, 90, 365].map((days) => (
              <option key={days} value={days}>
                {measurement.kind === "recurring_cost_projection"
                  ? "Monthly projection"
                  : measurement.profile.timing === "first_to_last_played"
                    ? "Lifetime"
                    : `Last ${days} days`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs">
          Chart
          <select
            className={selectClass}
            disabled={saving}
            value={definition.chart_type}
            onChange={(e) =>
              void change({
                ...definition,
                chart_type: e.target.value as PulseDefinition["chart_type"],
              })
            }
          >
            {(definition.bucket
              ? ["bar", "line", "area"]
              : measurement.profile.currency
                ? ["bar"]
                : ["bar", "pie"]
            ).map((type) => (
              <option key={type} value={type}>
                {type[0].toUpperCase() + type.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        aria-busy={loading}
        className={`pulse-editor-preview ${loading ? "opacity-50" : ""}`}
      >
        <PulseChartCard
          title={title || measurement.title}
          definition={definition}
          result={preview}
          source={measurement.profile.source}
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <Button
        onClick={() => void save()}
        disabled={
          loading ||
          saving ||
          !preview ||
          !title.trim() ||
          Boolean(preview.error) ||
          !preview.points.some(
            (p) => typeof p.value === "number" && Number.isFinite(p.value),
          )
        }
      >
        {saving ? "Adding…" : loading ? "Loading preview…" : "Add to Pulse"}
      </Button>
    </div>
  );
}
