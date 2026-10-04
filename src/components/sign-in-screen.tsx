import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/icons";

export function SignInScreen({
  busy,
  error,
  onSignIn,
}: {
  busy: boolean;
  error: string;
  onSignIn: () => void;
}) {
  return (
    <AuthLayout
      title="Sign in to Vox"
      badge="Desktop"
      description="Talk to your agent, manage tasks, and work with your data — all in one place."
      error={error}
    >
      <Button size="lg" disabled={busy} onClick={onSignIn}>
        <GoogleIcon />
        {busy ? "Waiting for Google…" : "Continue with Google"}
      </Button>
    </AuthLayout>
  );
}
