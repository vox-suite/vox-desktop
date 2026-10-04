export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpRequest = {
  method: HttpMethod;
  path: string;
  query?: Record<string, string>;
  body?: unknown;
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

export interface Platform {
  browser?: BrowserPort;
  http: HttpPort;
  live: LivePort;
}
