import { RouterProvider } from "react-router-dom";
import "./styles/fonts.css";
import "./index.css";
import { router } from "@/pages/Router";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryClientProvider } from "react-query";
import { queryClient } from "./utils/react-query";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <main>
          <RouterProvider router={router} />
        </main>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
