import type { components } from "../api.gen";

type S = components["schemas"];

export type SpaceState = S["SpaceState"];
export type NodeState = S["NodeState"];
export type RunState = S["RunState"];
export type SpaceEdge = Required<S["SpaceEdge"]>;
export type CommitSpaceResult = S["CommitSpaceResult"];

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

export type SpaceMessage = Omit<Required<S["SpaceMessage"]>, "role"> & {
  role: "user" | "assistant" | "system";
};

export type Space = Omit<Required<S["Space"]>, "agent_spec"> & {
  agent_spec: AgentSpec | Record<string, unknown>;
};

export type SpaceNode = Omit<Required<S["SpaceNode"]>, "data" | "position"> & {
  data: Record<string, unknown>;
  position: { x: number; y: number };
};

export interface SpaceGraph {
  space: Space;
  nodes: SpaceNode[];
  edges: SpaceEdge[];
}
