import { FileMinus } from "lucide-react";
import { useDashboard } from "@/contexts/dashboard-context";
import { Trans, useTranslation } from "react-i18next";
import { ConfirmationDialog } from "./confirmation-dialog";
export const ResetIcon = FileMinus;
export function ResetAllUsageModal() {
  const isResetingAllUsage = useDashboard((state) => state.isResetingAllUsage);
  const onResetAllUsage = useDashboard((state) => state.onResetAllUsage);
  const resetAllUsage = useDashboard((state) => state.resetAllUsage);
  const { t } = useTranslation();
  return (
    <ConfirmationDialog
      open={isResetingAllUsage}
      onClose={() => onResetAllUsage(false)}
      onConfirm={async () => {
        await resetAllUsage();
      }}
      title={t("resetAllUsage.title")}
      description={t("resetAllUsage.prompt")}
      actionLabel={t("reset")}
      successMessage={t("resetAllUsage.success")}
      errorMessage={t("resetAllUsage.error")}
      icon={<FileMinus className="size-5" />}
      destructive
    />
  );
}
