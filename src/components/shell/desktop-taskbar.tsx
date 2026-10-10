import { useEffect, useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Mic, MicOff, PhoneOff, Terminal, X } from "lucide-react";
import { desktopStore } from "@/features/desktop-control/store";
import { desktopActions } from "@/features/desktop-control/action-state";
import { useDesktopContext } from "@/hooks/use-desktop-control";

export function DesktopTaskbar({
  isActive,
  speaking,
  callState,
  error,
  onToggleCall,
}: {
  isActive: boolean;
  speaking: boolean;
  callState: string;
  error: string;
  onToggleCall: () => void;
}) {
  const context = useDesktopContext();
  const actions = useSyncExternalStore(
    desktopActions.subscribe,
    desktopActions.snapshot,
  );
  const pending = Object.values(actions).filter((a) => a.phase === "started");
  const [muted, setMuted] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState("");
  useEffect(() => {
    if (!isActive) setMuted(false);
  }, [isActive]);
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [terminalError, setTerminalError] = useState("");
  useEffect(() => {
    if (!context.terminalOpen) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    void invoke("terminal_open")
      .then(() => {
        if (!active) return;
        const read = () =>
          void invoke<string>("terminal_output")
            .then((text) => {
              if (active) setOutput(text);
            })
            .catch((e) => {
              if (active) setTerminalError(String(e));
            });
        read();
        timer = setInterval(read, 300);
      })
      .catch((e) => {
        if (active) setTerminalError(String(e));
      });
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [context.terminalOpen]);
  return (
    <>
      {isActive && (
        <div className="relative z-30 flex shrink-0 items-center gap-3 border-t border-border bg-background px-5 py-2">
          <button
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
            onClick={() =>
              void invoke("set_call_muted", { muted: !muted })
                .then(() => setMuted(!muted))
                .catch((e) => setMessageError(String(e)))
            }
            className="rounded p-2 hover:bg-muted"
          >
            {muted ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
          <form
            className="flex flex-1 gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!message.trim()) return;
              void invoke("send_desktop_text", { text: message })
                .then(() => {
                  setMessage("");
                  setMessageError("");
                })
                .catch((e) => setMessageError(String(e)));
            }}
          >
            <input
              aria-label="Message Vox"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="flex-1 bg-transparent text-xs outline-none"
              placeholder="Or type to Vox during this session…"
            />
            <button className="text-xs text-muted-foreground" type="submit">
              Send
            </button>
          </form>
        </div>
      )}
      {context.terminalOpen && (
        <section
          aria-label="Terminal"
          className="relative z-30 flex h-64 shrink-0 flex-col border-t border-border bg-background px-5 py-3"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Terminal</span>
            <button
              aria-label="Close terminal"
              onClick={() => desktopStore.patch({ terminalOpen: false })}
            >
              <X size={16} />
            </button>
          </div>
          <pre
            className="flex-1 overflow-auto whitespace-pre-wrap py-2 font-mono text-xs"
            aria-live="off"
          >
            {terminalError || output}
          </pre>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void invoke("terminal_input", { input: input + "\n" })
                .then(() => setInput(""))
                .catch((e) => setTerminalError(String(e)));
            }}
          >
            <input
              aria-label="Terminal command"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Enter a command…"
              className="w-full border-t border-border bg-transparent py-2 font-mono text-xs outline-none"
            />
          </form>
        </section>
      )}
      <footer className="relative z-40 flex h-16 shrink-0 items-center gap-4 border-t border-border bg-background/95 px-5">
        <button
          onClick={onToggleCall}
          disabled={callState === "connecting"}
          className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background disabled:opacity-50"
        >
          {isActive ? <PhoneOff size={16} /> : <Mic size={16} />}{" "}
          {isActive ? "End session" : "Talk to Vox"}
        </button>
        <span role="status" className="flex-1 text-xs text-muted-foreground">
          {messageError ||
            error ||
            (pending.length
              ? `Vox is ${pending[0].action.replaceAll("_", " ")}…`
              : speaking
                ? "Vox is speaking"
                : isActive
                  ? "Listening · live session"
                  : callState === "connecting"
                    ? "Connecting…"
                    : "Ask Vox to create, find, or change something")}
        </span>
        {pending.length > 0 && (
          <div
            aria-label="Action in progress"
            className="h-2 w-24 animate-pulse rounded bg-muted-foreground/30"
          />
        )}
        <button
          onClick={() =>
            desktopStore.patch({ terminalOpen: !context.terminalOpen })
          }
          className="flex items-center gap-2 rounded-md px-3 py-2 text-xs hover:bg-muted"
        >
          <Terminal size={16} />
          Terminal
        </button>
      </footer>
    </>
  );
}
