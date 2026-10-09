import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Loader2,
  Plug,
  RefreshCw,
  ShieldCheck,
  Unplug,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { platform } from "@/platform";
import type { WizStatus } from "@/platform/ports";
import { WizConnectionPanel } from "@/components/wiz-connection-panel";
import { BrandMark } from "./brand-mark";
import { StatusPill } from "./status-pill";
import { StatusMessage } from "./status-message";
import { GmailHistorySection } from "./gmail-history-section";
import { TakeoutSection } from "./takeout-section";
import { PlaystationNpsso } from "./playstation-npsso";
import { MAPS_IMPORT, YOUTUBE_IMPORT } from "./takeout-configs";
import type { BrandConfig, Connection, Connector } from "./types";

const request = <T,>(path: string, body?: unknown) =>
  platform().http.request<T>({
    method: "POST",
    path: `/v1/me/${path}`,
    body,
    timeoutMs: 120000,
  });

type PersonalPlaylists = {
  data?: {
    playlists?: {
      id?: string;
      name?: string;
      snippet?: { title?: string };
    }[];
    subscriptions?: unknown[];
  };
};

export function AppDetailSheet({
  openApp,
  openBrand,
  openAccount,
  importedHistory,
  onClose,
  message,
  setMessage,
  busy,
  run,
  connect,
  pending,
  isSynced,
  spotifyRegistered,
  wizStatus,
  setWizStatus,
  npsso,
  setNpsso,
  consent,
  setConsent,
  historyConsent,
  setHistoryConsent,
  outsideGuard,
}: {
  openApp: Connector | null;
  openBrand: BrandConfig | null;
  openAccount?: Connection;
  importedHistory?: Connection;
  onClose: () => void;
  message: string;
  setMessage: (msg: string) => void;
  busy: boolean;
  run: (op: () => Promise<void>) => Promise<void>;
  connect: (id: string) => Promise<void>;
  pending: string | null;
  isSynced: boolean;
  spotifyRegistered: boolean;
  wizStatus: WizStatus;
  setWizStatus: React.Dispatch<React.SetStateAction<WizStatus>>;
  npsso: string;
  setNpsso: React.Dispatch<React.SetStateAction<string>>;
  consent: boolean;
  setConsent: React.Dispatch<React.SetStateAction<boolean>>;
  historyConsent: boolean;
  setHistoryConsent: React.Dispatch<React.SetStateAction<boolean>>;
  outsideGuard: (event: Event) => void;
}) {
  const [personalData, setPersonalData] = useState<PersonalPlaylists | null>(null);
  const [personalLoading, setPersonalLoading] = useState(false);
  const [personalError, setPersonalError] = useState("");

  const needsAttention =
    !!openAccount &&
    (!!openAccount.failure_code ||
      openAccount.authorization_state !== "authorized");

  useEffect(() => {
    let active = true;
    const id = openAccount?.id;
    const canRead =
      openAccount?.assistant_read &&
      openAccount.authorization_state === "authorized";
    const isPersonal = openApp?.id === "youtube";

    void Promise.resolve().then(async () => {
      if (!active) return;
      setPersonalData(null);
      setPersonalError("");
      setPersonalLoading(!!id && !!canRead && isPersonal);
      if (!id || !canRead || !isPersonal) return;
      try {
        const data = await request<PersonalPlaylists>(`connections/${id}/read`);
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
    openApp?.id,
  ]);

  return (
    <Sheet open={!!openApp} onOpenChange={(open) => !open && onClose()}>
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
                    <StatusPill synced={isSynced} attention={needsAttention} />
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

                {openApp.id === "youtube" && (
                  <TakeoutSection
                    cfg={YOUTUBE_IMPORT}
                    importedAccount={importedHistory}
                    historyConsent={historyConsent}
                    setHistoryConsent={setHistoryConsent}
                    busy={busy}
                    run={run}
                    setMessage={setMessage}
                  />
                )}
                {openApp.id === "gmail" && openAccount && <GmailHistorySection />}
                {openApp.id === "maps_timeline" && (
                  <TakeoutSection
                    cfg={MAPS_IMPORT}
                    importedAccount={openAccount}
                    historyConsent={historyConsent}
                    setHistoryConsent={setHistoryConsent}
                    busy={busy}
                    run={run}
                    setMessage={setMessage}
                  />
                )}

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
                    <h3 className="text-sm font-medium">Your YouTube playlists</h3>
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
                          {openAccount.account_display_id || "Connected account"}
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
                                await request<PersonalPlaylists>(
                                  `connections/${openAccount.id}/read`,
                                ),
                              );
                              setPersonalError("");
                            }
                            await request(`connections/${openAccount.id}/refresh`);
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
                  <PlaystationNpsso npsso={npsso} setNpsso={setNpsso} />
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
                          consent ? "text-emerald-300" : "text-muted-foreground",
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
  );
}
