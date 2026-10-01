import type { Platform } from "./ports";

let current: Platform | null = null;

export function installPlatform(platform: Platform) {
  current = platform;
}

export function platform(): Platform {
  if (!current) throw new Error("platform not installed");
  return current;
}

export type { Platform, HttpPort, LivePort, LiveEvent, HttpRequest } from "./ports";
