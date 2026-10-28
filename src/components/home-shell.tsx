import { hasUnsavedMeetingNotes } from "@/features/meetings/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DesktopActionOverlay } from "@/components/shell/desktop-action-overlay";
import { TerminalPanel } from "@/components/shell/terminal-panel";
import { ConnectedAppsView } from "@/components/connected-apps-view";
import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import {
  PageContainer,
  PageHeader,
  PageBody,
} from "@/components/ui/page-container";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AgentPane } from "@/components/shell/agent-pane";
import { ActivityLogs } from "@/components/activity-logs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { type ShellTab } from "@/components/shell/shell-tabs";
import { UpdatesView } from "@/components/updates-view";
import { TimelineView } from "@/components/timeline-view";
import { useMissionMap } from "@/hooks/use-mission-map";
import type { Collection } from "@/lib/tauri";
import { PageLoading } from "@/components/ui/page-loading";
import type { VoxColor } from "@/lib/theme";

// Charts (recharts) and the canvas (xyflow) are large, so they ship in their
// own chunks. The shell preloads them after first paint so opening a page
// never waits on a download.
const loadMeetings = () => import("@/components/meetings/meetings-page");
const MeetingsPage = lazy(() =>
  loadMeetings().then((m) => ({ default: m.MeetingsPage })),
);
const loadPulse = () => import("@/components/pulse/pulse-view");
const loadSpaces = () => import("@/components/spaces/spaces-view");
const loadProjects = () => import("@/components/projects/projects-view");
const loadUsage = () => import("@/components/usage/usage-page");
const PulseView = lazy(() =>
  loadPulse().then((m) => ({ default: m.PulseView })),
);
const SpacesView = lazy(() =>
  loadSpaces().then((m) => ({ default: m.SpacesView })),
);
const ProjectsView = lazy(() =>
  loadProjects().then((m) => ({ default: m.ProjectsView })),
);
const UsagePage = lazy(() =>
  loadUsage().then((m) => ({ default: m.UsagePage })),
);

export function HomeShell({
  activeTab,
  onTabChange,
  accountLabel,
  accountId,
  userName,
  avatarUrl,
  onSignOut,
  isActive,
  voxSpeaking,
  micLevel,
  callState,
  callError,
  onToggleCall,
  collections,
}: {
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  accountLabel: string;
  accountId?: string;
  userName?: string | null;
  avatarUrl?: string | null;
  onSignOut: () => void;
  isActive: boolean;
  voxSpeaking: boolean;
  micLevel: number;
  callState: string;
  callError: string;
  onToggleCall: () => void;
  collections: Collection[];
}) {
  const [signOutConfirm, setSignOutConfirm] = useState(false);
  const requestSignOut = () => {
    if (hasUnsavedMeetingNotes(accountId ?? accountLabel))
      setSignOutConfirm(true);
    else onSignOut();
  };
  useEffect(() => {
    const id = setTimeout(() => {
      void loadPulse();
      void loadSpaces();
      void loadProjects();
    }, 300);
    return () => clearTimeout(id);
  }, []);
  const { mapNode, mapReady, mapError } = useMissionMap({
    callActive: isActive,
    voxSpeaking,
  });
  let body: ReactNode;
  if (activeTab === "agent") {
    body = (
      <AgentPane
        isActive={isActive}
        callState={callState}
        callError={callError}
        onToggleCall={onToggleCall}
      />
    );
  } else if (activeTab === "timeline") {
    body = (
      <TimelineView
        collections={collections}
        onCollapse={() => onTabChange("agent")}
      />
    );
  } else if (activeTab === "meetings") {
    body = (
      <Suspense fallback={<PageLoadingFrame title="Meetings" accent="mint" />}>
        <MeetingsPage
          key={accountId ?? accountLabel}
          accountId={accountId ?? accountLabel}
          navigation
        />
      </Suspense>
    );
  } else if (activeTab === "pulse") {
    body = (
      <Suspense fallback={<PageLoadingFrame title="Insights" accent="mint" />}>
        <PulseView />
      </Suspense>
    );
  } else if (activeTab === "usage") {
    body = (
      <Suspense fallback={<PageLoadingFrame title="Usage" accent="violet" />}>
        <UsagePage />
      </Suspense>
    );
  } else if (activeTab === "projects") {
    body = (
      <Suspense fallback={<PageLoadingFrame title="Projects" accent="pink" />}>
        <ProjectsView />
      </Suspense>
    );
  } else if (activeTab === "updates") {
    body = <UpdatesView />;
  } else if (activeTab === "connections") {
    body = <ConnectedAppsView />;
  } else {
    body = (
      <Suspense fallback={<PageLoadingFrame title="Plans" accent="gold" />}>
        <SpacesView />
      </Suspense>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarProvider
        mobileMode={activeTab === "meetings" ? "drawer" : "inline"}
        className="relative min-h-0 flex-1 overflow-hidden"
      >
        <AppSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          accountLabel={accountLabel}
          userName={userName}
          avatarUrl={avatarUrl}
          onSignOut={requestSignOut}
          voice={{
            isActive,
            speaking: voxSpeaking,
            micLevel,
            callState,
            error: callError,
            onToggleCall,
          }}
        />

        <SidebarInset
          data-tauri-drag-region
          className={
            activeTab === "agent"
              ? "relative z-10 pointer-events-none min-w-0 bg-transparent"
              : "relative z-10 min-w-0 overflow-hidden"
          }
        >
          <div className="pointer-events-auto absolute inset-0">
            <div ref={mapNode} className="vox-map-host size-full" />
          </div>
          {activeTab === "agent" && <ActivityLogs />}
          {body}
          <DesktopActionOverlay />
          <TerminalPanel />
          {activeTab === "agent" && mapError ? (
            <Alert
              variant="destructive"
              className="absolute bottom-20 left-1/2 z-40 w-auto max-w-md -translate-x-1/2"
            >
              <AlertDescription>{mapError}</AlertDescription>
            </Alert>
          ) : null}
          {activeTab === "agent" && !mapReady && !mapError ? (
            <p className="pointer-events-none absolute bottom-20 left-1/2 z-40 -translate-x-1/2 text-xs text-muted-foreground">
              Loading map…
            </p>
          ) : null}
        </SidebarInset>
      </SidebarProvider>
      <Dialog open={signOutConfirm} onOpenChange={setSignOutConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign out with unsaved notes?</DialogTitle>
            <DialogDescription>
              Your unsaved meeting drafts will be discarded. Saved notes stay on
              this computer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSignOutConfirm(false)}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setSignOutConfirm(false);
                onSignOut();
              }}
            >
              Sign out and discard drafts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PageLoadingFrame({
  title,
  accent,
}: {
  title: string;
  accent: VoxColor;
}) {
  return (
    <PageContainer aria-busy="true" aria-label={`Loading ${title}`}>
      <PageHeader className="h-16 px-6 py-0">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="size-10 animate-pulse rounded-lg bg-muted"
          />
          <div className="leading-tight">
            <h1 className="text-base font-semibold tracking-tight">{title}</h1>
            <span
              aria-hidden="true"
              className="mt-0.5 block h-4 w-20 animate-pulse rounded-sm bg-muted"
            />
          </div>
        </div>
      </PageHeader>
      <PageBody className="flex items-center justify-center">
        <PageLoading
          accent={accent}
          label={`Loading ${title.toLowerCase()}…`}
        />
      </PageBody>
    </PageContainer>
  );
}
