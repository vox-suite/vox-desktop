import type { components } from "../api.gen";

type S = components["schemas"];

export type ChartType = S["ChartType"];
export type Aggregation = S["Aggregation"];
export type QuerySpec = S["QuerySpec"];
export type ChartDataPoint = S["ChartDataPoint"];
export type ChartDataResult = S["ChartDataResult"];
export type ChartSuggestion = Omit<S["ChartSuggestion"], "chart_type"> & {
  chart_type: ChartType;
};
export type ChartBoard = Required<S["ChartBoardSummary"]>;

export type Schema = Omit<Required<S["DataSchema"]>, "json_schema"> & {
  json_schema: Record<string, unknown>;
};

export type Chart = Omit<Required<S["Chart"]>, "query_spec"> & {
  query_spec: QuerySpec | Record<string, unknown>;
};

export type ChartBoardDetails = Omit<Required<S["ChartBoardDetails"]>, "charts"> & {
  charts: Chart[];
};
