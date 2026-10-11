const resets = new Set<() => void>();

export function registerCacheReset(reset: () => void) {
  resets.add(reset);
}

export function resetUserCaches() {
  resets.forEach((reset) => reset());
}
