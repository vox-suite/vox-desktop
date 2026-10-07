import { createElement } from "react";
import { Banknote, RefreshCw } from "lucide-react";
import playstationLogo from "@/assets/brands/playstation.svg";
import spotifyLogo from "@/assets/brands/spotify.svg";
import youtubeLogo from "@/assets/brands/youtube.svg";
import googleMapsLogo from "@/assets/brands/google-maps.svg";
import { schemaIcon } from "@/lib/schema-tokens";
import type { Span } from "@/features/spans/types";
import { moneyKind } from "@/lib/span-format";
import { cn } from "@/lib/utils";

export function CategoryIndicator({
  span,
  color,
  dotSizeClass,
}: {
  span: Span;
  color: string;
  dotSizeClass: string;
}) {
  const logo =
    span.source === "spotify"
      ? spotifyLogo
      : span.source === "playstation"
        ? playstationLogo
        : span.source === "youtube"
          ? youtubeLogo
          : span.source === "google_maps"
            ? googleMapsLogo
            : null;
  if (logo) {
    return (
      <img src={logo} alt="" className="size-3.5 shrink-0 rounded-[4px]" />
    );
  }
  const money = moneyKind(span);
  if (money) {
    return createElement(money === "subscription" ? RefreshCw : Banknote, {
      className: "size-3.5 shrink-0",
      style: { color },
    });
  }
  if (span.schema_icon_token !== null && span.schema_icon_token !== undefined) {
    return createElement(schemaIcon(span.schema_icon_token), {
      className: "size-3 shrink-0",
      style: { color },
    });
  }
  return (
    <span
      className={cn(dotSizeClass, "shrink-0 rounded-full")}
      style={{
        background: color,
        boxShadow: `0 0 5px color-mix(in srgb, ${color} 53%, transparent)`,
      }}
    />
  );
}
