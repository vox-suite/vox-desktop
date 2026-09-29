import { invoke } from "@tauri-apps/api/core";

export type SpaceState = "ideating" | "planned" | "committed" | "dropped";
export type NodeState = "running" | "done" | "stale" | "rejected";

export interface AgentSpecLimits {
  max_steps: number;
  max_children: number;
}

export interface AgentSpec {
  mission: string;
  look_for: string[];
  done_when: string;
  limits?: AgentSpecLimits;
}

export interface Space {
  id: string;
  user_id: string;
  title: string;
  intent: string;
  state: SpaceState;
  agent_spec: AgentSpec | Record<string, unknown>;
  committed_collection_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpaceNode {
  id: string;
  space_id: string;
  kind: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  state: NodeState;
  position: { x: number; y: number };
  derived_from: string[];
  provenance: Record<string, unknown>;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface SpaceEdge {
  id: string;
  space_id: string;
  from_node: string;
  to_node: string;
  created_at: string;
}

export interface SpaceGraph {
  space: Space;
  nodes: SpaceNode[];
  edges: SpaceEdge[];
}

export interface CommitSpaceResult {
  collection_id: string;
  committed_spans_count: number;
}

export const spacesApi = {
  listSpaces: () => invoke<Space[]>("list_spaces"),
  getSpace: (id: string) => invoke<SpaceGraph>("get_space", { id }),
  createSpace: (title: string, intent: string) =>
    invoke<Space>("create_space", { title, intent }),
  dropSpace: (id: string) => invoke<void>("drop_space", { id }),
  sendSpaceChat: (id: string, message: string) =>
    invoke<{ status: string }>("send_space_chat", { id, message }),
  commitSpace: (id: string) =>
    invoke<CommitSpaceResult>("commit_space", { id }),
};
