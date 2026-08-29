import { useToast } from "@chakra-ui/react";
import { ChevronLeft, ChevronRight, Copy } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { FC, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDashboard } from "../contexts/DashboardContext";

/** Subscription QR plus one QR per proxy link, stepped through one at a time. */
export const QRCodeDialog: FC = () => {
  const { QRcodeLinks, setQRCode, setSubLink, subscribeUrl } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();
  const [index, setIndex] = useState(0);

  const isOpen = QRcodeLinks !== null || !!subscribeUrl;
  const links = QRcodeLinks || [];

  useEffect(() => {
    setIndex(0);
  }, [QRcodeLinks, subscribeUrl]);

  if (!isOpen) return null;

  const subscribeQrLink = String(subscribeUrl).startsWith("/")
    ? window.location.origin + subscribeUrl
    : String(subscribeUrl);

  const showingSubscription = !!subscribeUrl;
  const value = showingSubscription ? subscribeQrLink : links[index];

  const onClose = () => {
    setQRCode(null);
    setSubLink(null);
  };

  const onCopy = () => {
    navigator.clipboard?.writeText(value);
    toast({ title: t("usersTable.copied"), status: "success", position: "top", duration: 1500, isClosable: true });
  };

  return (
    <div className="xn-dialog-backdrop" onClick={onClose}>
      <div
        className="xn-dialog"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(360px, 100%)", alignItems: "stretch" }}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="xn-heading" style={{ fontSize: 20, lineHeight: 1.1 }}>
          {showingSubscription ? t("qrcodeDialog.subscribeLink") : t("qrcodeDialog.title")}
        </h3>

        <div
          style={{
            display: "grid",
            placeItems: "center",
            padding: 16,
            border: "1px solid var(--xn-divider)",
            background: "var(--xn-bg)",
          }}
        >
          <QRCodeCanvas value={value} size={240} level="L" bgColor="#f2f2f3" fgColor="#1d1f20" />
        </div>

        <div
          className="xn-mono"
          style={{
            fontSize: 11,
            color: "var(--xn-neutral-700)",
            wordBreak: "break-all",
            maxHeight: 54,
            overflow: "auto",
          }}
        >
          {value}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!showingSubscription && links.length > 1 && (
            <>
              <button
                className="xn-btn xn-btn-secondary"
                disabled={index === 0}
                onClick={() => setIndex((current) => Math.max(0, current - 1))}
              >
                <ChevronLeft size={15} strokeWidth={1.5} />
              </button>
              <span className="xn-mono" style={{ fontSize: 11, color: "var(--xn-neutral-600)" }}>
                {index + 1} / {links.length}
              </span>
              <button
                className="xn-btn xn-btn-secondary"
                disabled={index >= links.length - 1}
                onClick={() => setIndex((current) => Math.min(links.length - 1, current + 1))}
              >
                <ChevronRight size={15} strokeWidth={1.5} />
              </button>
            </>
          )}
          <button className="xn-btn xn-btn-secondary" style={{ marginLeft: "auto" }} onClick={onCopy}>
            <Copy size={15} strokeWidth={1.5} />
            {t("usersTable.copyLink")}
          </button>
          <button className="xn-btn xn-btn-primary" onClick={onClose}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
};
