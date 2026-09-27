import type { Span, SpanQuery } from "@/lib/tauri";

function weekDay(dayOfWeek: number, hour: number, minute = 0): string {
  // 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay());
  sunday.setHours(hour, minute, 0, 0);
  const target = new Date(sunday);
  target.setDate(sunday.getDate() + dayOfWeek);
  return target.toISOString();
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
  // --- Sunday (Day 0) ---
  span({
    id: "dummy-sun-ride",
    title: "Morning bike ride - Harlur Lake trail",
    category: "cycling",
    status: "done",
    start_at: weekDay(0, 7, 0),
    end_at: weekDay(0, 8, 30),
  }),
  span({
    id: "dummy-sun-coffee",
    title: "Filter coffee & breakfast at Third Wave",
    category: "food",
    status: "done",
    start_at: weekDay(0, 9, 15),
    end_at: weekDay(0, 9, 15),
    data: { amount: 280, currency: "INR" },
  }),
  span({
    id: "dummy-sun-task",
    title: "Sprint retrospective & task review",
    category: "todo",
    status: "done",
    start_at: weekDay(0, 11, 0),
    end_at: weekDay(0, 12, 30),
  }),
  span({
    id: "dummy-sun-brunch",
    title: "Sunday brunch with family",
    category: "meal",
    status: "done",
    start_at: weekDay(0, 13, 0),
    end_at: weekDay(0, 14, 15),
    data: { amount: 1650, currency: "INR" },
  }),
  span({
    id: "dummy-sun-mall",
    title: "Visit Nexus Koramangala Mall",
    category: "visit",
    status: "done",
    start_at: weekDay(0, 15, 30),
    end_at: weekDay(0, 17, 30),
  }),
  span({
    id: "dummy-sun-gelato",
    title: "Gelato at Milano - Nexus Mall",
    category: "food",
    status: "done",
    start_at: weekDay(0, 16, 45),
    end_at: weekDay(0, 16, 45),
    data: { amount: 320, currency: "INR" },
  }),
  span({
    id: "dummy-sun-eve-ride",
    title: "Evening bike ride",
    category: "ride",
    status: "done",
    start_at: weekDay(0, 18, 0),
    end_at: weekDay(0, 19, 15),
  }),
  span({
    id: "dummy-sun-ps5",
    title: "PS5: Black Myth: Wukong session",
    category: "game",
    status: "done",
    start_at: weekDay(0, 20, 30),
    end_at: weekDay(0, 22, 30),
  }),

  // --- Monday (Day 1) ---
  span({
    id: "dummy-mon-commute",
    title: "Metro commute to office",
    category: "commute",
    start_at: weekDay(1, 8, 30),
    end_at: weekDay(1, 9, 15),
  }),
  span({
    id: "dummy-mon-coffee",
    title: "Cappuccino at Blue Tokai",
    category: "food",
    start_at: weekDay(1, 9, 30),
    end_at: weekDay(1, 9, 30),
    data: { amount: 220, currency: "INR" },
  }),
  span({
    id: "dummy-mon-standup",
    title: "Team standup & sprint kickoff",
    category: "meeting",
    start_at: weekDay(1, 10, 0),
    end_at: weekDay(1, 10, 45),
  }),
  span({
    id: "dummy-mon-deepwork",
    title: "Deep work: Implement WebRTC jitter buffer",
    category: "todo",
    start_at: weekDay(1, 11, 15),
    end_at: weekDay(1, 13, 0),
  }),
  span({
    id: "dummy-mon-lunch",
    title: "Team lunch at Social",
    category: "meal",
    start_at: weekDay(1, 13, 0),
    end_at: weekDay(1, 14, 0),
    data: { amount: 650, currency: "INR" },
  }),
  span({
    id: "dummy-mon-sync",
    title: "1:1 with Engineering Lead",
    category: "meeting",
    start_at: weekDay(1, 14, 30),
    end_at: weekDay(1, 15, 15),
  }),
  span({
    id: "dummy-mon-fixpr",
    title: "Fix PR #81 - device link shell permissions",
    category: "todo",
    start_at: weekDay(1, 15, 45),
    end_at: weekDay(1, 17, 30),
  }),
  span({
    id: "dummy-mon-commute-home",
    title: "Evening commute back home",
    category: "commute",
    start_at: weekDay(1, 18, 30),
    end_at: weekDay(1, 19, 15),
  }),
  span({
    id: "dummy-mon-swiggy",
    title: "Swiggy dinner order",
    category: "food",
    start_at: weekDay(1, 19, 30),
    end_at: weekDay(1, 19, 30),
    data: { amount: 480, currency: "INR" },
  }),
  span({
    id: "dummy-mon-ps5",
    title: "PS5 Gaming: FC 25 Ultimate Team",
    category: "game",
    start_at: weekDay(1, 21, 0),
    end_at: weekDay(1, 22, 30),
  }),

  // --- Tuesday (Day 2) ---
  span({
    id: "dummy-tue-ride",
    title: "Morning bike ride & intervals",
    category: "cycling",
    start_at: weekDay(2, 7, 15),
    end_at: weekDay(2, 8, 15),
  }),
  span({
    id: "dummy-tue-cab",
    title: "Cab to Embassy Tech Village office",
    category: "travel",
    start_at: weekDay(2, 9, 0),
    end_at: weekDay(2, 9, 45),
    data: { amount: 340, currency: "INR" },
  }),
  span({
    id: "dummy-tue-standup",
    title: "Daily standup",
    category: "meeting",
    start_at: weekDay(2, 10, 0),
    end_at: weekDay(2, 10, 30),
  }),
  span({
    id: "dummy-tue-sync",
    title: "Product sync: Span calendar roadmap",
    category: "meeting",
    start_at: weekDay(2, 11, 0),
    end_at: weekDay(2, 12, 0),
  }),
  span({
    id: "dummy-tue-coffee",
    title: "Specialty cold brew coffee",
    category: "food",
    start_at: weekDay(2, 12, 30),
    end_at: weekDay(2, 12, 30),
    data: { amount: 260, currency: "INR" },
  }),
  span({
    id: "dummy-tue-refactor",
    title: "Refactor Span layout & overlap resolution",
    category: "todo",
    start_at: weekDay(2, 14, 0),
    end_at: weekDay(2, 15, 30),
  }),
  span({
    id: "dummy-tue-arch",
    title: "AI agent architecture review",
    category: "meeting",
    start_at: weekDay(2, 16, 0),
    end_at: weekDay(2, 17, 0),
  }),
  span({
    id: "dummy-tue-fuel",
    title: "Fuel refill - HP Petrol",
    category: "expense",
    start_at: weekDay(2, 18, 0),
    end_at: weekDay(2, 18, 0),
    data: { amount: 1800, currency: "INR" },
  }),
  span({
    id: "dummy-tue-commute",
    title: "Commute back home",
    category: "commute",
    start_at: weekDay(2, 18, 30),
    end_at: weekDay(2, 19, 30),
  }),
  span({
    id: "dummy-tue-ps5",
    title: "PS5: Elden Ring Shadow of the Erdtree",
    category: "game",
    start_at: weekDay(2, 20, 30),
    end_at: weekDay(2, 22, 0),
  }),

  // --- Wednesday (Day 3) ---
  span({
    id: "dummy-wed-ride",
    title: "Morning bike ride - Sarjapur route",
    category: "cycling",
    start_at: weekDay(3, 6, 45),
    end_at: weekDay(3, 8, 0),
  }),
  span({
    id: "dummy-wed-commute",
    title: "Office commute",
    category: "commute",
    start_at: weekDay(3, 8, 45),
    end_at: weekDay(3, 9, 30),
  }),
  span({
    id: "dummy-wed-standup",
    title: "Daily standup",
    category: "meeting",
    start_at: weekDay(3, 10, 0),
    end_at: weekDay(3, 10, 30),
  }),
  span({
    id: "dummy-wed-release",
    title: "Prepare Vox Core release candidate",
    category: "todo",
    start_at: weekDay(3, 11, 0),
    end_at: weekDay(3, 12, 30),
  }),
  span({
    id: "dummy-wed-lunch",
    title: "Lunch at cafeteria",
    category: "meal",
    start_at: weekDay(3, 13, 0),
    end_at: weekDay(3, 13, 45),
    data: { amount: 220, currency: "INR" },
  }),
  span({
    id: "dummy-wed-spec",
    title: "Write tech spec for local Gemma GGUF model",
    category: "todo",
    start_at: weekDay(3, 14, 0),
    end_at: weekDay(3, 15, 30),
  }),
  span({
    id: "dummy-wed-call",
    title: "Sync with mobile team (Android)",
    category: "call",
    start_at: weekDay(3, 16, 0),
    end_at: weekDay(3, 16, 45),
  }),
  span({
    id: "dummy-wed-mall",
    title: "Visit Vested / Nexus Shantiniketan Mall",
    category: "visit",
    start_at: weekDay(3, 18, 0),
    end_at: weekDay(3, 20, 30),
  }),
  span({
    id: "dummy-wed-shopping",
    title: "Electronics & accessories at Croma",
    category: "expense",
    start_at: weekDay(3, 19, 30),
    end_at: weekDay(3, 19, 30),
    data: { amount: 3499, currency: "INR" },
  }),
  span({
    id: "dummy-wed-dinner",
    title: "Dinner with friends at Chili's",
    category: "meal",
    start_at: weekDay(3, 20, 45),
    end_at: weekDay(3, 21, 45),
    data: { amount: 1250, currency: "INR" },
  }),

  // --- Thursday (Day 4) ---
  span({
    id: "dummy-thu-metro",
    title: "Metro to office",
    category: "commute",
    start_at: weekDay(4, 8, 45),
    end_at: weekDay(4, 9, 30),
  }),
  span({
    id: "dummy-thu-chai",
    title: "Chai & breakfast sandwich",
    category: "food",
    start_at: weekDay(4, 9, 45),
    end_at: weekDay(4, 9, 45),
    data: { amount: 180, currency: "INR" },
  }),
  span({
    id: "dummy-thu-standup",
    title: "Cross-functional standup",
    category: "meeting",
    start_at: weekDay(4, 10, 0),
    end_at: weekDay(4, 10, 30),
  }),
  span({
    id: "dummy-thu-triage",
    title: "Customer feedback review & triage",
    category: "todo",
    start_at: weekDay(4, 11, 0),
    end_at: weekDay(4, 12, 30),
  }),
  span({
    id: "dummy-thu-lunch",
    title: "Lunch & team walk",
    category: "meal",
    start_at: weekDay(4, 13, 0),
    end_at: weekDay(4, 14, 0),
    data: { amount: 350, currency: "INR" },
  }),
  span({
    id: "dummy-thu-demo",
    title: "Client demo: Vox duplex audio agent",
    category: "meeting",
    start_at: weekDay(4, 14, 30),
    end_at: weekDay(4, 15, 30),
  }),
  span({
    id: "dummy-thu-bench",
    title: "Performance benchmark: CPAL audio latency",
    category: "todo",
    start_at: weekDay(4, 16, 0),
    end_at: weekDay(4, 17, 30),
  }),
  span({
    id: "dummy-thu-cab",
    title: "Cab home",
    category: "travel",
    start_at: weekDay(4, 18, 30),
    end_at: weekDay(4, 19, 15),
    data: { amount: 380, currency: "INR" },
  }),
  span({
    id: "dummy-thu-dinner",
    title: "Dinner at Burma Burma",
    category: "meal",
    start_at: weekDay(4, 20, 0),
    end_at: weekDay(4, 21, 30),
    data: { amount: 2100, currency: "INR" },
  }),
  span({
    id: "dummy-thu-ps5",
    title: "PS5 Gaming: FC 25 online with Nikhil",
    category: "game",
    start_at: weekDay(4, 21, 45),
    end_at: weekDay(4, 23, 0),
  }),

  // --- Friday (Day 5) ---
  span({
    id: "dummy-fri-ride",
    title: "Morning bike ride",
    category: "cycling",
    start_at: weekDay(5, 7, 15),
    end_at: weekDay(5, 8, 15),
  }),
  span({
    id: "dummy-fri-cab",
    title: "Cab to office",
    category: "travel",
    start_at: weekDay(5, 9, 0),
    end_at: weekDay(5, 9, 45),
    data: { amount: 310, currency: "INR" },
  }),
  span({
    id: "dummy-fri-standup",
    title: "Daily standup",
    category: "meeting",
    start_at: weekDay(5, 10, 0),
    end_at: weekDay(5, 10, 30),
  }),
  span({
    id: "dummy-fri-security",
    title: "Security audit & API key rotation",
    category: "todo",
    start_at: weekDay(5, 11, 0),
    end_at: weekDay(5, 12, 45),
  }),
  span({
    id: "dummy-fri-lunch",
    title: "Team lunch",
    category: "meal",
    start_at: weekDay(5, 13, 0),
    end_at: weekDay(5, 14, 0),
    data: { amount: 550, currency: "INR" },
  }),
  span({
    id: "dummy-fri-deploy",
    title: "Deploy Vox Core release v0.2.0",
    category: "todo",
    start_at: weekDay(5, 14, 30),
    end_at: weekDay(5, 16, 0),
  }),
  span({
    id: "dummy-fri-retro",
    title: "Sprint retro & celebration demos",
    category: "meeting",
    start_at: weekDay(5, 16, 15),
    end_at: weekDay(5, 17, 30),
  }),
  span({
    id: "dummy-fri-mall",
    title: "Visit Forum South Mall - IMAX Movie",
    category: "visit",
    start_at: weekDay(5, 18, 30),
    end_at: weekDay(5, 21, 30),
  }),
  span({
    id: "dummy-fri-tickets",
    title: "IMAX tickets & snacks",
    category: "expense",
    start_at: weekDay(5, 20, 30),
    end_at: weekDay(5, 20, 30),
    data: { amount: 1600, currency: "INR" },
  }),
  span({
    id: "dummy-fri-ps5",
    title: "PS5: Astro Bot weekend chill",
    category: "game",
    start_at: weekDay(5, 22, 0),
    end_at: weekDay(5, 23, 30),
  }),

  // --- Saturday (Day 6) ---
  span({
    id: "dummy-sat-ride",
    title: "Weekend long bike ride to Nandi Hills",
    category: "cycling",
    start_at: weekDay(6, 6, 0),
    end_at: weekDay(6, 9, 30),
  }),
  span({
    id: "dummy-sat-breakfast",
    title: "Breakfast at Indian Paratha Company",
    category: "food",
    start_at: weekDay(6, 9, 45),
    end_at: weekDay(6, 9, 45),
    data: { amount: 450, currency: "INR" },
  }),
  span({
    id: "dummy-sat-maintenance",
    title: "Rest & bike maintenance",
    category: "todo",
    start_at: weekDay(6, 11, 30),
    end_at: weekDay(6, 13, 0),
  }),
  span({
    id: "dummy-sat-mall",
    title: "Visit Phoenix Marketcity - Shopping & Arcade",
    category: "visit",
    start_at: weekDay(6, 14, 0),
    end_at: weekDay(6, 17, 30),
  }),
  span({
    id: "dummy-sat-shopping",
    title: "Sneaker purchase - Nike Store",
    category: "expense",
    start_at: weekDay(6, 16, 0),
    end_at: weekDay(6, 16, 0),
    data: { amount: 8999, currency: "INR" },
  }),
  span({
    id: "dummy-sat-dinner",
    title: "Dinner with friends at Toit",
    category: "meal",
    start_at: weekDay(6, 19, 0),
    end_at: weekDay(6, 20, 30),
    data: { amount: 2800, currency: "INR" },
  }),
  span({
    id: "dummy-sat-ps5",
    title: "PS5 Gaming session with friends",
    category: "game",
    start_at: weekDay(6, 21, 0),
    end_at: weekDay(6, 23, 30),
  }),

  // --- Unscheduled To-Dos (Right To-do Drawer) ---
  span({
    id: "dummy-todo-bike-lube",
    title: "Buy chain lube and puncture repair kit for bike",
    category: "todo",
    priority: 1,
  }),
  span({
    id: "dummy-todo-ps-plus",
    title: "Renew PlayStation Plus Deluxe membership",
    category: "todo",
    priority: 2,
  }),
  span({
    id: "dummy-todo-tax",
    title: "Submit quarterly investment tax declarations",
    category: "todo",
    due_at: weekDay(5, 18, 0),
    priority: 3,
  }),
  span({
    id: "dummy-todo-figma",
    title: "Review Figma mockups for Vox Mobile audio visualizer",
    category: "todo",
    priority: 2,
  }),
  span({
    id: "dummy-todo-wrist-rest",
    title: "Order ergonomic keyboard wrist rest",
    category: "todo",
    priority: 1,
  }),
  span({
    id: "dummy-todo-clean-desk",
    title: "Clean up desktop workspace and wire management",
    category: "todo",
    priority: 1,
  }),
  span({
    id: "dummy-todo-backup-photos",
    title: "Backup iPhone photos to external SSD",
    category: "todo",
    priority: 2,
  }),
  span({
    id: "dummy-todo-book-goa",
    title: "Book serviced apartment for Goa workation",
    category: "todo",
    due_at: weekDay(6, 12, 0),
    priority: 3,
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
