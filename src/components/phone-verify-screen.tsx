import { useEffect, useRef, useState } from "react";
import { Badge } from "@vox/ui/ui/badge";
import { Button } from "@vox/ui/ui/button";
import { Card } from "@vox/ui/ui/card";
import { Input } from "@vox/ui/ui/input";
import { VoxLogo } from "@vox/ui/logo";
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
    <main
      className="relative flex h-full w-full flex-col overflow-hidden bg-void-black"
      tabIndex={0}
    >
      <div
        className="sign-in-glow pointer-events-none absolute -left-32 -top-36 h-[34rem] w-[34rem]"
        aria-hidden
      />
      <div
        className="sign-in-noise pointer-events-none absolute inset-0"
        aria-hidden
      />
      <div className="fixed inset-x-0 top-0 z-50 h-3" data-tauri-drag-region />
      <div
        className="relative z-10 flex flex-1 flex-col items-center justify-center gap-7 px-6"
        data-tauri-drag-region
      >
        <VoxLogo size={120} animated state={error ? "error" : "idle"} />
        <div className="flex w-full max-w-105 flex-col items-center text-center">
          <div className="mb-2 inline-flex items-center gap-2">
            <h1 className="text-[32px] font-normal leading-[1.15] text-pure-white">
              Verify your number
            </h1>
            <Badge
              variant="secondary"
              className="font-mono text-[10px] uppercase tracking-wider"
            >
              WhatsApp
            </Badge>
          </div>
          <p className="mb-7 max-w-80 text-sm text-ash">
            {sent
              ? `We sent a ${CODE_LENGTH}-digit code on WhatsApp to the number ending in ${last4 || "your phone"}. It expires in 10 minutes.`
              : "Confirm the number you linked so Vox can safely reach you. We'll send a code on WhatsApp."}
          </p>
          <Card className="shadow-key w-full border-0 bg-transparent p-1.5">
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
                    setCode(
                      event.target.value
                        .replace(/\D/g, "")
                        .slice(0, CODE_LENGTH),
                    )
                  }
                  disabled={busy}
                />
                <Button
                  type="submit"
                  className="shadow-btn-lift h-11 w-full"
                  disabled={busy || !codeReady}
                >
                  {busy ? "Verifying…" : "Verify"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 w-full"
                  disabled={busy || cooldown > 0}
                  onClick={() => void send()}
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </Button>
              </form>
            ) : (
              <div className="flex flex-col gap-3">
                <Button
                  type="button"
                  className="shadow-btn-lift h-11 w-full"
                  disabled={busy}
                  onClick={() => void send()}
                >
                  {busy ? "Sending…" : "Send code"}
                </Button>
              </div>
            )}
            {error ? (
              <p className="mt-3 text-center text-xs text-coral-pulse">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              className="mt-2 h-9 w-full"
              disabled={busy}
              onClick={onSkip}
            >
              Verify later
            </Button>
          </Card>
        </div>
      </div>
    </main>
  );
}
