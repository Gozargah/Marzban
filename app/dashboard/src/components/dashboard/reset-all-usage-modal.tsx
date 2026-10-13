import { FileMinus } from "lucide-react";
import { useDashboard } from "contexts/DashboardContext";
import { Trans, useTranslation } from "react-i18next";
import { ConfirmationDialog } from "./confirmation-dialog";
export const ResetIcon = FileMinus;
export function ResetAllUsageModal() {
  const { isResetingAllUsage, onResetAllUsage, resetAllUsage } = useDashboard();
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
