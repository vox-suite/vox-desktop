import type { SpaceNode } from "@/features/spaces/types";
import { token, type VoxColor } from "@/lib/theme";

type Execution = { role?: string } | undefined;

const ACCENTS: Record<string, VoxColor> = {
  goal: "sky",
  research: "teal",
  web_search: "teal",
  data: "gold",
  user_data: "gold",
  budget: "gold",
  option: "violet",
  step: "mint",
  plan: "pink",
  decision: "pink",
  risk: "danger",
  limit: "danger",
};

export function nodeRole(node: SpaceNode): string {
  const execution = node.data.execution as Execution;
  return execution?.role ?? node.kind;
}

export function nodeAccentToken(node: SpaceNode): VoxColor {
  return ACCENTS[nodeRole(node)] ?? ACCENTS[node.kind.toLowerCase()] ?? "slate";
}

export function nodeAccent(node: SpaceNode): string {
  return token(nodeAccentToken(node));
}
