import { lazy } from "react";
import { createHashRouter } from "react-router-dom";
import { getGetCurrentAdminQueryOptions } from "service/api";
import { queryClient } from "utils/react-query";

const ConsoleLayout = lazy(() => import("../layouts/ConsoleLayout"));
const Users = lazy(() => import("./Users"));
const Statistics = lazy(() => import("./Statistics"));
const GeneralSettings = lazy(() => import("./settings/General"));
const CoreSettings = lazy(() => import("./settings/Core"));
const HostsSettings = lazy(() => import("./settings/Hosts"));
const NodesSettings = lazy(() => import("./settings/Nodes"));
const Login = lazy(() => import("./Login"));

const fetchAdminLoader = () => {
  return queryClient.getQueryCache().build(queryClient, getGetCurrentAdminQueryOptions()).fetch();
};

export const router = createHashRouter([
  {
    path: "/",
    errorElement: <Login />,
    loader: fetchAdminLoader,
    element: <ConsoleLayout />,
    children: [
      {
        path: "/",
        element: <Users />,
      },
      {
        path: "statistics",
        element: <Statistics />,
      },
      {
        path: "settings",
        children: [
          {
            path: "/settings",
            element: <GeneralSettings />,
          },
          {
            path: "/settings/hosts",
            element: <HostsSettings />,
          },
          {
            path: "/settings/nodes",
            element: <NodesSettings />,
          },
          {
            path: "/settings/core",
            element: <CoreSettings />,
          },
        ],
      },
    ],
  },
  {
    path: "/login/",
    element: <Login />,
  },
]);
