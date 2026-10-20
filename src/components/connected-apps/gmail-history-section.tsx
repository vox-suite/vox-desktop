import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { platform } from "@/platform";

type Backfill = { state?: string | null; processed: number; imported: number; skipped: number };

const path = "/v1/connectors/gmail/backfill";

export function GmailHistorySection() {
  const [status, setStatus] = useState<Backfill | null>(null);
  const [error, setError] = useState("");
  const running = status?.state === "running";

  useEffect(() => {
    let alive = true;
    const load = () => platform().http.request<Backfill>({ method: "GET", path })
      .then(result => { if (alive) setStatus(result); })
      .catch(() => {});
    void load();
    const timer = running ? setInterval(load, 5000) : undefined;
    return () => { alive = false; clearInterval(timer); };
  }, [running]);

  const start = async () => {
    setError("");
    try { setStatus(await platform().http.request<Backfill>({ method: "POST", path })); }
    catch (cause) { setError(String(cause)); }
  };

  return <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.02] p-4">
    <h3 className="text-sm font-medium">Previous emails</h3>
    <p className="text-sm text-muted-foreground">New emails sync automatically from when you connected. Sync the 3 months before that to add past orders, bills and bookings to your timeline.</p>
    <Button variant="outline" disabled={running} onClick={() => void start()}>{running ? "Syncing…" : "Sync last 3 months"}</Button>
    {status?.state && <p role="status" className="text-xs text-muted-foreground">
      {running ? `Checked ${status.processed} emails so far, ${status.imported} added.` : `Done. Checked ${status.processed} emails, ${status.imported} added${status.skipped ? `, ${status.skipped} skipped` : ""}.`}
    </p>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
