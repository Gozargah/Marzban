import { describe, test, expect } from "bun:test";
import { clearAuthState, clearLegacyAuthToken } from "../../src/utils/authStorage";
import { getUsersPerPageLimitSize, setUsersPerPageLimitSize } from "../../src/utils/userPreferenceStorage";

describe("authentication state", () => {
  test("upgrade cleanup removes only the old browser token", () => {
    localStorage.setItem("token", "old-bearer-token");
    localStorage.setItem("marzban-num-users-per-page", "50");
    clearLegacyAuthToken();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("marzban-num-users-per-page")).toBe("50");
  });
  test("logout preserves unrelated preferences", () => {
    setUsersPerPageLimitSize("50");
    clearAuthState();
    expect(getUsersPerPageLimitSize()).toBe(50);
  });
});

describe("page preferences", () => {
  test("missing preference defaults to 10", () => expect(getUsersPerPageLimitSize()).toBe(10));
  test.each(["", "invalid", "0"])("invalid preference %s falls back", (value) => {
    setUsersPerPageLimitSize(value);
    expect(getUsersPerPageLimitSize()).toBe(10);
  });
  test.each([10, 20, 30, 50, 100])("persists size %s", (size) => {
    setUsersPerPageLimitSize(String(size));
    expect(getUsersPerPageLimitSize()).toBe(size);
  });
});
