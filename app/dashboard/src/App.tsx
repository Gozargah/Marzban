import { RouterProvider } from "react-router-dom";
import "./index.css";
import { router } from "@/pages/Router";
import { ThemeProvider } from "@/components/theme-provider";

function App() {
  return (
    <ThemeProvider>
      <main className="">
        <RouterProvider router={router} />
      </main>
    </ThemeProvider>
  );
}

export default App;
