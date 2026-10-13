import { describe, expect, test, setSystemTime } from "bun:test";
import { formatBytes, numberWithCommas } from "../../src/utils/formatByte";
import { relativeExpiryDate } from "../../src/utils/dateFormatter";
import { generateDistinctColors } from "../../src/utils/color";
import { createLogBuffer } from "../../src/utils/log-buffer";
import { createLatestRequest } from "../../src/utils/latest-request";

describe("traffic formatting", () => {
  test.each([[0, "0 B"], [1, "1 B"], [1023, "1023 B"], [1024, "1 KB"], [1536, "1.5 KB"], [1073741824, "1 GB"]])("%s bytes -> %s", (bytes, result) => {
    expect(formatBytes(bytes as number)).toBe(result);
  });
  test("precision and chart array output", () => {
    expect(formatBytes(1536, 0)).toBe("2 KB");
    expect(formatBytes(1536, -1)).toBe("2 KB");
    expect(formatBytes(1536, 2, true)).toEqual([1.5, "KB"]);
  });
  test.each([[0, "0"], [1234567, "1,234,567"], [-1234, "-1,234"], [1234.5, "1,234.5"]])("group %s", (value, result) => {
    expect(numberWithCommas(value as number)).toBe(result);
  });
});

describe("expiry", () => {
  test.each([null, undefined])("unlimited expiry %s", (expiry) => {
    expect(relativeExpiryDate(expiry)).toEqual({ status: "", time: "" });
  });
  test.each([[86400, "expires", "1 day"], [-172800, "expired", "2 days"], [3660, "expires", "1 hour, 1 min"], [0, "expired", ""]])("relative offset %s", (offset, status, time) => {
    setSystemTime(new Date("2026-01-15T12:00:00Z"));
    expect(relativeExpiryDate(Date.now() / 1000 + Number(offset))).toEqual({ status, time });
  });
});

describe("chart palette", () => {
  test.each([0, 1, 2, 8, 32])("creates %s deterministic valid colors", (count) => {
    const colors = generateDistinctColors(count);
    expect(colors).toHaveLength(count);
    expect(new Set(colors).size).toBe(count);
    for (const color of colors) expect(color).toMatch(/^#[\da-f]{6}$/);
    expect(generateDistinctColors(count)).toEqual(colors);
  });
});

describe("log buffer", () => {
  test("ignores whitespace, keeps order, and evicts oldest lines", () => {
    const buffer = createLogBuffer(2, 100);
    buffer.append("first\n \nsecond\n");
    buffer.append("third");
    expect(buffer.snapshot()).toEqual(["second", "third"]);
    buffer.clear();
    buffer.append("again");
    expect(buffer.snapshot()).toEqual(["again"]);
  });
  test("bounds each line and total memory across repeated messages", () => {
    const buffer = createLogBuffer(10, 5000);
    for (let i = 0; i < 100; i++) buffer.append("x".repeat(10000));
    expect(buffer.snapshot().every((line) => line.length <= 4096)).toBe(true);
    expect(buffer.snapshot().join("").length).toBeLessThanOrEqual(5000);
  });
});

test("finished request is no longer current and cancellation is idempotent", () => {
  const owner = createLatestRequest();
  owner.cancel();
  const request = owner.start();
  request.finish();
  expect(request.isCurrent()).toBe(false);
  owner.cancel();
  const next = owner.start();
  expect(next.signal.aborted).toBe(false);
  expect(next.isCurrent()).toBe(true);
  owner.cancel();
});
