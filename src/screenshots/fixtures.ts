import type { TimelineEntry } from "@/features/timeline/api";
import type { SpaceGraph } from "@/features/spaces/types";
import type { Project } from "@/features/projects/types";
import type { SavedPulseChart } from "@/features/pulse/discovery-types";
export const stamp = "2026-10-12T12:00:00-07:00";
export const groups = [
  "expense",
  "meeting",
  "music",
  "gaming",
  "visit",
  "meal",
  "video",
].map((value, i) => ({
  id: value,
  value,
  label: (
    {
      expense: "Spending",
      meeting: "Meetings",
      music: "Music",
      gaming: "Gaming",
      visit: "Places",
      meal: "Food",
      video: "Video",
    } as Record<string, string>
  )[value],
  sort_order: i,
  ui_hint: {},
}));
const activity = [
  [
    "07:45",
    "Blue Bottle Coffee",
    "expense",
    "gmail",
    null,
    6.75,
    "Morning cappuccino and a pastry in Palo Alto.",
  ],
  [
    "08:15",
    "Morning focus · Spotify",
    "music",
    "spotify",
    "09:00",
    null,
    "Daily Mix 2 · 45 minutes of listening.",
  ],
  [
    "09:30",
    "Product design review",
    "meeting",
    "google_calendar",
    "10:15",
    null,
    "Review the onboarding flow with Maya and Jordan.",
  ],
  [
    "11:00",
    "Computer History Museum",
    "visit",
    "google_maps",
    "12:00",
    null,
    "A visit to the Revolution exhibition in Mountain View.",
  ],
  [
    "12:15",
    "Sweetgreen · lunch order",
    "meal",
    "gmail",
    null,
    18.42,
    "Harvest Bowl and sparkling water, ordered for pickup.",
  ],
  [
    "13:00",
    "Weekly engineering sync",
    "meeting",
    "google_calendar",
    "13:45",
    null,
    "Discuss the release plan and API integration.",
  ],
  [
    "14:30",
    "Sony WH-1000XM5 headphones",
    "expense",
    "gmail",
    null,
    299.99,
    "Order confirmed by Best Buy. Wireless noise-canceling headphones, paid with Visa ending in 4242.",
  ],
  [
    "16:15",
    "Lo-fi afternoon · Spotify",
    "music",
    "spotify",
    "17:00",
    null,
    "Instrumental beats while wrapping up the day.",
  ],
  [
    "18:00",
    "Trader Joe’s · groceries",
    "expense",
    "gmail",
    null,
    54.28,
    "Weekly groceries at the Mountain View store.",
  ],
  [
    "19:00",
    "Ramen Nagi · dinner order",
    "meal",
    "gmail",
    null,
    26.8,
    "Original King ramen and gyoza for pickup in Palo Alto.",
  ],
  [
    "20:15",
    "Marvel’s Spider-Man 2",
    "gaming",
    "playstation",
    "21:45",
    null,
    "PlayStation 5 · evening session · 1 hour 30 minutes.",
  ],
  [
    "22:00",
    "How Silicon Valley began",
    "video",
    "youtube",
    "22:25",
    null,
    "A 25-minute documentary from the Computer History Museum.",
  ],
] as const;
export function entries(day = "2026-10-12"): TimelineEntry[] {
  return activity.map(
    ([time, title, group, source, end, amount, summary], i) => ({
      event: {
        id: `${day}-${i}`,
        user_id: "demo-alex",
        title,
        summary,
        group_id: group,
        event_type_id: group,
        occurred_at: `${day}T${time}:00-07:00`,
        ended_at: end ? `${day}T${end}:00-07:00` : null,
        time_precision: "minute",
        source_timezone: "America/Los_Angeles",
        record_state: "confirmed",
        confidence: 0.99,
        revision: 1,
        created_at: stamp,
        updated_at: stamp,
        content: amount
          ? {
              amount,
              currency: "USD",
              merchant: i === 6 ? "Best Buy" : title.split(" · ")[0],
              direction: "outflow",
            }
          : {},
      },
      evidence: [
        {
          id: `e-${day}-${i}`,
          timeline_event_id: `${day}-${i}`,
          user_id: "demo-alex",
          source_type: source,
          source_id:
            source === "gmail"
              ? i === 6
                ? "Best Buy order confirmation · BBY-10482761"
                : "Email receipt · " + title
              : summary,
          raw_reference: null,
          created_at: stamp,
          observation_metadata: {},
        },
      ],
    }),
  );
}
export const spending = [
  entries()[0],
  entries()[4],
  entries()[6],
  entries()[8],
  entries()[9],
  {
    ...entries("2026-10-11")[0],
    event: {
      ...entries("2026-10-11")[0].event,
      title: "Caltrain · day pass",
      content: {
        amount: 12.8,
        currency: "USD",
        merchant: "Caltrain",
        direction: "outflow",
      },
    },
  },
  {
    ...entries("2026-10-10")[0],
    event: {
      ...entries("2026-10-10")[0].event,
      title: "Netflix · monthly subscription",
      content: {
        amount: 17.99,
        currency: "USD",
        merchant: "Netflix",
        direction: "outflow",
      },
    },
  },
];
export const plan: SpaceGraph = {
  space: {
    id: "weekend-plan",
    user_id: "demo-alex",
    title: "A weekend on the Peninsula",
    intent: "Plan a relaxed Saturday around Mountain View for two, under $150.",
    state: "planned",
    run_state: "idle",
    run_error: null,
    project_id: null,
    committed_collection_id: null,
    agent_spec: {},
    created_at: stamp,
    updated_at: stamp,
  },
  nodes: [],
  edges: [],
};
const nodeInfo = [
  [
    "goal",
    "A Saturday worth slowing down for",
    "Two people · Mountain View and Palo Alto.\nA museum, a good lunch, and time outdoors.\nKeep the total under $150.",
    0,
    225,
  ],
  [
    "research",
    "Museum & opening hours",
    "Computer History Museum\n10 AM–5 PM · allow 2 hours.\nTwo adult tickets: $39.",
    450,
    0,
  ],
  [
    "research",
    "Lunch on Castro Street",
    "Doppio Zero · wood-fired pizza.\nBudget $48 for two, including tip.\nA 10-minute drive from the museum.",
    450,
    265,
  ],
  [
    "research",
    "A walk by the Bay",
    "Shoreline Lake · a gentle 2-mile loop.\nFree parking and open trails.\nBring a light jacket for the breeze.",
    450,
    530,
  ],
  [
    "synthesis",
    "The best route, within budget",
    "Museum → Castro Street → Shoreline.\nTickets $39 + lunch $48 + coffee $14.\nTotal $101 · $49 left for flexibility.",
    900,
    225,
  ],
  [
    "plan",
    "Your finished Saturday plan",
    "10:00 · Computer History Museum\n12:30 · Lunch at Doppio Zero\n14:00 · Walk around Shoreline Lake\n15:30 · Coffee at Blue Bottle\nEstimated total: $101 for two.",
    1350,
    225,
  ],
] as const;
plan.nodes = nodeInfo.map(([kind, title, body, x, y], i) => ({
  id: `n${i}`,
  space_id: plan.space.id,
  kind,
  title,
  body,
  position: { x, y },
  data: {
    execution: {
      role: kind === "research" ? "web_search" : kind,
      status: "done",
    },
  },
  state: "done",
  is_current: true,
  is_final: kind === "plan",
  version: 1,
  replaces: null,
  derived_from: [],
  provenance: {},
  created_at: stamp,
  updated_at: stamp,
}));
plan.edges = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 4],
  [2, 4],
  [3, 4],
  [4, 5],
].map(([from, to], i) => ({
  id: `edge${i}`,
  space_id: plan.space.id,
  from_node: `n${from}`,
  to_node: `n${to}`,
  created_at: stamp,
}));
export const project: Project = {
  id: "peninsula-app",
  name: "Peninsula · neighborhood guide",
  revision: 1,
  created_at: stamp,
  updated_at: stamp,
  data: {
    template: "software",
    notes: "A local guide for exploring the Peninsula.",
    sources: [
      {
        id: "repo",
        label: "peninsula-guide",
        kind: "folder",
        files: 128,
        symbols: 364,
        fingerprint: "demo",
        indexed_at: stamp,
      },
    ],
    messages: [],
    activity: [],
    nodes: [
      [
        "React web client",
        "Search places, save favorites, and build a day itinerary.",
        "module",
      ],
      [
        "Places API",
        "Typed endpoints for nearby landmarks, cafés, and restaurants.",
        "module",
      ],
      [
        "Postgres & search",
        "Store curated places, user lists, and location-aware search.",
        "module",
      ],
      [
        "Map renderer",
        "MapLibre layers show public places and walking routes.",
        "module",
      ],
      [
        "Google Places connector",
        "Refresh opening hours and public place details.",
        "integration",
      ],
      [
        "Release pipeline",
        "GitHub Actions checks types and ships the preview.",
        "workflow",
      ],
    ].map(([title, body, kind], i) => ({
      id: `context${i}`,
      title,
      body,
      kind,
      origin: "user",
      stale: false,
      history: [],
      citations: [],
      updated_at: stamp,
    })),
  },
};
const musicSeries = [
  ["Focus", [40, 55, 30, 70, 45, 80, 50]],
  ["Chill", [20, 25, 15, 30, 24, 35, 28]],
  ["Workout", [5, 12, 0, 10, 5, 18, 11]],
].map(([title, values], i) => ({
  measurement_id: `music${i}`,
  title: String(title),
  source: "spotify",
  unit: "minutes",
  quality: "observed",
  total: (values as number[]).reduce((a, b) => a + b, 0),
  record_count: 14,
  points: (values as number[]).map((value, j) => ({
    label: `2026-10-${String(j + 6).padStart(2, "0")}`,
    value,
  })),
}));
export const charts: SavedPulseChart[] = [
  ["Weekly spending", "bar", "USD", "gmail", [84, 62, 109, 45, 128, 71, 96]],
  [
    "Music through the week",
    "line",
    "minutes",
    "spotify",
    [65, 92, 48, 110, 74, 132, 89],
  ],
  ["Where your money went", "pie", "USD", "gmail", [186, 128, 89, 55]],
  [
    "Gaming time",
    "bar",
    "hours",
    "playstation",
    [1.2, 0, 1.5, 0.8, 0, 2.2, 1.5],
  ],
].map(([title, chartType, unit, source, values], i) => ({
  id: `chart${i}`,
  title: String(title),
  created_at: stamp,
  updated_at: stamp,
  definition: {
    version: 2,
    chart_type: chartType as "bar",
    measurement_id: `m${i}`,
    dimension: i === 2 ? "category" : null,
    bucket: i === 2 ? null : "day",
    period_days: 7,
    timezone: "America/Los_Angeles",
  },
  result: {
    points: (values as number[]).map((value, j) => ({
      label:
        i === 2
          ? ["Groceries", "Dining", "Shopping", "Transport"][j]
          : `2026-10-${String(j + 6).padStart(2, "0")}`,
      value,
    })),
    source: String(source),
    unit: String(unit),
    total: (values as number[]).reduce((a, b) => a + b, 0),
    record_count: 42,
    undated_count: 0,
    quality: "observed",
    description:
      i === 0
        ? "12% less spending than the previous week."
        : i === 1
          ? "Your weekday listening rhythm."
          : i === 2
            ? "Everyday spending by category."
            : "Evening sessions on PlayStation 5.",
    computed_at: stamp,
    data_as_of: stamp,
    coverage: { state: "complete" },
    error: null,
    ...(i === 1 ? { series: musicSeries } : {}),
  },
}));

const purchase = entries()[6];
// Both sources belong to the same email-derived purchase, never real account evidence.
export const purchaseEvidence = {
  ...purchase.evidence[0],
  id: "demo-order-pdf",
  source_type: "email attachment",
  source_id: "Best Buy receipt.pdf · Order BBY-10482761",
};

export const purchaseSpan: import("@/features/spans/types").Span = {
  id: purchase.event.id,
  user_id: purchase.event.user_id,
  title: purchase.event.title,
  notes: purchase.event.summary ?? "",
  category: "expense",
  start_at: purchase.event.occurred_at,
  end_at: null,
  due_at: null,
  completed_at: null,
  status: "done",
  priority: 0,
  data: {
    ...(purchase.event.content as Record<string, unknown>),
    time_precision: purchase.event.time_precision,
  },
  schema_id: purchase.event.event_type_id,
  schema_color_token: null,
  schema_icon_token: null,
  parent_id: null,
  source: "gmail",
  source_event_id: null,
  source_ref: purchase.evidence[0].source_id ?? null,
  execution_type: null,
  execution_result: null,
  collection_ids: [],
  version: 1,
  created_at: purchase.event.created_at,
  updated_at: purchase.event.updated_at,
};
