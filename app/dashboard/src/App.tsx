import { useIsAuthenticated } from "hooks/useIsAuthenticated";
import { Suspense } from "react";
import "react-datepicker/dist/react-datepicker.css";
import { RouterProvider, createHashRouter } from "react-router-dom";
import { authRoutes } from "router/auth";
import { guestRoutes } from "router/guest";

function App() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <main>
      <Suspense>
        <RouterProvider router={createHashRouter(isAuthenticated ? authRoutes : guestRoutes)} />
      </Suspense>
    </main>
  );
}

export default App;
