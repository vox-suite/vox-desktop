export type Block =
  | { kind: "text"; text: string }
  | { kind: "kv"; label: string; value: string }
  | { kind: "list"; items: string[] }
  | { kind: "day"; label: string; steps: string[] };

const BULLET = /^\s*[-•*]\s+/;
const DAY = /^(Day\s+\d+(?:\s*\([^)]*\))?)\s*[:\-–]\s*(.+)$/i;
const KV = /^([A-Za-z][A-Za-z &/']{1,28}(?:\s*\([^)]*\))?):\s+(.+)$/;

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of body.replace(/\\n/g, "\n").split("\n")) {
    const line = raw.replace(BULLET, "").trim();
    if (!line) continue;
    const day = line.match(DAY);
    if (day) {
      blocks.push({
        kind: "day",
        label: day[1],
        steps: day[2].split(/\s*(?:→|->)\s*/).filter(Boolean),
      });
      continue;
    }
    const kv = line.match(KV);
    if (kv) {
      blocks.push({ kind: "kv", label: kv[1], value: kv[2] });
      continue;
    }
    if (BULLET.test(raw)) {
      const last = blocks.at(-1);
      if (last?.kind === "list") last.items.push(line);
      else blocks.push({ kind: "list", items: [line] });
      continue;
    }
    blocks.push({ kind: "text", text: line });
  }
  return blocks;
}
