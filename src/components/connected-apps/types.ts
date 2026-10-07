import type { LucideIcon } from "lucide-react";
import type { components } from "@/features/api.gen";

export type Connector = components["schemas"]["ConnectorDescriptor"];
export type Connection = components["schemas"]["ConnectionItem"];
export type Setup = components["schemas"]["StartConnectionResponse"];

export type BrandConfig = {
  icon: LucideIcon;
  color: string;
  tagline: string;
  logo?: string;
  bare?: boolean;
};

export type TakeoutConfig = {
  id: string;
  title: string;
  blurb: string;
  help: string;
  consent: string;
  button: string;
  endpoint: string;
  noun: string;
  noRecords: string;
  maxMb: number;
  parse: (file: File) => Promise<unknown[] | string>;
};

export type StatusFilter = "all" | "connected" | "available";
