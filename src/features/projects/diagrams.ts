import type { ProjectFlow, ProjectMessage } from "./types";

export const diagramKinds = {
  architecture: "Architecture",
  workflow: "Workflow",
  sequence: "Sequence",
  dataflow: "Data flow",
  lifecycle: "Lifecycle",
};

export const diagramLineage = (message: ProjectMessage) =>
  message.diagram_id ?? message.id;

export function latestDiagrams(messages: ProjectMessage[]) {
  const latest = new Map<string, ProjectMessage>();
  for (const message of messages) {
    if (message.role !== "assistant" || !message.flow?.diagram) continue;
    const lineage = diagramLineage(message);
    latest.delete(lineage);
    latest.set(lineage, message);
  }
  return [...latest.values()].reverse();
}

export function removeDiagram(messages: ProjectMessage[], lineage: string) {
  const removed = new Set<number>();
  messages.forEach((message, index) => {
    if (
      message.role !== "assistant" ||
      !message.flow?.diagram ||
      diagramLineage(message) !== lineage
    )
      return;
    removed.add(index);
    if (messages[index - 1]?.role === "user") removed.add(index - 1);
  });
  return messages.filter((_, index) => !removed.has(index));
}

export function titleDiagram(flow: ProjectFlow, input: string): ProjectFlow {
  const title = input.trim();
  if (!title) throw new Error("Enter a title for this diagram.");
  if (title.length > 120)
    throw new Error("Keep the title to 120 characters or fewer.");
  return {
    ...flow,
    title,
    diagram: flow.diagram
      ? {
          ...flow.diagram,
          meta: {
            ...(flow.diagram.meta as Record<string, unknown> | undefined),
            title,
          },
        }
      : flow.diagram,
  };
}
