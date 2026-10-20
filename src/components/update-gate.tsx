import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { platform } from "@/platform";

type Status = { status: "ok" | "update_available" | "update_required"; latest_version?: string | null };

const RELEASES = "https://github.com/vox-suite/vox-desktop/releases/latest";

export function UpdateGate() {
  const [status, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const check = () =>
    platform().http.request<Status>({ method: "GET", path: "/v1/app/version", query: { platform: "desktop", version: __APP_VERSION__ } })
      .then(setStatus)
      .catch(() => {});

  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const download = () => void platform().browser.openExternal(RELEASES);
  const latest = status?.latest_version ? ` ${status.latest_version}` : "";

  if (status?.status === "update_required") {
    return <div role="alertdialog" aria-modal="true" aria-labelledby="update-title" className="fixed inset-0 z-[100] grid place-items-center bg-background/95 p-6 backdrop-blur">
      <div className="max-w-sm space-y-4 text-center">
        <h2 id="update-title" className="font-heading text-2xl">Update required</h2>
        <p className="text-sm text-muted-foreground">This version of Vox ({__APP_VERSION__}) is no longer supported. Install Vox{latest} to keep using it.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={download}>Download update</Button>
          <Button variant="outline" onClick={() => void check()}>Check again</Button>
        </div>
      </div>
    </div>;
  }

  if (status?.status === "update_available" && !dismissed) {
    return <div role="status" className="fixed bottom-4 right-4 z-[90] flex items-center gap-3 rounded-xl border border-line bg-popover px-4 py-3 text-sm shadow-lg">
      <span>Vox{latest} is available.</span>
      <Button size="sm" onClick={download}>Download</Button>
      <Button size="sm" variant="ghost" onClick={() => setDismissed(true)}>Later</Button>
    </div>;
  }

  return null;
}
