import type { ContextNode, Project, ProjectData } from "./types";
export const templates = [
  {
    id: "engineering",
    label: "Engineering",
    prompt: "What are you building, and what should it make easier?",
  },
  {
    id: "launch",
    label: "Launch",
    prompt: "Who is this for, and what do you want to launch?",
  },
  {
    id: "3d-print",
    label: "3D print",
    prompt: "What do you want to make, and what constraints matter?",
  },
  {
    id: "general",
    label: "Something else",
    prompt: "What would you like to explore?",
  },
];
export function initialData(template: string, notes: string): ProjectData {
  const at = new Date().toISOString();
  const topics: Record<string, string[]> = {
    engineering: ["Architecture", "Data flow"],
    launch: ["Audience", "Channels", "Timeline"],
    "3d-print": ["Model", "Material", "Print settings"],
  };
  const questions: ContextNode[] = (topics[template] ?? []).map((title) => ({
    id: crypto.randomUUID(),
    kind: "question",
    title,
    body: `What should we establish about ${title.toLowerCase()} for this project?`,
    origin: "inferred",
    stale: false,
    citations: [],
    history: [],
    updated_at: at,
  }));
  const data: ProjectData = {
    template,
    notes,
    nodes: notes.trim()
      ? [
          {
            id: crypto.randomUUID(),
            kind: "goal",
            title: "Project vision",
            body: notes.trim(),
            origin: "user",
            stale: false,
            citations: [],
            history: [],
            updated_at: at,
          },
        ]
      : [],
    sources: [],
    messages: [],
    activity: [{ id: crypto.randomUUID(), text: "Project created", at }],
  };
  data.nodes.push(...questions);
  return data;
}
export function activity(p: Project, text: string): Project {
  return {
    ...p,
    data: {
      ...p.data,
      activity: [
        ...p.data.activity,
        { id: crypto.randomUUID(), text, at: new Date().toISOString() },
      ].slice(-200),
    },
  };
}
export function replaceNode(
  nodes: ContextNode[],
  incoming: ContextNode,
): ContextNode[] {
  const old = nodes.find((n) => n.id === incoming.id);
  const replacement = {
    ...incoming,
    history: old
      ? [
          ...old.history,
          {
            title: old.title,
            body: old.body,
            citations: old.citations,
            origin: old.origin,
            updated_at: old.updated_at,
          },
        ].slice(-20)
      : incoming.history,
    updated_at: new Date().toISOString(),
  };
  return old
    ? nodes.map((n) => (n.id === old.id ? replacement : n))
    : [...nodes, replacement];
}
