import { Component, lazy, Suspense, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog as DialogRoot, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type Loader = () => Promise<{ default: ComponentType }>;

class DialogBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/** Declare once at module scope. Code loads on first open, then stays mounted for sheet animations. */
export function createDeferredDialog(load: Loader) {
  return function DeferredDialog({ open, onClose }: { open: boolean; onClose?: () => void }) {
    const { t } = useTranslation();
    const [opened, setOpened] = useState(open);
    const [attempt, setAttempt] = useState(0);
    const [Dialog, setDialog] = useState(() => lazy(load));
    useEffect(() => { if (open) setOpened(true); }, [open]);
    if (!open && !opened) return null;
    const frame = (children: ReactNode) => open ? (
      <DialogRoot open onOpenChange={(next) => { if (!next) onClose?.(); }}>
        <DialogContent aria-describedby={undefined} showCloseButton={false}>
          <DialogTitle>{t("dialogOpening", { defaultValue: "Opening dialog" })}</DialogTitle>
          {children}
          {onClose && <Button variant="outline" onClick={onClose}>{t("cancel")}</Button>}
        </DialogContent>
      </DialogRoot>
    ) : null;
    const failed = frame(<div role="alert" className="flex flex-col items-center gap-3">
      <p>{t("dialogLoadError", { defaultValue: "Could not open this dialog. Please try again." })}</p>
      <Button onClick={() => {
        setDialog(() => lazy(load));
        setAttempt((current) => current + 1);
      }}>{t("retry", { defaultValue: "Retry" })}</Button>
    </div>);
    return <DialogBoundary key={attempt} fallback={failed}>
      <Suspense fallback={frame(<div role="status" className="flex items-center gap-2"><Spinner aria-hidden="true" />{t("loading", { defaultValue: "Loading…" })}</div>)}>
        <Dialog />
      </Suspense>
    </DialogBoundary>;
  };
}

/** Lightweight shells are already downloaded; retain them only after their first opening. */
export function createImmediateDialog(Dialog: ComponentType) {
  return function ImmediateDialog({ open }: { open: boolean; onClose?: () => void }) {
    const [opened, setOpened] = useState(open);
    useEffect(() => { if (open) setOpened(true); }, [open]);
    return open || opened ? <Dialog /> : null;
  };
}
