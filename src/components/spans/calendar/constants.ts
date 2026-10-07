import { startOfDay } from "@/lib/span-layout";

export const HOUR_PX = 128;
export const QUARTER_PX = HOUR_PX / 4;
export const INSTANT_HEIGHT_PX = QUARTER_PX - 4;
export const PX_PER_MIN = HOUR_PX / 60;
export const INDENT_PX = 10;
export const GUTTER_PX = 54;

export function isSameDay(a: Date, b: Date) {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}
