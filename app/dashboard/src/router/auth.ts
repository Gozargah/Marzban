import { redirect } from "react-router-dom";
import { sharedRoutes } from "router/shared";
import { isValidToken } from "utils/authStorage";

export const authRoutes = [
  ...sharedRoutes,
  {
    path: "/",
    loader: async () => {
      const isAuthenticated = isValidToken();
      return isAuthenticated ? redirect("/login") : null;
    },
    lazy: async () => {
      let { ConsoleLayout } = await import("components/layouts/ConsoleLayout");
      return { Component: ConsoleLayout };
    },
    children: [
      {
        path: "/users",
        lazy: async () => {
          let { Users } = await import("pages/Users");
          return { Component: Users };
        },
      },
      {
        path: "/statistics",
        lazy: async () => {
          let { Statistics } = await import("pages/Statistics");
          return { Component: Statistics };
        },
      },
      {
        path: "/settings",
        children: [
          {
            path: "/settings/General",
            lazy: async () => {
              let { GeneralSettings } = await import("pages/settings/General");
              return { Component: GeneralSettings };
            },
          },
          {
            path: "/settings/hosts",
            lazy: async () => {
              let { HostSettings } = await import("pages/settings/Hosts");
              return { Component: HostSettings };
            },
          },
          {
            path: "/settings/nodes",
            lazy: async () => {
              let { NodeSettings } = await import("pages/settings/Nodes");
              return { Component: NodeSettings };
            },
          },
          {
            path: "/settings/core",
            lazy: async () => {
              let { CoreSettings } = await import("pages/settings/Core");
              return { Component: CoreSettings };
            },
          },
        ],
      },
    ],
  },
];
