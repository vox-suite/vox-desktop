import {
  mapsTimelineToVisits,
  takeoutHtmlToHistory,
} from "@/lib/takeout-history";
import type { TakeoutConfig } from "./types";

export const YOUTUBE_IMPORT: TakeoutConfig = {
  id: "youtube",
  title: "Personal watch history",
  blurb:
    "Import your Google Takeout watch-history file (HTML or JSON). Vox uses its recorded watch times. This is an imported snapshot; upload another export to add newer watches.",
  help: "Select YouTube and YouTube Music, include history, and either HTML or JSON works for the history format. Use an English-language export, extract it, and select watch-history below. The selected history is sent to Vox’s server for validation and import.",
  consent:
    "I allow Vox to store this watch history in my timeline and use it to answer my questions.",
  button: "Import watch history",
  endpoint: "connections/youtube/history/import",
  noun: "watch records",
  noRecords:
    "No valid watch records found. Choose the YouTube watch-history file from Google Takeout.",
  maxMb: 10,
  parse: async (file) => {
    let history: unknown;
    try {
      const text = await file.text();
      history = file.name.endsWith(".html")
        ? takeoutHtmlToHistory(text)
        : JSON.parse(text);
    } catch {
      return "This file is not valid JSON. Select the extracted watch-history file, not the ZIP archive.";
    }
    return Array.isArray(history)
      ? history
      : "Select a Google Takeout watch-history.json file containing an array of records.";
  },
};

export const MAPS_IMPORT: TakeoutConfig = {
  id: "maps_timeline",
  title: "Maps Timeline places",
  blurb:
    "Import your Google Maps Timeline export (JSON). Vox adds the places you visited, with arrival and departure times, to your timeline. This is an imported snapshot; upload another export to add newer visits.",
  help: "On your phone, open Google Maps > Settings > Timeline > Export Timeline data, or use Google Takeout and select Maps (your places) > Timeline. Select the exported Timeline.json (or a Semantic Location History month file) below. Only place visits are read; the file is processed on this device and just the visits are sent to Vox’s server.",
  consent:
    "I allow Vox to store these visited places in my timeline and use them to answer my questions.",
  button: "Import Timeline",
  endpoint: "connections/maps_timeline/history/import",
  noun: "place visits",
  noRecords:
    "No valid place visits found. Choose the Timeline.json file exported from Google Maps.",
  maxMb: 300,
  parse: async (file) => {
    try {
      const visits = mapsTimelineToVisits(JSON.parse(await file.text()));
      return visits.length
        ? visits
        : "No place visits found in this file. Choose the Timeline.json exported from Google Maps.";
    } catch {
      return "This file is not valid JSON. Select the extracted Timeline.json, not the ZIP archive.";
    }
  },
};

export const IMPORT_CHUNK = 500;
export const PENDING_KEY = "vox.pending-connection-setup";

export const failureMessage = (detail: string) => {
  const status = /failed: (\d{3})/.exec(detail)?.[1];
  if (status === "401" || status === "403") {
    return "Your session has expired. Sign in again and retry.";
  }
  if (status === "409") {
    return "A sync is already running for this account. Try again in a minute.";
  }
  if (status === "400") {
    return "Vox couldn't use this request. For watch history, choose an English Google Takeout watch-history file with recent watches.";
  }
  if (status === "413") {
    return "This file is too large for the server. Try a smaller export.";
  }
  if (status && status.startsWith("5")) {
    return "The Vox server isn't responding right now. Try again in a moment.";
  }
  return "Something went wrong. Check your connection and try again.";
};
