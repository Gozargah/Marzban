import type { ProxyKeys, ProxyType, User, UserCreate, UserInbounds } from "types/User";
import { z } from "zod";

export type FormType = Pick<UserCreate, keyof UserCreate> & {
  selected_proxies: ProxyKeys;
};

export const formatUser = (user: User): FormType => {
  return {
    ...user,
    data_limit: user.data_limit ? Number((user.data_limit / 1073741824).toFixed(5)) : user.data_limit,
    on_hold_expire_duration: user.on_hold_expire_duration
      ? Number(user.on_hold_expire_duration / (24 * 60 * 60))
      : user.on_hold_expire_duration,
    selected_proxies: Object.keys(user.proxies) as ProxyKeys,
  };
};
export const getDefaultValues = (availableInbounds: ReadonlyMap<string, readonly { tag: string }[]>): FormType => {
  const defaultInbounds = Object.fromEntries(availableInbounds);
  const inbounds: UserInbounds = {};
  for (const key in defaultInbounds) {
    inbounds[key] = defaultInbounds[key].map((i) => i.tag);
  }
  return {
    selected_proxies: Object.keys(defaultInbounds) as ProxyKeys,
    data_limit: null,
    expire: null,
    username: "",
    data_limit_reset_strategy: "no_reset",
    status: "active",
    on_hold_expire_duration: null,
    note: "",
    inbounds,
    proxies: {
      vless: { id: "", flow: "" },
      vmess: { id: "" },
      trojan: { password: "" },
      shadowsocks: { password: "", method: "chacha20-ietf-poly1305" },
    },
  };
};

export const mergeProxies = (proxyKeys: ProxyKeys, proxyType: ProxyType | undefined): ProxyType => {
  const proxies: ProxyType = proxyKeys.reduce((ac, a) => ({ ...ac, [a]: {} }), {});
  if (!proxyType) return proxies;
  proxyKeys.forEach((proxy) => {
    if (proxyType[proxy]) {
      proxies[proxy] = proxyType[proxy];
    }
  });
  return proxies;
};

const baseSchema = {
  username: z.string().min(1, { message: "userDialog.fieldRequired" }),
  selected_proxies: z.array(z.string()).refine((value) => value.length > 0, {
    message: "userDialog.selectOneProtocol",
  }),
  note: z.string().nullable(),
  proxies: z.record(z.string(), z.record(z.string(), z.any())).transform((ins) => {
    const deleteIfEmpty = (obj: any, key: string) => {
      if (obj && obj[key] === "") {
        delete obj[key];
      }
    };
    deleteIfEmpty(ins.vmess, "id");
    deleteIfEmpty(ins.vless, "id");
    deleteIfEmpty(ins.trojan, "password");
    deleteIfEmpty(ins.shadowsocks, "password");
    deleteIfEmpty(ins.shadowsocks, "method");
    return ins;
  }),
  data_limit: z
    .string()
    .min(0)
    .or(z.number())
    .nullable()
    .refine((value) => value === null || value === "" || (Number.isFinite(Number(value)) && Number(value) >= 0), { message: "userDialog.invalidDataLimit" })
    .transform((str) => {
      if (str) return Number((Number(str) * 1073741824).toFixed(5));
      return 0;
    })
    .refine(Number.isFinite, { message: "userDialog.invalidDataLimit" }),
  expire: z.number().nullable(),
  data_limit_reset_strategy: z.string(),
  inbounds: z.record(z.string(), z.array(z.string())).transform((ins) => {
    Object.keys(ins).forEach((protocol) => {
      if (Array.isArray(ins[protocol]) && !ins[protocol]?.length) delete ins[protocol];
    });
    return ins;
  }),
};

export const userFormSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("active"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("disabled"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("limited"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("expired"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("on_hold"),
    on_hold_expire_duration: z.coerce
      .number()
      .min(0.1, "userDialog.validDuration")
      .transform((d) => {
        return d * (24 * 60 * 60);
      }),
    ...baseSchema,
  }),
]);

export function toUserCreate(values: FormType): UserCreate {
  const { selected_proxies, ...rest } = values;
  return {
    ...rest,
    proxies: mergeProxies(selected_proxies, values.proxies),
    data_limit_reset_strategy: values.data_limit && values.data_limit > 0 ? values.data_limit_reset_strategy : "no_reset",
    status: values.status === "active" || values.status === "disabled" || values.status === "on_hold" ? values.status : "active",
  };
}
