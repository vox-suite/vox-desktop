import type { SpaceNode } from "@/features/spaces/types";

type Execution = { role?: string } | undefined;

const ACCENTS: Record<string, string> = {
  goal: "#6ea8ff",
  research: "#2dd4bf",
  web_search: "#2dd4bf",
  data: "#f5b83d",
  user_data: "#f5b83d",
  budget: "#f5b83d",
  option: "#a78bfa",
  step: "#4ade80",
  plan: "#f472b6",
  decision: "#f472b6",
  risk: "#ff5a67",
  limit: "#ff5a67",
};

export function nodeRole(node: SpaceNode): string {
  const execution = node.data.execution as Execution;
  return execution?.role ?? node.kind;
}

export function nodeAccent(node: SpaceNode): string {
  return (
    ACCENTS[nodeRole(node)] ?? ACCENTS[node.kind.toLowerCase()] ?? "#9aa0aa"
  );
}
