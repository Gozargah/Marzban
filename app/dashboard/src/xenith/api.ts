import { useQuery } from "react-query";
import { fetch } from "service/http";
import { User } from "types/User";

export type SystemStats = {
  version: string;
  mem_total: number;
  mem_used: number;
  cpu_cores: number;
  cpu_usage: number;
  total_user: number;
  online_users: number;
  users_active: number;
  users_disabled: number;
  users_expired: number;
  users_limited: number;
  users_on_hold: number;
  incoming_bandwidth: number;
  outgoing_bandwidth: number;
  incoming_bandwidth_speed: number;
  outgoing_bandwidth_speed: number;
};

export type UsagePoint = { time: string; uplink: number; downlink: number };
export type UsageSeries = { period: UsagePeriod; granularity: "hour" | "day"; points: UsagePoint[] };
export type UsagePeriod = "24h" | "7d" | "30d";

export type CoreStats = { version: string; started: boolean; logs_websocket: string };

export type NodeSummary = {
  id: number;
  name: string;
  address: string;
  port: number;
  status: "connected" | "connecting" | "error" | "disabled";
  message?: string;
  xray_version?: string;
};

export type NodeUsage = { node_id: number | null; node_name: string; uplink: number; downlink: number };

export type Inbound = { tag: string; protocol: string; network: string; tls: string; port: number | string };

export type AdminProfile = { username: string; is_sudo: boolean };

const REFETCH_INTERVAL = 10_000;

export const useSystemStats = () =>
  useQuery<SystemStats>("xenith-system", () => fetch("/system"), { refetchInterval: REFETCH_INTERVAL });

export const useUsageSeries = (period: UsagePeriod) =>
  useQuery<UsageSeries>(["xenith-usage", period], () => fetch("/system/usage", { query: { period } }), {
    refetchInterval: 60_000,
  });

export const useCoreStats = () =>
  useQuery<CoreStats>("xenith-core", () => fetch("/core"), { refetchInterval: REFETCH_INTERVAL });

export const useNodes = () =>
  useQuery<NodeSummary[]>("xenith-nodes", () => fetch("/nodes"), { refetchInterval: REFETCH_INTERVAL });

/** Node usage over the last 24 hours. Sudo only, so failures are swallowed. */
export const useNodesUsage = () =>
  useQuery<{ usages: NodeUsage[] }>(
    "xenith-nodes-usage",
    () => {
      const end = new Date();
      const start = new Date(end.getTime() - 24 * 3600 * 1000);
      return fetch("/nodes/usage", { query: { start: start.toISOString(), end: end.toISOString() } });
    },
    { retry: false, refetchInterval: 60_000 },
  );

export const useInbounds = () =>
  useQuery<Record<string, Inbound[]>>("xenith-inbounds", () => fetch("/inbounds"));

/** Proxy hosts keyed by inbound tag. Sudo only. */
export const useHosts = () =>
  useQuery<Record<string, unknown[]>>("xenith-hosts", () => fetch("/hosts"), { retry: false });

export const useTopUsers = (limit = 5) =>
  useQuery<{ users: User[]; total: number }>("xenith-top-users", () =>
    fetch("/users", { query: { limit, sort: "-used_traffic" } }),
  );

export const useAdmin = () => useQuery<AdminProfile>("xenith-admin", () => fetch("/admin"));

export type Certificate = {
  name: string;
  domains: string[];
  expires_at: string | null;
  days_left: number | null;
  certificate_path: string | null;
  private_key_path: string | null;
};

export type CertificateList = {
  enabled: boolean;
  staging: boolean;
  certificates: Certificate[];
};

export type IssueCertificate = {
  domains: string[];
  email?: string;
  method: "standalone" | "webroot";
  webroot?: string;
};

/** Certificates certbot manages on the host. Sudo only. */
export const useCertificates = () =>
  useQuery<CertificateList>("xenith-certificates", () => fetch("/certificates"), { retry: false });

export const issueCertificate = (body: IssueCertificate) =>
  fetch("/certificates", { method: "POST", body });

export const renewCertificate = (name: string) =>
  fetch(`/certificates/${encodeURIComponent(name)}/renew`, { method: "POST" });

export const deleteCertificate = (name: string) =>
  fetch(`/certificates/${encodeURIComponent(name)}`, { method: "DELETE" });

export type Tunable = {
  key: string;
  kind: "int" | "ints" | "text";
  description: string;
  baseline: string;
  value: string;
  customised: boolean;
};

export type NetworkSection = { id: string; title: string; settings: Tunable[] };

export type NetworkInterface = { name: string; mac: string | null; mtu: number | null; addresses: string[] };

export type NetworkSettings = {
  enabled: boolean;
  writable: boolean;
  reason: string | null;
  managed_file: string;
  sections: NetworkSection[];
  interfaces: NetworkInterface[];
};

export type NetworkApplyResult = {
  applied: string[];
  failed: { key: string; message: string }[];
  settings: NetworkSettings;
};

export type NetworkProfile = {
  id: number;
  name: string;
  description: string | null;
  builtin: boolean;
  settings: Record<string, string>;
  created_at: string | null;
  updated_at: string | null;
};

/** Kernel tunables the panel manages. Sudo only, so failures are swallowed. */
export const useNetworkSettings = () =>
  useQuery<NetworkSettings>("xenith-network", () => fetch("/network"), { retry: false });

export const useNetworkProfiles = () =>
  useQuery<NetworkProfile[]>("xenith-network-profiles", () => fetch("/network/profiles"), { retry: false });

