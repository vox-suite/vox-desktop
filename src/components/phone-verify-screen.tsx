import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth-layout";
import { Input } from "@/components/ui/input";
import { invokeErrorMessage } from "@/lib/tauri";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export function PhoneVerifyScreen({
  autoSend,
  onSend,
  onConfirm,
  onSkip,
}: {
  autoSend: boolean;
  onSend: () => Promise<string>;
  onConfirm: (code: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [last4, setLast4] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const autoSentRef = useRef(false);

  async function send() {
    setBusy(true);
    setError("");
    try {
      setLast4(await onSend());
      setSent(true);
      setCode("");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(invokeErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    setBusy(true);
    setError("");
    try {
      await onConfirm(code);
    } catch (err) {
      setError(invokeErrorMessage(err));
      setBusy(false);
    }
  }

  useEffect(() => {
    if (autoSend && !autoSentRef.current) {
      autoSentRef.current = true;
      void send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSend]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const codeReady = code.length === CODE_LENGTH;

  return (
    <AuthLayout
      title="Verify your number"
      badge="WhatsApp"
      description={
        sent
          ? `We sent a ${CODE_LENGTH}-digit code on WhatsApp to the number ending in ${last4 || "your phone"}. It expires in 10 minutes.`
          : "Confirm the number you linked so Vox can safely reach you. We'll send a code on WhatsApp."
      }
      error={error}
    >
      {sent ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (codeReady && !busy) void confirm();
          }}
        >
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder="123456"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
            }
            disabled={busy}
          />
          <Button type="submit" size="lg" disabled={busy || !codeReady}>
            {busy ? "Verifying…" : "Verify"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={busy || cooldown > 0}
            onClick={() => void send()}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
          </Button>
        </form>
      ) : (
        <Button size="lg" disabled={busy} onClick={() => void send()}>
          {busy ? "Sending…" : "Send code"}
        </Button>
      )}
      <Button type="button" variant="ghost" disabled={busy} onClick={onSkip}>
        Verify later
      </Button>
    </AuthLayout>
  );
}
