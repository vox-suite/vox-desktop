import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Meeting,
  CitedText,
  ActionCandidate,
} from "@/features/meetings/types";
import type { MeetingLibrary } from "@/features/meetings/controller";
function Evidence({
  meeting,
  ids,
  quote,
}: {
  meeting: Meeting;
  ids: string[];
  quote?: string;
}) {
  const passages = meeting.tracks.flatMap((track) =>
    track.segments
      .filter((s) => ids.includes(s.id))
      .map((s) => ({ source: track.source, text: s.text, start: s.start_ms })),
  );
  return (
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer">Evidence</summary>
      <div className="mt-2 space-y-2 border-l border-line pl-3">
        {passages.map((p, i) => (
          <p key={i} className="select-text whitespace-pre-wrap break-words">
            <span className="font-medium">
              {p.source === "mic" ? "Microphone" : "Computer audio"} ·{" "}
              {Math.floor(p.start / 60000)}:
              {String(Math.floor(p.start / 1000) % 60).padStart(2, "0")}
            </span>
            <br />
            {p.text}
          </p>
        ))}
        {!passages.length && (
          <p>{quote ?? "Evidence belongs to an earlier transcript version."}</p>
        )}
      </div>
    </details>
  );
}
function Section({
  title,
  items,
  meeting,
}: {
  title: string;
  items: CitedText[];
  meeting: Meeting;
}) {
  return items.length ? (
    <section>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i}>
            <p className="select-text whitespace-pre-wrap break-words text-sm leading-relaxed">
              {item.text}
            </p>
            <Evidence meeting={meeting} ids={item.evidence_ids} />
          </li>
        ))}
      </ul>
    </section>
  ) : null;
}
export function MeetingSummary({
  meeting,
  library,
  busy,
  timezone,
}: {
  meeting: Meeting;
  library: MeetingLibrary;
  busy: boolean;
  timezone: string;
}) {
  const saved = meeting.analysis;
  const [names, setNames] = useState(() => saved?.my_names.join(", ") ?? "");
  const available = meeting.tracks.some((t) => t.segments.length);
  const content = saved?.response.analysis;
  const rows: { key: string; action: ActionCandidate }[] = content
    ? content.actions.map((action, index) => ({
        key: saved!.action_keys[index],
        action,
      }))
    : [];
  for (const review of meeting.action_reviews) {
    if (
      review.state !== "pending" ||
      !review.approved_task ||
      rows.some((row) => row.key === review.key)
    )
      continue;
    rows.push({
      key: review.key,
      action: {
        ...review.approved_task,
        owner: "unknown",
        evidence_ids: [],
        evidence_quote:
          "Previously approved from an earlier summary. Retry sends the saved approval unchanged.",
      },
    });
  }
  return (
    <div className="space-y-6 px-5 py-5">
      <section className="space-y-3 border-b border-line pb-5">
        <h3 className="text-sm font-semibold">Summary and suggested tasks</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Generate sends this transcript and the name aliases below to Vox’s
          cloud text model. Audio stays local. Review suggestions before adding
          tasks to your Timeline.
        </p>
        <label className="block space-y-1.5">
          <span className="text-xs text-muted-foreground">
            Names people use for you (optional)
          </span>
          <Input
            value={names}
            maxLength={800}
            onChange={(e) => setNames(e.target.value)}
            placeholder="Names or aliases, separated by commas"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          Capture sources don’t identify speakers. Unclear assignments stay
          marked as uncertain.
        </p>
        <Button
          size="sm"
          disabled={busy || !available || meeting.state === "recording"}
          onClick={() =>
            void library.analyze(
              names
                .split(",")
                .map((n) => n.trim())
                .filter(Boolean),
              timezone,
              !!saved,
            )
          }
        >
          {busy
            ? "Working…"
            : saved
              ? "Regenerate with cloud text"
              : "Generate with cloud text"}
        </Button>
        {!available && (
          <p className="text-xs text-muted-foreground">
            A saved transcript is needed first.
          </p>
        )}
        {saved?.stale && (
          <p role="status" className="text-xs text-amber">
            The transcript changed. Generate a new summary before approving new
            suggestions.
          </p>
        )}
      </section>
      {content && (
        <>
          <p className="text-xs text-muted-foreground">
            Generated{" "}
            {new Date(saved!.created_ms).toLocaleString(undefined, {
              timeZone: timezone,
            })}
            . Your handwritten notes remain separate.
          </p>
          <Section title="Summary" items={content.overview} meeting={meeting} />
          <Section
            title="Decisions"
            items={content.decisions}
            meeting={meeting}
          />
          <Section
            title="Open questions"
            items={content.open_questions}
            meeting={meeting}
          />
          <section>
            <h3 className="text-sm font-semibold">Suggested tasks</h3>
            <p className="mb-3 mt-1 text-xs text-muted-foreground">
              Adding a suggestion makes it your human to-do. It does not start
              an agent or schedule a reminder.
            </p>
            {rows.length ? (
              <ul className="divide-y divide-line">
                {rows.map(({ action, key }) => {
                  const review = meeting.action_reviews.find(
                      (r) => r.key === key,
                    ),
                    approved = review?.approved_task,
                    due = approved ? approved.due_at : action.due_at;
                  return (
                    <li key={key} className="py-4">
                      <h4 className="select-text break-words text-sm font-medium">
                        {approved?.title ?? action.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {action.owner === "me"
                          ? "Suggested for you"
                          : action.owner === "other"
                            ? "Suggested for someone else"
                            : "Owner uncertain"}
                        {due
                          ? ` · Suggested deadline ${new Date(due).toLocaleString(undefined, { timeZone: timezone })}`
                          : " · No deadline"}
                      </p>
                      {(approved?.notes ?? action.notes) && (
                        <p className="mt-2 select-text whitespace-pre-wrap break-words text-sm">
                          {approved?.notes ?? action.notes}
                        </p>
                      )}
                      <Evidence
                        meeting={meeting}
                        ids={action.evidence_ids}
                        quote={action.evidence_quote}
                      />
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {review?.state === "saved" ? (
                          <span className="text-xs text-mint">
                            Added previously to Timeline
                          </span>
                        ) : review?.state === "dismissed" ? (
                          <span className="text-xs text-muted-foreground">
                            Dismissed
                          </span>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={
                                busy ||
                                (!!saved?.stale && review?.state !== "pending")
                              }
                              onClick={() => void library.promoteAction(key)}
                            >
                              {review?.state === "pending"
                                ? "Retry saving approved task"
                                : "Add to my tasks"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy || review?.state === "pending"}
                              onClick={() => void library.dismissAction(key)}
                            >
                              Dismiss
                            </Button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No concrete follow-ups were found.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
