import dayjs from "dayjs";
import debounce from "lodash.debounce";
import { Link as LinkIcon, QrCode, RotateCcw, Smartphone, SquarePen, Trash2 } from "lucide-react";
import { ChangeEvent, FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CoreSettingsModal } from "components/CoreSettingsModal";
import { DeleteUserModal } from "components/DeleteUserModal";
import { HostsDialog } from "components/HostsDialog";
import { NodesDialog } from "components/NodesModal";
import { NodesUsage } from "components/NodesUsage";
import { QRCodeDialog } from "components/QRCodeDialog";
import { ResetAllUsageModal } from "components/ResetAllUsageModal";
import { ResetUserUsageModal } from "components/ResetUserUsageModal";
import { UserDevicesModal } from "components/UserDevicesModal";
import { RevokeSubscriptionModal } from "components/RevokeSubscriptionModal";
import { UserDialog } from "components/UserDialog";
import { fetchInbounds, FilterType, useDashboard } from "contexts/DashboardContext";
import { router } from "pages/Router";
import { User } from "types/User";
import { Blueprint } from "xenith/Blueprint";
import { formatBytes, formatPercent, groupDigits } from "xenith/format";
import { PanelEmpty } from "xenith/panels";

const STATUSES: (FilterType["status"] | undefined)[] = [
  undefined,
  "active",
  "limited",
  "expired",
  "disabled",
  "on_hold",
];

const STATUS_TAG: Record<string, string> = {
  active: "xn-tag-accent",
  limited: "xn-tag-outline",
  expired: "xn-tag-outline",
  disabled: "xn-tag-neutral",
  on_hold: "xn-tag-neutral",
};

const PAGE_SIZES = [10, 20, 50];

