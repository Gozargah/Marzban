import "react-datepicker/dist/react-datepicker.css";
import "react-loading-skeleton/dist/skeleton.css";
import { useColorMode } from "@chakra-ui/react";
import { RouterProvider } from "react-router-dom";
import { router } from "./pages/Router";

function App() {
    const { colorMode } = useColorMode();
    return (
        <main className={colorMode === "dark" ? "gradient-bg" : "gradient-bg-light"}>
            <div style={{ position: "relative", zIndex: 1 }}>
                <RouterProvider router={router} />
            </div>
        </main>
    );
}

export default App;