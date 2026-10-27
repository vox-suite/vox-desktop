import { useEffect, useState } from "react";
import {
  differenceInCalendarDays,
  format,
  parseISO,
  subMonths,
} from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HistoryDatePicker } from "./history-date-picker";
import { platform } from "@/platform";

type Backfill = {
  state?: string | null;
  processed: number;
  imported: number;
  skipped: number;
  start_date?: string | null;
  end_date?: string | null;
};
const path = "/v1/connectors/gmail/backfill";

export function GmailHistorySection() {
  const [startDate, setStartDate] = useState(() =>
    format(subMonths(new Date(), 3), "yyyy-MM-dd"),
  );
  const [endDate, setEndDate] = useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [status, setStatus] = useState<Backfill | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const running = status?.state === "running";
  const busy = loading || starting || running;
  const days = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
  const rangeError =
    days <= 0
      ? "Choose a before date later than the start date."
      : days > 366
        ? "Choose a range of up to one year (366 days)."
        : "";

  useEffect(() => {
    if (starting) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const result = await platform().http.request<Backfill>({
          method: "GET",
          path,
        });
        if (!alive) return;
        setStatus(result);
        setError("");
        if (result.state === "running") {
          if (result.start_date) setStartDate(result.start_date);
          if (result.end_date) setEndDate(result.end_date);
        }
      } catch {
        if (alive)
          setError(
            "Could not refresh import progress. Check again before starting another import.",
          );
      } finally {
        if (alive) {
          setLoading(false);
          timer = setTimeout(() => void load(), 5000);
        }
      }
    };
    void load();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [refresh, starting]);

  const start = async () => {
    if (busy || rangeError) return;
    setStarting(true);
    setError("");
    try {
      const result = await platform().http.request<Backfill>({
        method: "POST",
        path,
        body: { start_date: startDate, end_date: endDate },
      });
      setStatus(result);
      if (result.start_date) setStartDate(result.start_date);
      if (result.end_date) setEndDate(result.end_date);
      setRefresh((value) => value + 1);
    } catch {
      setError(
        "Could not confirm the import started. Refresh progress before trying again.",
      );
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-ink/10 bg-ink/[0.02] p-4">
      <h3 className="text-sm font-medium">Import previous emails</h3>
      <p className="text-sm text-muted-foreground">
        Choose a date range. Vox imports relevant emails in the background and
        sends items needing your input to Updates. You can close the app while
        it runs.
      </p>
      <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <HistoryDatePicker
          label="Start date (included)"
          value={startDate}
          disabled={busy}
          onChange={setStartDate}
        />
        <HistoryDatePicker
          label="Before date (excluded)"
          value={endDate}
          disabled={busy}
          onChange={setEndDate}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Includes the start date and stops before the end date, in UTC. Select up
        to one year of emails.
      </p>
      {rangeError && (
        <p role="alert" className="text-xs text-destructive">
          {rangeError}
        </p>
      )}
      <Button
        variant="outline"
        disabled={busy || !!rangeError || !!error}
        onClick={() => void start()}
      >
        {(starting || running) && <Loader2 className="size-4 animate-spin" />}
        {loading
          ? "Checking import…"
          : starting
            ? "Starting import…"
            : running
              ? "Import in progress"
              : "Start import"}
      </Button>
      {status?.state && (
        <div role="status" className="space-y-1 text-xs text-muted-foreground">
          <p>
            {running
              ? "Import is running on the server."
              : status.state === "done"
                ? "Import complete."
                : "Import paused."}
          </p>
          {status.start_date && status.end_date && (
            <p>
              {format(parseISO(status.start_date), "MMM d, yyyy")} → before{" "}
              {format(parseISO(status.end_date), "MMM d, yyyy")} (UTC)
            </p>
          )}
          <p>
            {status.processed} checked · {status.imported} added ·{" "}
            {status.skipped} skipped
          </p>
        </div>
      )}
      {error && (
        <div role="alert" className="space-y-2 text-xs text-destructive">
          <p>{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLoading(true);
              setRefresh((value) => value + 1);
            }}
          >
            Refresh progress
          </Button>
        </div>
      )}
    </div>
  );
}
