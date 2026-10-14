import { Bike } from "lucide-react";
import swiggyLogo from "@/assets/brands/swiggy.svg";
import type { ConnectorBrand } from "./types";
import { brandToken } from "@/lib/theme";

export const swiggy = {
  id: "swiggy",
  brand: {
    icon: Bike,
    logo: swiggyLogo,
    bare: true,
    color: brandToken("swiggy"),
    tagline: "Food orders and delivery status",
  } satisfies ConnectorBrand,
  descriptor: {
    id: "swiggy",
    name: "Swiggy",
    description:
      "Read real food orders and delivery status through Swiggy account authorization.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "oauth2",
    available: true,
  },
  authUrl: "https://mcp.swiggy.com/auth/authorize",
};
