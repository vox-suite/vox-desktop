import { TranscribeRecording } from "./recording-controls";
import { useEffect, useState } from "react";
import { ArrowLeft, Download, FileUp, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type {
  MeetingLibrary,
  MeetingLibraryState,
} from "@/features/meetings/controller";
import { MeetingTranscript } from "./meeting-transcript";
export function MeetingDetail({
  accountId,
  library,
  state,
  timezone,
}: {
  accountId: string;
  library: MeetingLibrary;
  state: MeetingLibraryState;
  timezone: string;
}) {
  const meeting = state.detail!;
  const [deleting, setDeleting] = useState(false);
  const [importing, setImporting] = useState(false);
  useEffect(() => {
    const save = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "s") {
        event.preventDefault();
        void library.save();
      }
    };
    window.addEventListener("keydown", save);
    return () => window.removeEventListener("keydown", save);
  }, [library]);
  const locked = !!state.busy || state.saving;
  const activeRecording = meeting.state === "recording";
  const beginImport = () => {
    if (meeting.tracks.length) setImporting(true);
    else void library.importTranscript();
  };
  return (
    <>
      <header className="meeting-detail-header">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            className="meeting-back"
            variant="ghost"
            size="icon"
            aria-label="Back to meetings"
            onClick={() => library.deselect()}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <h2 className="select-text break-words text-lg font-semibold tracking-tight">
              {meeting.title}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              <time dateTime={new Date(meeting.created_ms).toISOString()}>
                {new Date(meeting.created_ms).toLocaleString(undefined, {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  timeZone: timezone,
                })}
              </time>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reload meeting"
            disabled={locked}
            onClick={() => void library.select(meeting.id)}
          >
            <RefreshCw aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Export saved meeting"
            title={
              state.dirty
                ? "Save notes before exporting"
                : "Export saved meeting"
            }
            disabled={locked || state.dirty}
            onClick={() => void library.exportText()}
          >
            <Download aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete meeting"
            disabled={locked || activeRecording}
            onClick={() => setDeleting(true)}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </header>
      {state.detailError && (
        <p role="alert" className="mx-6 mb-3 text-sm text-destructive">
          {state.detailError}
        </p>
      )}
      {(meeting.state === "interrupted" ||
        meeting.state === "partial" ||
        meeting.state === "failed") && (
        <p className="meeting-recording-notice">
          {meeting.state === "interrupted"
            ? "This recording was interrupted. Check interrupted recordings to recover available audio."
            : meeting.state === "partial"
              ? "This recording has gaps or audio warnings. The transcript may be incomplete."
              : "The recording did not finish. Saved notes are still available."}
        </p>
      )}
      <TranscribeRecording
        accountId={accountId}
        id={meeting.id}
        available={
          !activeRecording &&
          (meeting.mic_frames > 0 || meeting.system_frames > 0)
        }
      />
      <Tabs
        defaultValue={meeting.tracks.length ? "transcript" : "notes"}
        className="flex min-h-0 flex-1 flex-col gap-0"
      >
        <div className="meeting-detail-toolbar">
          <TabsList variant="line">
            <TabsTrigger value="transcript">Transcript</TabsTrigger>
            <TabsTrigger value="notes">
              Your notes
              {state.dirty && (
                <span
                  className="ml-1 size-1.5 rounded-full bg-current"
                  aria-label="Unsaved changes"
                />
              )}
            </TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            disabled={locked || activeRecording}
            onClick={beginImport}
          >
            <FileUp aria-hidden="true" />
            Import transcript
          </Button>
        </div>
        <TabsContent value="transcript" className="meeting-tab-body min-h-0">
          <MeetingTranscript
            meeting={meeting}
            onImport={beginImport}
            importing={locked || activeRecording}
          />
        </TabsContent>
        <TabsContent value="notes" className="meeting-tab-body min-h-0">
          <div className="meeting-notes-editor">
            <div className="mb-3 flex items-center justify-between gap-2">
              <label
                htmlFor={`meeting-notes-${meeting.id}`}
                className="text-sm font-medium"
              >
                Your notes
              </label>
              <Button
                size="sm"
                disabled={!state.dirty || locked}
                onClick={() => void library.save()}
              >
                {state.saving ? "Saving…" : "Save notes"}
              </Button>
            </div>
            <textarea
              id={`meeting-notes-${meeting.id}`}
              value={state.draft}
              onChange={(event) => library.edit(event.target.value)}
              className="meeting-notes-input select-text"
              placeholder="What mattered in this conversation?"
              aria-describedby="meeting-note-state"
            />
            <p
              id="meeting-note-state"
              className="mt-2 text-xs text-muted-foreground"
            >
              {state.dirty
                ? "Unsaved changes. Your draft is kept while you switch meetings."
                : "Notes are saved on this computer."}
            </p>
            {state.saveError && !state.conflict && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {state.saveError} Your draft is still here.
              </p>
            )}
            {state.conflict && (
              <section
                className="meeting-conflict"
                aria-label="Review note conflict"
              >
                <h3 className="text-sm font-medium">
                  This meeting changed before your notes were saved.
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your draft is kept above. Review the saved notes before
                  choosing which copy to keep.
                </p>
                <p className="mt-3 whitespace-pre-wrap break-words text-sm select-text">
                  {state.conflict.notes || "The saved notes are empty."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => library.useSavedNotes()}
                  >
                    Use saved notes
                  </Button>
                  <Button
                    size="sm"
                    disabled={state.saving}
                    onClick={() => void library.keepMyDraft()}
                  >
                    Save my draft instead
                  </Button>
                </div>
              </section>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this meeting?</DialogTitle>
            <DialogDescription>
              This removes {meeting.title}, its transcript, notes, and any
              recording files stored with it on this computer. This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleting(false)}>
              Keep meeting
            </Button>
            <Button
              variant="destructive"
              disabled={locked}
              onClick={() => {
                setDeleting(false);
                void library.remove();
              }}
            >
              Delete meeting
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={importing} onOpenChange={setImporting}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import another transcript?</DialogTitle>
            <DialogDescription>
              The imported file replaces the transcript for its matching audio
              source. Your written notes are kept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setImporting(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setImporting(false);
                void library.importTranscript();
              }}
            >
              Choose transcript
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
