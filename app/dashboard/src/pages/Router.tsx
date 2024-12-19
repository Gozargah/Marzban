import { createHashRouter, RouteObject } from "react-router-dom";
import { fetch } from "@/service/http";
import { getAuthToken } from "@/utils/authStorage";
import Dashboard from "./Dashboard";
import Login from "./Login";
import Layout from "./Layout";

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
    ],
  },
  {
    path: "/login",
    element: <Login />,
  },
] as RouteObject[]);
