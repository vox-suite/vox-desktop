const DAY_MS = 24 * 60 * 60_000;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function startOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function monthGridDays(date: Date): Date[] {
  const firstDayOfMonth = startOfMonth(date);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const gridStart = addDays(firstDayOfMonth, -startDayOfWeek);

  const lastDayOfMonth = endOfMonth(date);
  const endDayOfWeek = lastDayOfMonth.getDay();
  const trailingDays = 6 - endDayOfWeek;
  const gridEnd = addDays(startOfDay(lastDayOfMonth), trailingDays);

  const totalDays =
    Math.round(
      (gridEnd.getTime() - gridStart.getTime()) / DAY_MS,
    ) + 1;
  const targetDays = totalDays <= 35 ? 35 : 42;

  const days: Date[] = [];
  for (let i = 0; i < targetDays; i++) {
    days.push(addDays(gridStart, i));
  }
  return days;
}
