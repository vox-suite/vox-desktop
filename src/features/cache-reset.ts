import { cancelPersist } from "@/features/persist";

const resets = new Set<() => void>();

export function registerCacheReset(reset: () => void) {
  resets.add(reset);
}

export function resetUserCaches() {
  cancelPersist();
  resets.forEach((reset) => reset());
}
