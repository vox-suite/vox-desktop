import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { discoveryApi, pulseTimezone } from "@/features/pulse/api";
import type { Measurement, PulseDefinition } from "@/features/pulse/discovery-types";
import { ChartEditor } from "./chart-editor";

export function MeasurementsView({ onSaved }: { onSaved: () => void }) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [selected, setSelected] = useState<Measurement | null>(null);
  const [definition, setDefinition] = useState<PulseDefinition | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    discoveryApi.listMeasurements().then((data) => { if (active) setMeasurements(data); })
      .catch((e: unknown) => { if (active) setError(String(e)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (selected && definition) return <div className="space-y-4">
    <Button variant="ghost" size="sm" onClick={() => setSelected(null)}><ArrowLeft size={14} /> Measurements</Button>
    <ChartEditor measurement={selected} initialDefinition={definition} onSaved={onSaved} />
  </div>;
  return <div className="space-y-4">
    <Input aria-label="Search measurements" placeholder="Search measurements" value={search} onChange={(e) => setSearch(e.target.value)} />
    {loading && <p role="status" className="text-sm text-muted-foreground">Loading recorded measurements…</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!loading && !error && !measurements.length && <p className="text-sm text-muted-foreground">Connect an app or import history to discover measurements. Missing activity remains unknown.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      {measurements.filter((m) => `${m.title} ${m.description}`.toLowerCase().includes(search.toLowerCase())).map((m) => <button key={m.id}
        className="rounded-lg border border-border p-4 text-left transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() => { setSelected(m); setDefinition({ version: 2, measurement_id: m.id, period_days: 30, timezone: pulseTimezone(), bucket: m.buckets[0] ?? "day", dimension: null, chart_type: "bar" }); }}>
        <p className="text-sm font-medium">{m.title}</p><p className="mt-2 text-xs text-muted-foreground">{m.description}</p>
        <p className="mt-3 text-xs text-muted-foreground">{m.profile.count.toLocaleString()} records · {m.unit}</p>
      </button>)}
    </div>
  </div>;
}
