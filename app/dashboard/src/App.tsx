import { Suspense } from "react";
import "react-datepicker/dist/react-datepicker.css";
import "react-loading-skeleton/dist/skeleton.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./pages/Router";

function App() {
  return (
    <main className="p-8">
      <Suspense>
        <RouterProvider router={router} />
      </Suspense>
    </main>
  );
}

export default App;
