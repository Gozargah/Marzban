import { ReactNode, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ConfirmationDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  actionLabel,
  successMessage,
  errorMessage,
  icon,
  destructive = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  title: string;
  description: ReactNode;
  actionLabel: string;
  successMessage: string;
  errorMessage: string;
  icon: ReactNode;
  destructive?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const close = () => {
    if (!lock.current) {
      setError(null);
      onClose();
    }
  };
  const confirm = async () => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    setError(null);
    try {
      await onConfirm();
    } catch {
      setError(errorMessage);
      return;
    } finally {
      lock.current = false;
      setPending(false);
    }
    toast.success(successMessage, { duration: 3000, closeButton: true });
    close();
  };
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <AlertDialogContent className="sm:max-w-sm" initialFocus={cancel} dir={i18n.dir()} aria-busy={pending}>
        <AlertDialogHeader>
          <span
            aria-hidden="true"
            className={
              destructive
                ? "mb-2 flex size-10 items-center justify-center rounded-lg bg-destructive/10 text-destructive"
                : "mb-2 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
            }
          >
            {icon}
          </span>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <AlertDialogFooter>
          <Button ref={cancel} type="button" variant="outline" className="flex-1" disabled={pending} onClick={close}>
            {t("cancel")}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            className="flex-1"
            disabled={pending}
            onClick={confirm}
          >
            {pending && <Spinner />}
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
