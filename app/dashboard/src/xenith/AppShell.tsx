import {
  Activity,
  Globe,
  LayoutGrid,
  LogIn,
  Plus,
  RefreshCw,
  ScrollText,
  Server,
  ShieldCheck,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { FC, FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "react-query";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useDashboard } from "contexts/DashboardContext";
import { restartCore, useAdmin, useCoreStats, useNodes, useSystemStats } from "./api";
import { ConfirmDialog } from "./ConfirmDialog";
import { groupDigits } from "./format";
import { LogoLockup } from "./Logo";

type NavItem = {
  to: string;
  label: string;
  icon: FC<{ size?: number; strokeWidth?: number }>;
  count?: number;
};

/** Page title and kicker per route, shown in the header. */
const PAGE_TITLES: Record<string, { kicker: string; title: string }> = {
  "/": { kicker: "xenith.kicker.overview", title: "xenith.page.overview" },
  "/traffic": { kicker: "xenith.kicker.traffic", title: "xenith.page.traffic" },
  "/nodes": { kicker: "xenith.kicker.nodes", title: "xenith.page.nodes" },
  "/logs": { kicker: "xenith.kicker.logs", title: "xenith.page.logs" },
  "/inbounds": { kicker: "xenith.kicker.inbounds", title: "xenith.page.inbounds" },
  "/certificates": { kicker: "xenith.kicker.certificates", title: "xenith.page.certificates" },
  "/nginx": { kicker: "xenith.kicker.nginx", title: "xenith.page.nginx" },
  "/users": { kicker: "xenith.kicker.users", title: "xenith.page.users" },
  "/settings": { kicker: "xenith.kicker.settings", title: "xenith.page.settings" },
};

const NavGroup: FC<{ title: string; items: NavItem[]; first?: boolean }> = ({ title, items, first }) => (
  <>
    <div className="xn-nav-group" style={{ paddingTop: first ? 0 : 20 }}>
      {title}
    </div>
    <nav style={{ display: "flex", flexDirection: "column" }}>
      {items.map(({ to, label, icon: Icon, count }) => (
        <NavLink key={to} to={to} end={to === "/"} className="xn-nav-item">
          <Icon size={16} strokeWidth={1.5} />
          <span style={{ fontSize: 13.5, letterSpacing: "0.02em" }}>{label}</span>
          {count !== undefined && (
            <span className="xn-tag xn-tag-outline" style={{ marginLeft: "auto", fontSize: 10, padding: "1px 6px" }}>
              {count}
            </span>
          )}
        </NavLink>
      ))}
    </nav>
  </>
);

export const AppShell: FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: system } = useSystemStats();
  const { data: core } = useCoreStats();
  const { data: nodes } = useNodes();
  const { data: admin } = useAdmin();
  const [restarting, setRestarting] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [search, setSearch] = useState("");

  const page = PAGE_TITLES[location.pathname] || PAGE_TITLES["/"];

  const monitoring: NavItem[] = [
    { to: "/", label: t("xenith.nav.overview"), icon: LayoutGrid },
    { to: "/traffic", label: t("xenith.nav.traffic"), icon: Activity },
    { to: "/nodes", label: t("xenith.nav.nodes"), icon: Server, count: nodes?.length },
    { to: "/logs", label: t("xenith.nav.logs"), icon: ScrollText },
  ];
  const configuration: NavItem[] = [
    { to: "/inbounds", label: t("xenith.nav.inbounds"), icon: LogIn },
    { to: "/users", label: t("xenith.nav.users"), icon: Users, count: system?.total_user },
    { to: "/certificates", label: t("xenith.nav.certificates"), icon: ShieldCheck },
    { to: "/nginx", label: t("xenith.nav.nginx"), icon: Globe },
    { to: "/settings", label: t("xenith.nav.settings"), icon: SlidersHorizontal },
  ];

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    useDashboard.getState().onFilterChange({ search, offset: 0 });
    navigate("/users");
  };

  const onRefresh = () => {
    queryClient.invalidateQueries();
    useDashboard.getState().refetchUsers();
  };

  const onRestartCore = () => {
    setRestarting(true);
    restartCore()
      .catch(() => undefined)
      .finally(() => {
        setRestarting(false);
        setConfirmRestart(false);
        queryClient.invalidateQueries("xenith-core");
      });
  };

  const initials = (admin?.username || "").slice(0, 2).toUpperCase() || "··";

  return (
    <div className="xn-root xn-shell">
      <aside className="xn-sidebar">
        <div style={{ padding: "0 20px 22px" }}>
          <LogoLockup />
        </div>

        <NavGroup title={t("xenith.group.monitoring")} items={monitoring} first />
        <NavGroup title={t("xenith.group.configuration")} items={configuration} />

        <div className="xn-sidebar-foot">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--xn-neutral-600)",
            }}
          >
            <span>{t("xenith.core")}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--xn-accent-800)" }}>
              <i
                style={{
                  width: 6,
                  height: 6,
                  display: "block",
                  background: core?.started ? "var(--xn-accent)" : "var(--xn-neutral-500)",
                }}
              />
              {core?.started ? t("xenith.running") : t("xenith.stopped")}
            </span>
          </div>
          <div className="xn-mono" style={{ fontSize: 11, color: "var(--xn-neutral-600)" }}>
            xray-core {core?.version || "—"} · panel {system?.version || "—"}
          </div>
          <button
            className="xn-btn xn-btn-secondary"
            style={{ width: "100%", marginTop: 2, fontSize: 12.5 }}
            onClick={() => setConfirmRestart(true)}
          >
            {t("xenith.restartCore")}
          </button>
        </div>
      </aside>

      <main className="xn-main">
        <header className="xn-header">
          <div style={{ display: "flex", flexDirection: "column", gap: 2, marginRight: "auto", minWidth: 0 }}>
            <span className="xn-kicker">{t(page.kicker)}</span>
            <h1 style={{ fontSize: 27, letterSpacing: 0, lineHeight: 1 }}>{t(page.title)}</h1>
          </div>

          <form onSubmit={onSearch} className="xn-header-search">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--xn-neutral-500)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ position: "absolute", left: 10 }}
            >
              <path d="m21 21-4.34-4.34" />
              <circle cx="11" cy="11" r="8" />
            </svg>
            <input
              className="xn-input"
              style={{ width: 268, paddingLeft: 32 }}
              placeholder={t("xenith.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>

          <button className="xn-btn xn-btn-secondary" onClick={onRefresh}>
            <RefreshCw size={15} strokeWidth={1.5} />
            {t("xenith.refresh")}
          </button>
          <button
            className="xn-btn xn-btn-primary"
            onClick={() => {
              useDashboard.getState().onCreateUser(true);
              navigate("/users");
            }}
          >
            <Plus size={15} strokeWidth={1.5} />
            {t("xenith.newUser")}
          </button>

          <div className="xn-header-profile">
            <div className="xn-heading xn-avatar">{initials}</div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
              <span style={{ fontSize: 12.5 }}>{admin?.username || "—"}</span>
              <span style={{ fontSize: 10, color: "var(--xn-neutral-600)" }}>
                {admin?.is_sudo ? t("xenith.roleSudo") : t("xenith.roleAdmin")}
              </span>
            </div>
            <NavLink to="/login" className="xn-link" style={{ fontSize: 11, marginLeft: 4 }}>
              {t("header.logout")}
            </NavLink>
          </div>
        </header>

        <div className="xn-content">
          <Outlet />
        </div>
      </main>

      <ConfirmDialog
        open={confirmRestart}
        title={t("xenith.restartCore")}
        body={t("xenith.restartCorePrompt")}
        confirmLabel={t("xenith.restartCore")}
        busy={restarting}
        onConfirm={onRestartCore}
        onClose={() => setConfirmRestart(false)}
      />
    </div>
  );
};
