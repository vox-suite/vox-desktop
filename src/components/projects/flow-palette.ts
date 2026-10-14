import {
  Monitor,
  Server,
  Database,
  Cloud,
  Shield,
  ArrowLeftRight,
  ExternalLink,
} from "lucide-react";
import { token } from "@/lib/theme";

export const FLOW_PALETTE = {
  frontend: { label: "Frontend", color: token("cyan"), icon: Monitor },
  backend: { label: "Backend", color: token("mint"), icon: Server },
  database: { label: "Database", color: token("violet"), icon: Database },
  cloud: { label: "Cloud", color: token("gold"), icon: Cloud },
  security: { label: "Security", color: token("pink"), icon: Shield },
  messagebus: { label: "Message bus", color: token("orange"), icon: ArrowLeftRight },
  external: { label: "External", color: token("slate"), icon: ExternalLink },
};
export type FlowCategory = keyof typeof FLOW_PALETTE;
const LEGACY_CATEGORIES: Record<string, FlowCategory> = {
  client: "frontend",
  ui: "frontend",
  interface: "frontend",
  service: "backend",
  api: "backend",
  function: "backend",
  runtime: "backend",
  orchestrator: "backend",
  storage: "database",
  cache: "database",
  persistence: "database",
  store: "database",
  auth: "security",
  policy: "security",
  permission: "security",
  queue: "messagebus",
  broker: "messagebus",
  transport: "messagebus",
  channel: "messagebus",
  websocket: "messagebus",
  deployment: "cloud",
  artifact: "cloud",
  provider: "external",
  vendor: "external",
};
export function flowCategory(kind: string): FlowCategory {
  const value = kind.trim().toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FLOW_PALETTE, value))
    return value as FlowCategory;
  return LEGACY_CATEGORIES[value] ?? "external";
}
export function connectionColor(
  evidence: string,
  from: string,
  to: string,
  focused: boolean,
) {
  if (evidence !== "observed") return token("text-dim");
  if (flowCategory(from) === "security" || flowCategory(to) === "security")
    return FLOW_PALETTE.security.color;
  return focused ? FLOW_PALETTE.backend.color : token("text-dim");
}
