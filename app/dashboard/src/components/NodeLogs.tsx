import { Box, FormLabel, HStack, Select, Text, useColorMode } from "@chakra-ui/react";
import { joinPaths } from "@remix-run/router";
import debounce from "lodash.debounce";
import { CSSProperties, FC, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ReadyState } from "react-use-websocket";
import { useWebSocket } from "react-use-websocket/dist/lib/use-websocket";
import { useNodesQuery } from "contexts/NodesContext";
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
    let baseURL = new URL(
      import.meta.env.VITE_BASE_API.startsWith("/")
        ? window.location.origin + import.meta.env.VITE_BASE_API
        : import.meta.env.VITE_BASE_API,
    );

    return (
      (baseURL.protocol === "https:" ? "wss://" : "ws://") +
      joinPaths([baseURL.host + baseURL.pathname, !nodeID ? "/core/logs" : `/node/${nodeID}/logs`]) +
      // The handshake carries the session cookie, so no token in the URL.
      "?interval=1"
    );
  } catch (e) {
    console.error("Unable to generate websocket url");
    console.error(e);
    return null;
  }
};

const LOG_LEVEL_COLORS: { [key: string]: CSSProperties["color"] } = {
  Info: "text-[#1d57c2] dark:text-[#5988e0]",
  Warning: "text-[#b36908] dark:text-[#fbbf24]",
  Error: "text-[#c21d1d] dark:text-[#f87171]",
  Debug: "text-[#a78bf2] dark:text-[#a78bf2]",
} as const;

const LOG_RE = /^(\d{4}\/\d{2}\/\d{2} [\d:.]+)(?: (\[(Info|Warning|Error|Debug)\]))? (.*)$/;
const Log: FC<{ children: string }> = ({ children }) => {
  const message = children.trim();
  const m = LOG_RE.exec(message);
  if (!m)
    return (
      <Text fontSize="xs" opacity={0.8} whiteSpace="pre" fontFamily="monospace" style={{ height: `20px` }}>
        {message}
      </Text>
    );
  const [, timestamp, level, levelKey, rest] = m;

  return (
    <Text fontSize="xs" opacity={0.8} whiteSpace="pre" fontFamily="monospace" style={{ height: `20px` }}>
      <span className="dark:opacity-50 opacity-70">{timestamp}</span>
      {level && (
        <>
          {" "}
          <span className={LOG_LEVEL_COLORS[levelKey]}>{level}</span>
        </>
      )}{" "}
      {rest}
    </Text>
  );
};

let logsTmp: string[] = [];
export const NodeLogs = () => {
  const { colorMode } = useColorMode();
  const logsDiv = useRef<HTMLDivElement | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const { data: nodes } = useNodesQuery();
  const disabled = false;
  const [selectedNode, setNode] = useState<string>("");
  const { readyState } = useWebSocket(getWebsocketUrl(selectedNode), {
    onMessage: (e: any) => {
      const newLogs = e.data.split("\n").filter((l: string) => l.trim());
      logsTmp.push(...newLogs);
      if (logsTmp.length > MAX_NUMBER_OF_LOGS) logsTmp = logsTmp.splice(0, logsTmp.length - MAX_NUMBER_OF_LOGS);
      setLogs([...logsTmp]);
    },
    shouldReconnect: () => true,
    reconnectAttempts: 10,
    reconnectInterval: 1000,
  });

  useEffect(() => {
    return () => {
      logsTmp = [];
    };
  }, []);

  const status = getStatus(readyState.toString());

  const handleLog = (id: string, title: string) => {
    if (id === selectedNode) return;
    else if (id === "host") {
      logsTmp = [];
      setNode("");
      setLogs([]);
    } else {
      logsTmp = [];
      setNode(id);
      setLogs([]);
    }
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
    if (shouldStick.current) {
      virtualizedLogs.scrollToIndex(logs.length - 1, { align: "end" });
    }
  }, [logs.length]);

  return (
    <>
      <HStack justifyContent="space-between">
        <HStack>
          {nodes?.[0] && (
            <Select
              size="sm"
              style={{ width: "auto" }}
              disabled={disabled}
              bg={disabled ? "gray.100" : "transparent"}
              _dark={{
                bg: disabled ? "gray.600" : "transparent",
                borderColor: "gray.500",
              }}
              sx={{
                option: {
                  backgroundColor: colorMode === "dark" ? "#222C3B" : "white",
                },
              }}
              borderColor="gray.300"
              rounded="md"
              onChange={(v) => handleLog(v.currentTarget.value, v.currentTarget.selectedOptions[0].text)}
            >
              <option key={"host"} value={"host"} defaultChecked>
                Master
              </option>
              {nodes &&
                nodes.map((s) => {
                  return (
                    <option key={s.address} value={String(s.id)}>
                      {t(s.name)}
                    </option>
                  );
                })}
            </Select>
          )}
          <FormLabel className="w-auto m-0!">{t("core.logs")}</FormLabel>
        </HStack>
        <Text as={FormLabel} m={0}>
          {t(`core.socket.${status}`)}
        </Text>
      </HStack>
      <Box
        border="1px solid"
        borderColor="gray.300"
        bg="#F9F9F9"
        _dark={{
          borderColor: "gray.500",
          bg: "#1d2128",
        }}
        borderRadius={5}
        p={2}
        overflowY="auto"
        ref={logsDiv}
        maxW="full"
        flexGrow={1}
        key="logs"
        data-vaul-no-drag="true"
        onPointerDownCapture={(e) => e.nativeEvent.stopImmediatePropagation()}
        className="select-text scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200/80 dark:scrollbar-thumb-gray-600 dark:scrollbar-track-white/3"
        onScroll={handleScroll}
      >
        <div
          style={{
            height: `${virtualizedLogs.getTotalSize()}px`,
            paddingTop: virtualizedLogs.getVirtualItems()[0]?.start ?? 0,
          }}
        >
          {virtualizedLogs.getVirtualItems().map((virtualRow, i) => {
            const message = logs[virtualRow.index];
            return <Log key={virtualRow.key}>{message}</Log>;
          })}
        </div>
      </Box>
    </>
  );
};
