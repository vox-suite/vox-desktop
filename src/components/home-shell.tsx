import { DesktopActionOverlay } from "@/components/shell/desktop-action-overlay";
import { TerminalPanel } from "@/components/shell/terminal-panel";
import { ConnectedAppsView } from "@/components/connected-apps-view";
import { lazy, Suspense, useState, type ReactNode } from "react";
import { Compass, Sparkles } from "lucide-react";
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
const StrataView = lazy(() =>
  import("@/components/strata/strata-view").then((m) => ({
    default: m.StrataView,
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
  micLevel,
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
  micLevel: number;
  callState: string;
  callError: string;
  onToggleCall: () => void;
  collections: Collection[];
}) {
  const [homeMode, setHomeMode] = useState<"map" | "strata">("strata");
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
      <Suspense
        fallback={
          <div
            className="m-8 h-48 animate-pulse rounded-lg bg-muted"
            aria-label="Loading page"
          />
        }
      >
        <PulseView />
      </Suspense>
    );
  } else if (activeTab === "updates") {
    body = <UpdatesView />;
  } else if (activeTab === "connections") {
    body = <ConnectedAppsView />;
  } else {
    body = (
      <Suspense
        fallback={
          <div
            className="m-8 h-48 animate-pulse rounded-lg bg-muted"
            aria-label="Loading page"
          />
        }
      >
        <SpacesView />
      </Suspense>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SidebarProvider className="relative min-h-0 flex-1 overflow-hidden">
        <div className="absolute inset-0">
          <div
            ref={mapNode}
            className={`vox-map-host size-full transition-opacity duration-300 ${
              homeMode === "map" ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
          {homeMode === "strata" && (
            <div className="absolute inset-0 size-full">
              <Suspense
                fallback={
                  <div className="size-full bg-[#0a0c0e] flex items-center justify-center font-mono text-xs text-muted-foreground">
                    INITIALIZING STRATA ENGINE…
                  </div>
                }
              >
                <StrataView />
              </Suspense>
            </div>
          )}
        </div>

        <ActivityLogs />

        <AppSidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          accountLabel={accountLabel}
          userName={userName}
          avatarUrl={avatarUrl}
          onSignOut={onSignOut}
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
          {activeTab === "agent" && (
            <div className="pointer-events-auto absolute top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 rounded-full border border-white/10 bg-black/60 p-1 backdrop-blur-md shadow-2xl">
              <button
                type="button"
                onClick={() => setHomeMode("map")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                  homeMode === "map"
                    ? "bg-white/20 text-white shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                <Compass className="size-3.5" />
                3D Map
              </button>
              <button
                type="button"
                onClick={() => setHomeMode("strata")}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1 text-xs font-mono font-medium transition-all ${
                  homeMode === "strata"
                    ? "bg-cyan-500/25 text-cyan-200 border border-cyan-400/30 shadow-sm"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                <Sparkles className="size-3.5 text-cyan-400" />
                Strata
              </button>
            </div>
          )}
          {body}
          <DesktopActionOverlay />
          <TerminalPanel />
          {activeTab === "agent" && homeMode === "map" && mapError ? (
            <Alert
              variant="destructive"
              className="absolute bottom-20 left-1/2 z-40 w-auto max-w-md -translate-x-1/2"
            >
              <AlertDescription>{mapError}</AlertDescription>
            </Alert>
          ) : null}
          {activeTab === "agent" && homeMode === "map" && !mapReady && !mapError ? (
            <p className="pointer-events-none absolute bottom-20 left-1/2 z-40 -translate-x-1/2 text-xs text-muted-foreground">
              Loading map…
            </p>
          ) : null}
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
