import { useEffect, useState, useSyncExternalStore } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { meetingRecording } from "@/features/meetings/api";
import type { RecordingSession } from "@/features/meetings/recording";

export function RecordingControls({ accountId }: { accountId: string }) {
  const session = meetingRecording(accountId);
  return session ? <Controls key={accountId} session={session} /> : null;
}
function Controls({ session }: { session: RecordingSession }) {
  const { status, observedMs, busy, error, modelReady } = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
  );
  const [open, setOpen] = useState(false),
    [title, setTitle] = useState("");
  useEffect(() => {
    void session.poll();
    void session.checkModel();
    const timer = setInterval(() => void session.poll(), 1000);
    return () => clearInterval(timer);
  }, [session]);
  const recording = status.phase === "recording" || status.phase === "stopping";
  const processing = status.phase === "transcribing";
  const active = recording || processing;
  const seconds = Math.max(
    0,
    Math.floor((observedMs - status.started_ms) / 1000),
  );
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return (
    <>
      <section
        aria-label="Meeting recording"
        className="no-drag flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2 text-xs"
      >
        <div className="flex min-w-0 basis-full items-center gap-2 sm:flex-1 sm:basis-auto">
          {active ? (
            <span
              className="size-2 shrink-0 rounded-full bg-destructive"
              aria-hidden="true"
            />
          ) : (
            <Mic
              className="size-3.5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          )}
          <span role="status">
            {recording
              ? `${status.phase === "stopping" ? "Stopping…" : status.mic_frames && status.system_frames ? "Recording locally" : "Starting local recording…"} · ${clock}`
              : processing
                ? "Transcribing on this computer…"
                : status.phase === "ready"
                  ? "Transcript saved locally"
                  : status.phase === "captured"
                    ? "Recording saved locally"
                    : status.phase === "failed"
                      ? "Local audio operation needs attention"
                      : "Meeting recorder"}
          </span>
        </div>
        {recording && (
          <span className="text-muted-foreground">
            Mic {(status.mic_frames / 16000).toFixed(0)}s · Computer{" "}
            {(status.system_frames / 16000).toFixed(0)}s
          </span>
        )}
        {!active && (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => void session.chooseModel()}
          >
            {modelReady ? "Change speech model" : "Set up local speech"}
          </Button>
        )}
        {active ? (
          <Button
            size="sm"
            variant="destructive"
            disabled={busy || status.phase === "stopping"}
            onClick={() => void session.stop()}
          >
            <Square className="size-3" aria-hidden="true" />
            {processing ? "Cancel transcription" : "Stop recording"}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => {
              setTitle("");
              setOpen(true);
            }}
          >
            <Mic className="size-3.5" aria-hidden="true" />
            Record meeting
          </Button>
        )}
        {(error || status.error) && (
          <p role="alert" className="w-full break-words text-destructive">
            {error || status.error}
          </p>
        )}
        {processing && (
          <Loader2
            className="size-3.5 animate-spin motion-reduce:animate-none"
            aria-label="Local transcription in progress"
          />
        )}
      </section>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record this meeting</DialogTitle>
            <DialogDescription>
              Vox records your default microphone and computer output, including
              other apps and notifications. Both audio tracks stay on this
              computer. Let participants know before recording.
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Keep this window visible while recording. Maximum two hours. Echo
            cancellation is not available yet. Transcribe locally after
            stopping. Audio is stored unencrypted on this device until you
            delete the meeting.
          </p>
          <Input
            aria-label="Recording title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={240}
            placeholder="Meeting title"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !title.trim()}
              onClick={() => {
                setOpen(false);
                void session.start(title.trim());
              }}
            >
              Start local recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
export function TranscribeRecording({
  accountId,
  id,
  available,
}: {
  accountId: string;
  id: string;
  available: boolean;
}) {
  const session = meetingRecording(accountId);
  return session && available ? <Transcribe session={session} id={id} /> : null;
}
function Transcribe({
  session,
  id,
}: {
  session: RecordingSession;
  id: string;
}) {
  const { status, busy, modelReady } = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
  );
  const active = ["recording", "stopping", "transcribing"].includes(
    status.phase,
  );
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2 text-xs">
      <span className="flex-1 text-muted-foreground">
        Speech recognition runs on this computer. Audio stays local.
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={busy || active}
        onClick={() =>
          void (modelReady ? session.transcribe(id) : session.chooseModel())
        }
      >
        {modelReady ? "Transcribe local audio" : "Choose local speech model"}
      </Button>
    </div>
  );
}
