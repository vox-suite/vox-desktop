import { PageContainer, PageBody } from "@/components/ui/page-container";

export function AgentPane({
  isActive,
  callError,
}: {
  isActive: boolean;
  callState: string;
  callError: string;
  onToggleCall: () => void;
}) {
  return (
    <PageContainer className="bg-transparent">
      <PageBody scroll={false} className="flex items-center justify-end pb-5">
        <p className="text-xs text-muted-foreground">
          {callError ||
            (isActive
              ? "Your space stays in view while you talk."
              : null)}
        </p>
      </PageBody>
    </PageContainer>
  );
}
