import AdminPanelLayout from "@/components/layout/panel-layout";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <AdminPanelLayout>
      <Outlet />
    </AdminPanelLayout>
  );
}
