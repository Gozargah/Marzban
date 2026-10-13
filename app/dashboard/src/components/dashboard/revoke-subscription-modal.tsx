import { RotateCcw } from "lucide-react";
import { useDashboard } from "contexts/DashboardContext";
import { Trans, useTranslation } from "react-i18next";
import { ConfirmationDialog } from "./confirmation-dialog";
export const ResetIcon = RotateCcw;
export function RevokeSubscriptionModal() {
  const { revokeSubscriptionUser: user, revokeSubscription } = useDashboard();
  const { t } = useTranslation();
  return (
    <ConfirmationDialog
      open={!!user}
      onClose={() => useDashboard.setState({ revokeSubscriptionUser: null })}
      onConfirm={async () => {
        if (user) await revokeSubscription(user);
      }}
      title={t("revokeUserSub.title")}
      description={
        <Trans
          i18nKey="revokeUserSub.prompt"
          values={{ username: user?.username }}
          components={{ b: <b className="break-all" /> }}
        />
      }
      actionLabel={t("revoke")}
      successMessage={t("revokeUserSub.success", { username: user?.username })}
      errorMessage={t("revokeUserSub.error")}
      icon={<RotateCcw className="size-5" />}
    />
  );
}
