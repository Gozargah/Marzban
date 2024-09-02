import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { Dashboard } from "../../pages/Dashboard";
import { Login } from "../../pages/Login";
import { fetch } from "../../service/http";
import { getAuthToken } from "../../utils/authStorage";

const fetchAdminLoader = () => {
  return fetch("/admin", {
    headers: {
      Authorization: `Bearer ${getAuthToken()}`,
    },
  });
};

export const router = createBrowserRouter(
  [
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
  ],
  { basename: import.meta.env.BASE_URL }
);
