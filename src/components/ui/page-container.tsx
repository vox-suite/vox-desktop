import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Shared desktop page frame. Headers stay outside the scrollable body. */
export function PageContainer({
  className,
  ...props
}: ComponentProps<"section">) {
  return (
    <section
      data-page-container
      className={cn(
        "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export function PageHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      data-page-header
      className={cn(
        "relative shrink-0 flex items-center justify-between gap-4 border-b border-border bg-background px-6 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function PageBody({
  className,
  scroll = true,
  ...props
}: ComponentProps<"div"> & { scroll?: boolean }) {
  return (
    <div
      data-page-body
      className={cn(
        "relative min-h-0 flex-1",
        scroll ? "overflow-auto" : "overflow-hidden",
        className,
      )}
      {...props}
    />
  );
}
