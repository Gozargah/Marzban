import { queryClient } from "config/react-query";
import { RouteObject, redirect } from "react-router-dom";
import { getGetCurrentAdminQueryOptions } from "services/api";
import { isValidToken } from "utils/authStorage";

const fetchAdminLoader = () => {
  if (!isValidToken()) return false;
  console.log("fetching admin loader");
  return queryClient
    .getQueryCache()
    .build(queryClient, getGetCurrentAdminQueryOptions())
    .fetch()
    .catch(() => {
      return redirect("/login");
    });
};

export const routes: RouteObject[] = [
  {
    path: "/login",
    lazy: async () => {
      let { Login } = await import("pages/Login");
      return { Component: Login };
    },
  },
  {
    path: "/",
    loader: fetchAdminLoader,
    lazy: async () => {
      let { ConsoleLayout } = await import("components/layouts/ConsoleLayout");
      return { Component: ConsoleLayout };
    },
    children: [
      {
        path: "/",
        loader: () => {
          return redirect("/users");
        },
      },
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
            path: "/settings",
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
