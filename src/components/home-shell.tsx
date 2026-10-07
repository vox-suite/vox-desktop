import { ConnectedAppsView } from "@/components/connected-apps-view";
import { lazy, Suspense, type ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AgentPane } from "@/components/shell/agent-pane";
import { ActivityLogs } from "@/components/activity-logs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { type ShellTab } from "@/components/shell/shell-tabs";
import { TimelineView } from "@/components/timeline-view";
import { useMissionMap } from "@/hooks/use-mission-map";
import type { Collection } from "@/lib/tauri";

// Charts (recharts) and the canvas (xyflow) are large, so load them on first visit.
const PulseView = lazy(() =>
  import("@/components/pulse/pulse-view").then((m) => ({
    default: m.PulseView,
  })),
);
const SpacesView = lazy(() =>
  import("@/components/spaces/spaces-view").then((m) => ({
    default: m.SpacesView,
  })),
);

export function HomeShell({
  activeTab,
  onTabChange,
  accountLabel,
  userName,
  avatarUrl,
  onSignOut,
  isActive,
  voxSpeaking,
  callState,
  callError,
  onToggleCall,
  collections,
}: {
  activeTab: ShellTab;
  onTabChange: (tab: ShellTab) => void;
  accountLabel: string;
  userName?: string | null;
  avatarUrl?: string | null;
  onSignOut: () => void;
  isActive: boolean;
  voxSpeaking: boolean;
  callState: string;
  callError: string;
  onToggleCall: () => void;
  collections: Collection[];
}) {
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
  } else if (activeTab === "pulse") {
    body = (
      <Suspense fallback={null}>
        <PulseView />
      </Suspense>
    );
  } else if (activeTab === "connections") {
    body = <ConnectedAppsView />;
  } else {
    body = (
      <Suspense fallback={null}>
        <SpacesView />
      </Suspense>
    );
  }

  return (
    <SidebarProvider className="relative h-full min-h-0 overflow-hidden">
      <div className="absolute inset-0">
        <div ref={mapNode} className="vox-map-host size-full" />
      </div>

      {activeTab === "agent" ? <ActivityLogs /> : null}

      <AppSidebar
        activeTab={activeTab}
        onTabChange={onTabChange}
        accountLabel={accountLabel}
        userName={userName}
        avatarUrl={avatarUrl}
        onSignOut={onSignOut}
      />

      <SidebarInset
        data-tauri-drag-region
        className={
          activeTab === "agent"
            ? "pointer-events-none min-w-0 bg-transparent"
            : "min-w-0 overflow-hidden"
        }
      >
        {body}
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
  );
}
