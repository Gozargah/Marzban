export const sharedRoutes = [
  {
    path: "/",
    lazy: async () => {
      let { Login } = await import("pages/Login");
      return { Component: Login };
    },
  },
  {
    path: "/login",
    lazy: async () => {
      let { Login } = await import("pages/Login");
      return { Component: Login };
    },
  },
];
