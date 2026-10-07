import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

// Render outside the panel so backdrop-filter can sample the app below it.
export function PanelEdgeBlur({
  selector,
  edge,
  width = 96,
}: {
  selector: string;
  edge: "left" | "right";
  width?: number;
}) {
  const [rect, setRect] = useState<{
    top: number;
    height: number;
    left: number;
    right: number;
  } | null>(null);
  useLayoutEffect(() => {
    const panel = document.querySelector(selector);
    if (!panel) return;
    let header: Element | null = null;
    const update = () => {
      const bounds = panel.getBoundingClientRect();
      const headerBottom =
        edge === "right" ? header?.getBoundingClientRect().bottom : undefined;
      const top = Math.max(bounds.top, headerBottom ?? bounds.top);
      const next = {
        top,
        height: Math.max(0, bounds.bottom - top),
        left: bounds.left,
        right: bounds.right,
      };
      setRect((previous) =>
        previous &&
        Object.keys(next).every(
          (key) =>
            previous[key as keyof typeof next] ===
            next[key as keyof typeof next],
        )
          ? previous
          : next,
      );
    };
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    const findHeader = () => {
      const next = document.querySelector("[data-page-header]");
      if (next !== header) {
        if (header) observer.unobserve(header);
        header = next;
        if (header) observer.observe(header);
      }
      update();
    };
    findHeader();
    const mutations = new MutationObserver(findHeader);
    mutations.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      mutations.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [selector, edge]);
  if (!rect) return null;
  const mask =
    edge === "left"
      ? "linear-gradient(to right, transparent, black)"
      : "linear-gradient(to right, black, transparent)";
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-20 bg-black/5 backdrop-blur-sm"
      style={{
        width,
        top: rect.top,
        height: rect.height,
        left: edge === "left" ? rect.left - width : rect.right,
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    />,
    document.body,
  );
}
