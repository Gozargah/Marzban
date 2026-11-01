import { test, expect } from "bun:test";
import {
  hostsSchema,
  toFormKey,
  toInboundTag,
  newHost,
  toHostFormValues,
  firstErrorPath,
} from "../../src/features/hosts/form";
test.each(["vless.tcp[1]", "normal", "标签/با فاصله", "a%20b"])("inbound %s survives form-path encoding", (tag) => {
  const key = toFormKey(tag);
  expect(key).not.toMatch(/[.[\]]/);
  expect(toInboundTag(key)).toBe(tag);
});
test("host defaults are independent and valid port strings become numeric payloads", () => {
  const host = { ...newHost(), remark: "Edge", address: "example.com", port: "443" };
  expect(hostsSchema.parse({ edge: [host] }).edge[0].port).toBe(443);
  expect(host.port).toBe("443");
  expect(newHost()).not.toBe(newHost());
});
test.each(["bad", "0", "65536", "1.5"])("invalid port %s prevents save", (port) => {
  expect(
    hostsSchema.safeParse({ edge: [{ ...newHost(), remark: "Edge", address: "example.com", port }] }).success,
  ).toBe(false);
});
test("server rows receive missing form defaults and validation paths skip ref cycles", () => {
  const values = toHostFormValues({
    "vless.tcp": [{ remark: "Edge", address: "example.com", port: null, path: null, sni: null, host: null }],
  });
  expect(values[toFormKey("vless.tcp")][0].security).toBe("inbound_default");
  expect(firstErrorPath({ field: { nested: { message: "Required" }, ref: {} } })).toBe("field.nested");
});
const hostWith = (patch: Record<string, unknown>) => ({
  ...newHost(),
  remark: "Edge",
  address: "example.com",
  ...patch,
});
test("empty xray extras are sent as null and mux off", () => {
  const host = hostsSchema.parse({ edge: [hostWith({})] }).edge[0];
  expect(host.tls_extra).toBeNull();
  expect(host.reality_extra).toBeNull();
  expect(host.xhttp_extra).toBeNull();
  expect(host.mux_settings).toBeNull();
});
test("tls extras become arrays and pins are validated", () => {
  const pin = "a".repeat(64);
  const ok = hostsSchema.parse({
    edge: [
      hostWith({ security: "tls", tls_extra: { ...newHost().tls_extra, pinned_peer_cert_sha256: `${pin}, ${pin}` } }),
    ],
  }).edge[0];
  expect(ok.tls_extra?.pinned_peer_cert_sha256).toEqual([pin, pin]);
  expect(
    hostsSchema.safeParse({
      edge: [hostWith({ security: "tls", tls_extra: { ...newHost().tls_extra, pinned_peer_cert_sha256: "zz" } })],
    }).success,
  ).toBe(false);
});
test("reality requires a public key and is dropped for other security modes", () => {
  expect(hostsSchema.safeParse({ edge: [hostWith({ security: "reality" })] }).success).toBe(false);
  const reality = { public_key: "pbk", short_id: "ab", spider_x: "" };
  expect(
    hostsSchema.parse({ edge: [hostWith({ security: "reality", reality_extra: reality })] }).edge[0].reality_extra,
  ).toEqual({ public_key: "pbk", short_id: "ab", spider_x: null });
  expect(
    hostsSchema.parse({ edge: [hostWith({ security: "tls", reality_extra: reality })] }).edge[0].reality_extra,
  ).toBeNull();
});
test("mux and xhttp settings are normalized and round-trip through the form", () => {
  const parsed = hostsSchema.parse({
    edge: [
      hostWith({
        mux_enable: true,
        mux_settings: { concurrency: "8", xudp_concurrency: "", xudp_proxy_udp443: "reject" },
        xhttp_extra: {
          ...newHost().xhttp_extra,
          mode: "packet-up",
          xmux: { ...newHost().xhttp_extra?.xmux, max_concurrency: "16-32" },
        },
      }),
    ],
  }).edge[0];
  expect(parsed.mux_settings).toEqual({
    enabled: true,
    concurrency: 8,
    xudp_concurrency: null,
    xudp_proxy_udp443: "reject",
  });
  expect(parsed.xhttp_extra).toEqual({
    mode: "packet-up",
    x_padding_bytes: null,
    sc_max_each_post_bytes: null,
    xmux: { max_concurrency: "16-32" },
  });
  const form = toHostFormValues({ tag: [parsed as never] })[toFormKey("tag")][0];
  expect(form.mux_settings?.concurrency).toBe("8");
  expect(form.xhttp_extra?.xmux?.max_concurrency).toBe("16-32");
});
