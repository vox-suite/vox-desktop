import { useDeferredValue, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Meeting, MeetingSource } from "@/features/meetings/types";
function timestamp(ms: number) {
  const total = Math.floor(ms / 1000);
  return total >= 3600
    ? `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
    : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
export function MeetingTranscript({
  meeting,
  onImport,
  importing,
}: {
  meeting: Meeting;
  onImport: () => void;
  importing: boolean;
}) {
  const [source, setSource] = useState<MeetingSource>(
    meeting.tracks[0]?.source ?? "mic",
  );
  const [query, setQuery] = useState("");
  const deferred = useDeferredValue(query);
  const [limit, setLimit] = useState(200);
  const track =
    meeting.tracks.find((t) => t.source === source) ?? meeting.tracks[0];
  const segments = useMemo(() => {
    const needle = deferred.trim().toLocaleLowerCase();
    return (track?.segments ?? []).filter(
      (s) => !needle || s.text.toLocaleLowerCase().includes(needle),
    );
  }, [track, deferred]);
  if (!meeting.tracks.length)
    return (
      <div className="meetings-empty">
        <h3>No transcript yet</h3>
        <p>
          Add a transcript from a local recording. Your written notes are
          available in the next tab.
        </p>
        <Button variant="outline" disabled={importing} onClick={onImport}>
          Import transcript
        </Button>
      </div>
    );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="meeting-transcript-controls">
        <div role="group" aria-label="Audio source" className="flex gap-1">
          {(["mic", "system"] as const)
            .filter((s) => meeting.tracks.some((t) => t.source === s))
            .map((s) => (
              <Button
                key={s}
                size="sm"
                variant="ghost"
                aria-pressed={track?.source === s}
                className="aria-pressed:bg-muted aria-pressed:text-foreground"
                onClick={() => {
                  setSource(s);
                  setLimit(200);
                }}
              >
                {s === "mic" ? "Microphone" : "Computer audio"}
              </Button>
            ))}
        </div>
        <label className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground"
          />
          <span className="sr-only">Search transcript</span>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setLimit(200);
            }}
            placeholder="Search transcript"
            className="pl-8"
          />
        </label>
      </div>
      <div
        className="meeting-transcript-scroll select-text"
        aria-label="Transcript text"
        aria-busy={query !== deferred}
      >
        <p className="mb-6 text-xs text-muted-foreground">
          Times are relative to this audio source.
          {query.trim() ? ` ${segments.length} matching passages.` : ""}
        </p>
        {segments.slice(0, limit).map((segment) => (
          <div key={segment.id} className="meeting-transcript-segment">
            <span className="tabular-nums text-xs text-muted-foreground">
              {timestamp(segment.start_ms)}
            </span>
            <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-7">
              {segment.text}
            </p>
          </div>
        ))}
        {!segments.length && (
          <p className="text-sm text-muted-foreground">
            {query.trim()
              ? "No passages match your search."
              : "No speech was transcribed for this audio source."}
          </p>
        )}
        {segments.length > limit && (
          <Button
            variant="outline"
            className="my-5"
            onClick={() => setLimit((value) => value + 200)}
          >
            Show more passages
          </Button>
        )}
      </div>
    </div>
  );
}
