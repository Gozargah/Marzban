import { test, expect } from "bun:test";
import { screen } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { renderFrontend } from "../helpers/render";

function setup() {
  const net = network();
  const { default: useGetUser } = loadSource<typeof import("../../src/hooks/useGetUser")>("hooks/useGetUser.tsx", { "service/http": net });
  function Probe() {
    const { userData, getUserIsPending, getUserIsError, getUserIsSuccess } = useGetUser();
    return <output>{getUserIsPending ? "pending" : getUserIsError ? "error" : getUserIsSuccess ? userData.username : "idle"}</output>;
  }
  renderFrontend(<Probe />);
  return net;
}

test("admin hook exposes pending then authenticated identity", async () => {
  const net = setup();
  expect(screen.getByText("pending")).toBeInTheDocument();
  net.calls[0].resolve({ username: "alice", is_sudo: true, discord_webook: "", telegram_id: "" });
  expect(await screen.findByText("alice")).toBeInTheDocument();
});
test("admin hook exposes error instead of reporting success", async () => {
  const net = setup();
  net.calls[0].reject(new Error("unauthorized"));
  expect(await screen.findByText("error")).toBeInTheDocument();
  expect(net.calls).toHaveLength(1);
});
