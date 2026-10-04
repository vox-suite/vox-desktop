import type { LucideIcon } from "lucide-react";
import { Activity, Plug, Bot, Compass, GanttChart } from "lucide-react";

export type ShellTab =
  "agent" | "timeline" | "pulse" | "spaces" | "connections";

export const SHELL_TABS: { id: ShellTab; label: string; icon: LucideIcon }[] = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "timeline", label: "Span", icon: GanttChart },
  { id: "pulse", label: "Pulse", icon: Activity },
  { id: "connections", label: "Connected Apps", icon: Plug },
  { id: "spaces", label: "Spaces", icon: Compass },
];
