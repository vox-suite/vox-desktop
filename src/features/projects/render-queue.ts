// One render at a time; replace waiting work with the latest streamed snapshot.
export function latestRenderer<T, R>(
  render: (input: T) => Promise<R>,
  publish: (input: T, output: R) => void,
  fail: (input: T, error: unknown) => void,
) {
  let pending: { input: T } | undefined;
  let running = false;
  let disposed = false;
  const drain = async () => {
    if (running || disposed) return;
    running = true;
    while (pending && !disposed) {
      const { input } = pending;
      pending = undefined;
      try {
        const output = await render(input);
        if (!disposed) publish(input, output);
      } catch (error) {
        if (!disposed) fail(input, error);
      }
    }
    running = false;
  };
  return {
    push(input: T) { pending = { input }; void drain(); },
    dispose() { disposed = true; pending = undefined; },
  };
}
