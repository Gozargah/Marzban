import { test, expect, mock } from "bun:test";
import { screen, fireEvent, waitFor, act } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend } from "../helpers/render";

function setup() {
  let options: any;
  const socket = mock((_url: string, next: any) => { options = next; return { readyState: 1 }; });
  const scrollToIndex = mock(() => {});
  const { NodeLogs } = loadSource<typeof import("../../src/components/dashboard/node-logs")>("components/dashboard/node-logs.tsx", {
    "react-use-websocket": { __esModule: true, default: socket, ReadyState: { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3, UNINSTANTIATED: -1 } },
    "@/contexts/nodes-context": { useNodesQuery: () => ({ data: [{ id: 7, name: "Edge" }] }) },
    "@tanstack/react-virtual": { useVirtualizer: ({ count }: { count: number }) => ({
      getTotalSize: () => count * 20,
      getVirtualItems: () => Array.from({ length: count }, (_, index) => ({ index, key: index, start: index * 20 })),
      scrollToIndex,
    }) },
  });
  return { ...renderFrontend(<NodeLogs />), socket, message: (data: unknown) => options.onMessage({ data }), scrollToIndex };
}

test("logs encode token, select correct socket endpoint and display messages", async () => {
  localStorage.setItem("token", "a&b=token");
  const { socket, message } = setup();
  expect(socket.mock.calls[0][0]).toBe("ws://localhost/api/core/logs?interval=1&token=a%26b%3Dtoken");
  act(() => message("2026/01/15 12:00:00 [Info] Ready\nplain line"));
  expect(await screen.findByText("Ready")).toBeInTheDocument();
  expect(screen.getByText("plain line")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "7" } });
  expect(socket.mock.lastCall?.[0]).toBe("ws://localhost/api/node/7/logs?interval=1&token=a%26b%3Dtoken");
  expect(screen.queryByText("plain line")).not.toBeInTheDocument();
});
test("ignores non-text frames and unmount cancels buffered flush", async () => {
  const { message, unmount, socket } = setup();
  act(() => message(new ArrayBuffer(8)));
  expect(socket).toHaveBeenCalledTimes(1);
  act(() => message("late"));
  unmount();
  await new Promise((resolve) => setTimeout(resolve, 120));
  expect(screen.queryByText("late")).not.toBeInTheDocument();
});
