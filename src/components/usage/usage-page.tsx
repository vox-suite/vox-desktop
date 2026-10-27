import { useEffect, useRef, useState } from "react";
import { Gauge, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageLoading } from "@/components/ui/page-loading";
import { PulseShell } from "@/components/pulse/pulse-shell";
import {
  PulseChartCard,
  PulseChartSkeleton,
} from "@/components/pulse/chart-card";
import {
  discoveryApi,
  formatTotal,
  pulseTimezone,
  type Measurement,
  type PulseDefinition,
  type PulseResult,
} from "@/features/pulse";

const USAGE_SOURCE = "vox_usage";
const PERIODS = [
  { days: 1, label: "Today" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

type Chart = { key: string; title: string; definition: PulseDefinition };

function find(catalog: Measurement[], kind: string, field: string | null) {
  return catalog.find(
    (m) =>
      m.profile.source === USAGE_SOURCE &&
      m.profile.action === kind &&
      (field ? m.field === field : m.kind === "event_count"),
  )?.id;
}

function charts(catalog: Measurement[], days: number): Chart[] {
  const base = {
    version: 2 as const,
    period_days: days,
    timezone: pulseTimezone(),
    bucket: null,
    dimension: null,
  };
  const voice = find(catalog, "voice", "session_seconds");
  const voiceIn = find(catalog, "voice", "input_audio_seconds");
  const voiceOut = find(catalog, "voice", "output_audio_seconds");
  const tokens = find(catalog, "gemini", "total_tokens");
  const tokensIn = find(catalog, "gemini", "input_tokens");
  const tokensOut = find(catalog, "gemini", "output_tokens");
  const tokensReasoning = find(catalog, "gemini", "reasoning_tokens");
  const out: Chart[] = [];
  if (voice) {
    out.push(
      {
        key: "voice-daily",
        title: "Voice minutes per day",
        definition: {
          ...base,
          measurement_id: voice,
          bucket: "day",
          chart_type: "line",
          compare_with: [voiceIn, voiceOut].filter((id): id is string => !!id),
        },
      },
      {
        key: "voice-channel",
        title: "Voice minutes by channel",
        definition: {
          ...base,
          measurement_id: voice,
          dimension: "channel",
          chart_type: "bar",
        },
      },
    );
  }
  if (tokens) {
    out.push(
      {
        key: "gemini-daily",
        title: "LLM tokens per day",
        definition: {
          ...base,
          measurement_id: tokens,
          bucket: "day",
          chart_type: "line",
          compare_with: [tokensIn, tokensOut, tokensReasoning].filter(
            (id): id is string => !!id,
          ),
        },
      },
      {
        key: "gemini-channel",
        title: "LLM tokens by channel",
        definition: {
          ...base,
          measurement_id: tokens,
          dimension: "channel",
          chart_type: "bar",
        },
      },
      {
        key: "gemini-feature",
        title: "LLM tokens by feature",
        definition: {
          ...base,
          measurement_id: tokens,
          dimension: "feature",
          chart_type: "bar",
        },
      },
    );
  }
  return out;
}

function seriesTotal(result: PulseResult | undefined, id: string | undefined) {
  if (!result || !id) return null;
  const series = result.series?.find((s) => s.measurement_id === id);
  return series ? series.total : result.total;
}

function seriesCount(result: PulseResult | undefined, id: string | undefined) {
  if (!result || !id) return null;
  const series = result.series?.find((s) => s.measurement_id === id);
  return series ? series.record_count : result.record_count;
}

function Stat({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  const formatted = value == null ? null : formatTotal(value, unit);
  return (
    <Card className="gap-1 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-semibold tracking-tight">
        {formatted ? formatted.text : "—"}
        {formatted?.unit && (
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            {formatted.unit}
          </span>
        )}
      </p>
    </Card>
  );
}

function SaveButton({ chart }: { chart: Chart }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const key = useRef(crypto.randomUUID());
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2 text-xs"
      disabled={state === "saving" || state === "saved"}
      onClick={() => {
        setState("saving");
        discoveryApi
          .save(chart.title, chart.definition, key.current)
          .then(() => setState("saved"))
          .catch(() => setState("failed"));
      }}
    >
      {state === "saved"
        ? "Added"
        : state === "saving"
          ? "Adding…"
          : state === "failed"
            ? "Retry add"
            : "Add to Insights"}
    </Button>
  );
}

export function UsagePage() {
  const [days, setDays] = useState<number>(30);
  const [catalog, setCatalog] = useState<Measurement[] | null>(null);
  const [results, setResults] = useState<Record<string, PulseResult>>({});
  const [error, setError] = useState("");
  const [reloads, setReloads] = useState(0);
  const ticket = useRef(0);

  useEffect(() => {
    const mine = ++ticket.current;
    void (async () => {
      try {
        const measurements = (await discoveryApi.listMeasurements()).filter(
          (m) => m.profile.source === USAGE_SOURCE,
        );
        if (mine !== ticket.current) return;
        setCatalog(measurements);
        // The Pulse preview gate is small, so charts load one after another.
        for (const chart of charts(measurements, days)) {
          const result = await discoveryApi.preview(chart.definition);
          if (mine !== ticket.current) return;
          setResults((prev) => ({ ...prev, [chart.key]: result }));
        }
      } catch (e) {
        if (mine === ticket.current)
          setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [days, reloads]);

  const reload = (nextDays = days) => {
    setError("");
    setResults({});
    setDays(nextDays);
    setReloads((n) => n + 1);
  };
  const list = catalog ? charts(catalog, days) : [];
  const voiceDaily = results["voice-daily"];
  const geminiDaily = results["gemini-daily"];
  const id = (kind: string, field: string | null) =>
    catalog ? find(catalog, kind, field) : undefined;
  const firstSeen = catalog
    ?.map((m) => m.profile.first_at)
    .filter((at): at is string => !!at)
    .sort()[0];

  return (
    <PulseShell
      label="Usage"
      header={
        <>
          <div className="flex items-center gap-3.5">
            <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card shadow-sm">
              <Gauge className="size-[18px] text-violet" />
            </span>
            <div className="leading-tight">
              <h1 className="text-base font-semibold tracking-tight">Usage</h1>
              <p className="mt-0.5 font-mono text-[10.5px] leading-4 text-muted-foreground">
                {firstSeen
                  ? `Tracked since ${new Date(firstSeen).toLocaleDateString()}`
                  : "Voice minutes and LLM tokens"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="radiogroup"
              aria-label="Period"
              className="flex rounded-lg border border-border bg-card p-0.5"
            >
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  role="radio"
                  aria-checked={days === p.days}
                  onClick={() => reload(p.days)}
                  className={`rounded-md px-2.5 py-1 text-xs ${days === p.days ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="icon"
              className="size-8 rounded-lg"
              aria-label="Refresh usage"
              onClick={() => reload()}
            >
              <RotateCw className="size-3.5" />
            </Button>
          </div>
        </>
      }
    >
      <div className="flex min-h-full flex-col gap-6 p-4 sm:p-6">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-3 py-16">
            <p className="text-sm text-muted-foreground">Could not load usage.</p>
            <p className="text-xs text-destructive">{error}</p>
            <Button variant="outline" onClick={() => reload()}>
              Retry
            </Button>
          </div>
        ) : !catalog ? (
          <PageLoading accent="violet" label="Loading usage…" />
        ) : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            No usage recorded yet. Voice sessions and LLM requests appear here
            once tracking has data.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
              <Stat label="Total voice" value={seriesTotal(voiceDaily, id("voice", "session_seconds"))} unit="minutes" />
              <Stat label="Voice input" value={seriesTotal(voiceDaily, id("voice", "input_audio_seconds"))} unit="minutes" />
              <Stat label="Voice output" value={seriesTotal(voiceDaily, id("voice", "output_audio_seconds"))} unit="minutes" />
              <Stat label="Voice sessions" value={seriesCount(voiceDaily, id("voice", "session_seconds"))} unit="" />
              <Stat label="LLM tokens" value={seriesTotal(geminiDaily, id("gemini", "total_tokens"))} unit="tokens" />
              <Stat label="LLM requests" value={seriesCount(geminiDaily, id("gemini", "total_tokens"))} unit="" />
            </div>
            <p className="text-xs text-muted-foreground">
              LLM totals include every request: voice, phone, chat and
              background work. Voice output counts only audio that was played.
            </p>
            <div className="pulse-chart-grid">
              {list.map((chart) =>
                results[chart.key] ? (
                  <PulseChartCard
                    key={chart.key}
                    title={chart.title}
                    definition={chart.definition}
                    result={results[chart.key]}
                    source="usage"
                    footerAction={<SaveButton chart={chart} />}
                  />
                ) : (
                  <PulseChartSkeleton key={chart.key} />
                ),
              )}
            </div>
          </>
        )}
      </div>
    </PulseShell>
  );
}
