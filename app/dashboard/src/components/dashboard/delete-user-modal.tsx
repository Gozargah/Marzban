import { useLocale } from "@/hooks/use-locale";
import { Trash2 } from "lucide-react";
import { useDashboard } from "@/contexts/dashboard-context";
import { FC, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// Keep the existing export for node and host dialogs that share this icon.
export const DeleteIcon: FC<React.ComponentProps<typeof Trash2>> = ({ className, ...props }) => (
  <Trash2 className={["size-5", className].filter(Boolean).join(" ")} {...props} />
);

export type DeleteUserModalProps = {
  deleteCallback?: () => void;
};

export const DeleteUserModal: FC<DeleteUserModalProps> = ({ deleteCallback }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const user = useDashboard((state) => state.deletingUser);
  const onDeletingUser = useDashboard((state) => state.onDeletingUser);
  const deleteUser = useDashboard((state) => state.deleteUser);
  const { t } = useTranslation();
  const { direction } = useLocale();

  const onClose = () => {
    if (pendingRef.current) return;
    setError(null);
    onDeletingUser(null);
  };

  const onDelete = async () => {
    if (!user || pendingRef.current) return;
    pendingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await deleteUser(user);
    } catch {
      setError(t("deleteUser.error", { defaultValue: "Could not delete the user. Please try again." }));
      return;
    } finally {
      pendingRef.current = false;
      setLoading(false);
    }
    toast.success(t("deleteUser.deleteSuccess", { username: user.username }), {
      duration: 3000,
      closeButton: true,
    });
    onClose();
    deleteCallback?.();
  };

  return (
    <AlertDialog
      open={!!user}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent className="sm:max-w-sm" initialFocus={cancelRef} dir={direction} aria-busy={loading}>
        <AlertDialogHeader>
          <span
            className="mb-2 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
            aria-hidden="true"
          >
            <DeleteIcon />
          </span>
          <AlertDialogTitle>{t("deleteUser.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {user && (
              <Trans
                i18nKey="deleteUser.prompt"
                values={{ username: user.username }}
                components={{ b: <b className="break-all font-semibold text-foreground" /> }}
              />
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <Button
            ref={cancelRef}
            type="button"
            size="sm"
            variant="outline"
            className="flex-1"
            disabled={loading}
            onClick={onClose}
          >
            {t("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="destructive"
            className="flex-1"
            disabled={loading}
            onClick={onDelete}
          >
            {loading && <Spinner />}
            {t("delete")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
