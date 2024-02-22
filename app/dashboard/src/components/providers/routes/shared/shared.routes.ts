export const sharedRoutes = [
  {
    path: "/login",
    lazy: async () => {
      let { Login } = await import("pages/Login");
      return { Component: Login };
    },
  },
];
