import "react-datepicker/dist/react-datepicker.css";
import "react-loading-skeleton/dist/skeleton.css";
import { RouterProvider } from "react-router-dom";
import { router } from "./pages/Router";

function App() {
    // no padding here: the sidebar sits flush against the edge and the page
    // column brings its own
    return (
        <main>
            <RouterProvider router={router} />
        </main>
    );
}

export default App;