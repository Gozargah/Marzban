import { AppSidebar } from "@/components/app-sidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Footer } from "components/Footer";
import { FC } from "react";
import { Outlet } from "react-router-dom";

export const DashboardLayout: FC = () => {
  return (
    <div className="w-full flex gap-1">
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col justify-between min-h-screen p-6 gap-y-4 w-full">
          <Outlet />
          <Footer />
        </div>
      </SidebarProvider>
    </div>
  );
};

export default DashboardLayout;
