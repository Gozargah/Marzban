import { createBrowserRouter, redirect } from "react-router-dom";
import { sharedRoutes } from "components/providers/routes/shared/shared.routes";

export const unAuthRouter = createBrowserRouter([
  {
    path: "/",
    loader: async () => {
      return redirect("/login");
    },
  },
  ...sharedRoutes,
]);
