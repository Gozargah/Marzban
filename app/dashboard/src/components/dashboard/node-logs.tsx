import { createLogBuffer } from "utils/log-buffer";
import { NativeSelect } from "@/components/ui/native-select";
import { joinPaths } from "@remix-run/router";
import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { getAuthToken } from "utils/authStorage";
import { useNodesQuery } from "@/contexts/nodes-context";
import { useVirtualizer } from "@tanstack/react-virtual";

export const MAX_NUMBER_OF_LOGS = 10_000;

const getStatus = (status: string) => {
  return {
    [ReadyState.CONNECTING]: "connecting",
    [ReadyState.OPEN]: "connected",
    [ReadyState.CLOSING]: "closed",
    [ReadyState.CLOSED]: "closed",
    [ReadyState.UNINSTANTIATED]: "closed",
  }[status];
};

const getWebsocketUrl = (nodeID: string) => {
  try {
    const baseURL = new URL(import.meta.env.VITE_BASE_API || "/", window.location.origin);

    return (
      (baseURL.protocol === "https:" ? "wss://" : "ws://") +
      joinPaths([baseURL.host + baseURL.pathname, !nodeID ? "/core/logs" : `/node/${nodeID}/logs`]) +
      "?interval=1&token=" +
      encodeURIComponent(getAuthToken() ?? "")
    );
  } catch (e) {
    console.error("Unable to generate websocket url");
    console.error(e);
    return null;
  }
};

const LOG_LEVEL_COLORS: Record<string, string> = {
  Info: "text-[#1d57c2] dark:text-[#5988e0]",
  Warning: "text-[#b36908] dark:text-[#fbbf24]",
  Error: "text-[#c21d1d] dark:text-[#f87171]",
  Debug: "text-[#a78bf2] dark:text-[#a78bf2]",
} as const;

const LOG_RE = /^(\d{4}\/\d{2}\/\d{2} [\d:.]+)(?: (\[(Info|Warning|Error|Debug)\]))? (.*)$/;
const Log: FC<{ children: string }> = ({ children }) => {
  const message = children.trim();
  const m = LOG_RE.exec(message);
  if (!m) return <div className="h-5 whitespace-pre font-mono text-xs leading-5 opacity-80">{message}</div>;
  const [, timestamp, level, levelKey, rest] = m;

  return (
    <div className="h-5 whitespace-pre font-mono text-xs leading-5 opacity-80">
      <span className="opacity-70 dark:opacity-50">{timestamp}</span>
      {level && (
        <>
          {" "}
          <span className={LOG_LEVEL_COLORS[levelKey]}>{level}</span>
        </>
      )}{" "}
      {rest}
    </div>
  );
};

export const NodeLogs = () => {
  const buffer = useRef(createLogBuffer(MAX_NUMBER_OF_LOGS));
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const logsDiv = useRef<HTMLDivElement | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { data: nodes } = useNodesQuery();
  const [selectedNode, setNode] = useState<string>("");
  const { readyState } = useWebSocket(getWebsocketUrl(selectedNode), {
    onMessage: (e: any) => {
      if (typeof e.data !== "string") return;
      buffer.current.append(e.data);
      if (flushTimer.current === null) flushTimer.current = setTimeout(() => {
        flushTimer.current = null;
        setLogs(buffer.current.snapshot());
      }, 100);
    },
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 1000,
  });

  useEffect(() => {
    return () => {
      if (flushTimer.current !== null) clearTimeout(flushTimer.current);
      flushTimer.current = null;
      buffer.current.clear();
    };
  }, []);

  const status = getStatus(readyState.toString());

  const handleLog = (id: string) => {
    const next = id === "host" ? "" : id;
    if (next === selectedNode) return;
    if (flushTimer.current !== null) clearTimeout(flushTimer.current);
    flushTimer.current = null;
    buffer.current.clear();
    shouldStick.current = true;
    setLogs([]);
    setNode(next);
  };
  const { t } = useTranslation();
  const virtualizedLogs = useVirtualizer({
    count: logs.length,
    estimateSize: () => 20,
    getScrollElement: () => logsDiv.current,
    overscan: 20,
  });
  const shouldStick = useRef(true);

  const handleScroll = () => {
    const el = logsDiv.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32;
    shouldStick.current = atBottom;
  };

  useLayoutEffect(() => {
    if (shouldStick.current && logs.length > 0) {
      virtualizedLogs.scrollToIndex(logs.length - 1, { align: "end" });
    }
  }, [logs, virtualizedLogs]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {!!nodes?.length && (
            <NativeSelect
              aria-label={t("core.logs")}
              value={selectedNode || "host"}
              onChange={(event) => handleLog(event.currentTarget.value)}
              className="w-auto"
            >
              <option value="host">Master</option>
              {nodes.map((node) => (
                <option key={node.id} value={String(node.id)}>
                  {node.name}
                </option>
              ))}
            </NativeSelect>
          )}
          <span className="text-sm font-medium">{t("core.logs")}</span>
        </div>
        <span role="status" className="text-xs text-muted-foreground">
          {t(`core.socket.${status}`)}
        </span>
      </div>
      <div
        ref={logsDiv}
        onScroll={handleScroll}
        className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/20 p-2"
        dir="ltr"
        aria-label={t("core.logs")}
      >
        <div
          style={{
            height: virtualizedLogs.getTotalSize(),
            paddingTop: virtualizedLogs.getVirtualItems()[0]?.start ?? 0,
          }}
        >
          {virtualizedLogs.getVirtualItems().map((row) => (
            <Log key={row.key}>{logs[row.index]}</Log>
          ))}
        </div>
      </div>
    </>
  );
};
