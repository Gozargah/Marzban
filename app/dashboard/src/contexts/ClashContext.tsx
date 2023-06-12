import { fetch } from "service/http";
import { create } from "zustand";

export type Setting = {
  name: string;
  content: string;
}

export type User = {
  username: string;
  code?: string;
  tags?: string;
  domain?: string;
  sublink?: string;
};

export type UserFilter = {
  search?: string;
  limit?: number;
  offset?: number;
  sort: string;
};

export type ProxyTag = {
  tag: string;
  servers: string[];
}

export type ProxyInbound = {
  name: string;
  type: "trojan" | "vless" | "vmess" | "shadowsocks";
  security: string;
  network: string;
  servername: string;
  port: string;
  ws_path: string;
};

export type ProxySettings = {
  icon?: string;
  trojan?: {
    security: "none" | "tls"; // | "reality";
    fingerprint: string;
    udp: boolean;
    alpn: string;
    sni: string;
    allow_insecure: boolean;
    ws_addition_path: string;
  };
  vless?: {
    security: "none" | "tls"; // | "reality";
    fingerprint: string;
    servername: string;
    alpn: string;
    udp: boolean;
    allow_insecure: boolean;
    ws_addition_path: string;
  };
  vmess?: {
    security: "none" | "tls"; // | "reality";
    fingerprint: string;
    allow_insecure: boolean;
    servername: string;
    alpn: string;
    udp: boolean;
    ws_addition_path: string;
  };
  shadowsocks?: {};
};

export type Proxy = {
  id?: number;
  name: string;
  server: string;
  inbound: string;
  tag?: string;
  port: string;
  settings: ProxySettings;
};

export type ProxyBrief = Pick<Proxy, | "name" | "server" | "tag"> & { 
  id: string;
  builtin: boolean;
};

export type ProxyFilter = {
  search?: string;
  limit?: number;
  offset?: number;
  sort: string;
};

export type ProxyGroupSettings = {
  icon?: string;
  relay?: {},
  url_test?: {
    tolerance: number;
    lazy: boolean;
    url: string;
    interval: number;
  },
  fallback?: {
    url: string;
    interval: number;
  },
  load_balance?: {
    strategy: string;
    url: string;
    interval: number;
  },
  select?: {
    disable_udp: boolean;
    filter: string;
  }
};

export type ProxyGroup = {
  id?: number;
  name: string;
  tag: string;
  type: string;
  builtin: boolean;
  proxies: string;
  settings: ProxyGroupSettings;
};

export type ProxyGroupFilter = {
  search?: string;
  limit?: number;
  offset?: number;
  sort: string;
};

export type Rule = {
  id?: number;
  type: string;
  content: string;
  option?: string;
  ruleset: string;
};

export type RuleFilter = {
  search?: string;
  limit?: number;
  offset?: number;
  ruleset?: string;
  sort: string;
};

export type Ruleset = {
  id?: number;
  name: string;
  builtin?: boolean;
  preferred_proxy: string;
  settings: {
    icon?: string;
  }
};

export type Alert = {
  title: string;
  content: string;
  type: "error" | "success" | "warning" | "info";
  yes: string;
  onConfirm: () => void;
};

