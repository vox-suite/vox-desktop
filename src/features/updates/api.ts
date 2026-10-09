import { platform } from "@/platform";
import type { components } from "@/features/api.gen";
export type UpdateItem = components["schemas"]["UpdateItem"];
export const updatesApi = {
  list: (kind?: string, before?: UpdateItem) => platform().http.request<UpdateItem[]>({ method: "POST", path: "/v1/updates/list", body: { status: "active", limit: 100, ...(before ? { before: before.published_at, before_id: before.id } : {}), ...(kind ? { kind } : {}) } }),
  action: (id: string, action: "read" | "dismiss" | "resolve") => platform().http.request<UpdateItem>({ method: "POST", path: `/v1/updates/${id}/${action}`, body: {} }),
  retry: (job: string) => platform().http.request({ method: "POST", path: `/v1/updates/jobs/${job}/retry`, body: { idempotency_key: crypto.randomUUID() } }),
  password: (job: string, password: string) => platform().http.request({ method: "POST", path: `/v1/updates/jobs/${job}/input`, body: { input_type: "password", data: { password } } }),
};
