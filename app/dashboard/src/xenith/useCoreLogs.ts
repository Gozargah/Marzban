import { joinPaths } from "@remix-run/router";
import { useCallback, useState } from "react";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";

export type CoreLogLine = { id: number; time: string; level: string; text: string };

/** `2024/05/06 12:00:00 [Info] message` — the format xray writes. */
const LOG_RE = /^(\d{4}\/\d{2}\/\d{2} )?([\d:.]+)?\s*(?:\[(Info|Warning|Error|Debug)\])?\s*(.*)$/;

export const LEVEL_COLORS: Record<string, string> = {
  INFO: "var(--xn-accent-700)",
  WARNING: "var(--xn-accent-900)",
  WARN: "var(--xn-accent-900)",
  ERROR: "var(--xn-neutral-900)",
  DEBUG: "var(--xn-neutral-600)",
};

const websocketUrl = (path: string) => {
  try {
    const base = new URL(
      import.meta.env.VITE_BASE_API.startsWith("/")
        ? window.location.origin + import.meta.env.VITE_BASE_API
        : import.meta.env.VITE_BASE_API,
    );
    // The session cookie rides along with the handshake, so no token in the URL.
    return (base.protocol === "https:" ? "wss://" : "ws://") + joinPaths([base.host + base.pathname, path]) + "?interval=1";
  } catch {
    return null;
  }
};

/** Streams the core log, keeping only the last `limit` lines. */
export const useCoreLogs = (limit: number) => {
  const [logs, setLogs] = useState<CoreLogLine[]>([]);
  const [counter, setCounter] = useState(0);

  const onMessage = useCallback(
    (event: WebSocketEventMap["message"]) => {
      const lines = String(event.data || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (lines.length === 0) return;

      setCounter((start) => {
        setLogs((current) => {
          const parsed = lines.map((line, index) => {
            const match = LOG_RE.exec(line);
            return {
              id: start + index,
              time: match?.[2] || "",
              level: (match?.[3] || "INFO").toUpperCase(),
              text: match?.[4] || line,
            };
          });
          return [...current, ...parsed].slice(-limit);
        });
        return start + lines.length;
      });
    },
    [limit],
  );

  const { readyState } = useWebSocket(websocketUrl("/core/logs"), {
    onMessage,
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 2000,
  });

  return { logs, readyState };
};
