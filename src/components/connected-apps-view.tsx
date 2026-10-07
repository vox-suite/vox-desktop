import { useCallback, useEffect, useRef, useState } from "react";
import { CircleAlert, Loader2, Search, X } from "lucide-react";
import {
  PageContainer,
  PageHeader,
  PageBody,
} from "@/components/ui/page-container";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { platform } from "@/platform";
import type { WizStatus } from "@/platform/ports";
import { useOutsideGuard } from "@/hooks/use-outside-guard";
import { errorMessage } from "@/lib/errors";
import {
  AppCard,
  AppDetailSheet,
  StatusMessage,
  getBrand,
  KNOWN_CONNECTORS,
  wizConnector,
  type Connection,
  type Connector,
  type Setup,
  type StatusFilter,
} from "./connected-apps";

const PAGE_SIZE = 12;
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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const outsideGuard = useOutsideGuard();
  const searchInput = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const scroller = useRef<HTMLDivElement>(null);
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
        } else if (active) {
          setMessage(
            "Waiting for connection status. Return here after authorization.",
          );
        }
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

  const connect = (id: string) =>
    run(async () => {
      if (
        connectors.find((app) => app.id === id)?.auth_type === "oauth2" &&
        !platform().browser
      ) {
        throw new Error("Browser unavailable");
      }
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
      } else {
        setMessage("Account connected.");
      }
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
    connected: connectors.filter((c) => matchesQuery(c) && isSynced(c.id)).length,
    available: connectors.filter((c) => matchesQuery(c) && !isSynced(c.id)).length,
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
  const openBrand = openApp ? getBrand(openApp.id) : null;
  const openAccount = openApp
    ? connections.find((c) => c.connector_id === openApp.id)
    : undefined;

  return (
    <PageContainer>
      <PageHeader className="block">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Connected Apps
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect the apps you love for personal context and everyday help, on
          your terms.
        </p>
      </PageHeader>
      <PageBody ref={scroller} className="p-5">
        <div className="flex flex-col gap-5">
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
                {shown.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    brand={getBrand(app.id)}
                    account={accountFor(app.id)}
                    isSynced={isSynced(app.id)}
                    isConnected={isConnected(app.id)}
                    onOpen={() => {
                      setMessage("");
                      setOpenId(app.id);
                    }}
                  />
                ))}
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
      </PageBody>

      <AppDetailSheet
        openApp={openApp}
        openBrand={openBrand}
        openAccount={openAccount}
        importedHistory={importedHistory}
        onClose={() => setOpenId(null)}
        message={message}
        setMessage={setMessage}
        busy={busy}
        run={run}
        connect={connect}
        pending={pending}
        isSynced={openApp ? isSynced(openApp.id) : false}
        spotifyRegistered={spotifyRegistered}
        wizStatus={wizStatus}
        setWizStatus={setWizStatus}
        npsso={npsso}
        setNpsso={setNpsso}
        consent={consent}
        setConsent={setConsent}
        historyConsent={historyConsent}
        setHistoryConsent={setHistoryConsent}
        outsideGuard={outsideGuard}
      />
    </PageContainer>
  );
}
