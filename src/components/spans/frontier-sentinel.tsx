import { useEffect, useRef } from "react";

export function FrontierSentinel({
  root,
  left,
  disabled,
  onReach,
}: {
  root: React.RefObject<HTMLDivElement | null>;
  left: number;
  disabled: boolean;
  onReach: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node || disabled) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onReach();
      },
      { root: root.current, rootMargin: "0px 400px 0px 400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [root, disabled, left, onReach]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="pointer-events-none absolute top-0 h-px w-px"
      style={{ left }}
    />
  );
}
