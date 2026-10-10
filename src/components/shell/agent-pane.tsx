import { PageContainer, PageBody } from "@/components/ui/page-container";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { VoxLogo, type VoxOrbVisualState } from "@/components/vox-logo";
import { api } from "@/lib/tauri";
import { useLocalModels } from "@/hooks/use-local-models";

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
  const models = useLocalModels();
  const connecting = callState === "connecting";
  const percent =
    models.total_bytes > 0
      ? Math.min(
          100,
          Math.round((models.downloaded_bytes / models.total_bytes) * 100),
        )
      : 0;
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
      <PageBody
        scroll={false}
        className="flex flex-col items-center justify-end gap-2 pb-4"
      >
        {models.downloading ? (
          <p className="pointer-events-auto text-xs text-muted-foreground">
            Downloading on-device voice… {percent}%
          </p>
        ) : models.error ? (
          <p className="pointer-events-auto text-xs text-muted-foreground">
            Voice download failed.{" "}
            <button
              className="underline"
              onClick={() => void api.downloadLocalModels()}
            >
              Retry
            </button>
          </p>
        ) : null}
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
