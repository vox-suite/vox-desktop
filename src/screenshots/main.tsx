import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { OriginalMonth } from "./original-month";
import { SpanPanel } from "@/components/span-panel";
import { purchaseSpan } from "./fixtures";
import { HomeShell } from "@/components/home-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { installPlatform, type Platform } from "@/platform";
import { useDesktopContext } from "@/hooks/use-desktop-control";
import { desktopStore } from "@/features/desktop-control/store";
import { KNOWN_CONNECTORS } from "@/components/connected-apps";
import {
  entries,
  groups,
  spending,
  plan,
  project,
  charts,
  stamp,
  purchaseEvidence,
} from "./fixtures";
import "@/index.css";
import "./screenshots.css";
import { decorateScreenshot } from "./presentation";
if (!import.meta.env.DEV)
  throw new Error("Screenshot fixtures are development only");
// Isolate all native, network, and cache calls from personal account data.
const internals = {
  invoke: async (cmd: string) =>
    cmd === "get_native_location"
      ? { lat: 37.4143, lng: -122.0775 }
      : cmd.includes("listen")
        ? 1
        : null,
  transformCallback: () => 1,
  unregisterCallback: () => {},
};
Object.assign(window, {
  __TAURI_INTERNALS__: internals,
  __TAURI_EVENT_PLUGIN_INTERNALS__: { unregisterListener: () => {} },
});
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = String(input);
  if (url.includes("ipapi.co"))
    return Promise.resolve(
      new Response(
        JSON.stringify({
          latitude: 37.4143,
          longitude: -122.0775,
          city: "Computer History Museum",
        }),
      ),
    );
  if (url.includes("nominatim"))
    return Promise.resolve(
      new Response(
        JSON.stringify({
          address: { city: "Computer History Museum · Mountain View" },
        }),
      ),
    );
  return originalFetch(input, init);
};
localStorage.setItem(
  "vox-map-pos",
  JSON.stringify({ lat: 37.4143, lng: -122.0775 }),
);
const connectors = [
  {
    id: "gmail",
    name: "Gmail",
    description: "Receipts, purchases, and important updates from your inbox.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "oauth2",
    available: true,
  },
  ...KNOWN_CONNECTORS,
];
const connections = connectors.map((c) => ({
  id: `demo-${c.id}`,
  connector_id: c.id,
  authorization_state: "authorized",
  last_synced_at: stamp,
  sync_timeline: true,
  assistant_read: true,
  failure_code: null,
  account_label: "alex.morgan@example.com",
}));
const mock: Platform = {
  cache: {
    read: async () => null,
    write: async () => {},
    clear: async () => {},
  },
  live: { subscribe: () => () => {} },
  http: {
    request: async (req) => {
      const { path, body } = req;
      const b = (body ?? {}) as Record<string, unknown>;
      if (path.endsWith("/timeline/groups")) return groups as never;
      if (path.endsWith("/timeline/event-types")) return [] as never;
      if (path.endsWith("/timeline/events/days")) {
        const days = [];
        for (
          let d = new Date(String(b.start_at));
          d < new Date(String(b.end_at));
          d.setDate(d.getDate() + 1)
        ) {
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          days.push({
            day,
            count: 6 + (d.getDate() % 7),
            rev: "demo",
            categories: groups
              .slice(0, 3 + (d.getDate() % 4))
              .map((g) => ({ category: g.value, count: 2 })),
          });
        }
        return { revision: 1, days } as never;
      }
      if (path.endsWith("/timeline/events/query")) {
        const start = new Date(String(b.start_at));
        const day = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
        return {
          events: b.spending_only
            ? spending
            : entries(day)
                .map((entry) =>
                  entry.event.title.includes("Sony")
                    ? {
                        ...entry,
                        evidence: [...entry.evidence, purchaseEvidence],
                      }
                    : entry,
                )
                .filter(
                  (e) => !b.group_value || e.event.group_id === b.group_value,
                ),
          next_cursor: null,
        } as never;
      }
      if (path.endsWith("/connectors/list")) return connectors as never;
      if (path.endsWith("/connections/list")) return connections as never;
      if (path.includes("/count"))
        return {
          count: path.includes("pulse") ? 4 : 1,
          revision: "demo",
          rev: "demo",
        } as never;
      if (path.endsWith("/pulse/charts")) return charts as never;
      if (path.includes("/result"))
        return charts.find((c) => path.includes(c.id))!.result as never;
      if (path.endsWith("/pulse/measurements")) return [] as never;
      if (path.endsWith("/spaces")) return [plan.space] as never;
      if (path.endsWith("/messages")) return [] as never;
      if (path.includes("/spaces/")) return plan as never;
      if (path.endsWith("/projects"))
        return { items: [project], next_cursor: null } as never;
      if (path.includes("/projects/")) return project as never;
      return [] as never;
    },
  },
};
installPlatform(mock);
const page = new URLSearchParams(location.search).get("screen") ?? "home";
const tabs = {
  home: "agent",
  day: "timeline",
  month: "timeline",
  detail: "timeline",
  filter: "timeline",
  apps: "connections",
  insights: "pulse",
  plans: "spaces",
  project: "projects",
} as const;
desktopStore.patch({
  page: tabs[page as keyof typeof tabs] ?? "agent",
  spaceId: page === "plans" ? plan.space.id : null,
  projectId: page === "project" ? project.id : null,
  timezone: "America/Los_Angeles",
  timeline:
    page === "filter"
      ? {
          startAt: "2026-10-06T00:00:00-07:00",
          endAt: "2026-10-13T00:00:00-07:00",
          timezone: "America/Los_Angeles",
          spendingOnly: true,
          merchant: null,
          category: null,
        }
      : null,
});
export default function Capture() {
  const context = useDesktopContext();
  const [selectedSpan, setSelectedSpan] = useState<
    import("@/features/spans/types").Span | null
  >(page === "detail" ? purchaseSpan : null);
  useEffect(() => {
    document.body.dataset.screen = page;
    return decorateScreenshot(page);
  }, []);
  return (
    <>
      <HomeShell
        activeTab={context.page}
        onTabChange={(tab) => desktopStore.navigate(tab)}
        accountLabel="alex.morgan@example.com"
        userName="Alex Morgan"
        avatarUrl={null}
        onSignOut={() => {}}
        isActive={false}
        voxSpeaking={false}
        micLevel={0}
        callState="idle"
        callError=""
        onToggleCall={() => {}}
        collections={[]}
      />
      {page === "month" && <OriginalMonth onSelectSpan={setSelectedSpan} />}
      <SpanPanel
        span={selectedSpan}
        collections={[]}
        onClose={() => setSelectedSpan(null)}
        onSaved={() => {}}
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <TooltipProvider>
    <Capture />
  </TooltipProvider>,
);
