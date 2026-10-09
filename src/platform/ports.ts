export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequest = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
  rawBodyBase64?: string;
  timeoutMs?: number;
};

export interface HttpPort {
  request<T>(req: HttpRequest): Promise<T>;
}

export type LiveEvent = { type: string; [key: string]: unknown };

export interface LivePort {
  subscribe(handler: (event: LiveEvent) => void): () => void;
}

export interface BrowserPort {
  openExternal(url: string): Promise<void>;
}

export type WizDevice = {
  id: string;
  name: string;
  on: boolean;
  brightness?: number;
  reachable: boolean;
  room?: string;
};

export type WizStatus = { enabled: boolean; devices: WizDevice[] };

export interface WizPort {
  getStatus(): Promise<WizStatus>;
  connect(consent: boolean, link: string): Promise<WizDevice[]>;
  refresh(): Promise<WizDevice[]>;
  control(
    deviceId: string,
    state: { on?: boolean; brightness?: number },
  ): Promise<WizDevice>;
  disconnect(): Promise<void>;
}

export interface Platform {
  wiz?: WizPort;
  browser?: BrowserPort;
  http: HttpPort;
  live: LivePort;
}
