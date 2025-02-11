import {
  Users,
  Settings,
  LucideIcon,
  ChartPie,
  ListTodo,
  Share2,
  Settings2,
  UserCog,
} from "lucide-react";

type Submenu = {
  href: string;
  label: string;
  active?: boolean;
};

type Menu = {
  href: string;
  label: string;
  active?: boolean;
  icon: LucideIcon;
  submenus?: Submenu[];
};

type Group = {
  groupLabel: string;
  menus: Menu[];
};

export function getMenuList(pathname: string): Group[] {
  return [
    {
      groupLabel: "platform",
      menus: [
        {
          href: "/",
          label: "users",
          icon: Users,
          submenus: [],
        },
        {
          href: "/statistics",
          label: "statistics",
          icon: ChartPie,
          submenus: [],
        },
        {
          href: "/hosts",
          label: "hosts",
          icon: ListTodo,
          submenus: [],
        },
        {
          href: "/nodes",
          label: "nodes",
          icon: Share2,
          submenus: [],
        },
        {
          href: "/settings",
          label: "settings",
          icon: Settings2,
          submenus: [
            {
              href: "/settings",
              label: "general"
            },
            {
              href: "/settings/core",
              label: "core"
            }
          ],
        },
      ],
    },
    {
      groupLabel: "Settings",
      menus: [
        {
          href: "/users",
          label: "Users",
          icon: Users,
        },
        {
          href: "/account",
          label: "Account",
          icon: Settings,
        },
      ],
    },
  ];
}
