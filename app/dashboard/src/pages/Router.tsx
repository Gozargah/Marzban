import { createHashRouter, RouteObject } from "react-router-dom";
import { fetch } from "@/service/http";
import { getAuthToken } from "@/utils/authStorage";
import Dashboard from "./Dashboard";
import Login from "./Login";
import Layout from "./Layout";
import Statistics from "./Statistics";
import Settings from "./Settings";
import CoreSettings from "@/components/settings/CoreSettings";

const fetchAdminLoader = async (): Promise<any> => {
  try {
    const response = await fetch("/admin", {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
      },
    });
    return response;
  } catch (error) {
    throw new Response("Unauthorized", { status: 401 });
  }
};

export const router = createHashRouter([
  {
    element: <Layout />,
    errorElement: <Login />,
    loader: fetchAdminLoader,
    children: [
      {
        path: "/",
        index: true,
        element: <Dashboard />,
      },
      {
        path: "/statistics",
        element: <Statistics />,
      },

      {
        path: "/settings",
        element: <Settings />,
        children: [
          {
            path: "/settings/core",
            element: <CoreSettings />,
          },
        ],
      },
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
] as RouteObject[]);
