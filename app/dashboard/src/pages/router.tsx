import { createBrowserRouter } from "react-router";
import { adminQueryOptions } from "utils/admin-query";
import { queryClient } from "utils/react-query";
import { Dashboard } from "./dashboard";
import { Login } from "./login";
const fetchAdminLoader = () => queryClient.fetchQuery({
  ...adminQueryOptions,
  // Revalidate access on navigation; the header consumes the same fresh cache.
  staleTime: 0,
});
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
