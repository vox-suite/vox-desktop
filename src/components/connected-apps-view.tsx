import { useCallback, useEffect, useRef, useState } from "react";
import { platform } from "@/platform";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CircleAlert,
  CircleCheck,
  Info,
  Gamepad2,
  KeyRound,
  Loader2,
  Lightbulb,
  MapPin,
  Upload,
  Music2,
  Youtube,
  Plug,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Unplug,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import googleCalendarLogo from "@/assets/brands/google-calendar.svg";
import playstationLogo from "@/assets/brands/playstation.svg";
import { swiggy } from "@/connectors/swiggy";
import { zomato } from "@/connectors/zomato";
import spotifyLogo from "@/assets/brands/spotify.svg";
import youtubeLogo from "@/assets/brands/youtube.svg";
import googleMapsLogo from "@/assets/brands/google-maps.svg";
import wizLogo from "@/assets/brands/wiz.svg";
import { WizConnectionPanel } from "@/components/wiz-connection-panel";
import type { WizStatus } from "@/platform/ports";
import { Skeleton } from "@/components/ui/skeleton";
import { useOutsideGuard } from "@/hooks/use-outside-guard";
import { errorMessage } from "@/lib/errors";
import { mapsTimelineToVisits, takeoutHtmlToHistory } from "@/lib/takeout-history";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type Connector =
  import("@/features/api.gen").components["schemas"]["ConnectorDescriptor"];
type Connection =
  import("@/features/api.gen").components["schemas"]["ConnectionItem"];
type Setup =
  import("@/features/api.gen").components["schemas"]["StartConnectionResponse"];
const BRANDS: Record<
  string,
  {
    icon: LucideIcon;
    color: string;
    tagline: string;
    logo?: string;
    bare?: boolean;
  }
> = {
  google_calendar: {
    icon: CalendarDays,
    logo: googleCalendarLogo,
    bare: true,
    color: "#3c90ff",
    tagline: "Calendar events on your timeline",
  },
  playstation: {
    icon: Gamepad2,
    logo: playstationLogo,
    color: "#0070d1",
    tagline: "Gaming sessions and playtime",
  },
  swiggy: swiggy.brand,
  zomato: zomato.brand,
  spotify: {
    icon: Music2,
    logo: spotifyLogo,
    bare: true,
    color: "#1db954",
    tagline: "Music and recently played tracks",
  },
  youtube: {
    icon: Youtube,
    logo: youtubeLogo,
    bare: true,
    color: "#ff0033",
    tagline: "Playlists, likes, and subscriptions",
  },
  maps_timeline: {
    icon: MapPin,
    logo: googleMapsLogo,
    bare: true,
    color: "#34a853",
    tagline: "Places you've visited",
  },
  wiz: {
    icon: Lightbulb,
    logo: wizLogo,
    bare: true,
    color: "#a970ff",
    tagline: "Local Wi-Fi lights and brightness",
  },
};
const FALLBACK_BRAND = {
  icon: Plug,
  color: "#a78bfa",
  tagline: "Connected account",
};

const KNOWN_CONNECTORS: Connector[] = [
  {
    id: "playstation",
    name: "PlayStation Network",
    description:
      "Track gaming activity and playtime from your PlayStation account via community NPSSO token.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "npsso",
    available: true,
  },
  {
    id: "google_calendar",
    name: "Google Calendar",
    description:
      "Read-only access to your primary calendar for timeline synchronization and assistant context.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "oauth2",
    available: true,
  },
  swiggy.descriptor,
  zomato.descriptor,
  {
    id: "maps_timeline",
    name: "Google Maps Timeline",
    description:
      "Places you visited, imported from a Google Maps Timeline export.",
    supported_features: ["timeline_sync", "assistant_read"],
    auth_type: "import",
    available: true,
  },
  {
    id: "spotify",
    name: "Spotify",
    description:
      "Add your recently played music to your timeline and conversations with Vox.",
    supported_features: [],
    auth_type: "oauth2",
    available: false,
  },
  {
    id: "youtube",
    name: "YouTube",
    description:
      "Explore your playlists, liked videos, and channel subscriptions with Vox.",
    supported_features: [],
    auth_type: "oauth2",
    available: false,
  },
];

const wizConnector = (): Connector => ({
  id: "wiz",
  name: "WiZ",
  description:
    "Control your Philips WiZ lights locally on the same Wi-Fi network.",
  supported_features: [],
  auth_type: "local",
  available: !!platform().wiz,
});

const PAGE_SIZE = 12;

