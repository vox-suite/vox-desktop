import {
  CalendarDays,
  Gamepad2,
  Lightbulb,
  MapPin,
  Music2,
  Plug,
  Youtube,
} from "lucide-react";
import googleCalendarLogo from "@/assets/brands/google-calendar.svg";
import playstationLogo from "@/assets/brands/playstation.svg";
import spotifyLogo from "@/assets/brands/spotify.svg";
import youtubeLogo from "@/assets/brands/youtube.svg";
import googleMapsLogo from "@/assets/brands/google-maps.svg";
import wizLogo from "@/assets/brands/wiz.svg";
import { swiggy } from "@/connectors/swiggy";
import { zomato } from "@/connectors/zomato";
import { platform } from "@/platform";
import type { BrandConfig, Connector } from "./types";

export const BRANDS: Record<string, BrandConfig> = {
  google_calendar: {
    icon: CalendarDays,
    logo: googleCalendarLogo,
    bare: true,
    color: "#3c90ff",
    tagline: "Calendar events on your timeline",
  },
  playstation: {
    icon: Gamepad2,
    logo: playstationLogo,
    color: "#0070d1",
    tagline: "Gaming sessions and playtime",
  },
  swiggy: swiggy.brand,
  zomato: zomato.brand,
  spotify: {
    icon: Music2,
    logo: spotifyLogo,
    bare: true,
    color: "#1db954",
    tagline: "Music and recently played tracks",
  },
  youtube: {
    icon: Youtube,
    logo: youtubeLogo,
    bare: true,
    color: "#ff0033",
    tagline: "Playlists, likes, and subscriptions",
  },
  maps_timeline: {
    icon: MapPin,
    logo: googleMapsLogo,
    bare: true,
    color: "#34a853",
    tagline: "Places you've visited",
  },
  wiz: {
    icon: Lightbulb,
    logo: wizLogo,
    bare: true,
    color: "#a970ff",
    tagline: "Local Wi-Fi lights and brightness",
  },
};

export const FALLBACK_BRAND: BrandConfig = {
  icon: Plug,
  color: "#a78bfa",
  tagline: "Connected account",
};

export const KNOWN_CONNECTORS: Connector[] = [
  {
    id: "playstation",
    name: "PlayStation Network",
    description:
      "Track gaming activity and playtime from your PlayStation account via community NPSSO token.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "npsso",
    available: true,
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description:
      "Read-only access to your primary calendar for timeline synchronization and assistant context.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "oauth2",
    available: true,
  },
  swiggy.descriptor,
  zomato.descriptor,
  {
    id: "maps_timeline",
    name: "Google Maps Timeline",
    description:
      "Places you visited, imported from a Google Maps Timeline export.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "import",
    available: true,
  },
  {
    id: "spotify",
    name: "Spotify",
    description:
      "Add your recently played music to your timeline and conversations with Vox.",
    supported_features: [],
    auth_type: "oauth2",
    available: false,
  },
  {
    id: "youtube",
    name: "YouTube",
    description:
      "Explore your playlists, liked videos, and channel subscriptions with Vox.",
    supported_features: [],
    auth_type: "oauth2",
    available: false,
  },
];

export const wizConnector = (): Connector => ({
  id: "wiz",
  name: "WiZ",
  description:
    "Control your Philips WiZ lights locally on the same Wi-Fi network.",
  supported_features: [],
  auth_type: "local",
  available: !!platform().wiz,
});

export function getBrand(id: string): BrandConfig {
  return BRANDS[id] ?? FALLBACK_BRAND;
}
