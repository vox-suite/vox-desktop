const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const ZONE_MINUTES: Record<string, number> = {
  Z: 0,
  UTC: 0,
  GMT: 0,
  WET: 0,
  WEST: 60,
  BST: 60,
  CET: 60,
  CEST: 120,
  EET: 120,
  EEST: 180,
  MSK: 180,
  IST: 330,
  PKT: 300,
  ICT: 420,
  WIB: 420,
  SGT: 480,
  HKT: 480,
  AWST: 480,
  PHT: 480,
  JST: 540,
  KST: 540,
  ACST: 570,
  AEST: 600,
  AEDT: 660,
  NZST: 720,
  NZDT: 780,
  NST: -210,
  AST: -240,
  ADT: -180,
  EST: -300,
  EDT: -240,
  CST: -360,
  CDT: -300,
  MST: -420,
  MDT: -360,
  PST: -480,
  PDT: -420,
  AKST: -540,
  AKDT: -480,
  HST: -600,
};

function zoneMinutes(zone: string): number | null {
  const z = zone.toUpperCase();
  if (z in ZONE_MINUTES) return ZONE_MINUTES[z];
  const m = /^(?:GMT|UTC)?([+-\u2212])(\d{1,2})(?::?(\d{2}))?$/.exec(z);
  if (!m) return null;
  return (m[1] === "+" ? 1 : -1) * (Number(m[2]) * 60 + Number(m[3] ?? 0));
}

function toIso(raw: string): string | null {
  const text = raw.replace(/[\u00a0\u202f\u2009]/g, " ").trim();
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp])\.?[Mm]\.?)?/.exec(
    text,
  );
  if (!time) return null;
  const date = text.slice(0, time.index);
  const zone = text
    .slice(time.index + time[0].length)
    .trim()
    .replace(/^\(|\)$/g, "");
  let year: number, month: number, day: number;
  let m: RegExpExecArray | null;
  if ((m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(date))) {
    [year, month, day] = [+m[1], +m[2] - 1, +m[3]];
  } else if ((m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(date))) {
    const [x, y] = [+m[1], +m[2]];
    [year, month, day] =
      x > 12 || m[0].includes(".") ? [+m[3], y - 1, x] : [+m[3], x - 1, y];
  } else {
    const name = /([A-Za-z]{3,})\.?/.exec(date)?.[1].slice(0, 3).toLowerCase();
    const idx = MONTHS.findIndex((n) => n.toLowerCase() === name);
    const nums = date.match(/\d+/g)?.map(Number) ?? [];
    const y = nums.find((n) => n > 31);
    const d = nums.find((n) => n >= 1 && n <= 31);
    if (idx < 0 || y === undefined || d === undefined) return null;
    [year, month, day] = [y, idx, d];
  }
  let hour = Number(time[1]);
  if (time[4]) hour = (hour % 12) + (time[4].toLowerCase() === "p" ? 12 : 0);
  const parts = [
    year,
    month,
    day,
    hour,
    Number(time[2]),
    Number(time[3] ?? 0),
  ] as const;
  const offset = zone ? zoneMinutes(zone) : null;
  const ms = Date.UTC(...parts);
  const when =
    offset === null
      ? new Date(parts[0], parts[1], parts[2], parts[3], parts[4], parts[5])
      : new Date(ms - offset * 60000);
  return Number.isNaN(when.getTime()) ? null : when.toISOString();
}

export function takeoutHtmlToHistory(html: string): unknown[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll(".outer-cell"))
    .slice(0, 20000)
    .map((outer) => {
      const product = outer.querySelector(".header-cell")?.textContent?.trim();
      const cell = outer.querySelector(".content-cell.mdl-cell--6-col");
      const link = cell?.querySelector("a");
      return {
        products: product ? [product] : [],
        title: `Watched ${link?.textContent ?? ""}`,
        titleUrl: link?.getAttribute("href") ?? "",
        time: toIso(
          Array.from(cell?.childNodes ?? [])
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .pop()?.textContent ?? "",
        ),
      };
    });
}
