import { swiggy } from "@/connectors/swiggy";
import { zomato } from "@/connectors/zomato";

const HELP_DESTINATIONS = new Set([
  "https://takeout.google.com/",
  "https://www.playstation.com/",
  "https://ca.account.sony.com/api/v1/ssocookie",
]);

const AUTH_DESTINATIONS = new Set([
  "https://accounts.google.com/o/oauth2/v2/auth",
  "https://accounts.spotify.com/authorize",
  swiggy.authUrl,
  zomato.authUrl,
]);

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const destination = new URL(url);
    if (
      destination.protocol !== "https:" ||
      destination.username !== "" ||
      destination.password !== "" ||
      destination.port !== "" ||
      destination.hash !== ""
    )
      return false;
    const endpoint = `${destination.origin}${destination.pathname}`;
    return (
      AUTH_DESTINATIONS.has(endpoint) ||
      (HELP_DESTINATIONS.has(endpoint) && destination.search === "")
    );
  } catch {
    return false;
  }
}
