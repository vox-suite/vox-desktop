export type Schema = {
  id: string;
  user_id: string | null;
  owner_scope: string;
  namespace: string;
  name: string;
  version: number;
  description: string;
  json_schema: Record<string, unknown>;
  color_token: number;
  icon_token: number;
  state: "active" | "deprecated";
  created_at: string;
  updated_at: string;
};

export type ChartType = "line" | "bar" | "pie" | "area";

export type Aggregation = "sum" | "count" | "avg" | "min" | "max";

export type QuerySpec = {
  metric_field: string;
  aggregation: Aggregation;
  group_by: "day" | "week" | "month" | string;
};

export type ChartDataPoint = {
  label: string;
  value: number;
};

export type Chart = {
  id: string;
  board_id: string;
  title: string;
  chart_type: ChartType;
  schema_ids: string[];
  query_spec: QuerySpec | Record<string, unknown>;
  created_at: string;
};

export type ChartSuggestion = {
  title: string;
  description: string;
  chart_type: ChartType;
  schema_ids: string[];
  query_spec: QuerySpec;
};

export type ChartBoard = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  chart_count?: number;
  charts?: Chart[];
};

export type ChartBoardDetails = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  charts: Chart[];
};

export type ChartDataResult = {
  chart_id: string;
  data_points: ChartDataPoint[];
  error: string | null;
};
