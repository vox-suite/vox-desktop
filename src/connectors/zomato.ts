import { UtensilsCrossed } from "lucide-react";
import zomatoLogo from "@/assets/brands/zomato.svg";
import type { ConnectorBrand } from "./types";

export const zomato = {
  id: "zomato",
  brand: {
    icon: UtensilsCrossed,
    logo: zomatoLogo,
    bare: true,
    color: "#cb202d",
    tagline: "Connected food order history",
  } satisfies ConnectorBrand,
  descriptor: {
    id: "zomato",
    name: "Zomato",
    description:
      "Read food orders through an approved Zomato account integration.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "oauth2",
    available: false,
  },
  authUrl: "https://mcp-server.zomato.com/authorize",
};
