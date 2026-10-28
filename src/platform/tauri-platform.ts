import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LiveEvent, Platform } from "@/platform";

import type { WizStatus } from "./ports";

import { isAllowedExternalUrl } from "./external-url-policy";

export const tauriPlatform: Platform = {
  meetings: {
    recording: {
      start: (title) => invoke("meeting_recording_start", { title }),
      stop: () => invoke("meeting_recording_stop"),
      status: () => invoke("meeting_recording_status"),
      modelReady: () => invoke("meeting_model_ready"),
      chooseModel: () => invoke("meeting_model_choose"),
      transcribe: (id) => invoke("meeting_transcribe", { id }),
    },
    list: (offset, limit) => invoke("meeting_list", { offset, limit }),
    get: (id) => invoke("meeting_get", { id }),
    create: (title) => invoke("meeting_create", { title }),
    saveNotes: (id, expectedRevision, notes) =>
      invoke("meeting_save_notes", { id, expectedRevision, notes }),
    remove: (id, expectedRevision) =>
      invoke("meeting_delete", { id, expectedRevision }),
    recover: () => invoke("meeting_recover_interrupted"),
    importTranscript: (id, expectedRevision) =>
      invoke("meeting_import_transcript", { id, expectedRevision }),
    exportText: (id) => invoke("meeting_export_text", { id }),
  },
  projects: {
    renderDiagram: (diagram, draft) =>
      invoke("project_render_diagram", { diagram, draft: !!draft }),
    exportDiagram: (flow, format) =>
      invoke("project_export_diagram", { flow, format }),
    agentStatus: () => invoke("project_agent_status"),
    configureAgent: (key) => invoke("project_agent_configure", { key }),
    startTrace: (projectId, requestId, question, base, resume) =>
      invoke("project_agent_start", {
        projectId,
        requestId,
        question,
        base,
        resume,
      }),
    traceRuns: (projectId) => invoke("project_agent_runs", { projectId }),
    dismissTrace: (projectId, requestId) =>
      invoke("project_agent_dismiss", { projectId, requestId }),
    onTraceEvent: (listener) => {
      let stop: (() => void) | undefined;
      let stopped = false;
      void listen<import("@/features/projects/types").ProjectAgentEvent>(
        "project-agent-event",
        (e) => listener(e.payload),
      ).then((fn) => {
        if (stopped) fn();
        else stop = fn;
      });
      return () => {
        stopped = true;
        stop?.();
      };
    },
    cancelTrace: (requestId) => invoke("project_agent_cancel", { requestId }),
    engineStatus: () => invoke("project_engine_status"),
    installEngine: () => invoke("project_install_engine"),
    pickSources: (projectId, kind, sourceId) =>
      invoke("project_pick_sources", {
        projectId,
        kind,
        sourceId: sourceId ?? null,
      }),
    sources: (projectId) => invoke("project_local_sources", { projectId }),
    index: (projectId, sourceId) =>
      invoke("project_index_source", { projectId, sourceId }),
    graph: (projectId, sourceId, path, search, offset) =>
      invoke("project_graph", { projectId, sourceId, path, search, offset }),
    read: (projectId, citation) =>
      invoke("project_read_source", { projectId, citation }),
    changes: (projectId) => invoke("project_check_sources", { projectId }),
    remove: (projectId, sourceId) =>
      invoke("project_remove_source", { projectId, sourceId }),
  },
  cache: {
    read: (key) => invoke<string | null>("cache_read", { key }),
    write: (key, value) => invoke<void>("cache_write", { key, value }),
    clear: () => invoke<void>("cache_clear"),
  },
  wiz: {
    getStatus: () => invoke("get_wiz_status"),
    connect: (consent, link) =>
      invoke<WizStatus>("connect_wiz", {
        consent,
        link,
      }).then((status) => status.devices),
    refresh: () => invoke("refresh_wiz"),
    control: (deviceId, state) =>
      invoke("control_wiz", {
        deviceId,
        on: state.on ?? null,
        brightness: state.brightness ?? null,
      }),
    disconnect: () => invoke("disconnect_wiz"),
  },
  browser: {
    openExternal: async (url) => {
      if (!isAllowedExternalUrl(url)) {
        throw new Error("Unsupported external destination");
      }
      await openUrl(url);
    },
  },
  http: {
    request: <T>(req: Parameters<Platform["http"]["request"]>[0]) =>
      invoke<T>("core_http", {
        method: req.method,
        path: req.path,
        query: req.query ? Object.entries(req.query) : null,
        body: req.body ?? null,
        rawBodyBase64: req.rawBodyBase64 ?? null,
        timeoutMs: req.timeoutMs ?? null,
      }),
  },
  live: {
    subscribe: (handler) => {
      let active = true;
      let unlisten: (() => void) | undefined;
      void listen<string>("vox-live-update", (event) => {
        if (!active) return;
        try {
          const parsed = JSON.parse(event.payload) as LiveEvent;
          if (typeof parsed.type === "string") handler(parsed);
        } catch {
          return;
        }
      }).then((fn) => {
        if (active) unlisten = fn;
        else fn();
      });
      return () => {
        active = false;
        unlisten?.();
      };
    },
  },
};
