import { useQueryClient } from "@tanstack/react-query";
import { CircleDollarSign, Link2, LogOut, Menu, Moon, Network, PieChart, RotateCcw, Settings, Sun } from "lucide-react";
import { useState, type ReactNode } from "react";
import GitHubButton from "react-github-btn";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Language } from "@/components/language";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DONATION_URL, REPO_URL } from "constants/Project";
import { useDashboard } from "contexts/DashboardContext";
import useGetUser from "hooks/useGetUser";
import { removeAuthToken } from "utils/authStorage";

type HeaderProps = { actions?: ReactNode };
const NOTIFICATION_KEY = "marzban-menu-notification";
const DONATION_REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000;
const iconButtonClassName = "relative shrink-0 border! border-input! bg-background! text-foreground! hover:bg-accent!";

export function shouldShowDonation(): boolean {
  try {
    const stored = localStorage.getItem(NOTIFICATION_KEY);
    if (!stored) return true;
    const timestamp = Number(stored);
    return !Number.isFinite(timestamp) || timestamp < 0 || timestamp > Date.now()
      || Date.now() - timestamp >= DONATION_REMINDER_INTERVAL;
  } catch {
    return true;
  }
}

export function Header({ actions }: HeaderProps) {
  const { userData, getUserIsSuccess, getUserIsPending } = useGetUser();
  const isSudo = getUserIsSuccess && !getUserIsPending && userData.is_sudo;
  const onEditingHosts = useDashboard((state) => state.onEditingHosts);
  const onEditingNodes = useDashboard((state) => state.onEditingNodes);
  const onShowingNodesUsage = useDashboard((state) => state.onShowingNodesUsage);
  const onResetAllUsage = useDashboard((state) => state.onResetAllUsage);
  const { t, i18n } = useTranslation();
  const { resolvedTheme: colorMode, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [showDonationNotif, setShowDonationNotif] = useState(shouldShowDonation);
  const direction = i18n.dir();


  const githubTheme = colorMode === "dark" ? "dark_dimmed" : "light";
  const menuLabel = t("header.menu", { defaultValue: "Dashboard menu" });
  const themeLabel = colorMode === "dark"
    ? t("header.lightMode", { defaultValue: "Switch to light mode" })
    : t("header.darkMode", { defaultValue: "Switch to dark mode" });

  function acknowledgeDonation() {
    setShowDonationNotif(false);
    try {
      localStorage.setItem(NOTIFICATION_KEY, String(Date.now()));
    } catch {
      // The menu remains usable when browser storage is unavailable.
    }
  }

  function toggleTheme() {
    setTheme(colorMode === "dark" ? "light" : "dark");
  }

  function logout() {
    removeAuthToken();
    queryClient.clear();
  }

  return (
    <>
      <header className="relative flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl! font-semibold!">{t("users")}</h1>
        <div dir="rtl" className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="icon-sm" className={iconButtonClassName} />}
              type="button"
              aria-label={menuLabel}
              title={menuLabel}
            >
              <Menu aria-hidden="true" />
              {showDonationNotif && (
                <span aria-hidden="true" className="absolute -end-0.5 -top-0.5 size-2 rounded-full bg-amber-500" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" dir={direction} className="min-w-48">
              {isSudo && (
                <>
                  <DropdownMenuGroup>
                    <DropdownMenuItem onClick={() => onEditingHosts(true)}>
                      <Link2 aria-hidden="true" /> {t("header.hostSettings")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onEditingNodes(true)}>
                      <Network aria-hidden="true" /> {t("header.nodeSettings")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onShowingNodesUsage(true)}>
                      <PieChart aria-hidden="true" /> {t("header.nodesUsage")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => onResetAllUsage(true)}>
                      <RotateCcw aria-hidden="true" /> {t("resetAllUsage")}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={<a href={DONATION_URL} target="_blank" rel="noopener noreferrer" />}
                  onClick={acknowledgeDonation}
                >
                  <CircleDollarSign aria-hidden="true" /> {t("header.donation")}
                  {showDonationNotif && (
                    <span aria-hidden="true" className="ms-auto size-2 rounded-full bg-amber-500" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem render={<Link to="/login" />} onClick={logout}>
                  <LogOut aria-hidden="true" /> {t("header.logout")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {isSudo && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={t("header.coreSettings", { defaultValue: "Core settings" })}
              title={t("header.coreSettings", { defaultValue: "Core settings" })}
              onClick={() => useDashboard.setState({ isEditingCore: true })}
            >
              <Settings aria-hidden="true" />
            </Button>
          )}

          <Language />
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className={iconButtonClassName}
            aria-label={themeLabel}
            title={themeLabel}
            onClick={toggleTheme}
          >
            {colorMode === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
          </Button>
          <div dir="ltr" className="flex items-center [&_span]:inline-flex">
            <GitHubButton
              href={REPO_URL}
              data-color-scheme={`no-preference: ${githubTheme}; light: ${githubTheme}; dark: ${githubTheme};`}
              data-size="large"
              data-show-count="true"
              aria-label="Star Marzban on GitHub"
            >
              Star
            </GitHubButton>
          </div>
        </div>
      </header>
    </>
  );
}
