import { useToast } from "@chakra-ui/react";
import { FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDashboard } from "contexts/DashboardContext";
import { ConfirmDialog } from "xenith/ConfirmDialog";

export const ResetUserUsageModal: FC = () => {
  const [loading, setLoading] = useState(false);
  const { resetUsageUser: user, resetDataUsage } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();

  const onClose = () => useDashboard.setState({ resetUsageUser: null });

  const onReset = () => {
    if (!user) return;
    setLoading(true);
    resetDataUsage(user)
      .then(() => {
        toast({
          title: t("resetUserUsage.success", { username: user.username }),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .catch(() => {
        toast({ title: t("resetUserUsage.error"), status: "error", isClosable: true, position: "top", duration: 3000 });
      })
      .finally(() => setLoading(false));
  };

  return (
    <ConfirmDialog
      open={!!user}
      title={t("resetUserUsage.title")}
      body={user && <Trans components={{ b: <b /> }}>{t("resetUserUsage.prompt", { username: user.username })}</Trans>}
      confirmLabel={t("reset")}
      busy={loading}
      onConfirm={onReset}
      onClose={onClose}
    />
  );
};
