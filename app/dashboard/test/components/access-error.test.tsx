import { test, expect, mock } from "bun:test";
import { screen, fireEvent } from "@testing-library/react";
import { loadSource } from "../helpers/load-source";
import { renderFrontend, localeAdapter } from "../helpers/render";
import { saveDraft, readDraft } from "../../src/features/shared/drafts";

function setup(status?: number) {
  const revalidate = mock(() => {}), navigate = mock(() => {});
  const { AccessError } = loadSource<typeof import("../../src/pages/access-error")>("pages/access-error.tsx", {
    ...localeAdapter,
    "react-router": { useRouteError: () => ({ response: { status } }), useRevalidator: () => ({ state: "idle", revalidate }), useNavigate: () => navigate },
    "./login": { Login: () => <div>Authentication required</div> },
  });
  renderFrontend(<AccessError />); return { revalidate, navigate };
}
test.each([undefined, 500, 503])("transient dashboard failure %s retains authentication and drafts", (status) => {
  localStorage.setItem("token", "current-session"); saveDraft("core", { config: "draft" });
  const { revalidate } = setup(status);
  expect(screen.getByRole("alert")).toHaveTextContent(/session and saved drafts/i);
  expect(localStorage.getItem("token")).toBe("current-session"); expect(readDraft("core")).toEqual({ config: "draft" });
  fireEvent.click(screen.getByRole("button", { name: "Retry" })); expect(revalidate).toHaveBeenCalledTimes(1);
});
test.each([401, 403])("authentication failure %s renders login", (status) => {
  setup(status); expect(screen.getByText("Authentication required")).toBeInTheDocument();
});
