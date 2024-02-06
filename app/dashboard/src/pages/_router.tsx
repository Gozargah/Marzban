import { lazy } from "react";
import { createHashRouter } from "react-router-dom";
import { getCurrentAdmin } from "service/api";

const ConsoleLayout = lazy(() => import("../layouts/ConsoleLayout"));
const Dashboard = lazy(() => import("./Dashboard"));
const Login = lazy(() => import("./Login"));

const fetchAdminLoader = () => {
  return getCurrentAdmin();
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
