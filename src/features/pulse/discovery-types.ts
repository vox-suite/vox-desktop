import type { components } from "@/features/api.gen";
import type { ChartBoard } from "./types";
type S = components["schemas"];
export type Bucket = S["Bucket"];
export type PulseDefinition = Omit<
  Required<S["PulseDefinition"]>,
  "version" | "offset_days"
> & { version: 2; offset_days?: number };
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
export type CanvasResponse = Omit<
  Required<S["CanvasResponse"]>,
  "charts" | "legacy_boards"
> & { charts: SavedPulseChart[]; legacy_boards: ChartBoard[] };
export type ComposeMessage = { role: "user" | "assistant"; content: string };
export type ComposeResponse = {
  reply: string;
  title: string | null;
  definition: PulseDefinition | null;
  measurement: Measurement | null;
  preview: PulseResult | null;
};
