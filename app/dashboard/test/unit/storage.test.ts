import { describe, test, expect } from "bun:test";
import { getAuthToken, setAuthToken, removeAuthToken } from "../../src/utils/authStorage";
import { getUsersPerPageLimitSize, setUsersPerPageLimitSize } from "../../src/utils/userPreferenceStorage";

describe("authentication storage", () => {
  test("absent, persisted, replaced and removed token", () => {
    expect(getAuthToken()).toBeNull();
    setAuthToken("first");
    expect(getAuthToken()).toBe("first");
    setAuthToken("second");
    expect(getAuthToken()).toBe("second");
    removeAuthToken(); removeAuthToken();
    expect(getAuthToken()).toBeNull();
  });
  test("logout preserves unrelated preferences", () => {
    setUsersPerPageLimitSize("50"); setAuthToken("token"); removeAuthToken();
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
