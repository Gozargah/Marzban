import { useToast } from "@chakra-ui/react";
import { CircleCheck, CircleX, TriangleAlert, Upload } from "lucide-react";
import { ChangeEvent, FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "react-query";
import {
  NginxAsset,
  NginxResult,
  NginxSite,
  deleteNginxFile,
  deleteNginxSite,
  readNginxFile,
  readNginxSite,
  reloadNginx,
  setNginxSiteEnabled,
  testNginxConfig,
  uploadNginxFile,
  useNginxFiles,
  useNginxLog,
  useNginxSites,
  useNginxStatus,
  writeNginxFile,
  writeNginxSite,
} from "xenith/api";
import { Blueprint } from "xenith/Blueprint";
import { ConfirmDialog } from "xenith/ConfirmDialog";
import { formatBytes } from "xenith/format";
import { PanelEmpty, PanelHead, PanelNote } from "xenith/panels";

const describe = (err: any, fallback: string) => err?.response?._data?.detail || fallback;

/** A file being edited, whether it is a site config or a page in the web root. */
type Draft = { kind: "site" | "file"; name: string; content: string; saved: string };

const Notice: FC<{ children: React.ReactNode }> = ({ children }) => (
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
    <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--xn-accent-900)" }}>{children}</div>
  </div>
);

/**
 * The host's nginx.
 *
 * Saving a site config and reloading nginx are deliberately two separate
 * actions. The backend rolls back a config the server rejects, so a save is
 * always safe, but a saved config is not a running one until it is reloaded —
 * and conflating the two is how a change appears to have taken effect when it
 * has not.
 */
