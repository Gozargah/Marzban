import { DeploymentRecovery } from "@/components/deployment-recovery";
import "react-datepicker/dist/react-datepicker.css";
import { clearLegacyAuthToken } from "@/utils/authStorage";
import { RouterProvider } from "react-router/dom";
import { useEffect } from "react";
import { router } from "./pages/router";

function App() {
  useEffect(() => clearLegacyAuthToken(), []);
  return (
    <main>
      <DeploymentRecovery />
      <RouterProvider router={router} />
    </main>
  );
}

export default App;
