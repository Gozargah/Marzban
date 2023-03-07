export type UserStatus = "active" | "deactive" | "limited" | "expired";
export type ProxyKeys = ("vmess" | "vless" | "trojan" | "shadowsocks")[];
export type ProxyType = {
  vmess?: {
    id?: string;
  };
  vless?: {
    id?: string;
  };
  trojan?: { password?: string };
  shadowsocks?: {
    password?: string;
  };
};

export type DataLimitResetStrategy =
  | "no_reset"
  | "day"
  | "week"
  | "month"
  | "year";

export type User = {
  proxies: ProxyType;
  expire: number | null;
  data_limit: number | null;
  data_limit_reset_strategy: DataLimitResetStrategy;
  lifetime_used_traffic: number;
  username: string;
  used_traffic: number;
  status: UserStatus;
  links: string[];
  subscription_url: string;
};

export type UserCreate = Pick<
  User,
  "proxies" | "expire" | "data_limit" | "username" | "data_limit_reset_strategy"
>;
