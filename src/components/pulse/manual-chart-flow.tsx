import { useEffect, useState } from "react";
import { discoveryApi, pulseTimezone } from "@/features/pulse/api";
import type { Measurement } from "@/features/pulse/discovery-types";
import { defaultDefinition } from "@/features/pulse/settings";
import { ChartEditor } from "./chart-editor";
export function ManualChartFlow({ onSaved }: { onSaved: () => void }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void discoveryApi
      .listMeasurements()
      .then((items) => {
        if (active) {
          setMeasurements(items);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(String(e));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  const measurement = measurements.find((m) => m.id === selected);
  if (loading)
    return (
      <p role="status" className="py-8 text-sm text-muted-foreground">
        Finding available measurements…
      </p>
    );
  if (error)
    return (
      <p role="alert" className="text-sm text-destructive">
        {error}
      </p>
    );
  return (
    <div className="space-y-4">
      <label className="flex flex-col gap-2 text-sm">
        What would you like to chart?
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-xs"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">Choose a measurement</option>
          {measurements.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} · {m.profile.source}
            </option>
          ))}
        </select>
      </label>
      {!measurements.length && (
        <p className="text-sm text-muted-foreground">
          No supported measurements yet. Sync activity or add dated entries to
          your timeline.
        </p>
      )}
      {measurement && (
        <ManualEditor
          key={measurement.id}
          measurement={measurement}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
function ManualEditor({
  measurement,
  onSaved,
}: {
  measurement: Measurement;
  onSaved: () => void;
}) {
  const [definition] = useState(() =>
    defaultDefinition(measurement, pulseTimezone()),
  );
  return (
    <ChartEditor
      measurement={measurement}
      initialDefinition={definition}
      onSaved={onSaved}
    />
  );
}
