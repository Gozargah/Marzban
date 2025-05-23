import "react-datepicker/dist/react-datepicker.css";
import "react-loading-skeleton/dist/skeleton.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./pages/Router";
import { useEffect } from "react";

function App() {
    useEffect(() => {
        if (window.DASHBOARD_TITLE) {
            document.title = window.DASHBOARD_TITLE;
        }
    }, []);

    return (
        <main className="p-8">
            <RouterProvider router={router} />
        </main>
    );
}

export default App;