export const Nginx: FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useNginxStatus();
  const { data: sites } = useNginxSites();
  const { data: webroot } = useNginxFiles();

  const [logName, setLogName] = useState<"error" | "access">("error");
  const { data: log } = useNginxLog(logName);

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState("");
  const [removingSite, setRemovingSite] = useState<NginxSite | null>(null);
  const [removingFile, setRemovingFile] = useState<NginxAsset | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const enabled = status?.enabled ?? false;

  const refresh = () => {
    queryClient.invalidateQueries("xenith-nginx");
    queryClient.invalidateQueries("xenith-nginx-sites");
    queryClient.invalidateQueries("xenith-nginx-files");
    queryClient.invalidateQueries("xenith-nginx-log");
  };

  const fail = (err: any) =>
    toast({
      title: describe(err, t("xenith.nginx.failed")),
      status: "error",
      position: "top",
      duration: 8000,
      isClosable: true,
    });

  const succeed = (title: string) =>
    toast({ title, status: "success", position: "top", duration: 4000, isClosable: true });

  const run = (work: Promise<NginxResult>, title: string) => {
    setBusy(true);
    work
      .then((result) => {
        setOutput(result.detail);
        succeed(title);
        refresh();
      })
      .catch((err) => {
        setOutput(describe(err, ""));
        fail(err);
      })
      .finally(() => setBusy(false));
  };

  // Close the editor whenever the file behind it is gone.
  useEffect(() => {
    if (draft?.kind === "site" && sites && !sites.some((site) => site.name === draft.name)) {
      setDraft(null);
    }
  }, [sites, draft]);

  const openSite = (name: string) => {
    setBusy(true);
    readNginxSite(name)
      .then((site) => setDraft({ kind: "site", name, content: site.content, saved: site.content }))
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const openFile = (path: string) => {
    setBusy(true);
    readNginxFile(path)
      .then((file) => setDraft({ kind: "file", name: path, content: file.content, saved: file.content }))
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const onSave = () => {
    if (!draft) return;
    if (draft.kind === "site") {
      run(writeNginxSite(draft.name, draft.content), t("xenith.nginx.saved"));
      setDraft({ ...draft, saved: draft.content });
      return;
    }
    setBusy(true);
    writeNginxFile(draft.name, draft.content)
      .then(() => {
        succeed(t("xenith.nginx.saved"));
        setDraft({ ...draft, saved: draft.content });
        refresh();
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const onUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBusy(true);
    uploadNginxFile(file)
      .then((asset) => {
        succeed(t("xenith.nginx.uploaded", { name: asset.path }));
        refresh();
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const onRemoveSite = () => {
    if (!removingSite) return;
    run(deleteNginxSite(removingSite.name), t("xenith.nginx.siteDeleted"));
    setRemovingSite(null);
  };

  const onRemoveFile = () => {
    if (!removingFile) return;
    setBusy(true);
    deleteNginxFile(removingFile.path)
      .then(() => {
        succeed(t("xenith.nginx.fileDeleted"));
        if (draft?.kind === "file" && draft.name === removingFile.path) setDraft(null);
        refresh();
      })
      .catch(fail)
      .finally(() => {
        setBusy(false);
        setRemovingFile(null);
      });
  };

  const dirty = draft ? draft.content !== draft.saved : false;

  return (
    <>
      {!enabled && !isLoading && (
        <Blueprint style={{ padding: "16px 18px" }}>
          <Notice>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="xn-heading" style={{ fontSize: 17 }}>
                {t("xenith.nginx.disabledTitle")}
              </span>
              <span>{t("xenith.nginx.disabledBody")}</span>
              <code className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-accent-800)" }}>
                NGINX_ENABLED = True
              </code>
            </div>
          </Notice>
        </Blueprint>
      )}

      {/* Status */}
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.nginx.statusTitle")}
          note={status?.paths?.conf_dir}
          trailing={
            <div style={{ display: "flex", gap: 6 }}>
              <button
                className="xn-btn xn-btn-secondary"
                style={{ fontSize: 12.5 }}
                onClick={() => run(testNginxConfig(), t("xenith.nginx.tested"))}
                disabled={!enabled || busy}
              >
                {t("xenith.nginx.test")}
              </button>
              <button
                className="xn-btn xn-btn-primary"
                style={{ fontSize: 12.5 }}
                onClick={() => run(reloadNginx(), t("xenith.nginx.reloaded"))}
                disabled={!enabled || busy}
              >
                {t("xenith.nginx.reload")}
              </button>
            </div>
          }
        />

        <div className="xn-grid-cells" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
          {[
            {
              label: t("xenith.nginx.state"),
              value: status?.running ? t("xenith.running") : t("xenith.stopped"),
            },
            { label: t("xenith.nginx.version"), value: status?.version || "—" },
            {
              label: t("xenith.nginx.config"),
              value:
                status?.config_ok === null || status?.config_ok === undefined
                  ? "—"
                  : status.config_ok
                    ? t("xenith.nginx.valid")
                    : t("xenith.nginx.invalid"),
            },
            {
              label: t("xenith.nginx.listening"),
              value: status?.listening?.length ? status.listening.join(", ") : "—",
            },
          ].map((fact) => (
            <div
              key={fact.label}
              className="xn-cell"
              style={{ padding: "16px 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span className="xn-label">{fact.label}</span>
              <span className="xn-mono" style={{ fontSize: 13.5 }}>
                {fact.value}
              </span>
            </div>
          ))}
        </div>

        {(output || status?.message) && (
          <pre
            className="xn-mono"
            style={{
              fontSize: 11.5,
              lineHeight: 1.5,
              margin: 0,
              padding: 10,
              overflowX: "auto",
              whiteSpace: "pre-wrap",
              border: "1px solid var(--xn-neutral-200)",
              background: "var(--xn-neutral-100)",
            }}
          >
            {output || status?.message}
          </pre>
        )}
      </Blueprint>

      {/* Sites */}
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.nginx.sitesTitle")}
          note={t("xenith.nginx.sitesNote")}
          trailing={status?.paths?.sites_available ? <PanelNote>{status.paths.sites_available}</PanelNote> : undefined}
        />
        {!sites?.length ? (
          <PanelEmpty loading={isLoading}>{t("xenith.nginx.noSites")}</PanelEmpty>
        ) : (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>{t("xenith.nginx.site")}</th>
                  <th>{t("status")}</th>
                  <th>{t("xenith.nginx.size")}</th>
                  <th style={{ textAlign: "right" }}>{t("xenith.users.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr key={site.name}>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {site.name}
                    </td>
                    <td>
                      <span className={`xn-tag ${site.enabled ? "xn-tag-accent" : "xn-tag-neutral"}`}>
                        {site.enabled ? t("xenith.nginx.enabled") : t("xenith.nginx.disabled")}
                      </span>
                    </td>
                    <td className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
                      {formatBytes(site.size)}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          className="xn-btn xn-btn-secondary"
                          style={{ fontSize: 12 }}
                          onClick={() => openSite(site.name)}
                          disabled={busy}
                        >
                          {t("edit")}
                        </button>
                        <button
                          className="xn-btn xn-btn-secondary"
                          style={{ fontSize: 12 }}
                          onClick={() =>
                            run(
                              setNginxSiteEnabled(site.name, !site.enabled),
                              site.enabled ? t("xenith.nginx.siteDisabled") : t("xenith.nginx.siteEnabled"),
                            )
                          }
                          disabled={busy}
                        >
                          {site.enabled ? t("xenith.nginx.disable") : t("xenith.nginx.enable")}
                        </button>
                        <button
                          className="xn-btn xn-btn-danger"
                          style={{ fontSize: 12 }}
                          onClick={() => setRemovingSite(site)}
                          disabled={busy}
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

      {/* Web root */}
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.nginx.filesTitle")}
          note={t("xenith.nginx.filesNote", { total: formatBytes(webroot?.total_bytes || 0) })}
          trailing={
            <>
              <input
                ref={uploadRef}
                type="file"
                style={{ display: "none" }}
                onChange={onUpload}
                accept=".html,.htm,.css,.js,.json,.txt,.xml,.png,.jpg,.jpeg,.gif,.svg,.webp,.avif,.ico,.woff,.woff2,.ttf"
              />
              <button
                className="xn-btn xn-btn-primary"
                style={{ fontSize: 12.5, display: "flex", alignItems: "center", gap: 6 }}
                onClick={() => uploadRef.current?.click()}
                disabled={!enabled || busy}
              >
                <Upload size={14} strokeWidth={1.5} />
                {t("xenith.nginx.upload")}
              </button>
            </>
          }
        />
        <span style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
          {webroot?.root || status?.paths?.webroot}
        </span>
        {!webroot?.assets?.length ? (
          <PanelEmpty loading={isLoading}>{t("xenith.nginx.noFiles")}</PanelEmpty>
        ) : (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>{t("xenith.nginx.file")}</th>
                  <th>{t("xenith.nginx.size")}</th>
                  <th style={{ textAlign: "right" }}>{t("xenith.users.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {webroot.assets.map((asset) => (
                  <tr key={asset.path}>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {asset.path}
                    </td>
                    <td className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
                      {formatBytes(asset.size)}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          className="xn-btn xn-btn-secondary"
                          style={{ fontSize: 12 }}
                          onClick={() => openFile(asset.path)}
                          disabled={busy}
                        >
                          {t("edit")}
                        </button>
                        <button
                          className="xn-btn xn-btn-danger"
                          style={{ fontSize: 12 }}
                          onClick={() => setRemovingFile(asset)}
                          disabled={busy}
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

      {/* Editor */}
      {draft && (
        <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <PanelHead
            title={draft.name}
            note={
              draft.kind === "site" ? t("xenith.nginx.editorSiteNote") : t("xenith.nginx.editorFileNote")
            }
            trailing={
              dirty ? (
                <span className="xn-tag xn-tag-accent">{t("xenith.nginx.unsaved")}</span>
              ) : (
                <span className="xn-tag xn-tag-neutral">{t("xenith.nginx.upToDate")}</span>
              )
            }
          />
          <textarea
            className="xn-input xn-mono"
            style={{ fontSize: 12.5, minHeight: 320, lineHeight: 1.5 }}
            spellCheck={false}
            value={draft.content}
            onChange={(event) => setDraft({ ...draft, content: event.target.value })}
            disabled={!enabled || busy}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="xn-btn xn-btn-primary"
              style={{ height: 40, fontSize: 14 }}
              onClick={onSave}
              disabled={!enabled || busy || !dirty}
            >
              {t("xenith.nginx.save")}
            </button>
            <button
              className="xn-btn xn-btn-secondary"
              style={{ height: 40, fontSize: 14 }}
              onClick={() => setDraft(null)}
              disabled={busy}
            >
              {t("close")}
            </button>
          </div>
        </Blueprint>
      )}

      {/* Logs */}
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <PanelHead
          title={t("xenith.nginx.logsTitle")}
          note={log?.path}
          trailing={
            <div className="xn-seg">
              {(["error", "access"] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="xn-seg-opt"
                  style={{ fontSize: 12 }}
                  aria-pressed={logName === name}
                  onClick={() => setLogName(name)}
                >
                  {t(`xenith.nginx.log.${name}`)}
                </button>
              ))}
            </div>
          }
        />
        <pre
          className="xn-mono"
          style={{
            fontSize: 11.5,
            lineHeight: 1.55,
            margin: 0,
            padding: 12,
            maxHeight: 340,
            overflow: "auto",
            border: "1px solid var(--xn-neutral-200)",
            background: "var(--xn-neutral-100)",
          }}
        >
          {log?.content || t("xenith.empty")}
        </pre>
      </Blueprint>

      <ConfirmDialog
        open={!!removingSite}
        title={t("xenith.nginx.deleteSite")}
        body={t("xenith.nginx.deleteSitePrompt", { name: removingSite?.name })}
        confirmLabel={t("delete")}
        busy={busy}
        danger
        onConfirm={onRemoveSite}
        onClose={() => setRemovingSite(null)}
      />
      <ConfirmDialog
        open={!!removingFile}
        title={t("xenith.nginx.deleteFile")}
        body={t("xenith.nginx.deleteFilePrompt", { name: removingFile?.path })}
        confirmLabel={t("delete")}
        busy={busy}
        danger
        onConfirm={onRemoveFile}
        onClose={() => setRemovingFile(null)}
      />
    </>
  );
};

export default Nginx;
