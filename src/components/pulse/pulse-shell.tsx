import {
  PageContainer,
  PageHeader,
  PageBody,
} from "@/components/ui/page-container";
import type { ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import "./pulse.css";

export function PulseShell({
  header,
  glow = false,
  label,
  scroll = true,
  children,
}: {
  header: ReactNode;
  glow?: boolean;
  label?: string;
  scroll?: boolean;
  children: ReactNode;
}) {
  return (
    <PageContainer
      aria-label={label}
      className="pulse-surface relative flex h-full w-full flex-col overflow-hidden"
    >
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-96"
          style={{
            background:
              "radial-gradient(ellipse 70% 100% at 100% 0%, #3ecf8e55 0%, #3ecf8e22 40%, #3ecf8e0a 65%, transparent 85%)",
          }}
        />
      )}
      <PageHeader className="relative z-10 flex items-center justify-between gap-4 border-b border-border px-6 py-3">
        {header}
      </PageHeader>
      <PageBody scroll={false} className="flex flex-col">
        {scroll ? (
          <ScrollArea className="pulse-scroll relative min-h-0 flex-1">
            {children}
          </ScrollArea>
        ) : (
          <div className="relative min-h-0 flex-1">{children}</div>
        )}
      </PageBody>
    </PageContainer>
  );
}
