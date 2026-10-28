import { ArrowLeft } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEffect, useState, useSyncExternalStore } from "react";
import { HardDrive, Plus, RefreshCw, RotateCcw } from "lucide-react";
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
import {
  PageContainer,
  PageHeader,
  PageBody,
} from "@/components/ui/page-container";
import { useDesktopContext } from "@/hooks/use-desktop-control";
import { meetingLibrary } from "@/features/meetings/api";
import type { MeetingState } from "@/features/meetings/types";
import { MeetingDetail } from "./meeting-detail";
import "./meetings.css";
const stateLabel: Record<MeetingState, string> = {
  prepared: "Notes only",
  recording: "Recording",
  interrupted: "Interrupted",
  captured: "Audio captured",
  partial: "Partial recording",
  failed: "Recording failed",
  transcript_ready: "Transcript",
};
export function MeetingsPage({
  accountId,
  navigation = false,
}: {
  accountId: string;
  navigation?: boolean;
}) {
  const { timezone } = useDesktopContext();
  const library = meetingLibrary(accountId);
  const state = useSyncExternalStore(library.subscribe, library.snapshot);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  useEffect(() => {
    void library.load();
    const leave = (event: BeforeUnloadEvent) => {
      if (library.hasDrafts()) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, [library]);
  const failedRepairs = state.reports.reduce(
    (sum, report) => sum + report.tracks.filter((track) => track.error).length,
    0,
  );
  return (
    <PageContainer
      className="meetings-page no-drag"
      aria-label="Meeting library"
    >
      <PageHeader className="h-16 gap-2 px-5 py-0">
        <div className="flex min-w-0 items-center gap-2">
          {navigation && <SidebarTrigger className="md:hidden" />}
          <div className="min-w-0">
            <h1 className="text-base font-semibold tracking-tight">Meetings</h1>
            <p className="text-xs text-muted-foreground">
              {state.loaded && state.items.length
                ? `${state.items.length} shown`
                : "Local meeting notes"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="meetings-local-label mr-3 flex items-center gap-1.5 text-xs text-muted-foreground">
            <HardDrive className="size-3.5" aria-hidden="true" />
            On this computer
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh meetings"
            disabled={state.listLoading || !!state.busy}
            onClick={() => void library.refresh()}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Check interrupted recordings"
            disabled={!!state.busy}
            onClick={() => void library.recover()}
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            onClick={() => {
              setTitle("");
              setCreateOpen(true);
            }}
            disabled={!!state.busy}
          >
            <Plus aria-hidden="true" />
            New note
          </Button>
        </div>
      </PageHeader>
      {state.error && (
        <div
          role="alert"
          className="border-b border-border px-5 py-3 text-sm text-destructive"
        >
          {state.error}
          <Button variant="link" onClick={() => void library.refresh()}>
            Try again
          </Button>
        </div>
      )}
      {failedRepairs > 0 && (
        <p
          role="status"
          className="border-b border-border px-5 py-3 text-sm text-muted-foreground"
        >
          Some recording audio could not be recovered. Saved notes and
          transcripts are still available.{" "}
          <Button
            size="sm"
            variant="link"
            onClick={() => void library.recover()}
          >
            Check again
          </Button>
        </p>
      )}
      {state.notice && (
        <p
          role="status"
          className="border-b border-border px-5 py-2 text-xs text-muted-foreground"
        >
          {state.notice}
        </p>
      )}
      <PageBody scroll={false} className="min-h-0">
        {!state.loaded && state.listLoading ? (
          <div className="meetings-empty" role="status">
            Loading meetings…
          </div>
        ) : state.loaded && !state.items.length && !state.error ? (
          <div className="meetings-empty">
            <h2>No meeting notes yet</h2>
            <p>
              Create a note for your next conversation. You can add a transcript
              and keep your own notes alongside it.
            </p>
          </div>
        ) : (
          <div
            className="meeting-library-layout"
            data-detail-open={!!state.selectedId}
          >
            <nav className="meeting-list" aria-label="Saved meetings">
              <ul>
                {state.items.map((item) => (
                  <li key={item.id}>
                    <button
                      className="meeting-list-row"
                      aria-current={
                        item.id === state.selectedId ? "true" : undefined
                      }
                      onClick={() => void library.select(item.id)}
                    >
                      <span className="meeting-list-title">{item.title}</span>
                      <span className="meeting-list-meta">
                        <time
                          dateTime={new Date(item.created_ms).toISOString()}
                        >
                          {new Date(item.created_ms).toLocaleDateString(
                            undefined,
                            {
                              month: "short",
                              day: "numeric",
                              timeZone: timezone,
                            },
                          )}
                        </time>
                        <span>{stateLabel[item.state]}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {state.hasMore && (
                <Button
                  variant="ghost"
                  className="mx-3 my-3"
                  disabled={state.listLoading}
                  onClick={() => void library.loadMore()}
                >
                  {state.listLoading ? "Loading…" : "Load more meetings"}
                </Button>
              )}
            </nav>
            <section
              className="meeting-detail"
              aria-label="Meeting detail"
              aria-busy={state.detailLoading}
            >
              {!state.detail && state.selectedId && (
                <div className="meeting-error-navigation">
                  <Button
                    className="meeting-back"
                    variant="ghost"
                    onClick={() => library.deselect()}
                  >
                    <ArrowLeft aria-hidden="true" />
                    Back to meetings
                  </Button>
                </div>
              )}
              {state.detailLoading ? (
                <div className="meetings-empty" role="status">
                  Opening meeting…
                </div>
              ) : state.detail ? (
                <MeetingDetail
                  key={state.detail.id}
                  library={library}
                  state={state}
                  timezone={timezone}
                />
              ) : (
                <div className="meetings-empty">
                  {state.detailError ? (
                    <>
                      <p role="alert">{state.detailError}</p>
                      <Button
                        variant="outline"
                        onClick={() =>
                          state.selectedId &&
                          void library.select(state.selectedId)
                        }
                      >
                        Try again
                      </Button>
                    </>
                  ) : (
                    <>
                      <h2>Select a meeting</h2>
                      <p>Your transcript and notes stay together here.</p>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </PageBody>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New meeting note</DialogTitle>
            <DialogDescription>
              Create a note on this computer. This does not start a recording.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void library.create(title).then((created) => {
                if (created) setCreateOpen(false);
              });
            }}
          >
            <label
              htmlFor="new-meeting-title"
              className="mb-2 block text-sm font-medium"
            >
              Meeting title
            </label>
            <Input
              id="new-meeting-title"
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              placeholder="Weekly planning"
            />
            {state.error && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {state.error}
              </p>
            )}
            <DialogFooter className="mt-5">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!title.trim() || !!state.busy}>
                {state.busy === "create" ? "Creating…" : "Create note"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
