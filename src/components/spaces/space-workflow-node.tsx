import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Compass, Database, Globe, Layers, Flag } from "lucide-react";
import type { SpaceNode } from "@/features/spaces/types";
import { nodeAccent, nodeRole } from "./node-accent";
import { NodeContent } from "./node-content";
import { parseBlocks, type Block } from "./node-blocks";
export const SpaceWorkflowNode = memo(function SpaceWorkflowNode({
  data,
  selected,
}: NodeProps) {
  const { node, versions = 0 } = data as unknown as {
    node: SpaceNode;
    versions?: number;
  };
  const execution = node.data.execution as
    { status?: string; role?: string; error?: string } | undefined;
  const role = nodeRole(node);
  const accent = nodeAccent(node);
  const status = execution?.status ?? node.state;
  const Icon =
    node.kind === "goal"
      ? Compass
      : role === "user_data"
        ? Database
        : role === "web_search"
          ? Globe
          : role === "plan"
            ? Flag
            : Layers;
  const running = status === "running";
  const supplied = node.data.blocks;
  const body = execution?.error ?? node.body;
  const scroller = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ top: false, bottom: false });
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setMore((m) =>
      m.top === top && m.bottom === bottom ? m : { top, bottom },
    );
  }, []);
  const wasRunning = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    if (el && running) el.scrollTop = el.scrollHeight;
    if (el && !running && wasRunning.current) el.scrollTop = 0;
    wasRunning.current = running;
    measure();
  }, [body, running, measure]);
  return (
    <div
      className={`space-workflow-node is-${status} ${selected ? "is-selected" : ""}`}
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <Handle type="target" position={Position.Left} id="left" />
      <div className="space-node-head">
        <span className="space-node-icon">
          <Icon className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium capitalize tracking-tight">
          {node.kind === "goal" ? "Your vision" : role.replaceAll("_", " ")}
        </span>
        {node.is_final && <span className="space-node-chip">final</span>}
        <span className="space-node-chip" data-status={status}>
          <i />
          {status}
          {versions > 0 && ` · v${versions + 1}`}
        </span>
      </div>
      <div className="space-workflow-inner">
        <div
          ref={scroller}
          onScroll={measure}
          className="nowheel nopan nodrag plan-workflow-scroll"
        >
          <h3 className="text-base font-medium leading-snug">{node.title}</h3>
          <div className="mt-3">
            <NodeContent
              blocks={
                Array.isArray(supplied)
                  ? (supplied as Block[])
                  : parseBlocks(body)
              }
            />
            {running && <span className="space-workflow-caret" />}
          </div>
        </div>
        <span
          className={`space-workflow-fade top ${more.top ? "is-on" : ""}`}
          aria-hidden
        />
        <span
          className={`space-workflow-fade bottom ${more.bottom ? "is-on" : ""}`}
          aria-hidden
        />
      </div>
      <Handle type="source" position={Position.Right} id="right" />
    </div>
  );
});