function StatusMessage({
  message,
  className,
}: {
  message: string;
  className: string;
}) {
  const icon =
    /^(Account connected|Timeline refreshed|Imported \d|History disconnected|Disconnected\.)/.test(
      message,
    ) ? (
      <CircleCheck className="size-4 shrink-0 text-emerald-400" />
    ) : /^(Importing|Reading)/.test(message) ? (
      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
    ) : /^Waiting for connection/.test(message) ? (
      <Info className="size-4 shrink-0 text-muted-foreground" />
    ) : (
      <CircleAlert className="size-4 shrink-0 text-[#ff8a8a]" />
    );
  return (
    <div role="status" className={className}>
      {icon}
      {message}
    </div>
  );
}
type TakeoutConfig = {
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

const YOUTUBE_IMPORT: TakeoutConfig = {
  id: "youtube",
  title: "Personal watch history",
  blurb:
    "Import your Google Takeout watch-history file (HTML or JSON). Vox uses its recorded watch times. This is an imported snapshot; upload another export to add newer watches.",
  help: "Select YouTube and YouTube Music, include history, and either HTML or JSON works for the history format. Use an English-language export, extract it, and select watch-history below. The selected history is sent to Vox’s server for validation and import.",
  consent:
    "I allow Vox to store this watch history in my timeline and use it to answer my questions.",
  button: "Import watch history",
  endpoint: "connections/youtube/history/import",
  noun: "watch records",
  noRecords:
    "No valid watch records found. Choose the YouTube watch-history file from Google Takeout.",
  maxMb: 10,
  parse: async (file) => {
    let history: unknown;
    try {
      const text = await file.text();
      history = file.name.endsWith(".html")
        ? takeoutHtmlToHistory(text)
        : JSON.parse(text);
    } catch {
      return "This file is not valid JSON. Select the extracted watch-history file, not the ZIP archive.";
    }
    return Array.isArray(history)
      ? history
      : "Select a Google Takeout watch-history.json file containing an array of records.";
  },
};

const MAPS_IMPORT: TakeoutConfig = {
  id: "maps_timeline",
  title: "Maps Timeline places",
  blurb:
    "Import your Google Maps Timeline export (JSON). Vox adds the places you visited, with arrival and departure times, to your timeline. This is an imported snapshot; upload another export to add newer visits.",
  help: "On your phone, open Google Maps > Settings > Timeline > Export Timeline data, or use Google Takeout and select Maps (your places) > Timeline. Select the exported Timeline.json (or a Semantic Location History month file) below. Only place visits are read; the file is processed on this device and just the visits are sent to Vox’s server.",
  consent:
    "I allow Vox to store these visited places in my timeline and use them to answer my questions.",
  button: "Import Timeline",
  endpoint: "connections/maps_timeline/history/import",
  noun: "place visits",
  noRecords:
    "No valid place visits found. Choose the Timeline.json file exported from Google Maps.",
  maxMb: 300,
  parse: async (file) => {
    try {
      const visits = mapsTimelineToVisits(JSON.parse(await file.text()));
      return visits.length
        ? visits
        : "No place visits found in this file. Choose the Timeline.json exported from Google Maps.";
    } catch {
      return "This file is not valid JSON. Select the extracted Timeline.json, not the ZIP archive.";
    }
  },
};

const IMPORT_CHUNK = 500;
type Status = "all" | "connected" | "available";
const PENDING_KEY = "vox.pending-connection-setup";
const failureMessage = (detail: string) => {
  const status = /failed: (\d{3})/.exec(detail)?.[1];
  if (status === "401" || status === "403")
    return "Your session has expired. Sign in again and retry.";
  if (status === "409")
    return "A sync is already running for this account. Try again in a minute.";
  if (status === "400")
    return "Vox couldn't use this request. For watch history, choose an English Google Takeout watch-history file with recent watches.";
  if (status === "413")
    return "This file is too large for the server. Try a smaller export.";
  if (status && status.startsWith("5"))
    return "The Vox server isn't responding right now. Try again in a moment.";
  return "Something went wrong. Check your connection and try again.";
};

const request = <T,>(path: string, body?: unknown) =>
  platform().http.request<T>({
    method: "POST",
    path: `/v1/me/${path}`,
    body,
    timeoutMs: 120000,
  });

export function ConnectedAppsView() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [spotifyRegistered, setSpotifyRegistered] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pending, setPending] = useState<string | null>(() =>
    localStorage.getItem(PENDING_KEY),
  );
  const [consent, setConsent] = useState(false);
  const [historyConsent, setHistoryConsent] = useState(false);
  const [personalData, setPersonalData] = useState<{
    data?: {
      playlists?: {
        id?: string;
        name?: string;
        snippet?: { title?: string };
      }[];
      subscriptions?: unknown[];
    };
  } | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState("");
  const [wizStatus, setWizStatus] = useState<WizStatus>({
    enabled: false,
    devices: [],
  });
  const [npsso, setNpsso] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status>("all");
  const outsideGuard = useOutsideGuard();
  const searchInput = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const historyInput = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLElement>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState("");
  const inProgress = useRef(false);
  const reload = useCallback(async () => {
    try {
      void (
        platform()
          .wiz?.getStatus()
          .catch(() => ({ enabled: false, devices: [] })) ??
        Promise.resolve({ enabled: false, devices: [] })
      ).then(setWizStatus);
      const [apps, accounts] = await Promise.all([
        request<Connector[]>("connectors/list").catch(() => []),
        request<Connection[]>("connections/list").catch(() => []),
      ]);
      setSpotifyRegistered((apps || []).some((app) => app.id === "spotify"));
      const merged = (apps || []).filter(
        (app) => !["youtube_history", "philips_hue", "wiz"].includes(app.id),
      );
      for (const known of KNOWN_CONNECTORS) {
        const idx = merged.findIndex((a) => a.id === known.id);
        if (idx === -1) {
          merged.push(known);
        } else {
          merged[idx] = { ...known, ...merged[idx] };
        }
      }
      merged.push(wizConnector());
      setConnectors(merged);
      setConnections(
        (accounts || []).filter(
          (account) => !["philips_hue", "wiz"].includes(account.connector_id),
        ),
      );
    } catch {
      setConnectors([...KNOWN_CONNECTORS, wizConnector()]);
    }
  }, []);
  const initialLoad = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      await reload();
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [reload]);
  useEffect(() => {
    void Promise.resolve().then(initialLoad);
  }, [initialLoad]);
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const poll = async () => {
      if (inProgress.current) return;
      inProgress.current = true;
      try {
        const status = await request<{ status: string; error?: string }>(
          `connections/setup/${pending}/status`,
        );
        if (!active) return;
        if (!["pending", "exchanging"].includes(status.status)) {
          localStorage.removeItem(PENDING_KEY);
          setPending(null);
          setMessage(
            status.status === "authorized"
              ? "Account connected."
              : "Setup ended. Start again to connect your account.",
          );
          await reload();
        }
      } catch (error) {
        if (active && error instanceof Error && /\b404\b/.test(error.message)) {
          localStorage.removeItem(PENDING_KEY);
          setPending(null);
          setMessage("This setup is no longer available. Start again.");
        } else if (active)
          setMessage(
            "Waiting for connection status. Return here after authorization.",
          );
      } finally {
        inProgress.current = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 3000);
    const resume = () => {
      if (document.visibilityState === "visible") void poll();
    };
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [pending, reload]);
  const run = async (operation: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await operation();
      await reload();
    } catch (err) {
      setMessage(failureMessage(errorMessage(err)));
    } finally {
      setBusy(false);
    }
  };
  const openHelp = async (url: string, name: string) => {
    setMessage("");
    try {
      const browser = platform().browser;
      if (!browser) throw new Error("Browser unavailable");
      await browser.openExternal(url);
    } catch {
      setMessage(`Could not open ${name}. Open ${url} in your browser.`);
    }
  };
  const connect = (id: string) =>
    run(async () => {
      if (
        connectors.find((app) => app.id === id)?.auth_type === "oauth2" &&
        !platform().browser
      )
        throw new Error("Browser unavailable");
      const setup = await request<Setup>("connections/start", {
        connector_id: id,
        consent,
        ...(id === "playstation" ? { npsso } : {}),
      });
      setNpsso("");
      if (setup.setup_id && setup.authorization_url) {
        localStorage.setItem(PENDING_KEY, setup.setup_id);
        setPending(setup.setup_id);
        await platform().browser!.openExternal(setup.authorization_url);
      } else setMessage("Account connected.");
    });
  const q = query.trim().toLowerCase();
  const importedHistory = connections.find(
    (account) => account.connector_id === "youtube_history",
  );
  const accountFor = (id: string) =>
    connections.find((c) => c.connector_id === id) ??
    (id === "youtube" ? importedHistory : undefined);
  const isConnected = (id: string) =>
    id === "wiz" ? wizStatus.enabled : !!accountFor(id);
  const isSynced = (id: string) =>
    id === "wiz" ? wizStatus.enabled : !!accountFor(id)?.last_synced_at;
  const matchesQuery = (c: Connector) =>
    !q ||
    c.name.toLowerCase().includes(q) ||
    c.description.toLowerCase().includes(q);
  const counts = {
    all: connectors.filter(matchesQuery).length,
    connected: connectors.filter((c) => matchesQuery(c) && isSynced(c.id))
      .length,
    available: connectors.filter((c) => matchesQuery(c) && !isSynced(c.id))
      .length,
  };
  const filtered = connectors
    .filter(matchesQuery)
    .filter(
      (c) =>
        statusFilter === "all" ||
        (statusFilter === "connected") === isSynced(c.id),
    )
    .sort(
      (a, b) =>
        Number(isSynced(b.id)) - Number(isSynced(a.id)) ||
        a.name.localeCompare(b.name),
    );
  const shown = filtered.slice(0, visible);
  const hasMore = shown.length < filtered.length;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting))
          setVisible((v) => v + PAGE_SIZE);
      },
      { root: scroller.current, rootMargin: "240px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, shown.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInput.current?.focus();
        searchInput.current?.select();
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        searchInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const openApp = connectors.find((c) => c.id === openId) ?? null;
  const openBrand = openApp ? (BRANDS[openApp.id] ?? FALLBACK_BRAND) : null;
  const openAccount = openApp
    ? connections.find((c) => c.connector_id === openApp.id)
    : undefined;
  const takeoutImport = (cfg: TakeoutConfig) => {
    const imported =
      cfg.id === "youtube"
        ? importedHistory
        : connections.find((c) => c.connector_id === cfg.id);
    return (
      <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h3 className="text-sm font-medium">{cfg.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {cfg.blurb}
        </p>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => void openHelp("https://takeout.google.com/", "Google Takeout")}
        >
          Open Google Takeout
        </Button>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {cfg.help}
        </p>
        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={historyConsent}
            disabled={busy}
            onCheckedChange={(value) => setHistoryConsent(value === true)}
          />
          <span>{cfg.consent}</span>
        </label>
        <input
          ref={historyInput}
          type="file"
          accept=".json,.html,application/json,text/html"
          aria-label={cfg.title}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || !historyConsent) return;
            if (file.size > cfg.maxMb * 1024 * 1024) {
              setMessage(`Choose a file smaller than ${cfg.maxMb} MB.`);
              return;
            }
            void run(async () => {
              const parsed = await cfg.parse(file);
              if (typeof parsed === "string") {
                setMessage(parsed);
                return;
              }
              let importedCount = 0;
              let skipped = 0;
              let rejected = 0;
              for (let i = 0; i < parsed.length; i += IMPORT_CHUNK) {
                const chunk = parsed.slice(i, i + IMPORT_CHUNK);
                setMessage(
                  `Importing ${Math.min(i + IMPORT_CHUNK, parsed.length).toLocaleString()} of ${parsed.length.toLocaleString()} records…`,
                );
                try {
                  const result = await request<{
                    imported: number;
                    skipped: number;
                  }>(cfg.endpoint, { consent: historyConsent, history: chunk });
                  importedCount += result.imported;
                  skipped += result.skipped;
                } catch (err) {
                  if (!/failed: 400/.test(errorMessage(err))) throw err;
                  skipped += chunk.length;
                  rejected += 1;
                }
              }
              if (rejected * IMPORT_CHUNK >= parsed.length) {
                setMessage(cfg.noRecords);
                return;
              }
              setMessage(
                `Imported ${importedCount.toLocaleString()} new ${cfg.noun}. ${skipped.toLocaleString()} records were skipped.`,
              );
            });
          }}
        />
        <Button
          className="w-full gap-2"
          variant="secondary"
          disabled={busy || !historyConsent}
          onClick={() => historyInput.current?.click()}
        >
          <Upload className="size-4" />
          {cfg.button}
        </Button>
        {imported && (
          <div className="space-y-2 border-t border-white/10 pt-3">
            <p className="text-xs text-muted-foreground">
              Synced
              {imported.last_synced_at
                ? ` on ${new Date(imported.last_synced_at).toLocaleString()}`
                : ""}
              .
            </p>
            <Button
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request(`connections/${imported.id}/disconnect`);
                  setMessage(
                    "History disconnected. Imported timeline records are retained.",
                  );
                })
              }
            >
              Disconnect imported history
            </Button>
          </div>
        )}
      </div>
    );
  };
  useEffect(() => {
    let active = true;
    const id = openAccount?.id;
    const canRead =
      openAccount?.assistant_read &&
      openAccount.authorization_state === "authorized";
    const isPersonal = openId === "youtube";
    void Promise.resolve().then(async () => {
      if (!active) return;
      setPersonalData(null);
      setPersonalError("");
      setPersonalLoading(!!id && !!canRead && isPersonal);
      if (!id || !canRead || !isPersonal) return;
      try {
        const data = await request<NonNullable<typeof personalData>>(
          `connections/${id}/read`,
        );
        if (active) setPersonalData(data);
      } catch {
        if (active)
          setPersonalError(
            "Could not read your account. Check authorization and try again.",
          );
      } finally {
        if (active) setPersonalLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [
    openAccount?.id,
    openAccount?.assistant_read,
    openAccount?.authorization_state,
    openId,
  ]);
  return (
    <section
      ref={scroller}
      className="h-full overflow-auto p-5 text-foreground"
    >
      <div className="flex flex-col gap-5">
        <header>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            Connected Apps
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect the apps you love for personal context and everyday help, on
            your terms.
          </p>
        </header>

        <div className="flex flex-wrap items-center gap-3">
          <div
            role="radiogroup"
            aria-label="Filter by status"
            className="flex items-center gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] p-1"
          >
            {(
              [
                ["all", "All"],
                ["connected", "Connected"],
                ["available", "Not synced"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={statusFilter === value}
                onClick={() => {
                  setStatusFilter(value);
                  setVisible(PAGE_SIZE);
                }}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-md px-3 text-sm transition",
                  statusFilter === value
                    ? "bg-white/[0.08] text-foreground/80"
                    : "text-muted-foreground/60 hover:text-foreground/80",
                )}
              >
                {label}
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    statusFilter === value
                      ? "text-foreground/50"
                      : "text-muted-foreground/40",
                  )}
                >
                  {counts[value]}
                </span>
              </button>
            ))}
          </div>

          <div
            className={cn(
              "group flex h-11 min-w-[240px] flex-1 items-center gap-2.5 rounded-lg border bg-white/[0.02] pl-4 pr-2 transition",
              "border-white/[0.06] focus-within:border-[#ff6363]/50 focus-within:bg-white/[0.05] focus-within:shadow-[0_0_0_4px_rgba(255,99,99,0.12)]",
            )}
          >
            <Search className="size-4 shrink-0 text-muted-foreground/50 transition group-focus-within:text-[#ff8a8a]" />
            <input
              ref={searchInput}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE_SIZE);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" && query) {
                  e.stopPropagation();
                  setQuery("");
                } else if (e.key === "Escape") {
                  e.currentTarget.blur();
                }
              }}
              placeholder="Search apps by name or what they do"
              aria-label="Search apps"
              autoComplete="off"
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/45"
            />
            {query ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  searchInput.current?.focus();
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-white/10 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="mr-1 hidden shrink-0 rounded-md border border-white/[0.06] bg-transparent px-1.5 py-0.5 font-sans text-[11px] text-muted-foreground/50 group-focus-within:hidden sm:block">
                ⌘K
              </kbd>
            )}
          </div>
        </div>

        {message && !openApp && (
          <StatusMessage
            message={message}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm"
          />
        )}

        {pending && (
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
            <Loader2 className="size-5 animate-spin text-amber-200" />
            <p className="min-w-0 flex-1 text-sm text-foreground/90">
              Finish authorization in your browser, then return here. Vox will
              recover your setup automatically.
            </p>
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await request(`connections/setup/${pending}/cancel`);
                  localStorage.removeItem(PENDING_KEY);
                  setPending(null);
                })
              }
            >
              Cancel setup
            </Button>
          </div>
        )}

        {loading ? (
          <div className="grid auto-rows-fr items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="flex h-full min-h-64 flex-col rounded-xl border border-white/10 bg-[#0e0f12] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-2/3 bg-white/10" />
                    <Skeleton className="h-3 w-1/2 bg-white/[0.06]" />
                  </div>
                  <Skeleton className="size-11 rounded-lg bg-white/10" />
                </div>
                <Skeleton className="mt-3 h-4 w-24 rounded-full bg-white/[0.06]" />
                <div className="mt-3 space-y-2">
                  <Skeleton className="h-3.5 w-full bg-white/[0.06]" />
                  <Skeleton className="h-3.5 w-4/5 bg-white/[0.06]" />
                </div>
                <Skeleton className="mt-4 h-10 w-full rounded-lg bg-white/10" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center">
            <CircleAlert className="size-6 text-[#ff8a8a]" />
            <p className="text-sm text-muted-foreground">
              Connected apps are unavailable right now.
            </p>
            <Button variant="outline" onClick={() => void initialLoad()}>
              Try again
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/[0.03] px-6 py-12 text-center text-sm text-muted-foreground">
            {q
              ? `No apps match "${query.trim()}".`
              : statusFilter === "connected"
                ? "No connected apps yet."
                : "No apps available."}
          </p>
        ) : (
          <>
            <div className="grid auto-rows-fr items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
              {shown.map((app) => {
                const brand = BRANDS[app.id] ?? FALLBACK_BRAND;
                const account = accountFor(app.id);
                const needsAttention =
                  !!account &&
                  (!!account.failure_code ||
                    account.authorization_state !== "authorized");
                return (
                  <article
                    key={app.id}
                    style={{ "--brand": brand.color } as React.CSSProperties}
                    className="relative flex h-full min-h-64 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0e0f12] p-5 transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--brand)_55%,black)]"
                  >
                    <div
                      aria-hidden
                      className="pointer-events-none absolute -right-[101px] -top-[101px] size-72 rounded-full opacity-20"
                      style={{
                        background: `radial-gradient(circle, ${brand.color} 0%, ${brand.color}55 35%, transparent 70%)`,
                      }}
                    />
                    <div className="relative flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="font-heading text-lg font-semibold tracking-tight">
                          {app.name}
                        </h2>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
                          {brand.tagline}
                        </p>
                      </div>
                      <BrandMark brand={brand} />
                    </div>
                    <div className="relative mt-3">
                      <StatusPill
                        synced={isSynced(app.id)}
                        attention={needsAttention}
                      />
                    </div>
                    <p className="relative mb-4 mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                      {app.description}
                    </p>
                    <Button
                      className="relative mt-auto h-10 w-full shrink-0 gap-2 rounded-lg"
                      variant="secondary"
                      onClick={() => {
                        setMessage("");
                        setOpenId(app.id);
                      }}
                    >
                      {app.id === "youtube" ? (
                        <RefreshCw className="size-4" />
                      ) : isConnected(app.id) ? (
                        <Settings2 className="size-4" />
                      ) : (
                        <Plug className="size-4" />
                      )}
                      {app.id === "maps_timeline"
                        ? "Import"
                        : app.id === "youtube"
                        ? "Sync"
                        : isConnected(app.id)
                          ? "Configure"
                          : ["spotify", "youtube"].includes(app.id) &&
                              !app.available
                            ? "Set up"
                            : "Connect"}
                    </Button>
                  </article>
                );
              })}
            </div>
            {hasMore && (
              <div
                ref={sentinel}
                className="flex items-center justify-center gap-2 py-4 text-xs text-muted-foreground"
              >
                <Loader2 className="size-4 animate-spin" />
                Loading more
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={!!openApp} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent
          side="right"
          overlay={false}
          onInteractOutside={outsideGuard}
          className="vox-scroll w-full overflow-y-auto border-white/10 bg-[#0c0d10] sm:max-w-lg"
        >
          {openApp && openBrand && (
            <div className="relative isolate flex min-h-full shrink-0 flex-col gap-7 px-8 pb-12 pt-9">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 overflow-hidden"
                style={{
                  maskImage:
                    "linear-gradient(to bottom, #000 0%, #000 40%, transparent 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 0%, #000 40%, transparent 100%)",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background: `radial-gradient(ellipse 100% 85% at 100% 0%, ${openBrand.color}88 0%, ${openBrand.color}3d 40%, ${openBrand.color}14 62%, transparent 85%)`,
                  }}
                />
              </div>
              <div
                aria-hidden
                className="sign-in-noise pointer-events-none absolute inset-0 -z-20"
                style={{
                  opacity: 0.05,
                  filter: "brightness(0.4) contrast(1.3)",
                  backgroundSize: "130px 130px",
                  maskImage:
                    "linear-gradient(to bottom, #000 0%, #000 45%, rgba(0,0,0,0.35) 100%)",
                  WebkitMaskImage:
                    "linear-gradient(to bottom, #000 0%, #000 45%, rgba(0,0,0,0.35) 100%)",
                }}
              />
              <SheetHeader className="space-y-0 p-0">
                <div className="flex items-center gap-3">
                  <BrandMark brand={openBrand} />
                  <div className="min-w-0">
                    <SheetTitle className="font-heading text-lg">
                      {openApp.name}
                    </SheetTitle>
                    <div className="mt-1">
                      <StatusPill
                        synced={isSynced(openApp.id)}
                        attention={
                          !!openAccount &&
                          (!!openAccount.failure_code ||
                            openAccount.authorization_state !== "authorized")
                        }
                      />
                    </div>
                  </div>
                </div>
                <SheetDescription className="mt-3 text-sm leading-relaxed">
                  {openApp.id === "youtube"
                    ? "Import your watch history from a Google Takeout export."
                    : openApp.description}
                </SheetDescription>
              </SheetHeader>

              {message && (
                <StatusMessage
                  message={message}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm"
                />
              )}

              {openApp.id === "wiz" ? (
                <WizConnectionPanel
                  status={wizStatus}
                  onStatusChange={setWizStatus}
                />
              ) : (
                <>
                  {!openApp.available && openApp.id !== "youtube" && (
                    <p className="rounded-lg bg-white/[0.04] px-3 py-2 text-sm text-muted-foreground">
                      {openApp.id === "spotify" && !spotifyRegistered
                        ? "This server needs an update to support Spotify linking."
                        : "Not configured on this server."}
                    </p>
                  )}

                  {openApp.id === "spotify" && !openApp.available && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {openApp.id === "spotify" && !spotifyRegistered
                        ? "The connected server does not yet expose the Spotify connector. Update the server connector service, then return here to connect your account."
                        : `${openApp.name} account linking needs to be configured on this server. Once configured, connect your account here.`}
                    </p>
                  )}

                  {openApp.id === "youtube" && takeoutImport(YOUTUBE_IMPORT)}
                  {openApp.id === "maps_timeline" &&
                    takeoutImport(MAPS_IMPORT)}

                  {personalLoading && (
                    <p
                      role="status"
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <Loader2 className="size-4 animate-spin" />
                      Reading your account…
                    </p>
                  )}
                  {personalError && (
                    <p role="status" className="text-sm text-amber-200">
                      {personalError}
                    </p>
                  )}
                  {personalData?.data?.playlists && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium">
                        Your YouTube playlists
                      </h3>
                      <ul className="space-y-2 text-sm">
                        {personalData.data.playlists
                          .slice(0, 10)
                          .map((item, index) => (
                            <li
                              key={item.id ?? index}
                              className="rounded-lg bg-white/[0.04] px-3 py-2"
                            >
                              {item.snippet?.title ?? item.name ?? "Untitled"}
                            </li>
                          ))}
                        {!personalData.data.playlists.length && (
                          <li className="text-muted-foreground">
                            No playlists returned.
                          </li>
                        )}
                      </ul>
                    </div>
                  )}

                  {openAccount && (
                    <div className="space-y-3">
                      <dl className="grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/10 text-sm">
                        <div className="bg-[#0c0d10] p-3.5">
                          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Account
                          </dt>
                          <dd className="mt-1 truncate">
                            {openAccount.account_display_id ||
                              "Connected account"}
                          </dd>
                        </div>
                        <div className="bg-[#0c0d10] p-3.5">
                          <dt className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                            Last synced
                          </dt>
                          <dd className="mt-1">
                            {openAccount.last_synced_at
                              ? new Date(
                                  openAccount.last_synced_at,
                                ).toLocaleString()
                              : "Not yet synced"}
                          </dd>
                        </div>
                      </dl>
                      {openAccount.failure_code && (
                        <p
                          role="status"
                          className="flex items-center gap-2 rounded-lg bg-amber-300/10 px-3 py-2 text-sm text-amber-100"
                        >
                          <AlertTriangle className="size-4 shrink-0" />
                          {openAccount.failure_code === "reconnect_required" ||
                          openAccount.failure_code === "consent_required"
                            ? "Reconnect this account to restore access."
                            : "The last sync failed. Try refreshing."}
                        </p>
                      )}
                      <div className="grid gap-2">
                        {(["sync_timeline", "assistant_read"] as const)
                          .filter((key) =>
                            openApp.supported_features.includes(
                              key === "sync_timeline" ? "timeline_sync" : key,
                            ),
                          )
                          .map((key) => (
                            <label
                              key={key}
                              className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm transition hover:border-white/20"
                            >
                              <Checkbox
                                checked={openAccount[key]}
                                disabled={busy}
                                onCheckedChange={(v) =>
                                  void run(async () => {
                                    await request(
                                      `connections/${openAccount.id}/preferences`,
                                      { [key]: v === true },
                                    );
                                  })
                                }
                              />
                              {key === "sync_timeline"
                                ? "Sync to timeline"
                                : "Allow assistant reads"}
                            </label>
                          ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          className="gap-2"
                          disabled={
                            busy ||
                            !openAccount.sync_timeline ||
                            openAccount.authorization_state !== "authorized"
                          }
                          onClick={() =>
                            void run(async () => {
                              if (["spotify", "youtube"].includes(openApp.id)) {
                                setPersonalData(
                                  await request<
                                    NonNullable<typeof personalData>
                                  >(`connections/${openAccount.id}/read`),
                                );
                                setPersonalError("");
                              }
                              await request(
                                `connections/${openAccount.id}/refresh`,
                              );
                              setMessage("Timeline refreshed.");
                            })
                          }
                        >
                          <RefreshCw
                            className={cn("size-4", busy && "animate-spin")}
                          />
                          Refresh now
                        </Button>
                        <Button
                          variant="outline"
                          className="gap-2"
                          disabled={busy}
                          onClick={() =>
                            void run(async () => {
                              await request(
                                `connections/${openAccount.id}/disconnect`,
                              );
                              setMessage(
                                "Disconnected. Imported spans are retained.",
                              );
                            })
                          }
                        >
                          <Unplug className="size-4" />
                          Disconnect
                        </Button>
                      </div>
                    </div>
                  )}

                  {openApp.id === "playstation" && (
                    <div className="relative space-y-4">
                      <label className="block text-sm">
                        <span className="mb-2.5 flex items-center gap-2 text-foreground/90">
                          <KeyRound className="size-4 text-muted-foreground" />
                          PlayStation NPSSO token
                        </span>
                        <Input
                          type="password"
                          autoComplete="off"
                          value={npsso}
                          onChange={(e) => setNpsso(e.target.value)}
                          placeholder="Paste your account token"
                          className="h-11 rounded-lg"
                        />
                      </label>
                      <details className="group rounded-lg border border-white/10 bg-white/[0.02] text-sm">
                        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-foreground/90">
                          How do I get this token?
                          <span className="text-muted-foreground transition group-open:rotate-45">
                            +
                          </span>
                        </summary>
                        <div className="space-y-3 border-t border-white/10 px-4 py-4 leading-relaxed text-muted-foreground">
                          <ol className="list-decimal space-y-2 pl-5">
                            <li>
                              Sign in to your PlayStation account at{" "}
                              <button
                                type="button"
                                className="text-[#4da3ff] underline underline-offset-2 hover:text-[#7bbcff]"
                                onClick={() =>
                                  void platform().browser?.openExternal(
                                    "https://www.playstation.com",
                                  )
                                }
                              >
                                playstation.com
                              </button>{" "}
                              in your browser.
                            </li>
                            <li>
                              In the same browser, open the page below. It shows
                              a short block of text.
                            </li>
                            <li>
                              Copy the 64-character value after{" "}
                              <code className="rounded bg-white/10 px-1 py-0.5 text-foreground/90">
                                npsso
                              </code>{" "}
                              and paste it above.
                            </li>
                          </ol>
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-9 w-full rounded-lg"
                            onClick={() =>
                              void platform().browser?.openExternal(
                                "https://ca.account.sony.com/api/v1/ssocookie",
                              )
                            }
                          >
                            Open the token page
                          </Button>
                          <p className="text-xs">
                            The token gives access to your PlayStation account,
                            so keep it private and only paste it here. It is not
                            an official Sony feature and stops working after a
                            while, so you may need to connect again later.
                          </p>
                        </div>
                      </details>
                    </div>
                  )}

                  {(openApp.id === "swiggy" || openApp.id === "zomato") && (
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {openApp.available
                        ? `Authorize your ${openApp.name} account in your browser. Vox reads real orders and renews access when the provider supports it. If authorization expires, reconnect here.`
                        : `${openApp.name} account linking requires provider approval before it can be enabled.`}
                    </p>
                  )}

                  {openApp.id !== "youtube" && (
                    <>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 text-sm transition",
                          consent
                            ? "border-emerald-400/30 bg-emerald-400/[0.06]"
                            : "border-white/10 bg-white/[0.03] hover:border-white/20",
                        )}
                      >
                        <ShieldCheck
                          className={cn(
                            "mt-0.5 size-5 shrink-0",
                            consent
                              ? "text-emerald-300"
                              : "text-muted-foreground",
                          )}
                        />
                        <span className="flex-1 leading-relaxed text-foreground/90">
                          I allow Vox to sync activity to my timeline and read
                          connected account data when helping me. I can turn
                          either use off independently.
                        </span>
                        <Checkbox
                          checked={consent}
                          onCheckedChange={(v) => setConsent(v === true)}
                          className="mt-0.5"
                        />
                      </label>

                      <Button
                        className="h-11 w-full gap-2 rounded-lg"
                        variant="secondary"
                        disabled={
                          busy ||
                          !!pending ||
                          !consent ||
                          !openApp.available ||
                          (openApp.id === "playstation" && !npsso.trim())
                        }
                        onClick={() => void connect(openApp.id)}
                      >
                        <Plug className="size-4" />
                        {openAccount ? "Reconnect" : `Connect ${openApp.name}`}
                      </Button>
                      {!consent && (
                        <p className="-mt-3 text-center text-xs text-muted-foreground">
                          Accept the consent above to connect.
                        </p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}

function StatusPill({
  synced,
  attention,
}: {
  synced: boolean;
  attention: boolean;
}) {
  if (!synced && !attention) {
    return (
      <span className="rounded-full bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Not synced
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
        attention
          ? "bg-amber-300/15 text-amber-200"
          : "bg-emerald-400/15 text-emerald-300",
      )}
    >
      {attention ? (
        <AlertTriangle className="size-3" />
      ) : (
        <Check className="size-3" />
      )}
      {attention ? "Needs attention" : "Synced"}
    </span>
  );
}

function BrandMark({
  brand,
  className,
}: {
  brand: { icon: LucideIcon; color: string; logo?: string; bare?: boolean };
  className?: string;
}) {
  if (brand.logo && brand.bare) {
    return (
      <img
        src={brand.logo}
        alt=""
        className={cn("size-12 shrink-0 object-contain rounded-lg", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-lg",
        className,
      )}
      style={{
        background: `${brand.color}22`,
        boxShadow: `inset 0 0 0 1px ${brand.color}44`,
      }}
    >
      {brand.logo ? (
        <img src={brand.logo} alt="" className="size-7 object-contain" />
      ) : (
        <brand.icon className="size-6" style={{ color: brand.color }} />
      )}
    </div>
  );
}
