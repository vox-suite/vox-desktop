import { Fragment } from "react";
import {
  BedDouble,
  Bus,
  CircleDot,
  Clock,
  ThumbsDown,
  ThumbsUp,
  Utensils,
  Wallet,
} from "lucide-react";
import type { Block } from "./node-blocks";

const MONEY = /(₹\s?[\d,]+(?:\.\d+)?(?:\s?[-–]\s?₹?\s?[\d,]+)?)/g;

function labelIcon(label: string) {
  const l = label.toLowerCase();
  if (/transport|travel|drive|bus|cab|route/.test(l)) return Bus;
  if (/stay|hotel|accommodation|lodging/.test(l)) return BedDouble;
  if (/food|dining|meal|eat/.test(l)) return Utensils;
  if (/cost|price|budget|total|fee|spend/.test(l)) return Wallet;
  if (/pro/.test(l)) return ThumbsUp;
  if (/con|risk/.test(l)) return ThumbsDown;
  if (/time|duration|when/.test(l)) return Clock;
  return CircleDot;
}

function labelTone(label: string) {
  const l = label.toLowerCase();
  if (/^pros?$/.test(l)) return "text-emerald-400";
  if (/^cons?$/.test(l)) return "text-rose-400";
  return "text-muted-foreground";
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(MONEY).map((part, i) =>
        i % 2 ? (
          <span
            key={i}
            className="whitespace-nowrap rounded-md bg-white/[0.07] px-1.5 py-px font-medium text-foreground"
          >
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

export function NodeContent({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-3 text-[14px] leading-relaxed text-foreground/70">
      {blocks.map((block, index) => {
        if (block.kind === "kv") {
          const Icon = labelIcon(block.label);
          return (
            <div key={index} className="flex flex-col gap-1">
              <span
                className={`flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider ${labelTone(block.label)}`}
              >
                <Icon className="size-3.5" />
                {block.label}
              </span>
              <span className="text-foreground/90">
                <Rich text={block.value} />
              </span>
            </div>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={index} className="flex flex-col gap-1.5">
              {block.items.map((item, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>
                    <Rich text={item} />
                  </span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.kind === "day") {
          return (
            <div key={index} className="flex flex-col gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-foreground">
                {block.label}
              </span>
              <ol className="ml-1.5 flex flex-col border-l border-white/10">
                {block.steps.map((step, i) => (
                  <li key={i} className="relative pb-2.5 pl-4 last:pb-0">
                    <span className="absolute -left-[0.5px] top-[9px] size-1.5 -translate-x-1/2 rounded-full bg-white/40" />
                    <Rich text={step} />
                  </li>
                ))}
              </ol>
            </div>
          );
        }
        return (
          <p key={index}>
            <Rich text={block.text} />
          </p>
        );
      })}
    </div>
  );
}
