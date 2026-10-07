import { CircleAlert, CircleCheck, Info, Loader2 } from "lucide-react";

export function StatusMessage({
  message,
  className,
}: {
  message: string;
  className: string;
}) {
  const icon =
    /^(Account connected|Timeline refreshed|Imported \d|History disconnected|Disconnected\.)/.test(
      message,
    ) ? (
      <CircleCheck className="size-4 shrink-0 text-emerald-400" />
    ) : /^(Importing|Reading)/.test(message) ? (
      <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
    ) : /^Waiting for connection/.test(message) ? (
      <Info className="size-4 shrink-0 text-muted-foreground" />
    ) : (
      <CircleAlert className="size-4 shrink-0 text-[#ff8a8a]" />
    );
  return (
    <div role="status" className={className}>
      {icon}
      {message}
    </div>
  );
}
