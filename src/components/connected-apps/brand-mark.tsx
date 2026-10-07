import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandMark({
  brand,
  className,
}: {
  brand: { icon: LucideIcon; color: string; logo?: string; bare?: boolean };
  className?: string;
}) {
  if (brand.logo && brand.bare) {
    return (
      <img
        src={brand.logo}
        alt=""
        className={cn("size-12 shrink-0 object-contain rounded-lg", className)}
      />
    );
  }
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-lg",
        className,
      )}
      style={{
        background: `${brand.color}22`,
        boxShadow: `inset 0 0 0 1px ${brand.color}44`,
      }}
    >
      {brand.logo ? (
        <img src={brand.logo} alt="" className="size-7 object-contain" />
      ) : (
        <brand.icon className="size-6" style={{ color: brand.color }} />
      )}
    </div>
  );
}
