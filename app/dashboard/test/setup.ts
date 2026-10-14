import { clearAllDrafts } from "../src/features/shared/drafts";
import { afterEach, expect, mock, setSystemTime } from "bun:test";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanupQueryClients } from "./helpers/render";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import duration from "dayjs/plugin/duration";

// Register the DOM before importing Testing Library (its screen binds to document).
const { cleanup } = await import("@testing-library/react");
expect.extend(matchers);
dayjs.extend(utc);
dayjs.extend(duration);
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

afterEach(() => {
  cleanup();
  cleanupQueryClients();
  clearAllDrafts();
  document.documentElement.className = "";
  document.documentElement.removeAttribute("style");
  document.documentElement.lang = "";
  document.documentElement.dir = "";
  localStorage.clear();
  sessionStorage.clear();
  setSystemTime();
  mock.restore();
});
