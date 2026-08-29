import { useToast } from "@chakra-ui/react";
import { TriangleAlert } from "lucide-react";
import { FC, FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "react-query";
import {
  Certificate,
  deleteCertificate,
  issueCertificate,
  renewCertificate,
  useCertificates,
} from "xenith/api";
import { Blueprint } from "xenith/Blueprint";
import { ConfirmDialog } from "xenith/ConfirmDialog";
import { PanelEmpty, PanelHead, PanelNote } from "xenith/panels";

type Method = "standalone" | "webroot";

/** Expiry tag: accent while healthy, outline once renewal is due. */
const ExpiryTag: FC<{ certificate: Certificate }> = ({ certificate }) => {
  const { t } = useTranslation();
  const days = certificate.days_left;

  if (days === null) return <span className="xn-tag xn-tag-neutral">{t("xenith.certs.unknown")}</span>;
  if (days < 0) return <span className="xn-tag xn-tag-neutral">{t("xenith.certs.expired")}</span>;
  return (
    <span className={`xn-tag ${days <= 21 ? "xn-tag-outline" : "xn-tag-accent"}`}>
      {t("xenith.certs.daysLeft", { total: days })}
    </span>
  );
};

export const Certificates: FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useCertificates();

  const [domains, setDomains] = useState("");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<Method>("standalone");
  const [webroot, setWebroot] = useState("");
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  const [renewing, setRenewing] = useState<Certificate | null>(null);
  const [deleting, setDeleting] = useState<Certificate | null>(null);

  const enabled = data?.enabled ?? false;
  const certificates = data?.certificates || [];

  const refresh = () => queryClient.invalidateQueries("xenith-certificates");

  const describe = (err: any) => err?.response?._data?.detail || t("xenith.certs.failed");

  const onIssue = (event: FormEvent) => {
    event.preventDefault();
    setFailure("");
    setBusy(true);
    issueCertificate({
      domains: domains
        .split(/[\s,]+/)
        .map((domain) => domain.trim())
        .filter(Boolean),
      email: email || undefined,
      method,
      webroot: method === "webroot" ? webroot : undefined,
    })
      .then(() => {
        toast({ title: t("xenith.certs.issued"), status: "success", position: "top", duration: 4000, isClosable: true });
        setDomains("");
        refresh();
      })
      .catch((err) => setFailure(describe(err)))
      .finally(() => setBusy(false));
  };

  const onRenew = () => {
    if (!renewing) return;
    setBusy(true);
    renewCertificate(renewing.name)
      .then(() => {
        toast({ title: t("xenith.certs.renewed"), status: "success", position: "top", duration: 4000, isClosable: true });
        refresh();
      })
      .catch((err) =>
        toast({ title: describe(err), status: "error", position: "top", duration: 6000, isClosable: true }),
      )
      .finally(() => {
        setBusy(false);
        setRenewing(null);
      });
  };

  const onDelete = () => {
    if (!deleting) return;
    setBusy(true);
    deleteCertificate(deleting.name)
      .then(() => {
        toast({ title: t("xenith.certs.deleted"), status: "success", position: "top", duration: 4000, isClosable: true });
        refresh();
      })
      .catch((err) =>
        toast({ title: describe(err), status: "error", position: "top", duration: 6000, isClosable: true }),
      )
      .finally(() => {
        setBusy(false);
        setDeleting(null);
      });
  };

  return (
    <>
      {!enabled && !isLoading && (
        <Blueprint style={{ padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start" }}>
          <TriangleAlert size={16} strokeWidth={1.5} color="var(--xn-accent-800)" style={{ flex: "none", marginTop: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="xn-heading" style={{ fontSize: 17 }}>
              {t("xenith.certs.disabledTitle")}
            </span>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--xn-neutral-700)" }}>
              {isError ? describe(error) : t("xenith.certs.disabledBody")}
            </span>
            <code className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-accent-800)" }}>
              CERTBOT_ENABLED = True
            </code>
          </div>
        </Blueprint>
      )}

      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.certs.title")}
          note={t("xenith.certs.note", { total: certificates.length })}
          trailing={data?.staging ? <PanelNote>{t("xenith.certs.staging")}</PanelNote> : undefined}
        />
        {certificates.length === 0 ? (
          <PanelEmpty loading={isLoading}>{t("xenith.certs.empty")}</PanelEmpty>
        ) : (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>{t("xenith.certs.name")}</th>
                  <th>{t("xenith.certs.domains")}</th>
                  <th>{t("xenith.certs.expiry")}</th>
                  <th>{t("xenith.certs.path")}</th>
                  <th style={{ textAlign: "right" }}>{t("xenith.users.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((certificate) => (
                  <tr key={certificate.name}>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {certificate.name}
                    </td>
                    <td style={{ color: "var(--xn-neutral-700)" }}>{certificate.domains.join(", ")}</td>
                    <td>
                      <ExpiryTag certificate={certificate} />
                    </td>
                    <td className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
                      {certificate.certificate_path || "—"}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          className="xn-btn xn-btn-secondary"
                          style={{ fontSize: 12 }}
                          onClick={() => setRenewing(certificate)}
                        >
                          {t("xenith.certs.renew")}
                        </button>
                        <button
                          className="xn-btn xn-btn-danger"
                          style={{ fontSize: 12 }}
                          onClick={() => setDeleting(certificate)}
                        >
                          {t("delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Blueprint>

      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <PanelHead title={t("xenith.certs.issueTitle")} note={t("xenith.certs.issueNote")} />

        {failure && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "11px 13px",
              border: "1px solid var(--xn-accent-600)",
              background: "var(--xn-accent-100)",
            }}
          >
            <TriangleAlert size={16} strokeWidth={1.5} color="var(--xn-accent-800)" style={{ flex: "none", marginTop: 1 }} />
            <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--xn-accent-900)" }}>{failure}</span>
          </div>
        )}

        <form onSubmit={onIssue} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="xn-label">{t("xenith.certs.domainsLabel")}</span>
            <input
              className="xn-input xn-mono"
              style={{ fontSize: 13 }}
              placeholder="panel.example.com, sub.example.com"
              value={domains}
              onChange={(event) => setDomains(event.target.value)}
              disabled={!enabled}
            />
            <span style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>{t("xenith.certs.domainsHint")}</span>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="xn-label">{t("xenith.certs.emailLabel")}</span>
            <input
              className="xn-input xn-mono"
              style={{ fontSize: 13 }}
              placeholder="ops@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={!enabled}
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="xn-label">{t("xenith.certs.methodLabel")}</span>
            <div className="xn-seg" style={{ alignSelf: "flex-start" }}>
              {(["standalone", "webroot"] as Method[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="xn-seg-opt"
                  style={{ fontSize: 12 }}
                  aria-pressed={method === option}
                  onClick={() => setMethod(option)}
                  disabled={!enabled}
                >
                  {t(`xenith.certs.method.${option}`)}
                </button>
              ))}
            </div>
            <span style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
              {t(`xenith.certs.methodHint.${method}`)}
            </span>
          </div>

          {method === "webroot" && (
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="xn-label">{t("xenith.certs.webrootLabel")}</span>
              <input
                className="xn-input xn-mono"
                style={{ fontSize: 13 }}
                placeholder="/var/www/html"
                value={webroot}
                onChange={(event) => setWebroot(event.target.value)}
                disabled={!enabled}
              />
            </label>
          )}

          <button
            type="submit"
            className="xn-btn xn-btn-primary"
            style={{ alignSelf: "flex-start", height: 40, fontSize: 14 }}
            disabled={!enabled || busy || !domains.trim()}
          >
            {busy ? t("xenith.certs.issuing") : t("xenith.certs.issue")}
          </button>
        </form>
      </Blueprint>

      <ConfirmDialog
        open={!!renewing}
        title={t("xenith.certs.renew")}
        body={t("xenith.certs.renewPrompt", { name: renewing?.name })}
        confirmLabel={t("xenith.certs.renew")}
        busy={busy}
        onConfirm={onRenew}
        onClose={() => setRenewing(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t("xenith.certs.deleteTitle")}
        body={t("xenith.certs.deletePrompt", { name: deleting?.name })}
        confirmLabel={t("delete")}
        busy={busy}
        danger
        onConfirm={onDelete}
        onClose={() => setDeleting(null)}
      />
    </>
  );
};

export default Certificates;
