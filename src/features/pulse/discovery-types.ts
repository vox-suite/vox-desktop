import type { components } from "@/features/api.gen";
type S = components["schemas"];
export type Bucket = S["Bucket"];
export type PulseDefinition = Omit<
  Required<S["PulseDefinition"]>,
  "version" | "offset_days" | "top_n"
> & { version: 2; offset_days?: number; top_n?: number | null };
export type SourceProfile = Required<S["SourceProfile"]>;
export type Measurement = Omit<Required<S["Measurement"]>, "profile"> & {
  profile: SourceProfile;
};
export type PulseResult = Required<S["PulseResult"]>;
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
  "definition" | "result"
> & { definition: PulseDefinition; result: PulseResult | null };
export type DiscoveryResponse = Omit<
  Required<S["DiscoveryResponse"]>,
  "suggestions"
> & { suggestions: PulseSuggestion[] };
export type CanvasResponse = Omit<Required<S["CanvasResponse"]>, "charts"> & { charts: SavedPulseChart[] };
