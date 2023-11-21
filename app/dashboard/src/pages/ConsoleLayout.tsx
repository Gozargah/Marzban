import { Suspense } from "react";
import { Outlet } from "react-router-dom";

export const ConsoleLayout = () => {
  return (
    <div>
      <Suspense>
        <Outlet />
      </Suspense>
    </div>
  );
};

export default ConsoleLayout;
