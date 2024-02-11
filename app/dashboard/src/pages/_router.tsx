import { lazy } from "react";
import { createHashRouter } from "react-router-dom";
import { getGetCurrentAdminQueryOptions } from "service/api";
import { queryClient } from "utils/react-query";

const ConsoleLayout = lazy(() => import("../layouts/ConsoleLayout"));
const Dashboard = lazy(() => import("./Dashboard"));
const Login = lazy(() => import("./Login"));

const fetchAdminLoader = () => {
  return queryClient.getQueryCache().build(queryClient, getGetCurrentAdminQueryOptions()).fetch();
  // return getCurrentAdmin();
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
        element: <Dashboard />,
      },
    ],
  },
  {
    path: "/login/",
    element: <Login />,
  },
]);
