import DashboardLayout from "@/pages/dashboard/_layout";
import SettingsLayout from "@/pages/settings/_layout";
import CoreSettings from "@/pages/settings/core";
import GeneralSettings from "@/pages/settings/general";
import InterfacesSettings from "@/pages/settings/interfaces";
import NodesSettings from "@/pages/settings/nodes";
import { createHashRouter } from "react-router-dom";
import { fetch } from "../service/http";
import { getAuthToken } from "../utils/authStorage";
import { Dashboard } from "./Dashboard";
import { Login } from "./Login";
const fetchAdminLoader = () => {
  return fetch("/admin", {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
};
export const router = createHashRouter([
  {
    element: <DashboardLayout />,
    errorElement: <Login />,
    loader: fetchAdminLoader,
    children: [
      {
        path: "/",
        index: true,
        element: <Dashboard />,
      },
      {
        element: <SettingsLayout />,
        children: [
          {
            path: "/settings",
            element: <GeneralSettings />,
          },
          {
            path: "/settings/interfaces",
            element: <InterfacesSettings />,
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
