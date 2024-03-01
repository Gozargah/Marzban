import { redirect } from "react-router-dom";
import { sharedRoutes } from "router/shared";

export const guestRoutes = [
  {
    path: "/",
    loader: async () => {
      return redirect("/login");
    },
  },
  ...sharedRoutes,
];
