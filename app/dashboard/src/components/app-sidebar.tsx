import { ReactComponent as Logo } from "assets/logo.svg";
import {
  BookOpen,
  LifeBuoy,
  PieChart,
  RssIcon,
  Settings2,
  UsersIcon,
} from "lucide-react";
import * as React from "react";

import { GithubStar } from "@/components/github-star";
import { Language } from "@/components/Language";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { ThemeSwitchButton } from "@/components/theme-switch-button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { DONATION_URL, REPO_URL } from "@/constants/Project";

const data = {
  user: {
    name: "Admin",
  },
  navMain: [
    {
      title: "Users",
      url: "#",
      icon: UsersIcon,
    },
    {
      title: "Statistics",
      url: "#",
      icon: PieChart,
    },
    {
      title: "Settings",
      url: "#",
      icon: Settings2,
      items: [
        {
          title: "General",
          url: "#",
        },
        {
          title: "Interfaces",
          url: "#",
        },
        {
          title: "Nodes",
          url: "#",
        },
        {
          title: "Core",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Support Us",
      url: DONATION_URL,
      icon: LifeBuoy,
      target: "_blank",
    },
  ],
  community: [
    {
      title: "Documentation",
      url: "#",
      icon: BookOpen,
    },
    {
      title: "Community Group",
      url: "#",
      icon: RssIcon,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={REPO_URL} target="_blank">
                <Logo className="!w-5 !h-5 stroke-[2px]" />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">
                    Marzban{" "}
                    <span className="truncate text-xs opacity-45">v0.10</span>
                  </span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.community} label="Community" />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
        <div className="flex justify-between px-4">
          <GithubStar />
          <div className="flex gap-2">
            <Language />
            <ThemeSwitchButton />
          </div>
        </div>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
