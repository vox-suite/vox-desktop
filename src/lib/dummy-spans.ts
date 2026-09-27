import type { Span, SpanQuery } from "@/lib/tauri";

function at(hour: number, minute = 0, dayOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function span(partial: Partial<Span> & Pick<Span, "id" | "title">): Span {
  return {
    parent_id: null,
    notes: "",
    category: "todo",
    source: "dummy",
    status: "planned",
    start_at: null,
    end_at: null,
    due_at: null,
    priority: 0,
    execution_type: null,
    execution_result: null,
    data: {},
    collection_ids: [],
    version: 1,
    completed_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...partial,
  };
}

const DUMMY_SPANS: Span[] = [
  span({
    id: "dummy-standup",
    title: "Team standup",
    category: "meeting",
    status: "done",
    start_at: at(10, 0),
    end_at: at(10, 30),
  }),
  span({
    id: "dummy-coffee",
    title: "Coffee",
    category: "food",
    status: "done",
    start_at: at(9, 40),
    end_at: at(9, 40),
    data: { amount: 150, currency: "INR" },
  }),
  span({
    id: "dummy-ride",
    title: "Bike ride",
    category: "cycling",
    status: "active",
    start_at: at(16, 0),
    end_at: at(18, 0),
  }),
  span({
    id: "dummy-food-stall",
    title: "Food stall",
    category: "food",
    status: "done",
    start_at: at(17, 15),
    end_at: at(17, 15),
    data: { amount: 300, currency: "INR" },
  }),
  span({
    id: "dummy-dinner",
    title: "Dinner with Priya",
    category: "meal",
    start_at: at(20, 0, 1),
    end_at: at(21, 30, 1),
  }),
  span({
    id: "dummy-groceries",
    title: "Buy groceries",
    category: "todo",
  }),
  span({
    id: "dummy-report",
    title: "Send weekly report",
    category: "todo",
    due_at: at(18, 0),
  }),
];

export function dummySpansFor(query: SpanQuery): Span[] {
  if (query.unscheduled) return DUMMY_SPANS.filter((s) => !s.start_at);
  if (!query.from || !query.to) return DUMMY_SPANS.filter((s) => s.start_at);
  const from = new Date(query.from).getTime();
  const to = new Date(query.to).getTime();
  return DUMMY_SPANS.filter((s) => {
    if (!s.start_at) return false;
    const t = new Date(s.start_at).getTime();
    return t >= from && t < to;
  });
}
