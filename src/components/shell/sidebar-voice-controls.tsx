import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, useSyncExternalStore } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  Check,
  ArrowUp,
  MessageCircle,
  Mic,
  MicOff,
  Minus,
  PhoneOff,
} from "lucide-react";
import { desktopActions } from "@/features/desktop-control/action-state";
import { VoxStatusLogo } from "@/components/vox-status-logo";
import { LiveWaveform } from "@/components/elevenlabs/live-waveform";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/elevenlabs/conversation";
import { Message, MessageContent } from "@/components/elevenlabs/message";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";

export type SidebarVoiceProps = {
  isActive: boolean;
  speaking: boolean;
  micLevel: number;
  callState: string;
  error: string;
  onToggleCall: () => void;
};

type ChatMessage = { id: number; text: string; state: "sent" | "failed" };
const iconButton =
  "flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-ink/10 hover:text-foreground focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-40";

export function SidebarVoiceControls({
  isActive,
  speaking,
  micLevel,
  callState,
  error,
  onToggleCall,
}: SidebarVoiceProps) {
  const actions = useSyncExternalStore(
    desktopActions.subscribe,
    desktopActions.snapshot,
  );
  const pending = Object.values(actions).find(
    (action) => action.phase === "started",
  );
  const [microphones, setMicrophones] = useState<string[]>([]);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string | null>(
    null,
  );
  const [loadingMicrophones, setLoadingMicrophones] = useState(false);
  const [switchingMicrophone, setSwitchingMicrophone] = useState(false);
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [wasActive, setWasActive] = useState(isActive);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageError, setMessageError] = useState("");
  const [sending, setSending] = useState(false);
  const [changingMute, setChangingMute] = useState(false);
  if (wasActive !== isActive) {
    setWasActive(isActive);
    if (!isActive) setMuted(false);
  }
  const connecting = callState === "connecting";
  const failure = messageError || error;
  const title = connecting
    ? "Connecting…"
    : isActive
      ? speaking
        ? "Vox is speaking"
        : muted
          ? "Microphone muted"
          : "Listening"
      : "Talk to Vox";
  const detail =
    failure ||
    (pending
      ? `Vox is ${pending.action.replaceAll("_", " ")}…`
      : isActive
        ? "Live session"
        : "Your voice, anywhere in Vox");
  const orbState = failure
    ? "error"
    : connecting
      ? "connecting"
      : isActive
        ? "active"
        : "idle";
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <SidebarMenu>
        <SidebarMenuItem>
          <div className="overflow-hidden rounded-xl border border-ink/10 bg-ink/[0.04] p-2 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0">
            <div className="flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
              <button
                type="button"
                aria-label={isActive ? "Voice session active" : "Talk to Vox"}
                disabled={isActive || connecting}
                onClick={() => {
                  setMessageError("");
                  onToggleCall();
                }}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-lg text-left disabled:cursor-default focus-visible:outline-2 focus-visible:outline-violet group-data-[collapsible=icon]:flex-none"
              >
                <span className="flex size-7 shrink-0 items-center justify-center text-violet">
                  <VoxStatusLogo animateIdle size={24} state={orbState} />
                </span>
                <span
                  role="status"
                  className="min-w-0 truncate text-xs font-medium group-data-[collapsible=icon]:sr-only"
                >
                  {title}
                  <span className="sr-only">. {detail}</span>
                </span>
              </button>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Open Vox chat"
                  title="Open Vox chat"
                  className={iconButton}
                >
                  <MessageCircle size={16} />
                </button>
              </PopoverTrigger>
            </div>
            {(isActive || connecting) && (
              <div className="mt-2 flex items-center gap-2 group-data-[collapsible=icon]:flex-col">
                <DropdownMenu
                  onOpenChange={async (isOpen) => {
                    if (!isOpen) return;
                    setLoadingMicrophones(true);
                    try {
                      setMicrophones(
                        await invoke<string[]>("list_microphones"),
                      );
                      setMessageError("");
                    } catch (cause) {
                      setMessageError(String(cause));
                    } finally {
                      setLoadingMicrophones(false);
                    }
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Microphone settings"
                      title="Microphone settings"
                      className={iconButton}
                    >
                      {muted ? <MicOff size={14} /> : <Mic size={14} />}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    side="top"
                    align="start"
                    className="w-64"
                  >
                    <DropdownMenuItem
                      disabled={!isActive || changingMute}
                      onSelect={async () => {
                        setChangingMute(true);
                        try {
                          await invoke("set_call_muted", { muted: !muted });
                          setMuted(!muted);
                          setMessageError("");
                        } catch (cause) {
                          setMessageError(String(cause));
                        } finally {
                          setChangingMute(false);
                        }
                      }}
                    >
                      {muted ? <MicOff /> : <Mic />}
                      {muted ? "Unmute microphone" : "Mute microphone"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {[null, ...new Set(microphones)].map((name) => (
                      <DropdownMenuItem
                        key={name ?? "default"}
                        disabled={switchingMicrophone || loadingMicrophones}
                        onSelect={async () => {
                          setSwitchingMicrophone(true);
                          try {
                            await invoke("select_microphone", { name });
                            setSelectedMicrophone(name);
                            setMessageError("");
                          } catch (cause) {
                            setMessageError(String(cause));
                          } finally {
                            setSwitchingMicrophone(false);
                          }
                        }}
                      >
                        <span className="min-w-0 flex-1 truncate">
                          {name ?? "System Default"}
                        </span>
                        {selectedMicrophone === name && (
                          <Check className="size-4" />
                        )}
                      </DropdownMenuItem>
                    ))}
                    {loadingMicrophones && (
                      <DropdownMenuItem disabled>
                        Finding microphones…
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div
                  className="min-w-0 flex-1 text-violet/70 group-data-[collapsible=icon]:hidden"
                  aria-label={
                    muted ? "Microphone muted" : "Live microphone level"
                  }
                >
                  <LiveWaveform
                    active={isActive && !muted}
                    audioLevel={muted ? 0 : micLevel}
                    mode="scrolling"
                    height={28}
                    barWidth={2}
                    barGap={2}
                    barHeight={2}
                    barRadius={1}
                    fadeWidth={12}
                    sensitivity={5}
                    historySize={60}
                    updateRate={90}
                  />
                </div>
                <button
                  type="button"
                  aria-label="End session"
                  title="End session"
                  onClick={onToggleCall}
                  className={`${iconButton} bg-danger/10 text-danger hover:bg-danger/20 hover:text-danger`}
                >
                  <PhoneOff size={14} />
                </button>
              </div>
            )}
            {failure && (
              <p
                role="alert"
                className="mt-2 text-[11px] text-danger group-data-[collapsible=icon]:sr-only"
              >
                {failure}
              </p>
            )}
          </div>
        </SidebarMenuItem>
      </SidebarMenu>
      <PopoverContent
        side="right"
        align="end"
        sideOffset={16}
        collisionPadding={16}
        aria-label="Vox chat"
        className="w-[360px] max-w-[calc(100vw-32px)] gap-0 overflow-hidden rounded-2xl border border-line bg-panel/90 p-0 text-foreground shadow-float ring-0 backdrop-blur-[30px]"
      >
        <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
          <VoxStatusLogo animateIdle size={24} state={orbState} />
          <div className="flex-1">
            <h2 className="text-sm font-medium">Chat with Vox</h2>
          </div>
          <button
            type="button"
            aria-label="Minimize chat"
            onClick={() => setOpen(false)}
            className={iconButton}
          >
            <Minus size={16} />
          </button>
        </div>
        <Conversation
          aria-label="Messages sent to Vox"
          className="h-64 max-h-[45vh] flex-none"
        >
          <ConversationContent className="min-h-full">
            {messages.length === 0 ? (
              <ConversationEmptyState
                title="What would you like to do?"
                description="Type to Vox while keeping your workspace in view."
                icon={
                  <span className="flex size-12 items-center justify-center rounded-full border-2 border-dashed border-ink/20">
                    <MessageCircle size={20} />
                  </span>
                }
              />
            ) : (
              messages.map((item) => (
                <Message key={item.id} from="user" className="py-2">
                  <MessageContent
                    variant="flat"
                    className="whitespace-pre-wrap break-words text-xs leading-relaxed"
                  >
                    <p>{item.text}</p>
                    <span
                      className={`text-[10px] ${item.state === "failed" ? "text-danger" : "text-muted-foreground"}`}
                    >
                      {item.state === "failed" ? "Not sent" : "Sent to Vox"}
                    </span>
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton aria-label="Scroll to latest message" />
        </Conversation>
        <div className="border-t border-ink/10 p-3">
          {failure && (
            <p role="alert" className="mb-2 text-xs text-danger">
              {failure}
            </p>
          )}
          <form
            className="flex items-center gap-2 rounded-xl border border-ink/10 bg-ink/[0.04] px-3 focus-within:border-violet/40"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!message.trim() || sending || !isActive) return;
              const text = message.trim();
              const id = Date.now();
              setSending(true);
              try {
                await invoke("send_desktop_text", { text });
                setMessages((items) => [...items, { id, text, state: "sent" }]);
                setMessage("");
                setMessageError("");
              } catch (cause) {
                setMessages((items) => [
                  ...items,
                  { id, text, state: "failed" },
                ]);
                setMessageError(String(cause));
              } finally {
                setSending(false);
              }
            }}
          >
            <input
              aria-label="Message Vox"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={!isActive || sending}
              placeholder="Message Vox…"
              className="h-10 min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="submit"
              aria-label="Send message"
              disabled={!isActive || sending || !message.trim()}
              className={iconButton}
            >
              <ArrowUp size={17} />
            </button>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
