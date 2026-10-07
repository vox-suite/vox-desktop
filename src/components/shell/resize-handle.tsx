import { useLayoutEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";

const WIDTH_KEY = "vox.sidebar.width";
const DEFAULT_WIDTH = 256;
const MIN_WIDTH = 176;
const MAX_WIDTH = 420;
const COLLAPSE_BELOW = 120;

function storedWidth() {
  try {
    const value = Number(localStorage.getItem(WIDTH_KEY));
    if (value >= MIN_WIDTH && value <= MAX_WIDTH) return value;
  } catch {
    return DEFAULT_WIDTH;
  }
  return DEFAULT_WIDTH;
}

export function ResizeHandle() {
  const { open, setOpen, toggleSidebar } = useSidebar();
  const ref = useRef<HTMLDivElement>(null);
  const width = useRef(storedWidth());

  const wrapper = () =>
    ref.current?.closest<HTMLElement>("[data-slot=sidebar-wrapper]");

  const apply = (px: number) => {
    width.current = px;
    wrapper()?.style.setProperty("--sidebar-width", `${px}px`);
  };

  useLayoutEffect(() => {
    wrapper()?.style.setProperty("--sidebar-width", `${width.current}px`);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = e.clientX;
    let moved = false;
    let isOpen = open;
    const root = wrapper();
    root?.classList.add("sidebar-resizing");

    const move = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 3) moved = true;
      if (!moved) return;
      if (ev.clientX < COLLAPSE_BELOW) {
        if (isOpen) setOpen((isOpen = false));
        return;
      }
      if (!isOpen) setOpen((isOpen = true));
      apply(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, ev.clientX)));
    };

    const up = () => {
      root?.classList.remove("sidebar-resizing");
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      if (!moved) return toggleSidebar();
      try {
        localStorage.setItem(WIDTH_KEY, String(width.current));
      } catch {
        return;
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      onPointerDown={onPointerDown}
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute inset-y-0 -right-1 z-20 w-2 cursor-col-resize after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 hover:after:bg-[#5a1a1e] active:after:bg-[#5a1a1e]"
    />
  );
}
