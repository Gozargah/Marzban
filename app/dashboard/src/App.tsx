import "react-datepicker/dist/react-datepicker.css";
import { RouterProvider } from "react-router/dom";
import { router } from "./pages/router";

function App() {
  return (
    <main>
      <RouterProvider router={router} />
    </main>
  );
}

export default App;
