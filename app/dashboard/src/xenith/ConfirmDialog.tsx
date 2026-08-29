import { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  danger?: boolean;
  /** Blocks confirmation while the dialog's own form is incomplete. */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

/** The design system's dialog: square, hairline, no shadow. */
export const ConfirmDialog: FC<ConfirmDialogProps> = ({
  open,
  title,
  body,
  confirmLabel,
  busy = false,
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  return (
    <div className="xn-dialog-backdrop" onClick={onClose}>
      <div className="xn-dialog" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className="xn-heading" style={{ fontSize: 20, lineHeight: 1.1 }}>
          {title}
        </h3>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--xn-neutral-700)" }}>{body}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button className="xn-btn xn-btn-secondary" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button
            className={`xn-btn ${danger ? "xn-btn-danger" : "xn-btn-primary"}`}
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {busy ? t("xenith.working") : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
