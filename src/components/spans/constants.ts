import type { ComponentType } from "react";
import {
  Activity,
  Ban,
  Bell,
  CalendarClock,
  Car,
  CheckCircle2,
  CircleDashed,
  Gamepad2,
  Hourglass,
  MapPin,
  Music,
  Phone,
  Plane,
  Users,
  Video,
  Utensils,
  Banknote,
  XCircle,
  type LucideProps,
} from "lucide-react";
import type { SpanStatus } from "@/features/spans/types";

export type Icon = ComponentType<LucideProps>;

export const STATUSES: {
  value: SpanStatus;
  label: string;
  icon: Icon;
  tone: string;
}[] = [
  {
    value: "planned",
    label: "Planned",
    icon: CalendarClock,
    tone: "text-sky-300",
  },
  {
    value: "active",
    label: "In progress",
    icon: Activity,
    tone: "text-amber-300",
  },
  {
    value: "waiting_user",
    label: "Waiting for you",
    icon: Hourglass,
    tone: "text-violet-300",
  },
  {
    value: "done",
    label: "Done",
    icon: CheckCircle2,
    tone: "text-emerald-300",
  },
  { value: "failed", label: "Failed", icon: XCircle, tone: "text-red-400" },
  { value: "cancelled", label: "Cancelled", icon: Ban, tone: "text-zinc-400" },
];

export const CATEGORIES: { value: string; label: string; icon: Icon }[] = [
  { value: "todo", label: "To-do", icon: CircleDashed },
  { value: "meeting", label: "Meeting", icon: Users },
  { value: "call", label: "Call", icon: Phone },
  { value: "meal", label: "Meal", icon: Utensils },
  { value: "expense", label: "Expense", icon: Banknote },
  { value: "ride", label: "Ride", icon: Car },
  { value: "travel", label: "Travel", icon: Plane },
  { value: "visit", label: "Visit", icon: MapPin },
  { value: "reminder", label: "Reminder", icon: Bell },
  { value: "music", label: "Music", icon: Music },
  { value: "gaming", label: "Gaming", icon: Gamepad2 },
  { value: "video", label: "Video", icon: Video },
];

export const PROVIDER_OWNED = new Set([
  "google_calendar",
  "spotify",
  "youtube",
  "google_maps",
]);

export const SOURCE_LABELS: Record<string, string> = {
  spotify: "Spotify",
  google_calendar: "Google Calendar",
  playstation: "PlayStation",
  youtube: "YouTube",
  google_maps: "Google Maps",
  swiggy: "Swiggy",
  zomato: "Zomato",
};
