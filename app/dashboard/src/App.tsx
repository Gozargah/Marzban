import { routes } from "pages/_routes";
import { Suspense } from "react";
import "react-datepicker/dist/react-datepicker.css";
import { RouterProvider, createHashRouter } from "react-router-dom";

function App() {
  return (
    <main>
      <Suspense>
        <RouterProvider router={createHashRouter(routes)} />
      </Suspense>
    </main>
  );
}

export default App;
