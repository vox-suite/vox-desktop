import { platform } from "@/platform";
import type {
  DiagramIR,
  ProjectAgentEvent,
  ProjectAgentResult,
  ProjectAgentRun,
  ProjectFlow,
} from "./types";

// Diagram runs live in the desktop app, not in the page that started them.
// This store mirrors the latest run of each project so the project page can
// leave, come back, or reload and pick the run up where it is.
export type TraceRun = {
  requestId: string;
  state: ProjectAgentRun["state"] | "cancelled";
  question: string;
  status: string;
  log: string[];
  text: string;
  streamed: DiagramIR | null;
  result: ProjectAgentResult | null;
  error: string;
};

const runs = new Map<string, TraceRun>();
const listeners = new Set<() => void>();
let version = 0;
let stopListening: (() => void) | null = null;

function emit() {
  version++;
  listeners.forEach((l) => l());
}
function put(projectId: string, run: TraceRun) {
  runs.set(projectId, run);
  emit();
}
function onEvent({ project_id, request_id, event }: ProjectAgentEvent) {
  const run = runs.get(project_id);
  if (!run || run.requestId !== request_id) return;
  if (event.type === "text") {
    put(project_id, {
      ...run,
      text: (run.text + (event.message ?? "")).slice(-200000),
    });
  } else if (event.type === "done") {
    put(project_id, { ...run, state: "done", result: event.result ?? null });
  } else if (event.type === "error") {
    put(project_id, {
      ...run,
      state: event.state === "cancelled" ? "cancelled" : "failed",
      error: event.message ?? "",
    });
  } else if (event.message) {
    put(project_id, {
      ...run,
      status: event.message,
      log: [...run.log, event.message].slice(-40),
    });
  }
}
function listen() {
  if (!stopListening && platform().projects)
    stopListening = platform().projects!.onTraceEvent(onEvent);
}

export const traceRuns = {
  subscribe(listener: () => void) {
    listen();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  version: () => version,
  get: (projectId: string) => runs.get(projectId) ?? null,

  /** Picks up whatever the app is doing (or did) for this project. */
  async hydrate(projectId: string) {
    const port = platform().projects;
    if (!port) return;
    listen();
    const latest = (await port.traceRuns(projectId)).at(-1);
    const current = runs.get(projectId);
    if (!latest) return;
    if (current?.requestId === latest.request_id && current.state === "running")
      return;
    put(projectId, {
      requestId: latest.request_id,
      state: latest.state,
      question: latest.question,
      status: latest.log.at(-1) ?? "",
      log: latest.log,
      text: "",
      streamed: latest.streamed,
      result: latest.result,
      error: latest.error ?? "",
    });
  },

  async start(
    projectId: string,
    question: string,
    base: ProjectFlow | null,
    meta: { lineage: string | null },
  ) {
    const requestId = crypto.randomUUID();
    rememberMeta(requestId, meta);
    listen();
    put(projectId, {
      requestId,
      state: "running",
      question,
      status: "Preparing the investigation…",
      log: [],
      text: "",
      streamed: null,
      result: null,
      error: "",
    });
    try {
      await platform().projects!.startTrace(
        projectId,
        requestId,
        question,
        base,
        false,
      );
    } catch (e) {
      put(projectId, {
        ...runs.get(projectId)!,
        state: "failed",
        error: String(e),
      });
    }
    return requestId;
  },

  async resume(projectId: string) {
    const run = runs.get(projectId);
    if (!run || run.state !== "interrupted") return;
    put(projectId, {
      ...run,
      state: "running",
      status: "Resuming where the investigation stopped…",
      error: "",
    });
    try {
      await platform().projects!.startTrace(
        projectId,
        run.requestId,
        null,
        null,
        true,
      );
    } catch (e) {
      put(projectId, {
        ...runs.get(projectId)!,
        state: "interrupted",
        error: String(e),
      });
    }
  },

  cancel: async (projectId: string) => {
    const run = runs.get(projectId);
    if (run?.state === "running")
      await platform().projects!.cancelTrace(run.requestId);
  },

  /** The page has taken the outcome (or the user discarded the run). */
  async dismiss(projectId: string) {
    const run = runs.get(projectId);
    if (!run) return;
    runs.delete(projectId);
    emit();
    forgetMeta(run.requestId);
    await platform().projects?.dismissTrace(projectId, run.requestId);
  },
  meta: (requestId: string) => readMeta(requestId),
};

// What the page knew when it started the run, kept across reloads.
const metaKey = (id: string) => `vox.trace-meta.${id}`;
function rememberMeta(id: string, meta: { lineage: string | null }) {
  try {
    localStorage.setItem(metaKey(id), JSON.stringify(meta));
  } catch {
    // Falls back to treating an update as a new lineage.
  }
}
function readMeta(id: string): { lineage: string | null } {
  try {
    return (
      JSON.parse(localStorage.getItem(metaKey(id)) ?? "null") ?? {
        lineage: null,
      }
    );
  } catch {
    return { lineage: null };
  }
}
function forgetMeta(id: string) {
  try {
    localStorage.removeItem(metaKey(id));
  } catch {
    // Nothing to clean up.
  }
}
