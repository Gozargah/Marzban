import { router } from "pages/_router";
import { Suspense } from "react";
import "react-datepicker/dist/react-datepicker.css";
import "react-loading-skeleton/dist/skeleton.css";
import { RouterProvider } from "react-router-dom";

function App() {
  return (
    <main>
      <Suspense>
        <RouterProvider router={router} />
      </Suspense>
    </main>
  );
}

export default App;
