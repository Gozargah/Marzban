import { test, expect } from "bun:test";
import { hostsSchema, toFormKey, toInboundTag, newHost, toHostFormValues, firstErrorPath } from "../../src/features/hosts/form";
test.each(["vless.tcp[1]", "normal", "标签/با فاصله", "a%20b"])("inbound %s survives form-path encoding", (tag) => {
  const key = toFormKey(tag); expect(key).not.toMatch(/[.\[\]]/); expect(toInboundTag(key)).toBe(tag);
});
test("host defaults are independent and valid port strings become numeric payloads", () => {
  const host = { ...newHost(), remark: "Edge", address: "example.com", port: "443" };
  expect(hostsSchema.parse({ edge: [host] }).edge[0].port).toBe(443);
  expect(host.port).toBe("443"); expect(newHost()).not.toBe(newHost());
});
test.each(["bad", "0", "65536", "1.5"])("invalid port %s prevents save", (port) => {
  expect(hostsSchema.safeParse({ edge: [{ ...newHost(), remark: "Edge", address: "example.com", port }] }).success).toBe(false);
});
test("server rows receive missing form defaults and validation paths skip ref cycles", () => {
  const values = toHostFormValues({ "vless.tcp": [{ remark: "Edge", address: "example.com", port: null, path: null, sni: null, host: null }] });
  expect(values[toFormKey("vless.tcp")][0].security).toBe("inbound_default");
  expect(firstErrorPath({ field: { nested: { message: "Required" }, ref: {} } })).toBe("field.nested");
});
