/**
 * Shared state for the YUKU settings tabs.
 *
 * The settings live in one key/value table and are saved with a single PUT, but
 * the panel now shows them on three tabs (subscription, auto-select, devices).
 * Keeping the loaded object in a context means switching tabs doesn't discard
 * unsaved edits and one Save button still writes the whole thing.
 */
import { useToast } from "@chakra-ui/react";
import {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from "react";
import { fetch } from "service/http";

export type Settings = {
  expired_notice: string;
  device_limit_notice: string;
  default_device_limit: string;
  announce: string;
  announce_align: string;
  subscription_routing: string;
  auto_select_remark: string;
  auto_select_strategy: string;
  auto_select_interval: string;
  auto_select_destination: string;
  auto_select_groups: string;
};

export type AutoSelectGroup = {
  remark: string;
  strategy: string;
  interval: string;
  destination: string;
};

export const EMPTY_GROUP: AutoSelectGroup = {
  remark: "",
  strategy: "leastLoad",
  interval: "1m",
  destination: "",
};

export const EMPTY_SETTINGS: Settings = {
  expired_notice: "",
  device_limit_notice: "",
  default_device_limit: "0",
  announce: "",
  announce_align: "left",
  subscription_routing: "off",
  auto_select_remark: "",
  auto_select_strategy: "leastLoad",
  auto_select_interval: "1m",
  auto_select_destination: "",
  auto_select_groups: "",
};

// Kept in sync with AUTO_SELECT_STRATEGIES in app/subscription/v2ray.py.
export const AUTO_SELECT_STRATEGIES: Array<[string, string, string]> = [
  [
    "leastLoad",
    "leastLoad",
    "Самый быстрый по замерам скорости (burstObservatory). Точнее пинга, но нагружает серверы.",
  ],
  ["leastPing", "leastPing", "Самый низкий пинг (observatory). Дешевле по трафику, чем leastLoad."],
  ["roundRobin", "roundRobin", "По очереди, без замеров. Простое равномерное распределение."],
  ["random", "random", "Случайный сервер, без замеров."],
];

/** Groups as stored, falling back to the single-group keys the feature
 *  shipped with so an older panel's entry isn't silently dropped. */
export const readGroups = (settings: Settings): AutoSelectGroup[] => {
  let parsed: any = [];
  if (settings.auto_select_groups) {
    try {
      parsed = JSON.parse(settings.auto_select_groups);
    } catch {
      parsed = [];
    }
  }
  const groups: AutoSelectGroup[] = (Array.isArray(parsed) ? parsed : []).map(
    (g: any) => ({ ...EMPTY_GROUP, ...(g || {}) })
  );
  if (groups.length === 0) {
    groups.push({
      remark: settings.auto_select_remark || "",
      strategy: settings.auto_select_strategy || EMPTY_GROUP.strategy,
      interval: settings.auto_select_interval || EMPTY_GROUP.interval,
      destination: settings.auto_select_destination || "",
    });
  }
  return groups;
};

type YukuSettingsApi = {
  data: Settings;
  groups: AutoSelectGroup[];
  loading: boolean;
  saving: boolean;
  dirty: boolean;
  patch: (patch: Partial<Settings>) => void;
  setGroups: (update: (list: AutoSelectGroup[]) => AutoSelectGroup[]) => void;
  patchGroup: (index: number, patch: Partial<AutoSelectGroup>) => void;
  save: () => void;
  reload: () => void;
};

const YukuSettingsContext = createContext<YukuSettingsApi | null>(null);

export const useYukuSettings = (): YukuSettingsApi => {
  const api = useContext(YukuSettingsContext);
  if (!api)
    throw new Error("useYukuSettings must be used inside <YukuSettingsProvider>");
  return api;
};

export const YukuSettingsProvider: FC<PropsWithChildren> = ({ children }) => {
  const [data, setData] = useState<Settings>(EMPTY_SETTINGS);
  const [groups, setGroupsState] = useState<AutoSelectGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const toast = useToast();

  const apply = (payload: any) => {
    const settings: Settings = { ...EMPTY_SETTINGS, ...payload };
    setData(settings);
    setGroupsState(readGroups(settings));
    setDirty(false);
  };

  const reload = () => {
    setLoading(true);
    fetch("/yuku/settings")
      .then(apply)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const patch = (patch: Partial<Settings>) => {
    setData((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const setGroups = (update: (list: AutoSelectGroup[]) => AutoSelectGroup[]) => {
    setGroupsState(update);
    setDirty(true);
  };

  const patchGroup = (index: number, groupPatch: Partial<AutoSelectGroup>) =>
    setGroups((list) =>
      list.map((g, i) => (i === index ? { ...g, ...groupPatch } : g))
    );

  const save = () => {
    setSaving(true);
    // the group list is the source of truth from here on; group 1 also
    // overwrites the single-group keys so both stay in step
    const first = groups[0] ?? EMPTY_GROUP;
    const body = {
      ...data,
      auto_select_groups: JSON.stringify(groups),
      auto_select_remark: first.remark,
      auto_select_strategy: first.strategy,
      auto_select_interval: first.interval,
      auto_select_destination: first.destination,
    };
    fetch("/yuku/settings", { method: "PUT", body })
      .then((payload: any) => {
        apply(payload);
        toast({
          title: "Настройки сохранены",
          status: "success",
          isClosable: true,
          duration: 3000,
          position: "top",
        });
      })
      .catch((err: any) => {
        // the backend refuses e.g. deleting a group that hosts still use —
        // showing only "Ошибка сохранения" would hide why
        toast({
          title: "Ошибка сохранения",
          description: err?.response?._data?.detail ?? err?.data?.detail,
          status: "error",
          isClosable: true,
          duration: 6000,
          position: "top",
        });
      })
      .finally(() => setSaving(false));
  };

  return (
    <YukuSettingsContext.Provider
      value={{
        data,
        groups,
        loading,
        saving,
        dirty,
        patch,
        setGroups,
        patchGroup,
        save,
        reload,
      }}
    >
      {children}
    </YukuSettingsContext.Provider>
  );
};
