import { platform } from "@/platform";
import type {
  ChartBoard,
  ChartBoardDetails,
  ChartDataResult,
  ChartSuggestion,
  Schema,
} from "./types";

export const pulseApi = {
  listSchemas: () =>
    platform().http.request<Schema[]>({ method: "GET", path: "/v1/me/schemas" }),
  suggestCharts: (schemaIds: string[]) =>
    platform().http.request<ChartSuggestion[]>({
      method: "POST",
      path: "/v1/me/charts/suggest",
      body: { schema_ids: schemaIds },
    }),
  createChartBoard: (name: string, charts: ChartSuggestion[]) =>
    platform().http.request<ChartBoardDetails>({
      method: "POST",
      path: "/v1/me/charts/boards",
      body: { name, charts },
    }),
  listChartBoards: () =>
    platform().http.request<ChartBoard[]>({
      method: "GET",
      path: "/v1/me/charts/boards",
    }),
  getChartBoard: (id: string) =>
    platform().http.request<ChartBoardDetails>({
      method: "GET",
      path: `/v1/me/charts/boards/${id}`,
    }),
  getChartBoardData: (id: string) =>
    platform().http.request<ChartDataResult[]>({
      method: "GET",
      path: `/v1/me/charts/boards/${id}/data`,
    }),
};
