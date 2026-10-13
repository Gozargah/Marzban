import { RotateCcw } from "lucide-react";
import { useDashboard } from "@/contexts/dashboard-context";
import { Trans, useTranslation } from "react-i18next";
import { ConfirmationDialog } from "./confirmation-dialog";
export const ResetIcon = RotateCcw;
export function RevokeSubscriptionModal() {
  const user = useDashboard((state) => state.revokeSubscriptionUser);
  const revokeSubscription = useDashboard((state) => state.revokeSubscription);
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
