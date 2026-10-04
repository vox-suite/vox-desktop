import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { VoxLogo } from "@/components/vox-logo";

export function AuthLayout({
  title,
  badge,
  description,
  error,
  children,
}: {
  title: string;
  badge: string;
  description: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <main
      data-tauri-drag-region
      className="relative flex h-full w-full flex-col items-center justify-center gap-6 overflow-hidden bg-background px-6"
    >
      <div
        className="sign-in-glow pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="sign-in-noise pointer-events-none absolute inset-0" aria-hidden />
      <VoxLogo className="relative" size={96} animated state={error ? "error" : "idle"} />
      <div className="relative flex w-full max-w-md flex-col gap-4 text-center">
        <div className="flex flex-col items-center gap-2">
          <h1 className="flex items-center gap-2 font-heading text-3xl font-semibold">
            {title}
            <Badge variant="secondary" className="h-auto rounded-full bg-[#3a1418] px-2 py-[3px] font-mono text-[10px] font-normal uppercase tracking-[1px] text-[#e6e6e6]">{badge}</Badge>
          </h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex flex-col gap-3">
          {children}
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>
    </main>
  );
}
