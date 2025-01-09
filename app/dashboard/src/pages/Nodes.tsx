import { ContentLayout } from "@/components/layout/content-layout";
import NodesSection from "@/components/nodes/NodesSection";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNodes, useNodesQuery } from "@/contexts/NodesContext";
import useDirDetection from "@/hooks/use-dir-detection";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

const Nodes = () => {
  const { t } = useTranslation();
  const dir = useDirDetection();
  const { data: nodes, isLoading } = useNodesQuery();
  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;

  return (
    <ContentLayout className="pb-8">
      <div
        dir={dir}
        className="mx-auto pt-6 gap-4 flex items-center justify-between flex-wrap px-4 sm:px-8 pb-4"
      >
        <div className="flex flex-col gap-y-2">
          <h1 className="font-semibold text-2xl sm:text-3xl">{t("nodes")}</h1>
          <span className="text-muted-foreground text-xs sm:text-sm">
            {t("manageNodes")}
          </span>
        </div>
        <div>
          <Button className="flex items-center">
            <Plus />
            <span>{t("nodes.addNode")}</span>
          </Button>
        </div>
      </div>
      <Separator />
      <div>
        <NodesSection nodes={nodes} />
      </div>
    </ContentLayout>
  );
};

export default Nodes;
