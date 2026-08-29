import { useToast } from "@chakra-ui/react";
import { FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDashboard } from "contexts/DashboardContext";
import { ConfirmDialog } from "xenith/ConfirmDialog";

export const ResetAllUsageModal: FC = () => {
  const [loading, setLoading] = useState(false);
  const { isResetingAllUsage, onResetAllUsage, resetAllUsage } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();

  const onReset = () => {
    setLoading(true);
    resetAllUsage()
      .then(() => {
        toast({ title: t("resetAllUsage.success"), status: "success", isClosable: true, position: "top", duration: 3000 });
      })
      .catch(() => {
        toast({ title: t("resetAllUsage.error"), status: "error", isClosable: true, position: "top", duration: 3000 });
      })
      .finally(() => setLoading(false));
  };

  return (
    <ConfirmDialog
      open={isResetingAllUsage}
      title={t("resetAllUsage.title")}
      body={<Trans components={{ b: <b /> }}>{t("resetAllUsage.prompt")}</Trans>}
      confirmLabel={t("reset")}
      busy={loading}
      danger
      onConfirm={onReset}
      onClose={() => onResetAllUsage(false)}
    />
  );
};
