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
    title: "Users",
    icon: <UserGroupIcon width="24" />,
    href: "users",
  },
  {
    title: "Statistics",
    icon: <ChartPieIcon width="24" />,
    href: "statistics",
  },
  {
    title: "Settings",
    icon: <Cog6ToothIcon width="24" />,
    children: [
      {
        title: "General",
        href: "settings",
      },
      {
        title: "Core",
        href: "settings/core",
      },
      {
        title: "Hosts",
        href: "settings/hosts",
      },
      {
        title: "Nodes",
        href: "settings/nodes",
      },
    ],
  },
];
