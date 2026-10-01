export type SpaceState = "ideating" | "planned" | "committed" | "dropped";
export type NodeState = "running" | "done" | "stale" | "rejected";
export type RunState = "idle" | "running" | "failed";

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

export interface SpaceMessage {
  id: string;
  space_id: string;
  role: "user" | "assistant" | "system";
  text: string;
  created_at: string;
}

export interface Space {
  id: string;
  user_id: string;
  title: string;
  intent: string;
  state: SpaceState;
  agent_spec: AgentSpec | Record<string, unknown>;
  committed_collection_id: string | null;
  run_state: RunState;
  run_error: string | null;
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
