import { ContentLayout } from "@/components/layout/content-layout";
import Tabs from "@/components/Tabs";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { Outlet } from "react-router-dom";

const Settings = () => {
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  return (
    <ContentLayout>
      <div>
        <Tabs />
      </div>
      <div className="mx-auto py-10">
        <Outlet />
      </div>
    </ContentLayout>
  );
};

export default Settings;
