import { joinPaths } from "@remix-run/router";

/** Build a WebSocket URL that follows the configured API origin and path prefix. */
export function createWebSocketUrl(endpoint: string, apiBaseUrl: string | undefined, pageOrigin: string) {
  const apiUrl = new URL(apiBaseUrl || "/", pageOrigin);
  if (apiUrl.protocol !== "http:" && apiUrl.protocol !== "https:") {
    throw new TypeError(`Unsupported API protocol for WebSocket: ${apiUrl.protocol}`);
  }
  const protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  const path = joinPaths([apiUrl.pathname, endpoint]);
  return `${protocol}//${apiUrl.host}${path}`;
}
