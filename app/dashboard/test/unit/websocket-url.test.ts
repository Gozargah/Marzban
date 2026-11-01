import { test, expect } from "bun:test";
import { createWebSocketUrl } from "../../src/features/shared/websocket-url";

test("uses ws for an HTTP API and preserves a relative API prefix", () => {
  expect(createWebSocketUrl("/core/logs", "/api/", "http://dashboard.test")).toBe("ws://dashboard.test/api/core/logs");
});

test("uses wss for HTTPS APIs and preserves a remote API origin and prefix", () => {
  expect(createWebSocketUrl("/node/7/logs", "https://api.example.test/marzban/api/", "https://dashboard.test")).toBe(
    "wss://api.example.test/marzban/api/node/7/logs",
  );
});

test("uses an explicitly configured API port even when the dashboard is HTTPS", () => {
  expect(createWebSocketUrl("/node/7/logs", "http://127.0.0.1:8000/api", "https://dashboard.test")).toBe(
    "ws://127.0.0.1:8000/api/node/7/logs",
  );
});

test("rejects non-HTTP API protocols instead of constructing a misleading socket URL", () => {
  expect(() => createWebSocketUrl("/core/logs", "ftp://api.example.test", "https://dashboard.test")).toThrow(
    "Unsupported API protocol",
  );
});
