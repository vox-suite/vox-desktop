import type { Platform } from "@/platform/ports";

let current: Platform | null = null;

export function installPlatform(platform: Platform) {
  current = platform;
}

export function platform(): Platform {
  if (!current) throw new Error("platform not installed");
  return current;
}

export type { BrowserPort, Platform, HttpPort, LivePort, LiveEvent, HttpRequest } from "@/platform/ports";
