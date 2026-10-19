export type Citation = {
  source_id: string;
  path: string;
  start_line: number;
  end_line: number;
  hash: string;
};
export type ContextVersion = {
  title: string;
  body: string;
  citations: Citation[];
  updated_at: string;
  origin: string;
};
export type ContextNode = ContextVersion & {
  id: string;
  kind: string;
  stale: boolean;
  history: ContextVersion[];
};
export type ProjectSource = {
  id: string;
  label: string;
  kind: string;
  files: number;
  symbols: number;
  fingerprint: string;
  indexed_at: string;
};
export type DiagramType =
  "architecture" | "workflow" | "sequence" | "dataflow" | "lifecycle";
export type DiagramIR = Record<string, unknown> & { diagram_type: DiagramType };
export type RenderedDiagram = {
  svg: string;
  css: string;
  width: number;
  height: number;
  receipt: Record<string, unknown>;
};
export type ProjectFlow = {
  diagram?: DiagramIR | null;
  title: string;
  nodes: {
    id: string;
    title: string;
    kind: string;
    detail: string;
    citations: Citation[];
  }[];
  edges: {
    from: string;
    to: string;
    label: string;
    evidence: string;
    citations: Citation[];
  }[];
  gaps: string[];
};
export type ProjectMessage = {
  id: string;
  role: string;
  body: string;
  at: string;
  proposals: ContextNode[];
  flow?: ProjectFlow | null;
  diagram_id?: string | null;
};
export type ProjectActivity = { id: string; text: string; at: string };
export type ProjectData = {
  template: string;
  notes: string;
  nodes: ContextNode[];
  sources: ProjectSource[];
  messages: ProjectMessage[];
  activity: ProjectActivity[];
};
export type Project = {
  id: string;
  name: string;
  data: ProjectData;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type LocalSource = {
  id: string;
  label: string;
  kind: string;
  root: string;
  hashes: Record<string, string>;
};
export type IndexResult = {
  source: ProjectSource;
  nodes: ContextNode[];
  warnings: string[];
};
export type CodeSymbol = {
  id: number;
  name: string;
  kind: string;
  signature: string | null;
  citation: Citation;
};
export type GraphPage = {
  symbols: CodeSymbol[];
  relations: { from: number; to: number; kind: string; confidence: string }[];
  files: string[];
  total: number;
  next_offset: number | null;
};
export type SourceChanges = Record<
  string,
  { files?: string[]; unavailable?: string }
>;
export type ProjectAgentStatus = {
  engine: string;
  release: string;
  installed: boolean;
  authenticated: boolean;
  auth_method: string;
};
export type ProjectAgentProgress = {
  type: string;
  message?: string;
  state?: string;
  result?: ProjectAgentResult;
};
export type ProjectAgentEvent = {
  project_id: string;
  request_id: string;
  event: ProjectAgentProgress;
};
export type ProjectAgentRun = {
  request_id: string;
  state: "running" | "done" | "failed" | "interrupted";
  question: string;
  started_at: string;
  error: string | null;
  log: string[];
  streamed: DiagramIR | null;
  result: ProjectAgentResult | null;
};
export type ProjectAgentResult = {
  flow: ProjectFlow;
  mode: "update" | "new";
  reply: string;
  engine: string;
  request_id: string;
};
export interface ProjectLocalPort {
  renderDiagram(diagram: DiagramIR, draft?: boolean): Promise<RenderedDiagram>;
  exportDiagram(
    flow: ProjectFlow,
    format: "html" | "svg" | "json",
  ): Promise<void>;
  agentStatus(): Promise<ProjectAgentStatus>;
  configureAgent(key: string): Promise<void>;
  /** Starts (or, with `resume`, continues) a run that outlives the page. */
  startTrace(
    projectId: string,
    requestId: string,
    question: string | null,
    base: ProjectFlow | null,
    resume: boolean,
  ): Promise<void>;
  /** Runs that still need attention: running, unopened, failed, interrupted. */
  traceRuns(projectId: string): Promise<ProjectAgentRun[]>;
  dismissTrace(projectId: string, requestId: string): Promise<void>;
  onTraceEvent(listener: (event: ProjectAgentEvent) => void): () => void;
  cancelTrace(requestId: string): Promise<void>;
  engineStatus(): Promise<{
    engine: string;
    version: string;
    installed: boolean;
  }>;
  installEngine(): Promise<void>;
  pickSources(
    projectId: string,
    kind: "folder" | "file",
    sourceId?: string,
  ): Promise<LocalSource[]>;
  sources(projectId: string): Promise<LocalSource[]>;
  index(projectId: string, sourceId: string): Promise<IndexResult>;
  graph(
    projectId: string,
    sourceId: string,
    path: string,
    search: string,
    offset: number,
  ): Promise<GraphPage>;
  read(projectId: string, citation: Citation): Promise<string>;
  changes(projectId: string): Promise<SourceChanges>;
  remove(projectId: string, sourceId: string): Promise<void>;
}
