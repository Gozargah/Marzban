import { useToast } from "@chakra-ui/react";
import { FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDashboard } from "contexts/DashboardContext";
import { ConfirmDialog } from "xenith/ConfirmDialog";

export const RevokeSubscriptionModal: FC = () => {
  const [loading, setLoading] = useState(false);
  const { revokeSubscriptionUser: user, revokeSubscription } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();

  const onClose = () => useDashboard.setState({ revokeSubscriptionUser: null });

  const onRevoke = () => {
    if (!user) return;
    setLoading(true);
    revokeSubscription(user)
      .then(() => {
        toast({
          title: t("revokeUserSub.success", { username: user.username }),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .catch(() => {
        toast({ title: t("revokeUserSub.error"), status: "error", isClosable: true, position: "top", duration: 3000 });
      })
      .finally(() => setLoading(false));
  };

  return (
    <ConfirmDialog
      open={!!user}
      title={t("revokeUserSub.title")}
      body={user && <Trans components={{ b: <b /> }}>{t("revokeUserSub.prompt", { username: user.username })}</Trans>}
      confirmLabel={t("revoke")}
      busy={loading}
      onConfirm={onRevoke}
      onClose={onClose}
    />
  );
};