export type SubscriptionStore = {
  loading: boolean;

  sublink: string | null;
  setSublink: (sublink: string | null) => void;

  // delete modal
  alert: Alert | null | undefined;
  onAlert: (del: Alert | null) => void;

  settings: {
    [key: string]: Setting;
  };
  fetchSetting: (body: Partial<Setting>) => Promise<void>;
  editSetting: (body: Setting) => Promise<void>;

  // get rules or rulesets
  rules: Rule[];
  totalRules: number;
  rulesets: Ruleset[];
  ruleFilter: RuleFilter;
  fetchRules: () => Promise<void>;
  fetchRulesets: () => Promise<void>;
  onRuleFilterChange: (filter: Partial<RuleFilter>) => void;

  // edit or create rule
  isCreatingRule: boolean;
  editingRule: Rule | null | undefined;
  onCreateRule: (isOpen: boolean) => void;
  onEditingRule: (rule: Rule | null) => void;
  createRule: (body: Rule) => Promise<void>;
  editRule: (body: Rule) => Promise<void>;
  deleteRule: (body: Rule) => Promise<void>;

  // edit or create ruleset
  isCreatingRuleset: boolean;
  editingRuleset: Ruleset | null | undefined;
  onCreateRuleset: (isOpen: boolean) => void;
  onEditingRuleset: (rule: Ruleset | null) => void;
  createRuleset: (body: Ruleset) => Promise<void>;
  editRuleset: (body: Ruleset) => Promise<void>;
  deleteRuleset: (body: Ruleset) => Promise<void>;

  proxyTags: ProxyTag[];
  proxyInbounds: ProxyInbound[];
  proxyBriefs: ProxyBrief[];
  proxies: Proxy[];
  totalProxies: number;
  proxyFilter: ProxyFilter;
  fetchProxies: () => Promise<void>;
  fetchProxyTags: () => Promise<void>;
  fetchProxyInbounds: () => Promise<void>;
  fetchProxyBriefs: () => Promise<void>;
  onProxyFilterChange: (filter: Partial<ProxyFilter>) => void;
  isCreatingProxy: boolean;
  editingProxy: Proxy | null | undefined;
  duplicatingProxy: Proxy | null | undefined;
  onCreateProxy: (isOpen: boolean) => void;
  onEditingProxy: (proxy: Proxy | null) => void;
  onDuplicatingProxy: (proxy: Proxy | null) => void;
  createProxy: (body: Proxy) => Promise<void>;
  editProxy: (body: Proxy) => Promise<void>;
  deleteProxy: (body: Proxy) => Promise<void>;

  proxyGroups: ProxyGroup[];
  totalProxyGroups: number;
  proxyGroupFilter: ProxyGroupFilter;
  fetchProxyGroups: () => Promise<void>;
  onProxyGroupFilterChange: (filter: Partial<ProxyGroupFilter>) => void;
  isCreatingProxyGroup: boolean;
  editingProxyGroup: ProxyGroup | null | undefined;
  duplicatingProxyGroup: ProxyGroup | null | undefined;
  onCreateProxyGroup: (isOpen: boolean) => void;
  onEditingProxyGroup: (proxyGroup: ProxyGroup | null) => void;
  onDuplicatingProxyGroup: (proxyGroup: ProxyGroup | null) => void;
  createProxyGroup: (body: ProxyGroup) => Promise<void>;
  editProxyGroup: (body: ProxyGroup) => Promise<void>;
  deleteProxyGroup: (body: ProxyGroup) => Promise<void>;

  users: User[];
  totalUsers: number;
  userFilter: UserFilter;
  fetchUsers: () => Promise<void>;
  onUserFilterChange: (filter: Partial<UserFilter>) => void;
  editingUser: User | null;
  onEditingUser: (user: User | null) => void;
  editUser: (body: User) => Promise<void>;
  resetUserAuthCode: (body: User) => Promise<void>;
};

