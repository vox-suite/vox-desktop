import { Plug, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark } from "./brand-mark";
import { StatusPill } from "./status-pill";
import type { BrandConfig, Connection, Connector } from "./types";

export function AppCard({
  app,
  brand,
  account,
  isSynced,
  isConnected,
  onOpen,
}: {
  app: Connector;
  brand: BrandConfig;
  account?: Connection;
  isSynced: boolean;
  isConnected: boolean;
  onOpen: () => void;
}) {
  const needsAttention =
    !!account &&
    (!!account.failure_code || account.authorization_state !== "authorized");

  return (
    <article
      style={{ "--brand": brand.color } as React.CSSProperties}
      className="relative flex h-full min-h-64 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#0e0f12] p-5 transition-colors duration-200 hover:border-[color-mix(in_srgb,var(--brand)_55%,black)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[101px] -top-[101px] size-72 rounded-full opacity-20"
        style={{
          background: `radial-gradient(circle, ${brand.color} 0%, ${brand.color}55 35%, transparent 70%)`,
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-lg font-semibold tracking-tight">
            {app.name}
          </h2>
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
            {brand.tagline}
          </p>
        </div>
        <BrandMark brand={brand} />
      </div>
      <div className="relative mt-3">
        <StatusPill synced={isSynced} attention={needsAttention} />
      </div>
      <p className="relative mb-4 mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
        {app.description}
      </p>
      <Button
        className="relative mt-auto h-10 w-full shrink-0 gap-2 rounded-lg"
        variant="secondary"
        onClick={onOpen}
      >
        {app.id === "youtube" ? (
          <RefreshCw className="size-4" />
        ) : isConnected ? (
          <Settings2 className="size-4" />
        ) : (
          <Plug className="size-4" />
        )}
        {app.id === "maps_timeline"
          ? "Import"
          : app.id === "youtube"
            ? "Sync"
            : isConnected
              ? "Configure"
              : ["spotify", "youtube"].includes(app.id) && !app.available
                ? "Set up"
                : "Connect"}
      </Button>
    </article>
  );
}
