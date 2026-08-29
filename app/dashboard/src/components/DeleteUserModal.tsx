import { useToast } from "@chakra-ui/react";
import { FC, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useDashboard } from "contexts/DashboardContext";
import { ConfirmDialog } from "xenith/ConfirmDialog";

export const DeleteUserModal: FC = () => {
  const [loading, setLoading] = useState(false);
  const { deletingUser: user, onDeletingUser, deleteUser } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();

  const onClose = () => onDeletingUser(null);

  const onDelete = () => {
    if (!user) return;
    setLoading(true);
    deleteUser(user)
      .then(() => {
        toast({
          title: t("deleteUser.deleteSuccess", { username: user.username }),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
      })
      .then(onClose)
      .finally(() => setLoading(false));
  };

  return (
    <ConfirmDialog
      open={!!user}
      title={t("deleteUser.title")}
      body={
        user && <Trans components={{ b: <b /> }}>{t("deleteUser.prompt", { username: user.username })}</Trans>
      }
      confirmLabel={t("delete")}
      busy={loading}
      danger
      onConfirm={onDelete}
      onClose={onClose}
    />
  );
};
