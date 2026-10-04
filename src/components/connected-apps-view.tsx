import { useCallback, useEffect, useRef, useState } from "react";
import { platform } from "@/platform";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Connector = import("@/features/api.gen").components["schemas"]["ConnectorDescriptor"];
type Connection = import("@/features/api.gen").components["schemas"]["ConnectionItem"];
type Setup = import("@/features/api.gen").components["schemas"]["StartConnectionResponse"];
const PENDING_KEY = "vox.pending-connection-setup";
const request = <T,>(path: string, body?: unknown) =>
  platform().http.request<T>({
    method: "POST",
    path: `/v1/me/${path}`,
    body,
    timeoutMs: 120000,
  });

export function ConnectedAppsView() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [pending, setPending] = useState<string | null>(() =>
    localStorage.getItem(PENDING_KEY),
  );
  const [consent, setConsent] = useState(false);
  const [npsso, setNpsso] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inProgress = useRef(false);
  const reload = useCallback(async () => {
    const [apps, accounts] = await Promise.all([
      request<Connector[]>("connectors/list"),
      request<Connection[]>("connections/list"),
    ]);
    setConnectors(apps);
    setConnections(accounts);
  }, []);
  useEffect(() => {
    void Promise.resolve()
      .then(reload)
      .catch(() => setMessage("Connected apps are unavailable. Try again."));
  }, [reload]);
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
    } catch {
      setMessage(
        "The connection request failed. Check your authorization and try again.",
      );
    } finally {
      setBusy(false);
    }
  };
  const connect = (id: string) =>
    run(async () => {
      if (id === "google_calendar" && !platform().browser)
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
  return (
    <section className="h-full overflow-auto p-6 text-foreground">
      <h1 className="text-xl font-semibold">Connected Apps</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Connect your accounts to bring calendar events and observed gaming
        activity into Vox.
      </p>
      <label className="my-5 flex items-start gap-3 text-sm">
        <Checkbox
          checked={consent}
          onCheckedChange={(v) => setConsent(v === true)}
        />
        I allow Vox to sync activity to my timeline and read connected account
        data when helping me. I can turn either use off independently.
      </label>
      {message && (
        <p role="status" className="my-3 text-sm">
          {message}
        </p>
      )}
      {pending && (
        <Card className="mb-4 p-4">
          <p className="text-sm">
            Finish authorization in your browser, then return here. Vox will
            recover your setup automatically.
          </p>
          <Button
            className="mt-3"
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
        </Card>
      )}
      <div className="grid gap-4">
        {connectors.map((app) => {
          const account = connections.find((c) => c.connector_id === app.id);
          return (
            <Card key={app.id} className="p-5">
              <h2 className="font-semibold">{app.name}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{app.description}</p>
              {!app.available && (
                <p className="mt-3 text-sm">Not configured on this server.</p>
              )}
              {account && (
                <div className="my-4 space-y-3 text-sm">
                  <p>
                    {account.account_display_id || "Connected account"} ·{" "}
                    {account.authorization_state}
                  </p>
                  <p>
                    Last synced:{" "}
                    {account.last_synced_at
                      ? new Date(account.last_synced_at).toLocaleString()
                      : "Not yet synced"}
                  </p>
                  {account.failure_code && (
                    <p role="status">
                      {account.failure_code === "reconnect_required" ||
                      account.failure_code === "consent_required"
                        ? "Reconnect this account to restore access."
                        : "The last sync failed. Try refreshing."}
                    </p>
                  )}
                  {(["sync_timeline", "assistant_read"] as const).map((key) => (
                    <label key={key} className="flex items-center gap-3">
                      <Checkbox
                        checked={account[key]}
                        disabled={busy}
                        onCheckedChange={(v) =>
                          void run(async () => {
                            await request(
                              `connections/${account.id}/preferences`,
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
                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={
                        busy ||
                        !account.sync_timeline ||
                        account.authorization_state !== "authorized"
                      }
                      onClick={() =>
                        void run(async () => {
                          await request(`connections/${account.id}/refresh`);
                          setMessage("Timeline refreshed.");
                        })
                      }
                    >
                      Refresh now
                    </Button>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await request(`connections/${account.id}/disconnect`);
                          setMessage(
                            "Disconnected. Imported spans are retained.",
                          );
                        })
                      }
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              )}
              {app.id === "playstation" && (
                <label className="mt-4 block text-sm">
                  PlayStation NPSSO token
                  <Input
                    className="mt-2"
                    type="password"
                    autoComplete="off"
                    value={npsso}
                    onChange={(e) => setNpsso(e.target.value)}
                    placeholder="Paste your account token"
                  />
                </label>
              )}
              <Button
                className="mt-4"
                disabled={
                  busy ||
                  !!pending ||
                  !consent ||
                  !app.available ||
                  (app.id === "playstation" && !npsso.trim())
                }
                onClick={() => void connect(app.id)}
              >
                {account ? "Reconnect" : "Connect"}
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
