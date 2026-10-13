import { RotateCcw } from "lucide-react";
import { useDashboard } from "contexts/DashboardContext";
import { Trans, useTranslation } from "react-i18next";
import { ConfirmationDialog } from "./confirmation-dialog";
export const ResetIcon = RotateCcw;
export function ResetUserUsageModal() {
  const { resetUsageUser: user, resetDataUsage } = useDashboard();
  const { t } = useTranslation();
  return (
    <ConfirmationDialog
      open={!!user}
      onClose={() => useDashboard.setState({ resetUsageUser: null })}
      onConfirm={async () => {
        if (user) await resetDataUsage(user);
      }}
      title={t("resetUserUsage.title")}
      description={
        <Trans
          i18nKey="resetUserUsage.prompt"
          values={{ username: user?.username }}
          components={{ b: <b className="break-all" /> }}
        />
      }
      actionLabel={t("reset")}
      successMessage={t("resetUserUsage.success", { username: user?.username })}
      errorMessage={t("resetUserUsage.error")}
      icon={<RotateCcw className="size-5" />}
    />
  );
}
