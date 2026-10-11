import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import type { ContextNode, Citation } from "@/features/projects/types";
export function ContextEditor({
  node,
  busy,
  onClose,
  onSave,
  onRead,
  onReview,
  onRemove,
}: {
  node: ContextNode;
  busy: boolean;
  onClose: () => void;
  onSave: (n: ContextNode) => Promise<void>;
  onRead: (c: Citation) => void;
  onReview: (n: ContextNode) => Promise<ContextNode>;
  onRemove: () => Promise<void>;
}) {
  const [title, setTitle] = useState(node.title);
  const [kind, setKind] = useState(node.kind);
  const [body, setBody] = useState(node.body);
  const [error, setError] = useState("");
  const save = async (n: ContextNode) => {
    setError("");
    try {
      await onSave(n);
      onClose();
    } catch (e) {
      setError(String(e));
    }
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit context</DialogTitle>
          <DialogDescription>
            {node.stale
              ? "Its source changed. Review the new source before relying on this claim."
              : node.origin === "inferred"
                ? "This is an inferred claim. Review it against its sources."
                : node.origin === "user"
                  ? "Your edits take precedence over generated context."
                  : "Extracted structure from your local sources."}
          </DialogDescription>
        </DialogHeader>
        <label className="grid gap-2 text-xs">
          Title
          <Input
            value={title}
            maxLength={300}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label className="grid gap-2 text-xs">
          Kind
          <select
            className="rounded-md border bg-background p-2 text-sm"
            value={kind}
            onChange={(e) => setKind(e.target.value)}
          >
            {[
              "goal",
              "component",
              "decision",
              "constraint",
              "question",
              "asset",
              "milestone",
            ].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-xs">
          Context
          <Textarea
            value={body}
            maxLength={12000}
            rows={8}
            onChange={(e) => setBody(e.target.value)}
          />
        </label>
        <div className="space-y-1">
          {node.citations.map((c, i) => (
            <button
              className="block text-left text-xs text-sky-300 hover:underline"
              key={i}
              onClick={() => onRead(c)}
            >
              {c.path}:{c.start_line}–{c.end_line}
            </button>
          ))}
          {!node.citations.length && (
            <p className="text-xs text-muted-foreground">
              {node.origin === "user"
                ? "User statement"
                : "Assumption · no source cited"}
            </p>
          )}
        </div>
        {node.stale && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => {
              setError("");
              void onReview({ ...node, title, body })
                .then(save)
                .catch((e) => setError(String(e)));
            }}
          >
            I reviewed the updated sources
          </Button>
        )}
        {node.history.length > 0 && (
          <details className="rounded-lg border p-3 text-xs">
            <summary className="cursor-pointer">
              Earlier versions ({node.history.length})
            </summary>
            <div className="mt-3 space-y-3">
              {[...node.history].reverse().map((version, i) => (
                <div key={i} className="border-t pt-3">
                  <strong>{version.title}</strong>
                  <p className="my-2 whitespace-pre-wrap text-muted-foreground">
                    {version.body}
                  </p>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() =>
                      void save({
                        ...node,
                        ...version,
                        origin: "user",
                        stale: true,
                      })
                    }
                  >
                    Use this version
                  </Button>
                </div>
              ))}
            </div>
          </details>
        )}
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            className="mr-auto text-destructive"
            disabled={busy}
            onClick={() => {
              void onRemove()
                .then(onClose)
                .catch((e) => setError(String(e)));
            }}
          >
            Remove context
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={busy || !title.trim() || !body.trim()}
            onClick={() =>
              void save({
                ...node,
                kind,
                title: title.trim(),
                body: body.trim(),
                origin: "user",
                stale: node.stale,
              })
            }
          >
            Save context
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
