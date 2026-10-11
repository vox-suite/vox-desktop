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
export type ProjectFlow = {
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
export type ProjectExcerpt = { citation: Citation; text: string };
export interface ProjectLocalPort {
  retrieve(
    projectId: string,
    query: string,
    sourceId?: string,
    brief?: boolean,
  ): Promise<ProjectExcerpt[]>;
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
