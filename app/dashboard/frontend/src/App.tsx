import "react-datepicker/dist/react-datepicker.css";
import "react-loading-skeleton/dist/skeleton.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./components/modules/Router";

function App() {
  return (
    <main className="p-8">
      <RouterProvider router={router} />
    </main>
  );
}

export default App;
