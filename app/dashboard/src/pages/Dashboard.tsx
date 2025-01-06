import { ContentLayout } from "@/components/layout/content-layout";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import UsersTable from "@/components/users-table/users-table";
import { PaginationControls } from "@/components/users-table/filters";

const Dashboard = () => {
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  return (
    <ContentLayout className="pt-8 pb-8 px-4 sm:px-8">
      <div className="mx-auto py-10">
        <UsersTable />
        <PaginationControls />
      </div>
    </ContentLayout>
  );
};

export default Dashboard;
