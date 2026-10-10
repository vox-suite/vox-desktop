import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { platform } from "@/platform";
import { errorMessage } from "@/lib/errors";
import type { Connection, TakeoutConfig } from "./types";

const IMPORT_CHUNK = 500;

export function TakeoutSection({
  cfg,
  importedAccount,
  historyConsent,
  setHistoryConsent,
  busy,
  run,
  setMessage,
}: {
  cfg: TakeoutConfig;
  importedAccount?: Connection;
  historyConsent: boolean;
  setHistoryConsent: (v: boolean) => void;
  busy: boolean;
  run: (op: () => Promise<void>) => Promise<void>;
  setMessage: (msg: string) => void;
}) {
  const historyInput = useRef<HTMLInputElement>(null);

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
        accept=".zip,.json,.html,application/zip,application/json,text/html"
        aria-label={cfg.title}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file || !historyConsent) return;
          const limitMb = file.name.toLowerCase().endsWith(".zip") ? 100 : cfg.maxMb;
          if (file.size > limitMb * 1024 * 1024) {
            setMessage(`Choose a file smaller than ${limitMb} MiB.`);
            return;
          }
          void run(async () => {
            if (file.name.toLowerCase().endsWith(".zip")) {
              const bytes = new Uint8Array(await file.arrayBuffer());
              const chunks: string[] = [];
              for (let i = 0; i < bytes.length; i += 32768) chunks.push(String.fromCharCode(...bytes.subarray(i, i + 32768)));
              setMessage("Importing Takeout archive…");
              const result = await platform().http.request<{ youtube_records_imported: number; maps_records_imported: number; total_events_created: number }>({ method: "POST", path: "/v1/connectors/google/takeout/upload", rawBodyBase64: btoa(chunks.join("")), timeoutMs: 200000 });
              setMessage(`Imported ${result.total_events_created.toLocaleString()} new entries from ${result.youtube_records_imported.toLocaleString()} YouTube watches and ${result.maps_records_imported.toLocaleString()} Maps records. Export gaps remain unknown.`);
              return;
            }
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
                const result = await platform().http.request<{
                  imported: number;
                  skipped: number;
                }>({
                  method: "POST",
                  path: `/v1/me/${cfg.endpoint}`,
                  body: { consent: historyConsent, history: chunk },
                  timeoutMs: 120000,
                });
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
      {importedAccount && (
        <div className="space-y-2 border-t border-white/10 pt-3">
          <p className="text-xs text-muted-foreground">
            Synced
            {importedAccount.last_synced_at
              ? ` on ${new Date(importedAccount.last_synced_at).toLocaleString()}`
              : ""}
            .
          </p>
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await platform().http.request({
                  method: "POST",
                  path: `/v1/me/connections/${importedAccount.id}/disconnect`,
                  timeoutMs: 120000,
                });
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
}
