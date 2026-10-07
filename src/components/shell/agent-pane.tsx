import { PageContainer, PageBody } from "@/components/ui/page-container";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VoxLogo, type VoxOrbVisualState } from "@/components/vox-logo";

export function AgentPane({
  isActive,
  callState,
  callError,
  onToggleCall,
}: {
  isActive: boolean;
  callState: string;
  callError: string;
  onToggleCall: () => void;
}) {
  const connecting = callState === "connecting";
  const orbState: VoxOrbVisualState = callError
    ? "error"
    : isActive
      ? "active"
      : connecting
        ? "connecting"
        : "idle";

  const text = callError
    ? "Error connecting"
    : isActive
      ? "End call"
      : connecting
        ? "Connecting…"
        : "Talk to Vox";

  return (
    <PageContainer className="bg-transparent">
      <PageBody scroll={false} className="flex items-end justify-center pb-4">
        <Button
          size="lg"
          variant={isActive || callError ? "destructive" : "ghost"}
          className={cn(
            "pointer-events-auto rounded-full",
            !(isActive || callError) &&
              "border border-sidebar-border bg-black/25 text-foreground backdrop-blur-[30px] backdrop-saturate-150 hover:bg-black/35",
          )}
          onClick={onToggleCall}
        >
          <VoxLogo animated size={20} state={orbState} className="shrink-0" />
          {text}
        </Button>
      </PageBody>
    </PageContainer>
  );
}
