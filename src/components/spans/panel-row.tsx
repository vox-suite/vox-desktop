import type { ComponentType, ReactNode } from "react";
import type { LucideProps } from "lucide-react";

export function PanelRow({
  icon: RowIcon,
  label,
  children,
}: {
  icon: ComponentType<LucideProps>;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-3 py-2">
      <div className="flex items-center gap-2 pt-1 text-[13px] text-muted-foreground">
        <RowIcon className="size-3.5 shrink-0" />
        {label}
      </div>
      <div className="min-w-0 text-sm">{children}</div>
    </div>
  );
}