export const useClash = create<SubscriptionStore>((set, get) => ({
  loading: false,

  sublink: null,
  setSublink: (sublink) => set({ sublink }),

  settings: {},
  fetchSetting: (body) => {
    set({ loading: true });
    return fetch(`/clash/setting/${body.name}`)
      .then((setting) => {
        set({ loading: false });
        let settings = get().settings;
        settings[setting.name] = setting;
        set({ settings });
        return setting;
      })
  },
  editSetting: (body) => {
    return fetch(`/clash/setting/${body.name}`, { method: "PUT", body })
      .then((setting) => {
        let settings = get().settings;
        settings[setting.name] = setting;
        set({ settings });
        return setting;
      })
  },

  alert: null,
  onAlert: (alert) => set({ alert }),

  rules: [],
  totalRules: 0,
  rulesets: [],
  ruleFilter: { value:"", sort: "-created_at", limit: 10 },
  fetchRules: () => {
    var query = get().ruleFilter;
    for (const key in query) {
      if (!query[key as keyof RuleFilter]) delete query[key as keyof RuleFilter];
    }
    set({ loading: true });
    return fetch("/clash/rules", { query })
      .then((response) => {
        set({ rules: response.data, totalRules: response.total });
        return response.data;
      })
      .finally(() => {
        set({ loading: false });
      });
  },
  fetchRulesets: () => {
    return fetch("/clash/rulesets")
      .then((response) => {
        useClash.setState({ rulesets: response.data });
        return response.data;
      });
  },
  onRuleFilterChange: (filter) => {
    set({
      ruleFilter: {
        ...get().ruleFilter,
        ...filter,
      },
    });
    get().fetchRules();
  },

  isCreatingRule: false,
  editingRule: null,
  onCreateRule: (isCreatingRule) => set({ isCreatingRule }),
  onEditingRule: (editingRule) => set({ editingRule }),
  createRule: (body: Rule) => {
    return fetch(`/clash/rule`, { method: "POST", body }).then(() => {
      set({ editingRule: null });
      get().fetchRules();
    });
  },
  editRule: (body: Rule) =>{
    return fetch(`/clash/rule/${body.id}`, { method: "PUT", body }).then(
      () => {
        set({ editingRule: null });
        get().fetchRules();
      }
    );
  },
  deleteRule: (body: Rule) => {
    return fetch(`/clash/rule/${body.id}`, { method: "DELETE" }).then(() => {
      set({ editingRule: null });
      get().fetchRules();
    });
  },

  isCreatingRuleset: false,
  editingRuleset: null,
  onCreateRuleset: (isCreatingRuleset) => set({ isCreatingRuleset }),
  onEditingRuleset: (editingRuleset) => set({ editingRuleset }),
  createRuleset: (body: Ruleset) => {
    return fetch(`/clash/ruleset`, { method: "POST", body }).then(() => {
      set({ editingRuleset: null });
      get().fetchRulesets();
    });
  },
  editRuleset: (body: Ruleset) =>{
    return fetch(`/clash/ruleset/${body.id}`, { method: "PUT", body }).then(
      () => {
        set({ editingRuleset: null });
        get().fetchRulesets();
      }
    );
  },
  deleteRuleset: (body: Ruleset) => {
    return fetch(`/clash/ruleset/${body.id}`, { method: "DELETE" }).then(() => {
      set({ editingRuleset: null });
      get().ruleFilter.ruleset = "";
      get().fetchRulesets();
      get().fetchRules();
    });
  },

  proxyTags: [],
  proxyInbounds: [],
  proxyBriefs: [],
  proxies: [],
  totalProxies: 0,
  proxyFilter: { search:"", sort: "id", limit: 10 },
  fetchProxies: () => {
    var query = get().proxyFilter;
    for (const key in query) {
      if (!query[key as keyof ProxyFilter]) delete query[key as keyof ProxyFilter];
    }
    set({ loading: true });
    return fetch("/clash/proxies", { query })
      .then((response) => {
        set({ proxies: response.data, totalProxies: response.total });
        return response.data;
      })
      .finally(() => {
        set({ loading: false });
      });
  },
  fetchProxyTags: () => {
    return fetch("/clash/proxy/tags")
      .then((response) => {
        set({ proxyTags: response.data });
        return response.data;
      });
  },
  fetchProxyInbounds: () => {
    return fetch("/clash/proxy/inbounds")
      .then((response) => {
        set({ proxyInbounds: response.data });
        return response.data;
      });
  },
  fetchProxyBriefs: () => {
    return fetch("/clash/proxy/briefs")
      .then((response) => {
        set({ proxyBriefs: response.data });
        return response.data;
      });
  },
  onProxyFilterChange: (filter) => {
    set({
      proxyFilter: {
        ...get().proxyFilter,
        ...filter,
      },
    });
    get().fetchProxies();
  },
  isCreatingProxy: false,
  editingProxy: null,
  duplicatingProxy: null,
  onCreateProxy: (isCreatingProxy) => set({ isCreatingProxy }),
  onEditingProxy: (editingProxy) => set({ editingProxy }),
  onDuplicatingProxy: (duplicatingProxy) => {
    if (duplicatingProxy) {
      get().onEditingProxy(null);
      set({ duplicatingProxy });
      get().onCreateProxy(true);
    } else {
      set({ duplicatingProxy });
    }
  },
  createProxy: (body: Proxy) => {
    return fetch(`/clash/proxy`, { method: "POST", body }).then(() => {
      set({ editingProxy: null });
      get().fetchProxyBriefs();
      get().fetchProxyTags();
      get().fetchProxies();
    });
  },
  editProxy: (body: Proxy) =>{
    return fetch(`/clash/proxy/${body.id}`, { method: "PUT", body }).then(() => {
      if (get().editingProxy?.tag != body.tag) {
        get().fetchUsers();
      }
      set({ editingProxy: null });
      get().fetchProxyBriefs();
      get().fetchProxyTags();
      get().fetchProxies();
    });
  },
  deleteProxy: (body: Proxy) => {
    return fetch(`/clash/proxy/${body.id}`, { method: "DELETE" }).then(() => {
      set({ editingProxy: null });
      get().fetchUsers();
      get().fetchProxyBriefs();
      get().fetchProxyTags();
      get().fetchProxies();
    });
  },

  proxyGroups:  [],
  totalProxyGroups: 0,
  proxyGroupFilter: { search:"", sort: "id", limit: 10 },
  fetchProxyGroups: () => {
    var query = get().proxyGroupFilter;
    for (const key in query) {
      if (!query[key as keyof ProxyGroupFilter]) delete query[key as keyof ProxyGroupFilter];
    }
    set({ loading: true });
    return fetch("/clash/proxy/groups", { query })
      .then((response) => {
        set({ proxyGroups: response.data, totalProxyGroups: response.total });
        return response.data;
      })
      .finally(() => {
        set({ loading: false });
      });
  },
  onProxyGroupFilterChange: (filter) => {
    set({
      proxyGroupFilter: {
        ...get().proxyGroupFilter,
        ...filter,
      },
    });
    get().fetchProxyGroups();
  },
  isCreatingProxyGroup: false,
  editingProxyGroup: null,
  duplicatingProxyGroup: null,
  onCreateProxyGroup: (isCreatingProxyGroup) => set({ isCreatingProxyGroup }),
  onEditingProxyGroup: (editingProxyGroup) => set({ editingProxyGroup }),
  onDuplicatingProxyGroup: (duplicatingProxyGroup) => {
    if (duplicatingProxyGroup) {
      get().onEditingProxyGroup(null);
      set({ duplicatingProxyGroup });
      get().onCreateProxyGroup(true);
    } else {
      set({ duplicatingProxyGroup });
    }
  },
  createProxyGroup: (body: ProxyGroup) => {
    return fetch(`/clash/proxy/group`, { method: "POST", body }).then(() => {
      set({ editingProxyGroup: null });
      get().fetchProxyTags();
      get().fetchProxyGroups();
      get().fetchProxyBriefs();
    });
  },
  editProxyGroup: (body: ProxyGroup) =>{
    return fetch(`/clash/proxy/group/${body.id}`, { method: "PUT", body }).then(
      () => {
        if (get().editingProxyGroup?.tag != body.tag) {
          get().fetchUsers();
        }
        set({ editingProxyGroup: null });
        get().fetchProxyTags();
        get().fetchProxyGroups();
        get().fetchProxyBriefs();
      }
    );
  },
  deleteProxyGroup: (body: ProxyGroup) => {
    return fetch(`/clash/proxy/group/${body.id}`, { method: "DELETE" }).then(() => {
      const editingProxyGroup = get().editingProxyGroup;
      if (editingProxyGroup?.tag) {
        get().fetchUsers();
      }
      set({ editingProxyGroup: null });
      get().fetchProxyTags();
      get().fetchProxyGroups();
      get().fetchProxyBriefs();
    });
  },

  users: [],
  totalUsers: 0,
  userFilter: { search:"", sort: "-created_at", limit: 10 },
  fetchUsers: () => {
    var query = get().userFilter;
    for (const key in query) {
      if (!query[key as keyof UserFilter]) delete query[key as keyof UserFilter];
    }
    set({ loading: true });
    return fetch("/clash/users", { query })
      .then((response) => {
        set({ users: response.data, totalUsers: response.total });
        return response.data;
      })
      .finally(() => {
        set({ loading: false });
      });
  },
  onUserFilterChange: (filter) => {
    set({
      userFilter: {
        ...get().userFilter,
        ...filter,
      },
    });
    get().fetchUsers();
  },
  editingUser: null,
  onEditingUser: (editingUser) => {
    set({ editingUser });
  },
  editUser: (body: User) => {
    return fetch(`/clash/user/${body.username}`, { method: "PUT", body }).then(() => {
      set({ editingUser: null });
      get().fetchUsers();
    });
  },
  resetUserAuthCode: (body) => {
    return fetch(`/clash/user/${body.username}/authcode/reset`, { method: "PUT" })
      .then((data) => {
        get().fetchUsers();
        get().editingUser!.code = data.code;
      });
  },
}));
