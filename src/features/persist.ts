import { platform } from "@/platform";

const VERSION = 1;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, () => unknown>();

export async function readPersisted<T>(key: string): Promise<T | null> {
  try {
    const text = await platform().cache?.read(key);
    if (!text) return null;
    const parsed = JSON.parse(text) as { v: number; data: T };
    return parsed.v === VERSION ? parsed.data : null;
  } catch {
    return null;
  }
}

async function flush(key: string) {
  timers.delete(key);
  const produce = pending.get(key);
  pending.delete(key);
  if (!produce) return;
  try {
    await platform().cache?.write(
      key,
      JSON.stringify({ v: VERSION, data: produce() }),
    );
  } catch {
    return;
  }
}

export function schedulePersist(
  key: string,
  produce: () => unknown,
  delayMs = 1500,
) {
  pending.set(key, produce);
  if (timers.has(key)) return;
  timers.set(
    key,
    setTimeout(() => void flush(key), delayMs),
  );
}

export function cancelPersist() {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  pending.clear();
}
