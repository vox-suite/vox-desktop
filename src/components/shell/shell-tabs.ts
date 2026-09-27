import type { LucideIcon } from "lucide-react";
import { Bot, GanttChart } from "lucide-react";

export type ShellTab = "agent" | "timeline";

export const SHELL_TABS: { id: ShellTab; label: string; icon: LucideIcon }[] = [
  { id: "agent", label: "Agent", icon: Bot },
  { id: "timeline", label: "Span", icon: GanttChart },
];
