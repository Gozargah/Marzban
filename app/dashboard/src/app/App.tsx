import { checkAuth } from "core/hooks/checkAuth.hook";
import { Suspense } from "react";
import "react-datepicker/dist/react-datepicker.css";
import "react-loading-skeleton/dist/skeleton.css";
import { RouterProvider } from "react-router-dom";
import { authRouter } from "components/providers/routes/auth/auth.routes";
import { unAuthRouter } from "components/providers/routes/unAuth/unAuth.routes";

function App() {
  //isLogin
  const isLogin = checkAuth();

  return (
    <main>
      <Suspense>
        <RouterProvider router={isLogin ? authRouter : unAuthRouter} />
      </Suspense>
    </main>
  );
}

export default App;
