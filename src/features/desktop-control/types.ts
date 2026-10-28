export type DesktopPage =
  | "agent"
  | "timeline"
  | "meetings"
  | "pulse"
  | "usage"
  | "spaces"
  | "projects"
  | "connections"
  | "updates";
export type TimelineFilter = {
  startAt: string;
  endAt: string;
  timezone: string;
  spendingOnly: boolean;
  merchant: string | null;
  category: string | null;
};
export type DesktopContext = {
  revision: number;
  page: DesktopPage;
  spaceId: string | null;
  projectId: string | null;
  pulseId: string | null;
  selectedItemId: string | null;
  timezone: string;
  timeline: TimelineFilter | null;
  terminalOpen: boolean;
  resourceDetails?: unknown;
};
export type AppCommand = {
  commandId: string;
  expiresAt: string;
  expectedRevision: number | null;
  action: string;
  arguments: Record<string, unknown>;
};
export type AppResult = {
  commandId: string;
  ok: boolean;
  context: DesktopContext;
  output?: unknown;
  error?: string;
};
