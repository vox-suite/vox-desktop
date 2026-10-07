import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { platform } from "@/platform";

export function PlaystationNpsso({
  npsso,
  setNpsso,
}: {
  npsso: string;
  setNpsso: (token: string) => void;
}) {
  return (
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
                  void platform().browser?.openExternal("https://www.playstation.com")
                }
              >
                playstation.com
              </button>{" "}
              in your browser.
            </li>
            <li>
              In the same browser, open the page below. It shows a short block of text.
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
            The token gives access to your PlayStation account, so keep it
            private and only paste it here. It is not an official Sony feature and
            stops working after a while, so you may need to connect again later.
          </p>
        </div>
      </details>
    </div>
  );
}
