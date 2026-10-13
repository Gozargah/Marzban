import { mock } from "bun:test";

export function deferred<T = any>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Requests settle explicitly so races and pending states never rely on sleeps. */
export function network() {
  const calls: ({ url: string; options: any } & ReturnType<typeof deferred>)[] = [];
  const fetch = mock((url: string, options: any = {}) => {
    const request = deferred();
    calls.push({ url, options, ...request });
    return request.promise;
  });
  return { calls, fetch };
}

export const flushPromises = () => new Promise<void>((resolve) => setImmediate(resolve));
