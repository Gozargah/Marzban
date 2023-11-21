import { lazy } from "react";
import { createHashRouter } from "react-router-dom";
import { fetch } from "../service/http";
import { getAuthToken } from "../utils/authStorage";

const ConsoleLayout = lazy(() => import("./ConsoleLayout"));
const Dashboard = lazy(() => import("./Dashboard"));
const Login = lazy(() => import("./Login"));

const fetchAdminLoader = () => {
  return fetch("/admin", {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
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
