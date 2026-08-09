import { createHashRouter, Navigate } from "react-router-dom";
import { Layout } from "../components/Layout";
import { RouteError } from "../components/RouteError";
import { fetch } from "../service/http";
import { getAuthToken } from "../utils/authStorage";
import { Dashboard } from "./Dashboard";
import { Hosts } from "./Hosts";
import { Login } from "./Login";
import { Nodes } from "./Nodes";
import { AuditLogPage, NodesUsagePage } from "./Screens";
import { Settings } from "./Settings";

const fetchAdminLoader = () => {
    return fetch("/admin", {
        headers: {
            Authorization: `Bearer ${getAuthToken()}`,
        },
    });
};

// Every screen the sidebar links to is a child of the layout route, so they
// share one admin check and one set of chrome. The bare paths below are what
// the burger menu used to open; they stay as redirects so old bookmarks and
// links from earlier builds keep working.
export const router = createHashRouter([
    {
        path: "/",
        element: <Layout />,
        errorElement: <RouteError />,
        loader: fetchAdminLoader,
        children: [
            { index: true, element: <Dashboard /> },
            { path: "hosts", element: <Hosts /> },
            { path: "nodes", element: <Nodes /> },
            { path: "nodes-usage", element: <NodesUsagePage /> },
            { path: "audit", element: <AuditLogPage /> },
            { path: "settings", element: <Settings /> },
            { path: "settings/:tab", element: <Settings /> },
            { path: "core", element: <Navigate to="/settings/core" replace /> },
            { path: "yuku", element: <Navigate to="/settings/subscription" replace /> },
            { path: "groups", element: <Navigate to="/settings/traffic" replace /> },
            { path: "reset-usage", element: <Navigate to="/settings/maintenance" replace /> },
        ],
    },
    {
        path: "/login/",
        element: <Login />,
    },
]);
