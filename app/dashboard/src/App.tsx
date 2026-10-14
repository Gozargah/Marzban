import { DeploymentRecovery } from "@/components/deployment-recovery";
import "react-datepicker/dist/react-datepicker.css";
import { RouterProvider } from "react-router/dom";
import { router } from "./pages/router";

function App() {
  return (
    <main>
      <DeploymentRecovery />
      <RouterProvider router={router} />
    </main>
  );
}

export default App;
