import { z } from "zod";

const text = z.string().nullable().optional().default("");
const trimmed = (value: string | null | undefined) => (value ?? "").trim();
const orNull = (value: string | null | undefined) => trimmed(value) || null;
const toList = (value: string | null | undefined) =>
  trimmed(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
const toInt = (value: string | number | null | undefined) => {
  const raw = String(value ?? "").trim();
  return raw === "" ? null : Number(raw);
};
const intField = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .default("")
  .refine((value) => {
    const parsed = toInt(value);
    return parsed === null || (Number.isInteger(parsed) && parsed >= -1 && parsed <= 1024);
  }, "Must be a whole number between -1 and 1024");

const tlsExtraSchema = z.object({
  ech_config_list: text,
  ech_force_query: text,
  pinned_peer_cert_sha256: text,
  verify_peer_cert_by_name: text,
});
const realityExtraSchema = z.object({ public_key: text, short_id: text, spider_x: text });
const xhttpExtraSchema = z.object({
  mode: text,
  x_padding_bytes: text,
  sc_max_each_post_bytes: text,
  xmux: z
    .object({
      max_concurrency: text,
      max_connections: text,
      c_max_reuse_times: text,
      h_max_reusable_secs: text,
    })
    .optional()
    .default({ max_concurrency: "", max_connections: "", c_max_reuse_times: "", h_max_reusable_secs: "" }),
});
const muxSettingsSchema = z.object({
  concurrency: intField,
  xudp_concurrency: intField,
  xudp_proxy_udp443: text,
});

const emptyTlsExtra = () => ({
  ech_config_list: "",
  ech_force_query: "",
  pinned_peer_cert_sha256: "",
  verify_peer_cert_by_name: "",
});
const emptyRealityExtra = () => ({ public_key: "", short_id: "", spider_x: "" });
const emptyXhttpExtra = () => ({
  mode: "",
  x_padding_bytes: "",
  sc_max_each_post_bytes: "",
  xmux: { max_concurrency: "", max_connections: "", c_max_reuse_times: "", h_max_reusable_secs: "" },
});
const emptyMuxSettings = () => ({ concurrency: "", xudp_concurrency: "", xudp_proxy_udp443: "" });

// Form state keeps every nested group as plain strings; the API payload is built here.
function toPayload(host: {
  security: string;
  mux_enable: boolean;
  tls_extra: z.infer<typeof tlsExtraSchema>;
  reality_extra: z.infer<typeof realityExtraSchema>;
  xhttp_extra: z.infer<typeof xhttpExtraSchema>;
  mux_settings: z.infer<typeof muxSettingsSchema>;
}) {
  const tls = host.tls_extra;
  const pins = toList(tls.pinned_peer_cert_sha256);
  const names = toList(tls.verify_peer_cert_by_name);
  const hasTls = !!(trimmed(tls.ech_config_list) || trimmed(tls.ech_force_query) || pins.length || names.length);
  const xhttp = host.xhttp_extra;
  const xmux = Object.fromEntries(
    Object.entries(xhttp.xmux).flatMap(([key, value]) => (orNull(value) ? [[key, trimmed(value)]] : [])),
  );
  const xhttpFields = {
    mode: orNull(xhttp.mode),
    x_padding_bytes: orNull(xhttp.x_padding_bytes),
    sc_max_each_post_bytes: orNull(xhttp.sc_max_each_post_bytes),
    xmux: Object.keys(xmux).length ? xmux : null,
  };
  const hasXhttp = Object.values(xhttpFields).some(Boolean);
  const mux = host.mux_settings;
  const muxFields = {
    concurrency: toInt(mux.concurrency),
    xudp_concurrency: toInt(mux.xudp_concurrency),
    xudp_proxy_udp443: orNull(mux.xudp_proxy_udp443),
  };
  const hasMux = host.mux_enable || Object.values(muxFields).some((value) => value !== null);
  return {
    tls_extra: hasTls
      ? {
          ech_config_list: orNull(tls.ech_config_list),
          ech_force_query: orNull(tls.ech_force_query),
          pinned_peer_cert_sha256: pins,
          verify_peer_cert_by_name: names,
        }
      : null,
    reality_extra:
      host.security === "reality"
        ? {
            public_key: trimmed(host.reality_extra.public_key),
            short_id: trimmed(host.reality_extra.short_id),
            spider_x: orNull(host.reality_extra.spider_x),
          }
        : null,
    xhttp_extra: hasXhttp ? xhttpFields : null,
    mux_settings: hasMux ? { enabled: host.mux_enable, ...muxFields } : null,
  };
}

export const hostsSchema = z.record(
  z.string().min(1),
  z.array(
    z
      .object({
        remark: z.string().trim().min(1, "Remark is required").max(256),
        address: z.string().trim().min(1, "Address is required").max(256),
        port: z
          .union([z.string(), z.number(), z.null()])
          .transform((value) => (value === null || value === "" ? null : Number(value)))
          .refine(
            (value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 65535),
            "Port must be a whole number between 1 and 65535",
          ),
        path: z.string().nullable(),
        sni: z.string().nullable(),
        host: z.string().nullable(),
        mux_enable: z
          .boolean()
          .nullable()
          .transform((value) => value ?? false)
          .default(false),
        allowinsecure: z.boolean().nullable().default(false),
        is_disabled: z
          .boolean()
          .nullable()
          .transform((value) => value ?? false)
          .default(false),
        fragment_setting: z.string().nullable(),
        noise_setting: z.string().nullable(),
        random_user_agent: z
          .boolean()
          .nullable()
          .transform((value) => value ?? false)
          .default(false),
        security: z.string(),
        alpn: z.string(),
        fingerprint: z.string(),
        use_sni_as_host: z
          .boolean()
          .nullable()
          .transform((value) => value ?? false)
          .default(false),
        tls_extra: tlsExtraSchema.nullable().optional().default(emptyTlsExtra()),
        reality_extra: realityExtraSchema.nullable().optional().default(emptyRealityExtra()),
        xhttp_extra: xhttpExtraSchema.nullable().optional().default(emptyXhttpExtra()),
        mux_settings: muxSettingsSchema.nullable().optional().default(emptyMuxSettings()),
      })
      .superRefine((host, context) => {
        if (host.security === "reality" && !trimmed(host.reality_extra?.public_key)) {
          context.addIssue({
            code: "custom",
            path: ["reality_extra", "public_key"],
            message: "Public key is required for Reality",
          });
        }
        for (const [i, pin] of toList(host.tls_extra?.pinned_peer_cert_sha256).entries()) {
          if (!/^[0-9a-fA-F]{64}$/.test(pin)) {
            context.addIssue({
              code: "custom",
              path: ["tls_extra", "pinned_peer_cert_sha256"],
              message: `Pin ${i + 1} must be a 64-character hex SHA256`,
            });
            break;
          }
        }
      })
      .transform((host) => {
        const normalized = {
          ...host,
          tls_extra: host.tls_extra ?? emptyTlsExtra(),
          reality_extra: host.reality_extra ?? emptyRealityExtra(),
          xhttp_extra: host.xhttp_extra ?? emptyXhttpExtra(),
          mux_settings: host.mux_settings ?? emptyMuxSettings(),
        };
        return { ...host, ...toPayload(normalized) };
      }),
  ),
);

export type HostFormValues = z.input<typeof hostsSchema>;
export type HostValues = z.output<typeof hostsSchema>;
// Inbound tags may contain dots or brackets, which RHF treats as path separators.
export const toFormKey = (tag: string) =>
  `inbound_${encodeURIComponent(tag).replace(/[.!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`;
export const toInboundTag = (key: string) => decodeURIComponent(key.slice("inbound_".length));
export const newHost = (): HostFormValues[string][number] => ({
  remark: "",
  address: "",
  port: null,
  path: "",
  sni: "",
  host: "",
  mux_enable: false,
  allowinsecure: false,
  is_disabled: false,
  fragment_setting: "",
  noise_setting: "",
  random_user_agent: false,
  security: "inbound_default",
  alpn: "",
  fingerprint: "",
  use_sni_as_host: false,
  tls_extra: emptyTlsExtra(),
  reality_extra: emptyRealityExtra(),
  xhttp_extra: emptyXhttpExtra(),
  mux_settings: emptyMuxSettings(),
});
export function firstErrorPath(error: unknown, prefix = ""): string | null {
  if (!error || typeof error !== "object") return null;
  if ("message" in error && typeof error.message === "string") return prefix || null;
  for (const [key, value] of Object.entries(error)) {
    if (key === "ref") continue;
    const path = firstErrorPath(value, prefix ? `${prefix}.${key}` : key);
    if (path) return path;
  }
  return null;
}
// Server rows carry arrays/numbers/nulls; the form edits flat strings.
export function hostRowToForm(row: import("./resource").Hosts[string][number]): HostFormValues[string][number] {
  const base = newHost();
  const str = (value: unknown) => (value == null ? "" : String(value));
  const xmux = (row.xhttp_extra?.xmux ?? {}) as Record<string, unknown>;
  return {
    ...base,
    ...row,
    tls_extra: {
      ech_config_list: str(row.tls_extra?.ech_config_list),
      ech_force_query: str(row.tls_extra?.ech_force_query),
      pinned_peer_cert_sha256: (row.tls_extra?.pinned_peer_cert_sha256 ?? []).join(","),
      verify_peer_cert_by_name: (row.tls_extra?.verify_peer_cert_by_name ?? []).join(","),
    },
    reality_extra: {
      public_key: str(row.reality_extra?.public_key),
      short_id: str(row.reality_extra?.short_id),
      spider_x: str(row.reality_extra?.spider_x),
    },
    xhttp_extra: {
      mode: str(row.xhttp_extra?.mode),
      x_padding_bytes: str(row.xhttp_extra?.x_padding_bytes),
      sc_max_each_post_bytes: str(row.xhttp_extra?.sc_max_each_post_bytes),
      xmux: {
        max_concurrency: str(xmux.max_concurrency),
        max_connections: str(xmux.max_connections),
        c_max_reuse_times: str(xmux.c_max_reuse_times),
        h_max_reusable_secs: str(xmux.h_max_reusable_secs),
      },
    },
    mux_settings: {
      concurrency: str(row.mux_settings?.concurrency),
      xudp_concurrency: str(row.mux_settings?.xudp_concurrency),
      xudp_proxy_udp443: str(row.mux_settings?.xudp_proxy_udp443),
    },
  };
}
export function toHostFormValues(hosts: import("./resource").Hosts): HostFormValues {
  return Object.fromEntries(Object.entries(hosts).map(([tag, rows]) => [toFormKey(tag), rows.map(hostRowToForm)]));
}
