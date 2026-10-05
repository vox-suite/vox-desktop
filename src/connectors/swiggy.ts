import { Bike } from "lucide-react";
import swiggyLogo from "@/assets/brands/swiggy.svg";
import type { ConnectorBrand } from "./types";

export const swiggy = {
  id: "swiggy",
  brand: {
    icon: Bike,
    logo: swiggyLogo,
    bare: true,
    color: "#fc8019",
    tagline: "Food orders and delivery status",
  } satisfies ConnectorBrand,
  descriptor: {
    id: "swiggy",
    name: "Swiggy",
    description:
      "Read real food orders and delivery status through Swiggy account authorization.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "oauth2",
    available: false,
  },
  authUrl: "https://mcp.swiggy.com/auth/authorize",
};
