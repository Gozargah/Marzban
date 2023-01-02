export type UserStatus = "active" | "limited" | "expired";
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
export type User = {
  proxies: ProxyType;
  expire: number | null;
  data_limit: number | null;
  username: string;
  used_traffic: number;
  status: UserStatus;
  links: string[];
  sub_token: string;
};

export type UserCreate = Pick<
  User,
  "proxies" | "expire" | "data_limit" | "username"
>;
