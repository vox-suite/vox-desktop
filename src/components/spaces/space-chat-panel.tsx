import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  FileText,
  Info,
  RotateCw,
  Send,
  Sparkles,
  Target,
  Undo2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Space, SpaceMessage, SpaceNode } from "@/lib/spaces";

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
    patch: Partial<Pick<SpaceNode, "title" | "body" | "state" | "position">>
  ) => Promise<unknown>;
}) {
  const [text, setText] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [savingNode, setSavingNode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCommitted = space.state === "committed";

  useEffect(() => {
    if (selectedNode) {
      setEditTitle(selectedNode.title);
      setEditBody(selectedNode.body);
    } else {
      setEditTitle("");
      setEditBody("");
    }
  }, [selectedNode?.id, selectedNode?.title, selectedNode?.body]);

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
      `Dig deeper on "${selectedNode.title}". Research more details, pros, cons, and budget implications.`
    );
  };

  const handleRerunStale = async () => {
    if (staleNodes.length === 0 || sending || isCommitted) return;
    const titles = staleNodes.map((n) => `"${n.title}"`).join(", ");
    await onSendMessage(
      `Please refresh and re-evaluate the following stale nodes: ${titles}`
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
    <div className="flex h-full w-80 sm:w-96 flex-col border-l border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">
      <div className="border-b border-zinc-800/80 p-4 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>Space Intelligence</span>
        </div>
        <h2 className="mt-1 text-base font-bold text-zinc-100">{space.title}</h2>
        <p className="mt-1 text-xs text-zinc-400 line-clamp-2 leading-relaxed">
          {space.intent}
        </p>

        {space.run_error && (
          <div className="mt-3 rounded-lg border border-red-500/40 bg-red-950/30 p-2.5 text-xs text-red-200">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5">
                <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
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
                className="h-6 text-[10px] border-red-500/30 hover:bg-red-900/40 text-red-200 shrink-0 px-2"
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
              className="w-full border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs gap-1.5"
            >
              <RotateCw className={`h-3 w-3 ${sending ? "animate-spin" : ""}`} />
              <span>Re-run stale ({staleNodes.length})</span>
            </Button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedNode ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
              <span className="uppercase tracking-wider font-mono text-[10px] text-zinc-400">
                Selected Node
              </span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                {selectedNode.kind}
              </span>
            </div>

            <div className="space-y-2">
              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-500">
                  Title
                </label>
                <input
                  type="text"
                  value={editTitle}
                  disabled={isCommitted}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono uppercase text-zinc-500">
                  Body
                </label>
                <textarea
                  value={editBody}
                  rows={3}
                  disabled={isCommitted}
                  onChange={(e) => setEditBody(e.target.value)}
                  className="mt-0.5 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none resize-none leading-relaxed disabled:opacity-60"
                />
              </div>

              {hasUnsavedChanges && (
                <Button
                  size="sm"
                  onClick={() => void handleSaveNode()}
                  disabled={savingNode || isCommitted}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-7 gap-1"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </Button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-zinc-800/80 pt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void handleToggleReject()}
                disabled={savingNode || isCommitted}
                className={`flex-1 text-xs h-7 gap-1 ${
                  selectedNode.state === "rejected"
                    ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-950/20"
                    : "border-red-500/30 text-red-300 hover:bg-red-950/20"
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
                className="flex-1 text-xs h-7 gap-1 border-zinc-700 text-zinc-200 hover:bg-zinc-800"
              >
                <Sparkles className="h-3 w-3 text-indigo-400" />
                <span>Dig deeper</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-6 text-center text-zinc-500 border border-dashed border-zinc-800/80 rounded-xl p-4">
            <Info className="h-6 w-6 stroke-1 text-zinc-600 mb-1.5" />
            <p className="text-xs">
              Click any node in the canvas to view or edit details, reject/restore, or dig deeper.
            </p>
          </div>
        )}

        <div className="space-y-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
            Conversation History
          </span>
          {messages.length === 0 ? (
            <p className="text-xs text-zinc-600 italic">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl p-3 text-xs leading-relaxed ${
                  m.role === "user"
                    ? "bg-indigo-600/20 border border-indigo-500/30 text-zinc-100 ml-4"
                    : m.role === "system"
                    ? "bg-red-950/20 border border-red-900/40 text-red-300 font-mono text-[11px]"
                    : "bg-zinc-900/80 border border-zinc-800/80 text-zinc-200 mr-4"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1 text-[10px] text-zinc-500 font-medium uppercase tracking-wider">
                  <span>{m.role}</span>
                  <span>
                    {new Date(m.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap">{m.text}</p>
              </div>
            ))
          )}

          {space.run_state === "running" && (
            <div className="flex items-center gap-2 rounded-xl bg-indigo-950/30 border border-indigo-500/20 p-3 text-xs text-indigo-300 mr-4">
              <RotateCw className="h-3.5 w-3.5 animate-spin text-indigo-400" />
              <span>Working… researching and generating nodes</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      <div className="border-t border-zinc-800/80 p-3 bg-zinc-950/90 shrink-0">
        <form onSubmit={(e) => void handleSend(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              isCommitted
                ? "Space is committed (read-only)"
                : "Steer the plan... (e.g. 'Make it a day trip')"
            }
            disabled={sending || isCommitted}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || !text.trim() || isCommitted}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3"
          >
            {sending ? (
              <RotateCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
