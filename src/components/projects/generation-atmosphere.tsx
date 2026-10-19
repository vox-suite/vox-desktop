import { useEffect, useRef } from "react";
import { DraftingFigure } from "@/components/empty-figures";

export function GenerationAtmosphere({
  active,
  empty,
}: {
  active: boolean;
  empty: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const update = () => {
      if (host.current) host.current.dataset.paused = String(document.hidden);
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return (
    <div
      ref={host}
      className="project-generation-atmosphere"
      data-active={active}
      data-empty={empty}
      aria-hidden="true"
    >
      <span className="project-atmosphere-grid" />
      <span className="project-atmosphere-sweep" />
      {active && empty && (
        <div className="project-atmosphere-figure">
          <DraftingFigure />
        </div>
      )}
    </div>
  );
}
