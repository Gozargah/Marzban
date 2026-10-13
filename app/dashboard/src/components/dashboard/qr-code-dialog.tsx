import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, QrCode } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { useDashboard } from "@/contexts/dashboard-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function QRCodeDialog() {
  const QRcodeLinks = useDashboard((state) => state.QRcodeLinks);
  const setQRCode = useDashboard((state) => state.setQRCode);
  const setSubLink = useDashboard((state) => state.setSubLink);
  const subscribeUrl = useDashboard((state) => state.subscribeUrl);
  const { t, i18n } = useTranslation();
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [QRcodeLinks]);
  const close = () => {
    setQRCode(null);
    setSubLink(null);
  };
  const subscription = subscribeUrl?.startsWith("/") ? window.location.origin + subscribeUrl : subscribeUrl;
  const links = QRcodeLinks ?? [];
  const current = Math.min(index, Math.max(links.length - 1, 0));
  const qr = (value: string) => (
    <div className="mx-auto w-fit max-w-full rounded-md bg-white p-2">
      <QRCodeCanvas value={value} size={300} level="L" className="h-auto max-w-full" />
    </div>
  );
  return (
    <Dialog
      open={QRcodeLinks !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl"
        dir={i18n.dir()}
        aria-describedby={undefined}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <QrCode className="size-5 text-primary-text" />
            {t("qrcodeDialog.title", { defaultValue: "QR codes" })}
          </DialogTitle>
        </DialogHeader>
        <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2">
          {subscription && (
            <div className="min-w-0 space-y-2">
              {qr(subscription)}
              <p className="text-center text-sm">{t("qrcodeDialog.sublink")}</p>
            </div>
          )}
          {!!links.length && (
            <div className="min-w-0 space-y-2">
              {qr(links[current])}
              <div className="flex items-center justify-center gap-3" dir="ltr">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={t("previous", { defaultValue: "Previous" })}
                  disabled={links.length < 2}
                  onClick={() => setIndex((current + links.length - 1) % links.length)}
                >
                  <ChevronLeft />
                </Button>
                <span className="text-sm" aria-live="polite">
                  {current + 1} / {links.length}
                </span>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  aria-label={t("next", { defaultValue: "Next" })}
                  disabled={links.length < 2}
                  onClick={() => setIndex((current + 1) % links.length)}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
