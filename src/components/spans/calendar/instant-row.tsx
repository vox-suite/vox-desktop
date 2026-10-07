import type { PlacedSpan } from "@/lib/span-layout";
import type { Span } from "@/features/spans/types";
import { INDENT_PX, QUARTER_PX } from "./constants";
import { InstantChip } from "./instant-chip";

export function InstantRow({
  items,
  onSelect,
}: {
  items: PlacedSpan[];
  onSelect: (span: Span) => void;
}) {
  const { slot = 0, left, width, depth } = items[0];
  const inset = depth * INDENT_PX;

  return (
    <div
      data-no-drag
      className="pointer-events-none absolute flex flex-row items-center gap-2 overflow-x-auto px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{
        top: slot * QUARTER_PX,
        height: QUARTER_PX,
        left: `calc(${left * 100}% + ${inset + 3}px)`,
        width: `calc(${width * 100}% - ${inset + 6}px)`,
        zIndex: depth + 50,
      }}
    >
      {items.map((placed) => (
        <InstantChip
          key={placed.span.id}
          span={placed.span}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
