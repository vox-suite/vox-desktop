import { useSyncExternalStore } from "react";
import { Check, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { RecordingSession } from "@/features/meetings/recording";
export function SpeechModelDialog({ session }: { session: RecordingSession }) {
  const { model, modelReady, busy, setupOpen, error } = useSyncExternalStore(
    session.subscribe,
    session.snapshot,
  );
  const phase = model?.phase ?? "checking";
  const working = [
    "checking",
    "downloading",
    "verifying",
    "cancelling",
    "uninitialized",
  ].includes(phase);
  const total = model?.total_bytes ?? 147951465;
  const done = Math.min(total, model?.downloaded_bytes ?? 0);
  const label =
    phase === "downloading"
      ? "Downloading speech model"
      : phase === "verifying"
        ? "Verifying speech model"
        : phase === "cancelling"
          ? "Cancelling download"
          : phase === "checking" || phase === "uninitialized"
            ? "Checking local speech"
            : modelReady
              ? "Local speech is ready"
              : phase === "cancelled"
                ? "Download cancelled"
                : "Set up local speech";
  return (
    <Dialog
      open={setupOpen}
      onOpenChange={(open) => {
        if (!open) session.closeSetup();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Local speech recognition</DialogTitle>
          <DialogDescription>
            Download the speech model once, then transcribe meetings on this
            computer without an internet connection.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-start gap-3">
            {modelReady ? (
              <Check className="mt-0.5 size-4 text-mint" aria-hidden="true" />
            ) : working ? (
              <Loader2
                className="mt-0.5 size-4 animate-spin motion-reduce:animate-none"
                aria-hidden="true"
              />
            ) : (
              <Download
                className="mt-0.5 size-4 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            <div>
              <p className="text-sm font-medium">
                {model?.engine === "custom"
                  ? "Your custom local model"
                  : "Whisper Base multilingual"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {model?.engine === "custom"
                  ? "Uses the engine and model files you selected."
                  : "148 MB download · bundled speech engine · runs on your CPU"}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <p role="status" className="text-sm">
              {label}
            </p>
            {phase === "downloading" && (
              <>
                <progress
                  aria-label="Speech model download"
                  max={total}
                  value={done}
                  className="h-2 w-full accent-mint"
                />
                <p className="text-xs tabular-nums text-muted-foreground">
                  {(done / 1e6).toFixed(1)} of {(total / 1e6).toFixed(1)} MB ·{" "}
                  {Math.floor((done / total) * 100)}%
                </p>
              </>
            )}
            {phase === "verifying" && (
              <p className="text-xs text-muted-foreground">
                Checking the complete file before enabling transcription.
              </p>
            )}
          </div>
          {(model?.error || error) && (
            <p role="alert" className="break-words text-sm text-destructive">
              {model?.error || error}
            </p>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Setup downloads model weights from Hugging Face. It sends no meeting
            audio or transcript. Vox checks the model checksum before use.
          </p>
          <details className="border-t border-line pt-3">
            <summary className="cursor-pointer text-xs text-muted-foreground">
              Use existing local files
            </summary>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              For advanced setups, choose a trusted local speech engine and a
              compatible model already on this computer.
            </p>
            <Button
              className="mt-2"
              size="sm"
              variant="outline"
              disabled={busy || working}
              onClick={() => void session.chooseModel()}
            >
              Choose engine and model files
            </Button>
          </details>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => session.closeSetup()}>
            {working ? "Continue in background" : "Done"}
          </Button>
          {working &&
          (phase === "downloading" ||
            phase === "verifying" ||
            phase === "cancelling") ? (
            <Button
              variant="outline"
              disabled={busy || phase === "cancelling"}
              onClick={() => void session.cancelModel()}
            >
              Cancel download
            </Button>
          ) : !working && (!modelReady || model?.engine === "custom") ? (
            <Button disabled={busy} onClick={() => void session.installModel()}>
              {phase === "failed" || phase === "cancelled"
                ? "Retry download"
                : "Download local model"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
