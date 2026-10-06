import { useRef, useState } from "react";
import { discoveryApi } from "@/features/pulse/api";
import type {
  PulseDefinition,
  PulseResult,
} from "@/features/pulse/discovery-types";
import { PulseChartCard } from "./chart-card";
import { RangeControls } from "./range-controls";

export function SavedChart({
  title,
  definition: initial,
  result: initialResult,
}: {
  title: string;
  definition: PulseDefinition;
  result: PulseResult | null;
}) {
  const [definition, setDefinition] = useState(initial);
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const ticket = useRef(0);

  async function change(patch: Partial<PulseDefinition>) {
    const next = { ...definition, ...patch };
    const mine = ++ticket.current;
    setDefinition(next);
    setLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (mine !== ticket.current) return;
    try {
      const fresh = await discoveryApi.preview(next);
      if (mine === ticket.current) setResult(fresh);
    } catch (e) {
      if (mine === ticket.current)
        setResult((r) => (r ? { ...r, error: String(e) } : r));
    } finally {
      if (mine === ticket.current) setLoading(false);
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <RangeControls definition={definition} onChange={(p) => void change(p)} />
      <div
        className={`flex-1 ${loading ? "opacity-60 transition-opacity" : ""}`}
      >
        <PulseChartCard title={title} definition={definition} result={result} />
      </div>
    </div>
  );
}
