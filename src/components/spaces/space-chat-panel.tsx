import { useState } from "react";
import {
  Send,
  Sparkles,
  Info,
  RotateCw,
  FileText,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Space, SpaceNode } from "@/lib/spaces";

export function SpaceChatPanel({
  space,
  selectedNode,
  sending,
  onSendMessage,
}: {
  space: Space;
  selectedNode: SpaceNode | null;
  sending: boolean;
  onSendMessage: (msg: string) => Promise<void>;
}) {
  const [text, setText] = useState("");

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    const msg = text;
    setText("");
    await onSendMessage(msg);
  };

  const handleDigDeeper = async () => {
    if (!selectedNode || sending) return;
    await onSendMessage(`Dig deeper on "${selectedNode.title}". Research more details, pros, cons, and budget implications.`);
  };

  const spec = (space.agent_spec ?? {}) as {
    mission?: string;
    look_for?: string[];
    done_when?: string;
  };

  return (
    <div className="flex h-full w-80 sm:w-96 flex-col border-l border-zinc-800/80 bg-zinc-950/70 backdrop-blur-xl">
      <div className="border-b border-zinc-800/80 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
          <span>Space Intelligence</span>
        </div>
        <h2 className="mt-1 text-base font-bold text-zinc-100">{space.title}</h2>
        <p className="mt-1 text-xs text-zinc-400 line-clamp-3 leading-relaxed">
          {space.intent}
        </p>

        {spec.mission && (
          <div className="mt-3 rounded-lg border border-indigo-900/40 bg-indigo-950/20 p-2.5 text-xs text-zinc-300">
            <div className="flex items-center gap-1.5 font-medium text-indigo-300">
              <Target className="h-3.5 w-3.5" />
              <span>Mission</span>
            </div>
            <p className="mt-1 text-zinc-400">{spec.mission}</p>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {selectedNode ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="uppercase tracking-wider font-mono text-[10px] text-zinc-400">
                Selected Node
              </span>
              <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300">
                {selectedNode.kind}
              </span>
            </div>
            <h4 className="mt-2 text-sm font-semibold text-zinc-100">
              {selectedNode.title}
            </h4>
            {selectedNode.body && (
              <p className="mt-2 text-xs text-zinc-400 leading-relaxed whitespace-pre-wrap">
                {selectedNode.body}
              </p>
            )}

            {selectedNode.provenance && Object.keys(selectedNode.provenance).length > 0 && (
              <div className="mt-3 border-t border-zinc-800 pt-2 text-[11px] text-zinc-500">
                <span className="font-semibold text-zinc-400">Provenance:</span>
                <pre className="mt-1 overflow-x-auto rounded bg-black/40 p-2 text-[10px] font-mono text-zinc-400">
                  {JSON.stringify(selectedNode.provenance, null, 2)}
                </pre>
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => void handleDigDeeper()}
              disabled={sending}
              className="mt-3 w-full border-zinc-700 hover:bg-zinc-800 text-xs gap-1.5 text-zinc-200"
            >
              <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              <span>Dig deeper on this</span>
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-500">
            <Info className="h-8 w-8 stroke-1 text-zinc-600 mb-2" />
            <p className="text-xs">
              Click any node in the canvas to view data evidence, provenance, or explore alternatives.
            </p>
          </div>
        )}

        {spec.look_for && spec.look_for.length > 0 && (
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-3">
            <span className="text-[11px] font-semibold text-zinc-400 flex items-center gap-1.5 mb-2">
              <FileText className="h-3.5 w-3.5 text-sky-400" />
              Exploration Focus
            </span>
            <ul className="space-y-1.5 text-xs text-zinc-400">
              {spec.look_for.map((item, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-zinc-600 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="border-t border-zinc-800/80 p-3 bg-zinc-950/90">
        <form onSubmit={(e) => void handleSend(e)} className="flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Steer the plan... (e.g. 'Make it a day trip')"
            disabled={sending}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none"
          />
          <Button
            type="submit"
            size="sm"
            disabled={sending || !text.trim()}
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
