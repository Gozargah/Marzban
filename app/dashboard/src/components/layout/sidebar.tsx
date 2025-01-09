import { Menu } from "@/components/layout/menu";
import { SidebarToggle } from "@/components/layout/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";
import LogoIcon from "@/assets/logo.svg";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

export function Sidebar() {
  const { i18n } = useTranslation();
  const [isRTL, setIsRTL] = useState<boolean>(i18n.dir() === "rtl");
  useEffect(() => {
    if (i18n.dir() === "rtl") setIsRTL(true);
    else setIsRTL(false);
  }, [i18n.language]);
  
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  
  const { isOpen, toggleOpen, getOpenState, setIsHover, settings } = sidebar;

  return (
    <aside
      className={cn(
        "hidden lg:block fixed top-0 z-20 h-screen transition-[width,transform] ease-in-out duration-300",
        isRTL ? "right-0 translate-x-full lg:translate-x-0" : "left-0 -translate-x-full lg:translate-x-0",
        !getOpenState() ? "w-[90px]" : "w-60",
        settings.disabled && "!hidden"
      )}
    >
      <SidebarToggle isOpen={isOpen} setIsOpen={toggleOpen} />
      <div
        onMouseEnter={() => setIsHover(true)}
        onMouseLeave={() => setIsHover(false)}
        className="relative h-full flex flex-col px-3 py-4 overflow-y-auto shadow-md dark:shadow-zinc-800"
      >
        <Button
          className={cn(
            "transition-transform ease-in-out duration-300 mb-1",
            !getOpenState() ? "translate-x-1" : "translate-x-0"
          )}
          variant="link"
          asChild
        >
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-6 h-6 mr-1">
              <LogoIcon />
            </div>
            <h1
              className={cn(
                "font-bold text-lg whitespace-nowrap transition-[transform,opacity,display] ease-in-out duration-300",
                !getOpenState()
                  ? "-translate-x-96 opacity-0 hidden"
                  : "translate-x-0 opacity-100"
              )}
            >
              Marzban
            </h1>
          </Link>
        </Button>
        <Menu isOpen={getOpenState()} />
      </div>
    </aside>
  );
}
