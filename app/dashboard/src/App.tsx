import { RouterProvider } from "react-router-dom";
import './styles/fonts.css';
import "./index.css";
import { router } from "@/pages/Router";
import { ThemeProvider } from "@/components/theme-provider";

function App() {
  return (
    <ThemeProvider>
      <main>
        <RouterProvider router={router} />
      </main>
    </ThemeProvider>
  );
}

export default App;
