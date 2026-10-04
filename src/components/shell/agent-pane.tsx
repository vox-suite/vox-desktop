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
    <div className="flex h-full w-full items-end justify-center pb-4">
      <Button
        size="lg"
        variant={isActive || callError ? "destructive" : "secondary"}
        className="pointer-events-auto rounded-full"
        onClick={onToggleCall}
      >
        <VoxLogo animated size={20} state={orbState} className="shrink-0" />
        {text}
      </Button>
    </div>
  );
}
