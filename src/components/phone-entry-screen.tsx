import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth-layout";
import { Input } from "@/components/ui/input";

// E.164: a leading "+", then 7-15 digits, first digit non-zero.
// Matches what Twilio reports for an inbound call's caller id.
const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function PhoneEntryScreen({
  busy,
  error,
  onSubmit,
}: {
  busy: boolean;
  error: string;
  onSubmit: (phoneNumber: string) => void;
}) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const normalized = phoneNumber.replace(/[\s()-]/g, "");
  const isValid = E164_REGEX.test(normalized);

  return (
    <AuthLayout
      title="Your number"
      badge="Desktop"
      description="Add the phone number you call Vox from, so it recognizes you and your tasks show up here too. Anyone who later enters this number will inherit its history — only use a number that's yours."
      error={error}
    >
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (isValid) onSubmit(normalized);
        }}
      >
        <Input
          type="tel"
          placeholder="+1 555 000 1234"
          value={phoneNumber}
          onChange={(event) => setPhoneNumber(event.target.value)}
          disabled={busy}
        />
        <Button type="submit" size="lg" disabled={busy || !isValid}>
          {busy ? "Saving…" : "Continue"}
        </Button>
        {!error && phoneNumber.trim() && !isValid ? (
          <p className="text-xs text-muted-foreground">
            Include the country code with a leading +, e.g. +15550001234
          </p>
        ) : null}
      </form>
    </AuthLayout>
  );
}
