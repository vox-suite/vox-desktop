// Synthetic, development-only fixtures; rendered with the bundled Archify runtime.
import fixture from "./diagram-fixture.json";
import { project } from "./fixtures";
import { titleDiagram } from "@/features/projects/diagrams";
import type {
  Project,
  ProjectAgentEvent,
  ProjectAgentProgress,
  ProjectAgentResult,
  ProjectFlow,
  ProjectLocalPort,
  ProjectMessage,
} from "@/features/projects/types";

export const demoFlow = fixture.flow as ProjectFlow;
const saved = (
  id: string,
  lineage: string,
  title: string,
  at: string,
): ProjectMessage[] => [
  {
    id: `question-${id}`,
    role: "user",
    body: "Explain how place search works",
    at,
    proposals: [],
  },
  {
    id,
    diagram_id: lineage,
    role: "assistant",
    body: "Synthetic diagram fixture",
    at,
    proposals: [],
    flow: titleDiagram(demoFlow, title),
  },
];
export const diagramDemo = {
  project: {
    ...structuredClone(project),
    data: {
      ...structuredClone(project.data),
      messages: [
        ...saved(
          "search-v1",
          "search",
          "Place search overview",
          "2026-10-12T18:00:00Z",
        ),
        ...saved(
          "saved-v1",
          "saved",
          "Saved places architecture",
          "2026-10-13T18:00:00Z",
        ),
        ...saved(
          "search-v2",
          "search",
          "Place search architecture",
          "2026-10-14T18:00:00Z",
        ),
      ],
    },
  } as Project,
  renders: 0,
  saves: 0,
  failSave: new URLSearchParams(location.search).has("save-error"),
};
const traceListeners = new Set<(event: ProjectAgentEvent) => void>();
export const diagramPort: ProjectLocalPort = {
  renderDiagram: async () => {
    diagramDemo.renders++;
    return structuredClone(fixture.rendered);
  },
  exportDiagram: async () => {},
  agentStatus: async () => ({
    engine: "fixture",
    release: "fixture",
    installed: true,
    authenticated: true,
    auth_method: "fixture",
  }),
  configureAgent: async () => {},
  startTrace: async (project, request, _question, base) => {
    const progress = (event: ProjectAgentProgress) =>
      traceListeners.forEach((l) =>
        l({ project_id: project, request_id: request, event }),
      );
    void (async () => {
      if (new URLSearchParams(location.search).has("generation-test")) {
        progress({ type: "status", message: "Reading the implementation…" });
        const json = JSON.stringify(demoFlow.diagram);
        const split = Math.floor(json.length / 2);
        progress({
          type: "text",
          message:
            "Here is the source-backed explanation.\n```json\n" +
            json.slice(0, split),
        });
        await new Promise<void>((resolve) => setTimeout(resolve, 250));
        progress({ type: "text", message: json.slice(split) + "\n```" });
        await new Promise<void>((resolve) => setTimeout(resolve, 3250));
      }
      const result: ProjectAgentResult = {
        flow: titleDiagram(demoFlow, "Place search request flow"),
        mode: base ? "update" : "new",
        reply: "Synthetic fixture",
        engine: "fixture",
        request_id: "fixture",
      };
      progress({ type: "done", result });
    })();
  },
  traceRuns: async () => [],
  dismissTrace: async () => {},
  onTraceEvent: (listener) => {
    traceListeners.add(listener);
    return () => traceListeners.delete(listener);
  },
  cancelTrace: async () => {},
  engineStatus: async () => ({
    engine: "fixture",
    version: "fixture",
    installed: true,
  }),
  installEngine: async () => {},
  pickSources: async () => [],
  sources: async () => [],
  index: async () => {
    throw new Error("Indexing is not part of this fixture");
  },
  graph: async () => ({
    symbols: [],
    relations: [],
    files: [],
    total: 0,
    next_offset: null,
  }),
  read: async () => "Synthetic source fixture",
  changes: async () => ({}),
  remove: async () => {},
};
