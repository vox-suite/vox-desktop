import type { LucideIcon } from "lucide-react";
import { Activity, Bot, Compass, GanttChart } from "lucide-react";

export type ShellTab = "agent" | "timeline" | "pulse" | "spaces";

export const SHELL_TABS: { id: ShellTab; label: string; icon: LucideIcon }[] = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "timeline", label: "Span", icon: GanttChart },
  { id: "pulse", label: "Pulse", icon: Activity },
  { id: "spaces", label: "Spaces", icon: Compass },
];
