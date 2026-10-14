import { test, expect } from "bun:test";
import { getDefaultValues, formatUser, mergeProxies, toUserCreate, userFormSchema } from "../../src/features/users/form";
import { makeUser } from "../helpers/fixtures";
const inbounds = () => new Map([["vless", [{ tag: "tcp" }]]]);
test("defaults use supplied inbounds and return independent drafts", () => {
  const first = getDefaultValues(inbounds()); first.inbounds.vless.push("other");
  expect(getDefaultValues(inbounds()).inbounds).toEqual({ vless: ["tcp"] });
  expect(getDefaultValues(inbounds()).selected_proxies).toEqual(["vless"]);
});
test("editing converts bytes and seconds to form units", () => {
  expect(formatUser(makeUser({ data_limit: 1610612736, on_hold_expire_duration: 172800 }))).toMatchObject({ data_limit: 1.5, on_hold_expire_duration: 2 });
});
test("validation converts units without mutating draft credentials", () => {
  const draft = getDefaultValues(inbounds()); draft.username = "alice"; draft.data_limit = 1.5;
  const parsed = userFormSchema.parse(draft);
  expect(parsed.data_limit).toBe(1610612736); expect(parsed.proxies.vless).not.toHaveProperty("id");
  expect(draft.proxies.vless?.id).toBe("");
});
test.each(["bad", "1oops", "-1", -1, Infinity, 1e308])("invalid limit %s is rejected", (data_limit) => {
  expect(userFormSchema.safeParse({ ...getDefaultValues(inbounds()), username: "alice", data_limit }).success).toBe(false);
});
test("on-hold duration converts days to seconds", () => {
  expect(userFormSchema.parse({ ...getDefaultValues(inbounds()), username: "alice", status: "on_hold", on_hold_expire_duration: "2" })).toHaveProperty("on_hold_expire_duration", 172800);
});
test("selected protocols preserve credentials", () => {
  expect(mergeProxies(["vless"], { vless: { id: "saved" }, vmess: { id: "other" } })).toEqual({ vless: { id: "saved" } });
});

test("payload excludes UI fields, normalizes computed statuses and unlimited reset strategy", () => {
  const draft = getDefaultValues(inbounds()); draft.username = "alice"; draft.status = "expired"; draft.data_limit_reset_strategy = "day";
  const payload = toUserCreate(draft);
  expect(payload).not.toHaveProperty("selected_proxies");
  expect(payload).toMatchObject({ status: "active", data_limit_reset_strategy: "no_reset", proxies: { vless: { id: "", flow: "" } } });
});
