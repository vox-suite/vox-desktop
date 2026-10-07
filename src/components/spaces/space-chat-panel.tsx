import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  Info,
  RotateCw,
  Send,
  Sparkles,
  Target,
  Undo2,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { Space, SpaceMessage, SpaceNode } from "@/features/spaces/types";

export function SpaceChatPanel({
  space,
  messages,
  selectedNode,
  staleNodes,
  sending,
  onSendMessage,
  onUpdateNode,
}: {
  space: Space;
  messages: SpaceMessage[];
  selectedNode: SpaceNode | null;
  staleNodes: SpaceNode[];
  sending: boolean;
  onSendMessage: (msg: string) => Promise<void>;
  onUpdateNode: (
    nodeId: string,
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>,
  ) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingNode, setSavingNode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCommitted = space.state === "committed";

  const nodeKey = selectedNode
    ? `${selectedNode.id}\u0000${selectedNode.title}\u0000${selectedNode.body}`
    : "";
  const [syncedNodeKey, setSyncedNodeKey] = useState("");
  if (nodeKey !== syncedNodeKey) {
    setSyncedNodeKey(nodeKey);
    setEditTitle(selectedNode?.title ?? "");
    setEditBody(selectedNode?.body ?? "");
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, space.run_state]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending || isCommitted) return;
    const msg = text;
    setText("");
    await onSendMessage(msg);
  };

  const handleSaveNode = async () => {
    if (!selectedNode || savingNode || isCommitted) return;
    setSavingNode(true);
    try {
      await onUpdateNode(selectedNode.id, {
        title: editTitle.trim(),
        body: editBody.trim(),
      });
    } finally {
      setSavingNode(false);
    }
  };

  const handleToggleReject = async () => {
    if (!selectedNode || savingNode || isCommitted) return;
    setSavingNode(true);
    try {
      const newState = selectedNode.state === "rejected" ? "done" : "rejected";
      await onUpdateNode(selectedNode.id, { state: newState });
    } finally {
      setSavingNode(false);
    }
  };

  const handleDigDeeper = async () => {
    if (!selectedNode || sending || isCommitted) return;
    await onSendMessage(
      `Dig deeper on "${selectedNode.title}". Research more details, pros, cons, and budget implications.`,
    );
  };

  const handleRerunStale = async () => {
    if (staleNodes.length === 0 || sending || isCommitted) return;
    const titles = staleNodes.map((n) => `"${n.title}"`).join(", ");
    await onSendMessage(
      `Please refresh and re-evaluate the following stale nodes: ${titles}`,
    );
  };

  const hasUnsavedChanges =
    Boolean(selectedNode) &&
    (editTitle !== selectedNode?.title || editBody !== selectedNode?.body);

  const spec = (space.agent_spec ?? {}) as {
    mission?: string;
    look_for?: string[];
    done_when?: string;
  };

  return (
    <Card className="h-full w-full gap-0 rounded-none border-0 py-0 ring-0 backdrop-blur-xl md:w-80">
      <CardHeader className="block border-b border-border p-4 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-foreground" />
          <span>Space chat</span>
        </div>
        <CardTitle className="mt-1 text-base font-bold text-foreground">
          {space.title}
        </CardTitle>
        <CardDescription className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {space.intent}
        </CardDescription>

        {spec.mission && (
          <div className="mt-3 rounded-lg border border-ring bg-primary/20 p-2.5 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <Target className="h-3.5 w-3.5" />
              <span>Mission</span>
            </div>
            <p className="mt-1 text-muted-foreground">{spec.mission}</p>
          </div>
        )}

        {space.run_error && (
          <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/30 p-2.5 text-xs text-destructive">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <span className="break-all">{space.run_error}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const lastUser = [...messages]
                    .reverse()
                    .find((m) => m.role === "user");
                  void onSendMessage(lastUser?.text ?? space.intent);
                }}
                disabled={sending || isCommitted}
                className="h-6 text-[10px] border-destructive/30 hover:bg-destructive/40 text-destructive shrink-0 px-2"
              >
                Retry
              </Button>
            </div>
          </div>
        )}

        {staleNodes.length > 0 && (
          <div className="mt-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleRerunStale()}
              disabled={sending || isCommitted}
              className="w-full border-border bg-muted hover:bg-muted text-muted-foreground text-xs gap-1.5"
            >
              <RotateCw
                className={`h-3 w-3 ${sending ? "animate-spin" : ""}`}
              />
              <span>Re-run stale ({staleNodes.length})</span>
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {selectedNode ? (
          <Card
            size="sm"
            className="gap-0 border border-border bg-card p-4 ring-0"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="uppercase tracking-wider font-mono text-[10px] text-muted-foreground">
                Selected Node
              </span>
              <span className="rounded bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {selectedNode.kind}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">
                  Title
                </label>
                <Input
                  type="text"
                  value={editTitle}
                  disabled={isCommitted}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-0.5 h-7 text-xs"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-muted-foreground">
                  Body
                </label>
                <Textarea
                  value={editBody}
                  rows={3}
                  disabled={isCommitted}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="mt-0.5 min-h-0 resize-none text-xs"
                />
              </div>

              {hasUnsavedChanges && (
                <Button
                  size="sm"
                  onClick={() => void handleSaveNode()}
                  disabled={savingNode || isCommitted}
                  className="h-7 w-full gap-1 text-xs"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </Button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleToggleReject()}
                disabled={savingNode || isCommitted}
                className={`flex-1 text-xs h-7 gap-1 ${
                  selectedNode.state === "rejected"
                    ? "border-border text-muted-foreground hover:bg-muted"
                    : "border-destructive/30 text-destructive hover:bg-destructive/20"
                }`}
              >
                {selectedNode.state === "rejected" ? (
                  <>
                    <Undo2 className="h-3 w-3" />
                    <span>Restore</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" />
                    <span>Reject</span>
                  </>
                )}
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleDigDeeper()}
                disabled={sending || isCommitted}
                className="flex-1 text-xs h-7 gap-1 border-border text-muted-foreground hover:bg-accent"
              >
                <Sparkles className="h-3 w-3 text-foreground" />
                <span>Dig deeper</span>
              </Button>
            </div>
          </Card>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground border border-dashed border-border rounded-xl p-4">
            <Info className="h-6 w-6 stroke-1 text-muted-foreground mb-1.5" />
            <p className="text-xs">
              Click any node in the canvas to view or edit details,
              reject/restore, or dig deeper.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Conversation History
          </span>
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              No messages yet.
            </p>
          ) : (
            messages.map((m) => (
              <Card
                size="sm"
                key={m.id}
                className={`gap-0 rounded-xl p-3 ring-0 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary/20 border border-ring text-foreground ml-4"
                    : m.role === "system"
                      ? "bg-destructive/20 border border-destructive/40 text-destructive font-mono text-[11px]"
                      : "bg-card border border-border text-muted-foreground mr-4"
                }`}
              >
                <CardHeader className="flex items-center justify-between gap-2 px-0 mb-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  <span>{m.role}</span>
                  <span>
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </CardHeader>
                <CardContent className="px-0 whitespace-pre-wrap">
                  {m.text}
                </CardContent>
              </Card>
            ))
          )}

          {space.run_state === "running" && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/30 border border-ring p-3 text-xs text-foreground mr-4">
              <RotateCw className="h-3.5 w-3.5 animate-spin text-foreground" />
              <span>Working… researching and generating nodes</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </CardContent>

      <CardFooter className="border-t border-border p-3 bg-card shrink-0">
        <form
          onSubmit={(e) => void handleSend(e)}
          className="flex w-full items-center gap-2"
        >
          <Input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isCommitted
                ? "Space is committed (read-only)"
                : "Steer the plan... (e.g. 'Make it a day trip')"
            }
            disabled={sending || isCommitted}
            className="flex-1 text-xs"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || !text.trim() || isCommitted}
            aria-label="Send message"
            className="bg-primary hover:bg-primary text-foreground px-3"
          >
            {sending ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
