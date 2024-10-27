import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GeneralSettings from "@/pages/settings/general";
import { Link, Outlet, useLocation } from "react-router-dom";

const tabs = {
  "/settings": {
    label: "General",
    content: <GeneralSettings />,
  },
  "/settings/interfaces": {
    label: "Interfaces",
    content: <span>interfaces</span>,
  },
  "/settings/nodes": {
    label: "Nodes",
    content: <span>nodes</span>,
  },
  "/settings/core": {
    label: "Core",
    content: <span>cores</span>,
  },
};

export default function SettingsLayout() {
  const location = useLocation();
  return (
    <Tabs value={location.pathname}>
      <TabsList className="w-full flex gap-2 justify-start">
        {Object.keys(tabs).map((tabKey) => {
          return (
            <TabsTrigger value={tabKey} asChild>
              <Link to={`${tabKey}`}>
                {tabs[tabKey as keyof typeof tabs].label}
              </Link>
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value={location.pathname}>
        <Outlet />
      </TabsContent>
    </Tabs>
  );
}
