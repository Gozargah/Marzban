import { createHashRouter } from "react-router-dom";
import { fetch } from "../service/http";
import { AppShell } from "../xenith/AppShell";
import { Certificates } from "./Certificates";
import { Inbounds } from "./Inbounds";
import { Login } from "./Login";
import { Logs } from "./Logs";
import { Nginx } from "./Nginx";
import { Nodes } from "./Nodes";
import { Overview } from "./Overview";
import { Settings } from "./Settings";
import { Traffic } from "./Traffic";
import { Users } from "./Users";

// The session cookie is attached by the browser, so the loader only has to ask
// who we are; a 401 falls through to the errorElement and back to the login page.
const fetchAdminLoader = () => {
  return fetch("/admin");
};

export const router = createHashRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <Login />,
    loader: fetchAdminLoader,
    children: [
      { index: true, element: <Overview /> },
      { path: "traffic", element: <Traffic /> },
      { path: "nodes", element: <Nodes /> },
      { path: "logs", element: <Logs /> },
      { path: "inbounds", element: <Inbounds /> },
      { path: "certificates", element: <Certificates /> },
      { path: "nginx", element: <Nginx /> },
      { path: "users", element: <Users /> },
      { path: "settings", element: <Settings /> },
    ],
  },
  {
    path: "/login/",
    element: <Login />,
  },
]);
