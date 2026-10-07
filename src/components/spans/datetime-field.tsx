import { useState } from "react";
import { Clock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatDate, toLocalInput } from "./span-date-utils";

export function DateTimeField({
  value,
  disabled,
  placeholder,
  clearable,
  onCommit,
}: {
  value: string | null | undefined;
  disabled: boolean;
  placeholder: string;
  clearable?: boolean;
  onCommit: (iso: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date | undefined>();
  const [time, setTime] = useState("00:00");
  const shown = value ? formatDate(value) : null;

  const onOpenChange = (next: boolean) => {
    if (next) {
      const d = value ? new Date(value) : new Date();
      setDay(d);
      setTime(toLocalInput(d.toISOString()).slice(11));
    }
    setOpen(next);
  };

  const apply = () => {
    if (!day) return;
    const [h, m] = time.split(":").map(Number);
    const next = new Date(day);
    next.setHours(h || 0, m || 0, 0, 0);
    setOpen(false);
    if (!value || next.getTime() !== new Date(value).getTime()) {
      onCommit(next.toISOString());
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "group -mx-2 flex w-[calc(100%+1rem)] items-center gap-2 rounded-md px-2 py-1 text-left transition",
            !disabled && "hover:bg-white/[0.05]",
          )}
        >
          {shown ? (
            <span className="min-w-0">
              <span className="font-medium">{shown.date}</span>
              <span className="text-muted-foreground"> at {shown.time}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          {!disabled && (
            <Pencil className="ml-auto size-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={day}
          onSelect={setDay}
          defaultMonth={day}
        />
        <div className="flex items-center gap-2 bg-white/[0.03] p-3">
          <Clock className="size-3.5 shrink-0 text-muted-foreground" />
          <Input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-8 w-32"
          />
          {clearable && value ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                onCommit(null);
              }}
            >
              Clear
            </Button>
          ) : null}
          <Button size="sm" className="ml-auto" disabled={!day} onClick={apply}>
            Set
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
