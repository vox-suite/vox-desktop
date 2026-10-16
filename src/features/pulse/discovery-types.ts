import type { components } from "@/features/api.gen";
type S = components["schemas"];
export type Bucket = S["Bucket"];
export type PulseDefinition = Omit<
  Required<S["PulseDefinition"]>,
  "version" | "offset_days" | "top_n" | "compare_with"
> & {
  version: 2;
  offset_days?: number;
  top_n?: number | null;
  compare_with?: string[];
};
export type SourceProfile = Required<S["SourceProfile"]>;
export type Measurement = Omit<Required<S["Measurement"]>, "profile"> & {
  profile: SourceProfile;
};
export type PulseSeries = {
  measurement_id: string;
  title: string;
  source: string;
  unit: string;
  quality: string;
  total: number | null;
  record_count: number;
  points: { label: string; value?: number | null }[];
};
export type PulseResult = Required<Omit<S["PulseResult"], "series">> & {
  series?: PulseSeries[];
};
export type PulseSuggestion = Omit<
  Required<S["PulseSuggestion"]>,
  "definition" | "measurement" | "preview"
> & {
  definition: PulseDefinition;
  measurement: Measurement;
  preview: PulseResult;
};
export type SavedPulseChart = Omit<
  Required<S["SavedPulseChart"]>,
  "definition" | "result" | "is_pinned"
> & {
  definition: PulseDefinition;
  result: PulseResult | null;
  is_pinned?: boolean;
};
export type DiscoveryResponse = Omit<
  Required<S["DiscoveryResponse"]>,
  "suggestions"
> & { suggestions: PulseSuggestion[] };
export type CanvasResponse = Omit<Required<S["CanvasResponse"]>, "charts"> & {
  charts: SavedPulseChart[];
};
