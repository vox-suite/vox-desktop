import { useState } from "react";
import { ChevronDown, MessageSquare, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import type { Space, SpaceMessage, SpaceNode } from "@/features/spaces/types";
export function SpaceChatPanel({
  space,
  messages,
  selectedNode,
  sending,
  onSendMessage,
  onUpdateNode,
}: {
  space: Space;
  messages: SpaceMessage[];
  selectedNode: SpaceNode | null;
  staleNodes: SpaceNode[];
  sending: boolean;
  onSendMessage: (msg: string, nodeId?: string) => Promise<void>;
  onUpdateNode: (
    nodeId: string,
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>,
  ) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState("");
  const disabled =
    sending || space.state === "committed" || space.state === "dropped";
  const send = async () => {
    if (!text.trim() || disabled) return;
    const value = text;
    setError("");
    try {
      await onSendMessage(value, selectedNode?.id);
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send message");
    }
  };
  return (
    <div className="space-composer rounded-xl border border-white/15 bg-[#171719]/95 text-foreground shadow-2xl backdrop-blur-xl">
      <div className="flex items-center gap-2 px-3 pt-2">
        <MessageSquare className="size-3 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground">
          {selectedNode
            ? `Chat with ${selectedNode.title}`
            : "Space orchestrator"}
        </span>
        <Button
          size="icon-xs"
          variant="ghost"
          aria-label={
            expanded ? "Collapse conversation" : "Expand conversation"
          }
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <X className="size-3" />
          ) : (
            <ChevronDown className="size-3" />
          )}
        </Button>
      </div>
      {expanded && (
        <div className="max-h-[40vh] overflow-auto border-b border-white/10 p-3">
          {selectedNode && (
            <div className="mb-3 rounded-lg border border-white/10 p-3">
              <h3 className="text-xs font-medium">Selected node</h3>
              <Input
                key={`${selectedNode.id}-${selectedNode.version}-title`}
                defaultValue={selectedNode.title}
                onBlur={(e) => {
                  if (
                    e.target.value.trim() &&
                    e.target.value !== selectedNode.title
                  )
                    void onUpdateNode(selectedNode.id, {
                      title: e.target.value,
                    }).catch(() => setError("Could not save title"));
                }}
                className="my-2 text-xs"
              />
              <Textarea
                key={`${selectedNode.id}-${selectedNode.version}-body`}
                defaultValue={selectedNode.body}
                onBlur={(e) => {
                  if (e.target.value !== selectedNode.body)
                    void onUpdateNode(selectedNode.id, {
                      body: e.target.value,
                    }).catch(() => setError("Could not save findings"));
                }}
                className="text-xs"
              />
            </div>
          )}
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Share more context or ask for the next step.
            </p>
          ) : (
            messages.slice(-20).map((m) => (
              <div key={m.id} className="mb-3">
                <span className="text-[10px] text-muted-foreground">
                  {m.role === "user"
                    ? "You"
                    : m.role === "assistant"
                      ? "Agent"
                      : "System"}
                </span>
                <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-relaxed">
                  {m.text}
                </p>
              </div>
            ))
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-end gap-2 p-3"
      >
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
          placeholder={
            selectedNode
              ? "Ask this agent or share input…"
              : "Share your vision or next instruction…"
          }
          className="max-h-28 min-h-12 resize-none border-0 bg-black/20 text-xs"
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <Button
          type="submit"
          size="icon"
          variant="secondary"
          disabled={disabled || !text.trim()}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </form>
      {error && (
        <p role="alert" className="px-3 pb-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
