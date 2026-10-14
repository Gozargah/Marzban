import { expect, mock, test } from "bun:test";
import { createPreloader } from "../../src/features/shared/dialog-preload";
import { deferred } from "../helpers/network";

test("intent preloading shares one download and retries failed downloads", async () => {
  const request = deferred();
  const load = mock(() => request.promise);
  const preload = createPreloader(load);
  const first = preload();
  expect(preload()).toBe(first);
  expect(load).toHaveBeenCalledTimes(1);
  request.reject(new Error("offline"));
  await first;
  load.mockResolvedValueOnce({});
  await preload();
  expect(load).toHaveBeenCalledTimes(2);
  await preload();
  expect(load).toHaveBeenCalledTimes(2);
});
