import { useQueryClient } from "@tanstack/react-query";
import { FetchNodesQueryKey, useNodes } from "@/contexts/nodes-context";
import { Trans, useTranslation } from "react-i18next";
import { ConfirmationDialog } from "./confirmation-dialog";
import { DeleteIcon, DeleteUserModalProps } from "./delete-user-modal";
export function DeleteNodeModal({ deleteCallback }: DeleteUserModalProps) {
  const deletingNode = useNodes((state) => state.deletingNode);
  const deleteNode = useNodes((state) => state.deleteNode);
  const setDeletingNode = useNodes((state) => state.setDeletingNode);
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return (
    <ConfirmationDialog
      open={!!deletingNode}
      onClose={() => setDeletingNode(null)}
      onConfirm={async () => {
        await deleteNode();
        await queryClient.invalidateQueries({ queryKey: [FetchNodesQueryKey] });
        deleteCallback?.();
      }}
      title={t("deleteNode.title")}
      description={
        <Trans
          i18nKey="deleteNode.prompt"
          values={{ name: deletingNode?.name }}
          components={{ b: <b className="break-all" /> }}
        />
      }
      actionLabel={t("delete")}
      successMessage={t("deleteNode.deleteSuccess", { name: deletingNode?.name })}
      errorMessage={t("deleteNode.error", { defaultValue: "Could not delete the node. Please try again." })}
      icon={<DeleteIcon />}
      destructive
    />
  );
}
