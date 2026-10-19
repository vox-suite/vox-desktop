import { useEffect, useRef } from "react";

export function GenerationAtmosphere({ active }: { active: boolean }) {
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
      aria-hidden="true"
    >
      <span className="project-atmosphere-aura" />
      <span className="project-atmosphere-sheen" />
      <span className="project-atmosphere-rim" />
    </div>
  );
}
