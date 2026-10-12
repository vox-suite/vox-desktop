import { platform } from "@/platform";
import type { Project, ProjectData } from "./types";
export const projectsApi = {
  count: () =>
    platform().http.request<{ count: number; rev: string }>({
      method: "GET",
      path: "/v1/me/projects/count",
    }),
  list: (before?: string) =>
    platform().http.request<{ items: Project[]; next_cursor: string | null }>({
      method: "GET",
      path: "/v1/me/projects",
      query: before ? { before } : undefined,
    }),
  get: (id: string) =>
    platform().http.request<Project>({
      method: "GET",
      path: `/v1/me/projects/${id}`,
    }),
  create: (name: string, data: ProjectData) =>
    platform().http.request<Project>({
      method: "POST",
      path: "/v1/me/projects",
      body: { name, data },
    }),
  save: (p: Project) =>
    platform().http.request<Project>({
      method: "PUT",
      path: `/v1/me/projects/${p.id}`,
      body: { name: p.name, data: p.data, revision: p.revision },
    }),
  archive: (id: string) =>
    platform().http.request<void>({
      method: "DELETE",
      path: `/v1/me/projects/${id}`,
    }),
  attach: (projectId: string, plan: string) =>
    platform().http.request<void>({
      method: "POST",
      path: `/v1/me/projects/${projectId}/plans/${plan}/attach`,
    }),
};
export function localProjects() {
  const port = platform().projects;
  if (!port)
    throw new Error(
      "Local sources are available in the Vox desktop app. Project summaries remain available here.",
    );
  return port;
}
