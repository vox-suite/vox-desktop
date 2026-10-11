import type { ContextNode, Project, ProjectData } from "./types";
export function initialData(notes: string): ProjectData {
  const at = new Date().toISOString();
  const data: ProjectData = {
    template: "general",
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
