import { useState } from "react";
import { platform } from "@/platform";
import type { WizDevice, WizStatus } from "@/platform/ports";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

export function WizConnectionPanel({
  status,
  onStatusChange,
}: {
  status: WizStatus;
  onStatusChange: (status: WizStatus) => void;
}) {
  const [consent, setConsent] = useState(false);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [brightness, setBrightness] = useState<Record<string, number>>({});
  const port = platform().wiz;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };
  const update = async (
    device: WizDevice,
    state: { on?: boolean; brightness?: number },
  ) => {
    if (!port) return;
    const updated = await port.control(device.id, state);
    onStatusChange({
      ...status,
      devices: status.devices.map((light) =>
        light.id === updated.id ? updated : light,
      ),
    });
    setBrightness((values) => {
      const next = { ...values };
      delete next[device.id];
      return next;
    });
    setMessage("Light updated.");
  };

  if (!port) {
    return (
      <p className="rounded-lg bg-white/[0.04] p-3 text-sm text-muted-foreground">
        WiZ local control is available in the Vox desktop app. Open it on the
        same Wi-Fi network as your Philips WiZ lights.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm leading-relaxed text-muted-foreground">
        Keep this computer and your Philips WiZ lights on the same Wi-Fi
        network. In the WiZ mobile app, enable “Allow local communication” for
        your lights. Vox reads their current state locally and only changes a
        light when you choose an action here.
      </p>
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-400/10 p-3 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-muted-foreground">
          {message}
        </p>
      )}
      {!status.enabled && (
        <label className="flex items-start gap-3 rounded-lg border border-white/10 p-3.5 text-sm">
          <Checkbox
            checked={consent}
            disabled={busy}
            onCheckedChange={(checked) => setConsent(checked === true)}
          />
          <span>
            I allow Vox to discover and read WiZ lights on my local network. I
            choose each lighting change myself.
          </span>
        </label>
      )}
      <label className="block space-y-2 text-sm">
        <span>WiZ local integration link</span>
        <Input
          value={link}
          onChange={(event) => setLink(event.target.value)}
          disabled={busy}
          placeholder="https://wiz-s3-local-integration-prd-artifacts…"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="block text-xs text-muted-foreground">
          In the WiZ app open Settings → Integrations → Local integrations and
          copy the link. It expires after 15 minutes and is not saved.
        </span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={busy || !link.trim() || (!status.enabled && !consent)}
          onClick={() =>
            void run(async () => {
              const devices = await port.connect(
                status.enabled || consent,
                link.trim(),
              );
              setLink("");
              onStatusChange({ enabled: true, devices });
              setMessage(
                devices.length
                  ? `Found ${devices.length} light${devices.length === 1 ? "" : "s"}.`
                  : "No lights found. Check your network and local communication setting, and enable “Allow local communication” in the WiZ app.",
              );
            })
          }
        >
          {busy
            ? "Working…"
            : status.enabled
              ? "Reconnect with new link"
              : "Connect"}
        </Button>
        {status.enabled && (
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const devices = await port.refresh();
                onStatusChange({ enabled: true, devices });
                setBrightness({});
                setMessage("Light status refreshed.");
              })
            }
          >
            Refresh status
          </Button>
        )}
      </div>
      {status.enabled && !status.devices.length && (
        <p className="text-sm text-muted-foreground">
          Local access is enabled. No lights have been discovered yet.
        </p>
      )}
      {status.devices.map((device) => (
        <div
          key={device.id}
          className="space-y-3 rounded-lg border border-white/10 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{device.name}</p>
              <p className="text-xs text-muted-foreground">
                {device.room ? `${device.room} · ` : ""}
                {device.reachable
                  ? device.on
                    ? "On"
                    : "Off"
                  : "Unreachable — last known state"}
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={busy || !device.reachable}
              onClick={() => void run(() => update(device, { on: !device.on }))}
            >
              {device.on ? "Turn off" : "Turn on"}
            </Button>
          </div>
          {device.brightness !== undefined && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                value={brightness[device.id] ?? device.brightness}
                aria-label={`${device.name} brightness`}
                disabled={busy || !device.reachable}
                onChange={(event) =>
                  setBrightness((values) => ({
                    ...values,
                    [device.id]: Number(event.target.value),
                  }))
                }
                className="min-w-0 flex-1 accent-purple-400"
              />
              <span className="text-xs tabular-nums">
                {brightness[device.id] ?? device.brightness}%
              </span>
              <Button
                variant="outline"
                disabled={
                  busy ||
                  !device.reachable ||
                  brightness[device.id] === undefined
                }
                onClick={() =>
                  void run(() =>
                    update(device, { brightness: brightness[device.id] }),
                  )
                }
              >
                Apply brightness
              </Button>
            </div>
          )}
        </div>
      ))}
      {status.enabled && (
        <Button
          variant="outline"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              await port.disconnect();
              onStatusChange({ enabled: false, devices: [] });
              setConsent(false);
              setLink("");
              setBrightness({});
              setMessage(
                "Disconnected. Local consent and saved lights have been forgotten.",
              );
            })
          }
        >
          Disconnect WiZ
        </Button>
      )}
    </div>
  );
}
