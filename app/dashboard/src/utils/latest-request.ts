/** One owner for a replaceable read: abort old work and ignore late responses. */
export function createLatestRequest() {
  let controller: AbortController | undefined;
  return {
    start() {
      controller?.abort();
      const current = new AbortController();
      controller = current;
      return {
        signal: current.signal,
        isCurrent: () => controller === current && !current.signal.aborted,
        finish: () => { if (controller === current) controller = undefined; },
      };
    },
    cancel() {
      controller?.abort();
      controller = undefined;
    },
  };
}