/** Column header that toggles between ascending and descending on its field. */
const SortHeader: FC<{
  field: string;
  label: string;
  sort: string;
  onSort: (value: string) => void;
  align?: "left" | "right";
  width?: number;
}> = ({ field, label, sort, onSort, align = "left", width }) => {
  const active = sort === field || sort === `-${field}`;
  const descending = sort === `-${field}`;
  return (
    <th style={{ width, textAlign: align }}>
      <button
        onClick={() => onSort(active && descending ? field : `-${field}`)}
        style={{
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          font: "inherit",
          letterSpacing: "inherit",
          textTransform: "inherit",
          color: active ? "var(--xn-accent-800)" : "inherit",
        }}
      >
        {label}
        {active ? (descending ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );
};

/** Expiry as a relative phrase, or the on-hold duration when never started. */
const useExpiryText = () => {
  const { t } = useTranslation();
  return (user: User) => {
    if (user.status === "on_hold") return t("xenith.users.onHold");
    if (!user.expire) return t("xenith.users.never");
    const expire = dayjs(user.expire * 1000);
    return expire.isBefore(dayjs())
      ? t("xenith.users.expiredAgo", { time: expire.fromNow(true) })
      : t("xenith.users.expiresIn", { time: expire.fromNow(true) });
  };
};

export const Users: FC = () => {
  const { t } = useTranslation();
  const { users, loading, filters, onFilterChange, onCreateUser, onEditingUser, onDeletingUser, setQRCode, setSubLink } =
    useDashboard();
  const [search, setSearch] = useState(filters.search || "");
  const expiryText = useExpiryText();

  useEffect(() => {
    useDashboard.getState().refetchUsers();
    fetchInbounds();
  }, []);

  useEffect(() => {
    const initFilters = debounce((params: URLSearchParams) => {
      useDashboard.getState().onFilterChange(
        {
          search: params.get("search") || undefined,
          status: (params.get("status") as FilterType["status"]) || undefined,
          sort: params.get("sort") || "-created_at",
          offset: params.get("offset") ? Number(params.get("offset")) : undefined,
        },
        false,
      );
    }, 50);

    initFilters(new URLSearchParams(router.state.location.search));
    return router.subscribe(
      debounce((state) => {
        if (state.historyAction === "POP") {
          initFilters(new URLSearchParams(state.location.search));
        }
      }, 50),
    );
  }, []);

  const onSearch = useMemo(
    () => debounce((value: string) => onFilterChange({ search: value || undefined, offset: 0 }), 300),
    [onFilterChange],
  );

  const sort = filters.sort || "-created_at";
  const onSort = (value: string) => onFilterChange({ sort: value, offset: 0 });
  const limit = filters.limit || 10;
  const offset = filters.offset || 0;
  const total = users.total || 0;
  const pages = Math.max(1, Math.ceil(total / limit));
  const page = Math.floor(offset / limit) + 1;

  const goTo = (nextPage: number) => onFilterChange({ offset: (nextPage - 1) * limit });

  return (
    <>
      <Blueprint style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <input
          className="xn-input"
          style={{ width: 260 }}
          placeholder={t("search")}
          value={search}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            setSearch(event.target.value);
            onSearch(event.target.value);
          }}
        />
        <div className="xn-seg">
          {STATUSES.map((status) => (
            <button
              key={status || "all"}
              className="xn-seg-opt"
              style={{ fontSize: 12 }}
              aria-pressed={filters.status === status}
              onClick={() => onFilterChange({ status, offset: 0 })}
            >
              {t(`xenith.users.status.${status || "all"}`)}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
          {t("xenith.users.count", { total: groupDigits(total) })}
        </span>
        <button className="xn-btn xn-btn-primary" style={{ fontSize: 12.5 }} onClick={() => onCreateUser(true)}>
          {t("xenith.newUser")}
        </button>
      </Blueprint>

      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        {users.users.length === 0 ? (
          <PanelEmpty loading={loading}>{t("xenith.users.empty")}</PanelEmpty>
        ) : (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <SortHeader field="username" label={t("username")} sort={sort} onSort={onSort} />
                  <th>{t("status")}</th>
                  <SortHeader field="expire" label={t("xenith.users.expiry")} sort={sort} onSort={onSort} />
                  <SortHeader
                    field="used_traffic"
                    label={t("usersTable.dataUsage")}
                    sort={sort}
                    onSort={onSort}
                    width={260}
                  />
                  <th style={{ textAlign: "right" }}>{t("xenith.users.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {users.users.map((user) => {
                  const percent = user.data_limit ? formatPercent(user.used_traffic, user.data_limit) : 0;
                  return (
                    <tr key={user.username}>
                      <td className="xn-mono" style={{ fontSize: 12.5 }}>
                        {user.username}
                      </td>
                      <td>
                        <span className={`xn-tag ${STATUS_TAG[user.status] || "xn-tag-neutral"}`}>
                          {t(`xenith.users.status.${user.status}`)}
                        </span>
                      </td>
                      <td style={{ color: "var(--xn-neutral-700)", whiteSpace: "nowrap" }}>{expiryText(user)}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                          <div style={{ height: 5, background: "var(--xn-neutral-200)", position: "relative" }}>
                            <div
                              style={{
                                position: "absolute",
                                inset: "0 auto 0 0",
                                width: `${user.data_limit ? percent : 0}%`,
                                background:
                                  user.status === "limited" ? "var(--xn-neutral-900)" : "var(--xn-accent)",
                              }}
                            />
                          </div>
                          <span className="xn-mono" style={{ fontSize: 10.5, color: "var(--xn-neutral-600)" }}>
                            {formatBytes(user.used_traffic)}
                            {user.data_limit ? ` / ${formatBytes(user.data_limit)}` : ` · ${t("xenith.top.noLimit")}`}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                          <button
                            className="xn-btn xn-btn-ghost"
                            title={t("usersTable.copyLink") as string}
                            onClick={() => setSubLink(user.subscription_url)}
                          >
                            <LinkIcon size={15} strokeWidth={1.5} />
                          </button>
                          <button
                            className="xn-btn xn-btn-ghost"
                            title={t("usersTable.copyConfigs") as string}
                            onClick={() => setQRCode(user.links)}
                          >
                            <QrCode size={15} strokeWidth={1.5} />
                          </button>
                          <button
                            className="xn-btn xn-btn-ghost"
                            title={t("userDialog.editUser") as string}
                            onClick={() => onEditingUser(user)}
                          >
                            <SquarePen size={15} strokeWidth={1.5} />
                          </button>
                          <button
                            className="xn-btn xn-btn-ghost"
                            title={t("xenith.devices.title", { username: user.username }) as string}
                            onClick={() => useDashboard.setState({ devicesUser: user })}
                          >
                            <Smartphone size={15} strokeWidth={1.5} />
                          </button>
                          <button
                            className="xn-btn xn-btn-ghost"
                            title={t("resetUserUsage.title") as string}
                            onClick={() => useDashboard.setState({ resetUsageUser: user })}
                          >
                            <RotateCcw size={15} strokeWidth={1.5} />
                          </button>
                          <button
                            className="xn-btn xn-btn-ghost"
                            title={t("deleteUser.title") as string}
                            onClick={() => onDeletingUser(user)}
                          >
                            <Trash2 size={15} strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div className="xn-seg">
            {PAGE_SIZES.map((size) => (
              <button
                key={size}
                className="xn-seg-opt"
                style={{ fontSize: 12 }}
                aria-pressed={limit === size}
                onClick={() => onFilterChange({ limit: size, offset: 0 })}
              >
                {size}
              </button>
            ))}
          </div>
          <span className="xn-mono" style={{ fontSize: 11, color: "var(--xn-neutral-600)", marginRight: "auto" }}>
            {t("xenith.users.page", { page, pages })}
          </span>
          <button className="xn-btn xn-btn-secondary" style={{ fontSize: 12 }} disabled={page <= 1} onClick={() => goTo(page - 1)}>
            {t("previous")}
          </button>
          <button
            className="xn-btn xn-btn-secondary"
            style={{ fontSize: 12 }}
            disabled={page >= pages}
            onClick={() => goTo(page + 1)}
          >
            {t("next")}
          </button>
        </div>
      </Blueprint>

      <UserDialog />
      <DeleteUserModal />
      <QRCodeDialog />
      <HostsDialog />
      <ResetUserUsageModal />
      <RevokeSubscriptionModal />
      <UserDevicesModal />
      <NodesDialog />
      <NodesUsage />
      <ResetAllUsageModal />
      <CoreSettingsModal />
    </>
  );
};

export default Users;
