import { useEffect, useRef } from "react";

// Radix onInteractOutside handler: let an outside click close a panel, except
// the click that merely brings the app back into focus.
export function useOutsideGuard() {
  const focusedAt = useRef(0);
  useEffect(() => {
    const onFocus = () => {
      focusedAt.current = Date.now();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  return (event: Event) => {
    if (!document.hasFocus() || Date.now() - focusedAt.current < 400) {
      event.preventDefault();
    }
  };
}
