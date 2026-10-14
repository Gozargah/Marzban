import { z } from "zod";
export const hostsSchema = z.record(
  z.string().min(1),
  z.array(
    z.object({
      remark: z.string().trim().min(1, "Remark is required").max(256),
      address: z.string().trim().min(1, "Address is required").max(256),
      port: z.union([z.string(), z.number(), z.null()])
        .transform((value) => value === null || value === "" ? null : Number(value))
        .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 65535),
          "Port must be a whole number between 1 and 65535"),
      path: z.string().nullable(),
      sni: z.string().nullable(),
      host: z.string().nullable(),
      mux_enable: z.boolean().nullable().transform((value) => value ?? false).default(false),
      allowinsecure: z.boolean().nullable().default(false),
      is_disabled: z.boolean().nullable().transform((value) => value ?? false).default(false),
      fragment_setting: z.string().nullable(),
      noise_setting: z.string().nullable(),
      random_user_agent: z.boolean().nullable().transform((value) => value ?? false).default(false),
      security: z.string(),
      alpn: z.string(),
      fingerprint: z.string(),
      use_sni_as_host: z.boolean().nullable().transform((value) => value ?? false).default(false),
    }),
  ),
);

export type HostFormValues = z.input<typeof hostsSchema>;
export type HostValues = z.output<typeof hostsSchema>;
// Inbound tags may contain dots or brackets, which RHF treats as path separators.
export const toFormKey = (tag: string) => `inbound_${encodeURIComponent(tag).replace(/[.!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`;
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
export function toHostFormValues(hosts: import("./resource").Hosts): HostFormValues {
  return Object.fromEntries(Object.entries(hosts).map(([tag, rows]) => [toFormKey(tag), rows.map((row) => ({ ...newHost(), ...row }))]));
}