export const saveNetworkSettings = (settings: Record<string, string>) =>
  fetch("/network", { method: "PUT", body: { settings } }) as Promise<NetworkApplyResult>;

export const resetNetworkSettings = () =>
  fetch("/network/reset", { method: "POST" }) as Promise<NetworkApplyResult>;

export const createNetworkProfile = (body: {
  name: string;
  description?: string;
  settings?: Record<string, string>;
}) => fetch("/network/profiles", { method: "POST", body }) as Promise<NetworkProfile>;

export const applyNetworkProfile = (id: number) =>
  fetch(`/network/profiles/${id}/apply`, { method: "POST" }) as Promise<NetworkApplyResult>;

export const deleteNetworkProfile = (id: number) =>
  fetch(`/network/profiles/${id}`, { method: "DELETE" });

export type ResourceLimit = {
  name: string;
  soft: number | null;
  hard: number | null;
  /** null when the panel only reports this limit rather than raising it. */
  target: number | null;
  managed: boolean;
  at_target: boolean;
};

export type LimitsSnippet = { path: string; content: string; restart: string };

export type ResourceLimits = {
  enabled: boolean;
  reason: string | null;
  kernel_ceiling: number | null;
  target: number;
  limits: ResourceLimit[];
  snippets: LimitsSnippet[];
};

export type LimitsApplyResult = {
  raised: string[];
  written: LimitsSnippet[];
  problems: string[];
  limits: ResourceLimits;
};

/** The panel's own rlimits, and the host files that still need applying. */
export const useResourceLimits = () =>
  useQuery<ResourceLimits>("xenith-limits", () => fetch("/network/limits"), { retry: false });

export const raiseResourceLimits = () =>
  fetch("/network/limits/raise", { method: "POST" }) as Promise<LimitsApplyResult>;

export type NginxStatus = {
  enabled: boolean;
  running: boolean;
  version: string | null;
  config_ok: boolean | null;
  message: string | null;
  listening: number[];
  binary: string | null;
  paths: Record<string, string>;
};

export type NginxSite = { name: string; enabled: boolean; size: number; modified_at: string };
export type NginxSiteContent = { name: string; enabled: boolean; content: string };
export type NginxAsset = { path: string; size: number; modified_at: string };
export type NginxWebroot = { root: string; total_bytes: number; assets: NginxAsset[] };
export type NginxLog = { name: string; path: string; lines: number; content: string };
export type NginxResult = { detail: string; status: NginxStatus };

/** Everything below is sudo only, so failures are swallowed rather than retried. */
export const useNginxStatus = () =>
  useQuery<NginxStatus>("xenith-nginx", () => fetch("/nginx"), { retry: false });

export const useNginxSites = () =>
  useQuery<NginxSite[]>("xenith-nginx-sites", () => fetch("/nginx/sites"), { retry: false });

export const useNginxFiles = () =>
  useQuery<NginxWebroot>("xenith-nginx-files", () => fetch("/nginx/files"), { retry: false });

export const useNginxLog = (name: "access" | "error", lines = 200) =>
  useQuery<NginxLog>(
    ["xenith-nginx-log", name, lines],
    () => fetch(`/nginx/logs/${name}`, { query: { lines } }),
    { retry: false },
  );

export const testNginxConfig = () => fetch("/nginx/test", { method: "POST" }) as Promise<NginxResult>;
export const reloadNginx = () => fetch("/nginx/reload", { method: "POST" }) as Promise<NginxResult>;

export const readNginxSite = (name: string) =>
  fetch(`/nginx/sites/${encodeURIComponent(name)}`) as Promise<NginxSiteContent>;

export const writeNginxSite = (name: string, content: string) =>
  fetch(`/nginx/sites/${encodeURIComponent(name)}`, { method: "PUT", body: { content } }) as Promise<NginxResult>;

export const setNginxSiteEnabled = (name: string, enabled: boolean) =>
  fetch(`/nginx/sites/${encodeURIComponent(name)}/${enabled ? "enable" : "disable"}`, {
    method: "POST",
  }) as Promise<NginxResult>;

export const deleteNginxSite = (name: string) =>
  fetch(`/nginx/sites/${encodeURIComponent(name)}`, { method: "DELETE" }) as Promise<NginxResult>;

export const readNginxFile = (path: string) =>
  fetch("/nginx/files/content", { query: { path } }) as Promise<{ path: string; content: string }>;

export const writeNginxFile = (path: string, content: string) =>
  fetch("/nginx/files", { method: "PUT", body: { path, content } }) as Promise<NginxAsset>;

export const deleteNginxFile = (path: string) =>
  fetch("/nginx/files", { method: "DELETE", query: { path } });

/** Uploads go as multipart, so the body is a FormData rather than JSON. */
export const uploadNginxFile = (file: File, path?: string) => {
  const body = new FormData();
  body.append("file", file);
  return fetch("/nginx/files/upload", {
    method: "POST",
    body,
    query: path ? { path } : undefined,
  }) as Promise<NginxAsset>;
};

export const restartCore = () => fetch("/core/restart", { method: "POST" });

/** Every inbound, flattened out of the by-protocol map the API returns. */
export const flattenInbounds = (grouped?: Record<string, Inbound[]>): (Inbound & { protocol: string })[] =>
  Object.entries(grouped || {}).flatMap(([protocol, inbounds]) =>
    (inbounds || []).map((inbound) => ({ ...inbound, protocol })),
  );
