import { useLocale } from "@/hooks/use-locale";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, ChevronRight, CircleDollarSign, Code, Link2, LogOut, Menu, Moon, Network, PieChart, RotateCcw, Settings, Sun } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Language } from "@/components/language";
import { useTheme } from "@/components/theme-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { DONATION_URL, REPO_URL } from "constants/Project";
import { useDashboard } from "@/contexts/dashboard-context";
import useGetUser from "hooks/useGetUser";
import { removeAuthToken } from "utils/authStorage";

type HeaderProps = { actions?: ReactNode };
const NOTIFICATION_KEY = "marzban-menu-notification";
const DONATION_REMINDER_INTERVAL = 7 * 24 * 60 * 60 * 1000;

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
  const { t } = useTranslation();
  const { resolvedTheme: colorMode, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const nextAction = useRef<(() => void) | null>(null);
  const [showDonationNotif, setShowDonationNotif] = useState(shouldShowDonation);
  const { direction } = useLocale();
  const menuLabel = t("header.menu", { defaultValue: "Dashboard menu" });
  const themeLabel = colorMode === "dark"
    ? t("header.lightMode", { defaultValue: "Switch to light mode" })
    : t("header.darkMode", { defaultValue: "Switch to dark mode" });
  const destinations = [
    { label: t("header.hostSettings"), icon: Link2, description: t("header.hostsHint", { defaultValue: "Manage connection addresses for each inbound." }), action: () => onEditingHosts(true) },
    { label: t("header.nodeSettings"), icon: Network, description: t("header.nodesHint", { defaultValue: "Add servers and manage their connection settings." }), action: () => onEditingNodes(true) },
    { label: t("header.coreSettings", { defaultValue: "Core settings" }), icon: Settings, description: t("header.coreHint", { defaultValue: "Configure inbounds, routing, and the Xray core." }), action: () => useDashboard.setState({ isEditingCore: true }) },
    { label: t("header.nodesUsage"), icon: PieChart, description: t("header.usageHint", { defaultValue: "Review traffic across your servers." }), action: () => onShowingNodesUsage(true) },
  ];

  function openDestination(action: () => void) {
    // Let the navigation Sheet release its focus trap before opening another panel.
    nextAction.current = action;
    setMenuOpen(false);
  }
  function acknowledgeDonation() {
    setShowDonationNotif(false);
    try { localStorage.setItem(NOTIFICATION_KEY, String(Date.now())); } catch { /* Storage is optional. */ }
  }
  function logout() {
    removeAuthToken();
    queryClient.clear();
  }

  return (
    <DirectionProvider direction={direction}>
      <header dir={direction} className="space-y-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Marzban</p>
            <h1 className="text-2xl font-semibold tracking-tight">{t("users")}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
            <Language />
            <Button type="button" variant="outline" size="icon-sm" aria-label={themeLabel} title={themeLabel}
              onClick={() => setTheme(colorMode === "dark" ? "light" : "dark")}>
              {colorMode === "light" ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
            </Button>
            <Sheet open={menuOpen} onOpenChange={(open) => { if (open) nextAction.current = null; setMenuOpen(open); }} onOpenChangeComplete={(open) => {
              if (!open) {
                const action = nextAction.current;
                nextAction.current = null;
                action?.();
              }
            }}>
              <SheetTrigger render={<Button type="button" variant="outline" size="sm" />} aria-label={menuLabel}>
                <Menu aria-hidden="true" />
                <span className="md:hidden">{t("header.navigation", { defaultValue: "Menu" })}</span>
                <span className="hidden md:inline">{t("header.more", { defaultValue: "More" })}</span>
              </SheetTrigger>
              <SheetContent dir={direction} side={direction === "rtl" ? "left" : "right"} className="w-full! sm:max-w-sm! gap-0 overflow-hidden">
                <SheetHeader className="shrink-0 border-b px-5 py-5 pe-14">
                  <SheetTitle>{menuLabel}</SheetTitle>
                  <SheetDescription>{t("header.menuHint", { defaultValue: "Choose what you’d like to manage." })}</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5">
                  {isSudo && <section className="space-y-2" aria-labelledby="header-manage-title">
                    <h2 id="header-manage-title" className="text-xs font-medium text-muted-foreground">{t("header.manage", { defaultValue: "Manage" })}</h2>
                    <nav aria-label={t("header.manage", { defaultValue: "Manage" })} className="divide-y border border-border">
                      {destinations.map(({ label, icon: Icon, description, action }) => (
                        <Button key={label} type="button" variant="ghost" className="h-auto w-full justify-start gap-3 whitespace-normal px-3 py-3 text-start" onClick={() => openDestination(action)}>
                          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1"><span className="block font-medium">{label}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{description}</span></span>
                          <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground rtl:rotate-180" />
                        </Button>
                      ))}
                    </nav>
                  </section>}
                  <section className="space-y-3" aria-labelledby="header-preferences-title">
                    <h2 id="header-preferences-title" className="text-xs font-medium text-muted-foreground">{t("header.preferences", { defaultValue: "Preferences" })}</h2>
                    <div className="divide-y border border-border px-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 py-3">
                        <span className="text-xs font-medium">{t("header.language", { defaultValue: "Language" })}</span><Language showLabel />
                      </div>
                      <label className="flex cursor-pointer items-center justify-between gap-3 py-3">
                        <span className="flex items-center gap-2 text-xs font-medium"><Moon aria-hidden="true" className="size-4 text-muted-foreground" />{t("header.darkAppearance", { defaultValue: "Dark mode" })}</span>
                        <Switch checked={colorMode === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} aria-label={t("header.darkAppearance", { defaultValue: "Dark mode" })} />
                      </label>
                    </div>
                  </section>
                  {isSudo && <section className="space-y-2" aria-labelledby="header-tools-title">
                    <h2 id="header-tools-title" className="text-xs font-medium text-muted-foreground">{t("header.maintenance", { defaultValue: "Maintenance" })}</h2>
                    <Button type="button" variant="outline" className="h-auto w-full justify-start gap-3 whitespace-normal border-destructive/20 px-3 py-3 text-start" onClick={() => openDestination(() => onResetAllUsage(true))}>
                      <RotateCcw aria-hidden="true" className="size-4 shrink-0 text-destructive" />
                      <span className="min-w-0 flex-1"><span className="block text-destructive">{t("resetAllUsage")}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">{t("header.resetHint", { defaultValue: "Reset usage for all users. You’ll be asked to confirm." })}</span></span>
                      <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground rtl:rotate-180" />
                    </Button>
                  </section>}
                  <section className="space-y-2" aria-labelledby="header-support-title">
                    <h2 id="header-support-title" className="text-xs font-medium text-muted-foreground">{t("header.project", { defaultValue: "Project & support" })}</h2>
                    <div className="flex flex-col divide-y border border-border">
                      <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost", className: "h-10 justify-start px-3" })}>
                        <Code aria-hidden="true" />{t("header.github", { defaultValue: "View on GitHub" })}<ArrowUpRight aria-hidden="true" className="ms-auto" />
                      </a>
                      <a href={DONATION_URL} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost", className: "h-10 justify-start px-3" })} onClick={acknowledgeDonation}>
                        <CircleDollarSign aria-hidden="true" />{t("header.donation")}
                        {showDonationNotif && <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />}
                        <ArrowUpRight aria-hidden="true" className="ms-auto" />
                      </a>
                    </div>
                  </section>
                </div>
                <SheetFooter className="shrink-0 border-t px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{t("header.signedInAs", { defaultValue: "Signed in as" })}</p>
                      <p className="truncate text-sm font-medium">{userData.username || "—"}</p>
                    </div>
                    <Link to="/login" className={buttonVariants({ variant: "outline", size: "sm" })} onClick={logout}><LogOut aria-hidden="true" />{t("header.logout")}</Link>
                  </div>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </div>
        </div>
        {isSudo && <nav aria-label={t("header.manage", { defaultValue: "Manage" })} className="hidden flex-wrap items-center gap-2 md:flex">
          {destinations.map(({ label, icon: Icon, action }) => <Button key={label} type="button" variant="outline" size="sm" onClick={action}><Icon aria-hidden="true" />{label}</Button>)}
        </nav>}
      </header>
    </DirectionProvider>
  );
}
