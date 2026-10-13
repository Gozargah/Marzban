import { createBrowserRouter } from "react-router";
import { fetch } from "../service/http";
import { getAuthToken } from "../utils/authStorage";
import { Dashboard } from "./Dashboard";
import { Login } from "./login";
const fetchAdminLoader = async () => {
  return await fetch("/admin", {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
};
export const router = createBrowserRouter([

  {
    path: "/",
    element: <Dashboard />,
    errorElement: <Login />,
    loader: fetchAdminLoader,
  },
  {
    path: "/login/",
    element: <Login />,
  },
], {
  basename: import.meta.env.BASE_URL,
});
