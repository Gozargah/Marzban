import { ProxyHostSecurity } from "types/ProxyHosts";

export const proxyHostSecurity: { title: string; value: ProxyHostSecurity }[] =
  [
    {
      title: "Inbound's default",
      value: "inbound_default",
    },
    {
      title: "TLS",
      value: "tls",
    },
    {
      title: "None",
      value: "none",
    },
  ];

export const proxyALPN: { title: string; value: string }[] = [
  {
    title: "",
    value: "",
  },
  {
    title: "h3",
    value: "h3",
  },
  {
    title: "h2",
    value: "h2",
  },
  {
    title: "http/1.1",
    value: "http/1.1",
  },
  {
    title: "h3,h2,http/1.1",
    value: "h3,h2,http/1.1",
  },
  {
    title: "h3,h2",
    value: "h3,h2",
  },
  {
    title: "h2,http/1.1",
    value: "h2,http/1.1",
  },
];

export const proxyFingerprint: { title: string; value: string }[] = [
  {
    title: "",
    value: "",
  },
  ...[
    "chrome",
    "firefox",
    "safari",
    "ios",
    "android",
    "edge",
    "360",
    "qq",
    "random",
    "randomized",
  ].map((key) => ({ title: key, value: key })),
];

export const XTLSFlows = [
  { title: "none", value: "" },
  { title: "xtls-rprx-vision", value: "xtls-rprx-vision" },
];

export const shadowsocksMethods = [
  "aes-128-gcm",
  "aes-256-gcm",
  "chacha20-ietf-poly1305",
];
