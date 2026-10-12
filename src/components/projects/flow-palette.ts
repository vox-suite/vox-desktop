import {
  Monitor,
  Server,
  Database,
  Cloud,
  Shield,
  ArrowLeftRight,
  ExternalLink,
} from "lucide-react";
export const FLOW_PALETTE = {
  frontend: { label: "Client", color: "#22d3ee", icon: Monitor },
  backend: { label: "Service", color: "#2dd4bf", icon: Server },
  database: { label: "Data", color: "#a78bfa", icon: Database },
  cloud: { label: "Cloud", color: "#fbbf24", icon: Cloud },
  security: { label: "Security", color: "#fb7185", icon: Shield },
  messagebus: { label: "Transport", color: "#fb923c", icon: ArrowLeftRight },
  external: { label: "External", color: "#94a3b8", icon: ExternalLink },
};
export type FlowCategory = keyof typeof FLOW_PALETTE;
export function flowCategory(kind: string): FlowCategory {
  const value = kind.toLowerCase();
  if (/database|storage|cache|persist|state/.test(value)) return "database";
  if (/auth|security|policy|permission/.test(value)) return "security";
  if (/queue|message|transport|socket|stream|channel/.test(value))
    return "messagebus";
  if (/cloud|artifact|deploy/.test(value)) return "cloud";
  if (/client|frontend|interface|surface|\bui\b/.test(value)) return "frontend";
  if (/provider|external|vendor/.test(value)) return "external";
  return "backend";
}
