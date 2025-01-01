import { ContentLayout } from "@/components/layout/content-layout";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";

const Statistics = () => {
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  return (
    <ContentLayout>
      <div className="mx-auto py-10">
      </div>
    </ContentLayout>
  );
};

export default Statistics;
