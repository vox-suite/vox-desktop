import { useEffect, useState } from "react";
import { AgentsFigure } from "@/components/empty-figures";
import { getBrand } from "@/components/connected-apps/brands";
import type { Connection } from "@/components/connected-apps/types";
import { token } from "@/lib/theme";
import { platform } from "@/platform";

const LEGEND = [
  { label: "Timeline", color: "sky" },
  { label: "Updates", color: "gold" },
  { label: "Plans", color: "violet" },
] as const;

export function AgentsWorkshop({
  active,
  speaking,
}: {
  active: boolean;
  speaking: boolean;
}) {
  const [sources, setSources] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    platform()
      .http.request<Connection[]>({
        method: "POST",
        path: "/v1/me/connections/list",
      })
      .then((list) => {
        if (live)
          setSources([...new Set((list ?? []).map((c) => c.connector_id))]);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const status = speaking
    ? "Vox is speaking"
    : active
      ? "Listening"
      : "Working";
  return (
    <figure
      className="pointer-events-none absolute right-4 bottom-4 z-[5] m-0 w-[340px] max-w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-white/30 select-none dark:border-white/10"
      style={{
        background: "color-mix(in srgb, var(--vox-panel) 18%, transparent)",
        backdropFilter: "blur(5px) saturate(1.1)",
        WebkitBackdropFilter: "blur(5px) saturate(1.1)",
        boxShadow:
          "inset 0 1px 0 color-mix(in srgb, white 25%, transparent), 0 12px 40px -16px color-mix(in srgb, var(--vox-shade) 30%, transparent)",
      }}
    >
      <div className="flex items-center justify-between px-3.5 pt-3 font-mono text-[9.5px] tracking-wider text-muted-foreground uppercase">
        <span>Your agents</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-1.5 rounded-full"
            style={{
              background: token(
                speaking ? "violet" : active ? "mint" : "text-dim",
              ),
            }}
          />
          {status}
        </span>
      </div>
      <div className="px-1">
        <AgentsFigure
          sources={sources.map((id) => getBrand(id).color)}
          active={active}
          speaking={speaking}
        />
      </div>
      <figcaption className="flex items-center gap-3 border-t border-ink/8 px-3.5 py-2 text-[10.5px] text-muted-foreground">
        {LEGEND.map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-sm"
              style={{ background: token(item.color) }}
            />
            {item.label}
          </span>
        ))}
        <span className="ml-auto font-mono text-[9.5px]">
          {sources.length
            ? `${sources.length} source${sources.length === 1 ? "" : "s"}`
            : "No sources yet"}
        </span>
      </figcaption>
    </figure>
  );
}
