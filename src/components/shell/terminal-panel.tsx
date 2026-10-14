import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Terminal as TerminalIcon, X } from "lucide-react";
import { desktopStore } from "@/features/desktop-control/store";
import { useDesktopContext } from "@/hooks/use-desktop-control";
import { useVoxColors, withAlpha } from "@/lib/theme";

const SHELL_NAME = /win/i.test(navigator.platform) ? "PowerShell" : "zsh";

const decode = (b64: string) =>
  Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function TerminalPanel() {
  const { terminalOpen } = useDesktopContext();
  const host = useRef<HTMLDivElement>(null);
  const term = useRef<Terminal | null>(null);
  const fit = useRef<FitAddon | null>(null);
  const [error, setError] = useState("");
  const colors = useVoxColors();

  useEffect(() => {
    const t = new Terminal({
      allowTransparency: true,
      cursorBlink: true,
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: 13,
    });
    const f = new FitAddon();
    t.loadAddon(f);
    t.open(host.current!);
    term.current = t;
    fit.current = f;
    const data = t.onData((input) => {
      void invoke("terminal_input", { input }).catch((e) =>
        setError(String(e)),
      );
    });
    const resize = t.onResize(({ rows, cols }) => {
      void invoke("terminal_resize", { rows, cols }).catch(() => {});
    });
    const observer = new ResizeObserver(() => {
      if (host.current?.offsetParent) f.fit();
    });
    observer.observe(host.current!);
    const unlisten = Promise.all([
      listen<string>("terminal-data", (e) => t.write(decode(e.payload))),
      listen("terminal-exit", () => {
        t.reset();
        desktopStore.patch({ terminalOpen: false });
      }),
    ]);
    return () => {
      observer.disconnect();
      data.dispose();
      resize.dispose();
      void unlisten.then((fns) => fns.forEach((fn) => fn()));
      t.dispose();
    };
  }, []);

  useEffect(() => {
    if (!term.current) return;
    term.current.options.theme = {
      background: withAlpha(colors.background, 0),
      foreground: colors.text,
      cursor: colors.text,
      cursorAccent: colors.background,
      selectionBackground: withAlpha(colors.sky, 0.3),
    };
  }, [colors]);

  useEffect(() => {
    if (!terminalOpen) return;
    invoke("terminal_open")
      .then(() => {
        fit.current?.fit();
        const t = term.current;
        if (t) void invoke("terminal_resize", { rows: t.rows, cols: t.cols });
        t?.focus();
      })
      .catch((e) => setError(String(e)));
  }, [terminalOpen]);

  return (
    <section
      aria-label="Terminal"
      hidden={!terminalOpen}
      className="pointer-events-auto absolute inset-0 z-30 flex flex-col border-l border-line bg-background/70"
    >
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-line bg-panel/90 pl-3 pr-2">
        <div className="flex items-center gap-2 rounded-md bg-ink/[0.06] px-2.5 py-1 text-xs font-medium">
          <TerminalIcon size={13} className="text-muted-foreground" />
          <span>Terminal</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-muted-foreground">{SHELL_NAME}</span>
        </div>
        <button
          type="button"
          aria-label="Close terminal"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-ink/10 hover:text-foreground"
          onClick={() => desktopStore.patch({ terminalOpen: false })}
        >
          <X size={15} />
        </button>
      </header>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div ref={host} className="min-h-0 flex-1" />
    </section>
  );
}
