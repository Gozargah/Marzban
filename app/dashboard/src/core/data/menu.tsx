import { ChartPieIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";
import UserGroupIcon from "@heroicons/react/24/outline/UserGroupIcon";
import { ReactElement } from "react";

export type MenuItem = {
  title: string;
  href?: string;
  icon?: ReactElement;
  children?: MenuItem[];
  target?: string;
};

export const menu: MenuItem[] = [
  {
    title: "menu.users",
    icon: <UserGroupIcon width="24" />,
    href: "/dashboard/users",
  },
  {
    title: "menu.statistics",
    icon: <ChartPieIcon width="24" />,
    href: "/dashboard/statistics",
  },
  {
    title: "menu.settings",
    icon: <Cog6ToothIcon width="24" />,
    children: [
      {
        title: "menu.general",
        href: "/dashboard/settings/general",
      },
      {
        title: "menu.hosts",
        href: "/dashboard/settings/hosts",
      },
      {
        title: "menu.nodes",
        href: "/dashboard/settings/nodes",
      },
      {
        title: "menu.core",
        href: "/dashboard/settings/core",
      },
    ],
  },
];
