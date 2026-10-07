import { PanelEdgeBlur } from "@/components/panel-edge-blur";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Collection, Span } from "@/features/spans/types";
import { PanelBody } from "./spans";

export function SpanPanel({
  span,
  collections,
  onClose,
  onSaved,
}: {
  span: Span | null;
  collections: Collection[];
  onClose: () => void;
  onSaved: () => void;
}) {
  return (
    <Sheet
      modal={false}
      open={!!span}
      onOpenChange={(open) => !open && onClose()}
    >
      <SheetContent
        side="right"
        overlay={false}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        data-span-panel="true"
        className="z-30 isolate w-full gap-0 overflow-visible border-[#292929] bg-[#0c0d10] sm:max-w-lg [&_[data-slot=sheet-close]]:top-6"
      >
        <PanelEdgeBlur selector="[data-span-panel]" edge="left" />
        <div className="vox-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
          {span ? (
            <PanelBody
              key={span.id}
              initial={span}
              collections={collections}
              onClose={onClose}
              onSaved={onSaved}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
