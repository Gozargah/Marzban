import { expect, test } from "bun:test";
import { waitFor } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend } from "../helpers/render";

test("application startup clears legacy bearer storage before rendering routes", async () => {
  localStorage.setItem("token", "old-readable-token");
  localStorage.setItem("marzban-num-users-per-page", "50");
  const { default: App } = loadSource<typeof import("../../src/App")>("App.tsx", {
    "@/components/deployment-recovery": { DeploymentRecovery: () => null },
    "react-router/dom": { RouterProvider: () => null },
    "./pages/router": { router: {} },
  });
  renderFrontend(<App />);
  await waitFor(() => expect(localStorage.getItem("token")).toBeNull());
  expect(localStorage.getItem("marzban-num-users-per-page")).toBe("50");
});
