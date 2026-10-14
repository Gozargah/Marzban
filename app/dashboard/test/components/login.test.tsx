import { describe, test, expect, mock } from "bun:test";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { loadSource } from "../helpers/load-source";
import { network } from "../helpers/network";
import { renderFrontend, localeAdapter } from "../helpers/render";

function setup() {
  const net = network();
  const navigate = mock(async () => {});
  const clear = mock(() => {});
  const { Login } = loadSource<typeof import("../../src/pages/login")>("pages/login.tsx", {
    ...localeAdapter, "service/http": net,
    "react-router": { useNavigate: () => navigate, useLocation: () => ({ pathname: "/login" }) },
    "utils/react-query": { queryClient: { clear } },
    "assets/logo.svg?react": () => <svg aria-hidden="true" />,
    "@/components/footer": { Footer: () => null },
    "@/components/language": { Language: () => null },
  });
  const view = renderFrontend(<Login />);
  const submit = () => fireEvent.submit(view.container.querySelector("form")!);
  return { net, navigate, clear, submit, ...view };
}
async function credentials() {
  const user = userEvent.setup();
  await user.type(screen.getByPlaceholderText("Username"), "alice");
  await user.type(screen.getByPlaceholderText("Password"), "secret");
}

describe("login", () => {
  test("inputs have visible associated labels", () => {
    setup();
    expect(screen.getByRole("textbox", { name: "Username" })).toHaveAttribute("autocomplete", "username");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });
  test("clears stale authentication when mounted", () => {
    localStorage.setItem("token", "stale"); setup();
    expect(localStorage.getItem("token")).toBeNull();
  });
  test("empty fields prevent authentication and report errors", async () => {
    const { submit, net } = setup(); submit();
    await waitFor(() => expect(screen.getByPlaceholderText("Username")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(net.calls).toHaveLength(0);
  });
  test("submits credentials, locks while pending, stores token and navigates", async () => {
    const { submit, net, navigate, clear } = setup();
    await credentials(); submit();
    await waitFor(() => expect(net.calls).toHaveLength(1));
    const request = net.calls[0];
    expect(request.url).toBe("/admin/token");
    expect(request.options).toMatchObject({ method: "POST", retry: 0 });
    expect(Object.fromEntries(request.options.body)).toEqual({ username: "alice", password: "secret", grant_type: "password" });
    expect(screen.getByRole("button", { name: "Login" })).toBeDisabled();
    expect(screen.getByPlaceholderText("Password")).toHaveAttribute("readonly");
    request.resolve({ access_token: "new-token", token_type: "bearer" });
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/", { replace: true }));
    expect(localStorage.getItem("token")).toBe("new-token");
    expect(clear).toHaveBeenCalledTimes(1);
  });
  test("network failure shows an error and permits retry", async () => {
    const { submit, net, navigate } = setup();
    await credentials(); submit();
    await waitFor(() => expect(net.calls).toHaveLength(1));
    net.calls[0].reject(new Error("offline"));
    expect(await screen.findByRole("alert")).toHaveTextContent(/try again/i);
    expect(navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem("token")).toBeNull();
    submit(); await waitFor(() => expect(net.calls).toHaveLength(2));
    net.calls[1].resolve({ access_token: "retry-token" });
    await waitFor(() => expect(localStorage.getItem("token")).toBe("retry-token"));
  });
});
