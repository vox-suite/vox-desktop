import { Button } from "@/components/ui/button";
import { useAppUpdate } from "@/hooks/use-app-update";

export function UpdateGate() {
  const { required, latest, installing, check: recheck, download } = useAppUpdate();
  if (!required) return null;
  return <div role="alertdialog" aria-modal="true" aria-labelledby="update-title" className="fixed inset-0 z-[100] grid place-items-center bg-background/95 p-6 backdrop-blur">
    <div className="max-w-sm space-y-4 text-center">
      <h2 id="update-title" className="font-heading text-2xl">Update required</h2>
      <p className="text-sm text-muted-foreground">{installing ? `Installing Vox ${latest ?? ""}. Vox will restart when it's done.` : `This version of Vox (${__APP_VERSION__}) is no longer supported. Vox is downloading the update; if it doesn't finish, download it manually.`}</p>
      <div className="flex justify-center gap-2">
        <Button onClick={download}>Download update</Button>
        <Button variant="outline" onClick={() => void recheck()}>Check again</Button>
      </div>
    </div>
  </div>;
}
