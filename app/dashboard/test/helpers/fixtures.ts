import type { User, UserCreate } from "../../src/types/User";

/** Fresh fixtures avoid cross-test mutation. Override only fields relevant to the behavior. */
export function makeUser(overrides: Partial<User> = {}): User {
  return {
    username: "alice", status: "active", proxies: { vless: {} }, inbounds: { vless: ["vless-tcp"] },
    expire: null, data_limit: null, data_limit_reset_strategy: "no_reset", on_hold_expire_duration: null,
    used_traffic: 1024, lifetime_used_traffic: 2048, links: ["vless://demo"], subscription_url: "/sub/alice", note: "", online_at: "",
    ...overrides,
  };
}

export function makeUserCreate(overrides: Partial<UserCreate> = {}): UserCreate {
  const { username, status, proxies, inbounds, expire, data_limit, data_limit_reset_strategy, on_hold_expire_duration, note } = makeUser();
  return { username, status, proxies, inbounds, expire, data_limit, data_limit_reset_strategy, on_hold_expire_duration, note, ...overrides };
}
