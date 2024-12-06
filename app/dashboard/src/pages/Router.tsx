import { createBrowserRouter, RouteObject } from "react-router-dom";
import { fetch } from "@/service/http";
import { getAuthToken } from "@/utils/authStorage";
import Dashboard from "./dashboard";
import Login from "./login";

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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Dashboard />,
    // errorElement: <Login />,
    // loader: fetchAdminLoader,
  },
  {
    path: "/login",
    element: <Login />,
  },
] as RouteObject[]);
