import { test, expect, spyOn } from "bun:test";
import { screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "../../src/components/theme-provider";
import { renderFrontend } from "../helpers/render";

function Consumer() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return <><output>{theme}:{resolvedTheme}</output><button onClick={() => setTheme("light")}>Light</button><button onClick={() => setTheme("dark")}>Dark</button></>;
}

test("theme changes root class, color scheme and saved preference", () => {
  renderFrontend(<ThemeProvider defaultTheme="dark"><Consumer /></ThemeProvider>);
  expect(document.documentElement).toHaveClass("dark");
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  expect(document.documentElement).toHaveClass("light");
  expect(document.documentElement).not.toHaveClass("dark");
  expect(document.documentElement.style.colorScheme).toBe("light");
  expect(localStorage.getItem("vite-ui-theme")).toBe("light");
});
test("valid stored preference overrides default", () => {
  localStorage.setItem("theme-test", "light");
  renderFrontend(<ThemeProvider defaultTheme="dark" storageKey="theme-test"><Consumer /></ThemeProvider>);
  expect(screen.getByText("light:light")).toBeInTheDocument();
});
test("invalid stored theme uses default", () => {
  localStorage.setItem("vite-ui-theme", "invalid");
  renderFrontend(<ThemeProvider defaultTheme="dark"><Consumer /></ThemeProvider>);
  expect(screen.getByText("dark:dark")).toBeInTheDocument();
});
test("theme remains usable when storage is blocked", () => {
  spyOn(localStorage, "getItem").mockImplementation(() => { throw new Error("blocked"); });
  spyOn(localStorage, "setItem").mockImplementation(() => { throw new Error("blocked"); });
  renderFrontend(<ThemeProvider defaultTheme="dark"><Consumer /></ThemeProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Light" }));
  expect(screen.getByText("light:light")).toBeInTheDocument();
});
