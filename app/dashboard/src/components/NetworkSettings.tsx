import { useToast } from "@chakra-ui/react";
import { ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { FC, FormEvent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "react-query";
import {
  LimitsSnippet,
  NetworkApplyResult,
  NetworkProfile,
  ResourceLimit,
  Tunable,
  applyNetworkProfile,
  createNetworkProfile,
  deleteNetworkProfile,
  raiseResourceLimits,
  resetNetworkSettings,
  saveNetworkSettings,
  useNetworkProfiles,
  useNetworkSettings,
  useResourceLimits,
} from "xenith/api";
import { Blueprint } from "xenith/Blueprint";
import { ConfirmDialog } from "xenith/ConfirmDialog";
import { PanelEmpty, PanelHead, PanelNote } from "xenith/panels";

type Draft = Record<string, string>;

const describe = (err: any, fallback: string) => err?.response?._data?.detail || fallback;

/** A short, plain hint about the shape a value has to take. */
const placeholderFor = (tunable: Tunable) =>
  tunable.kind === "ints" ? tunable.baseline : tunable.kind === "text" ? "name" : "0";

const NoticeBox: FC<{ tone?: "warn"; children: React.ReactNode }> = ({ children }) => (
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
    <TriangleAlert
      size={16}
      strokeWidth={1.5}
      color="var(--xn-accent-800)"
      style={{ flex: "none", marginTop: 1 }}
    />
    <div style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--xn-accent-900)" }}>{children}</div>
  </div>
);


/** Formats an rlimit, where null means the kernel imposes no limit at all. */
const formatLimit = (value: number | null, unlimited: string) =>
  value === null ? unlimited : value.toLocaleString("en-US");

/**
 * Open file limits.
 *
 * Split into what the panel can do by itself — lifting its own soft limit,
 * which needs no privilege — and what the host has to be told, which only
 * counts once something restarts. The two are shown apart because confusing
 * them is why a raised limit so often turns out not to have been raised.
 */
const ResourceLimitsCard: FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading } = useResourceLimits();
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<LimitsSnippet | null>(null);

  const onRaise = () => {
    setBusy(true);
    raiseResourceLimits()
      .then((result) => {
        queryClient.invalidateQueries("xenith-limits");
        toast({
          title: result.raised.length
            ? t("xenith.limits.raised")
            : t("xenith.limits.alreadyAtMaximum"),
          description: result.problems.join(" ") || undefined,
          status: result.problems.length ? "warning" : "success",
          position: "top",
          duration: 6000,
          isClosable: true,
        });
      })
      .catch((err) =>
        toast({
          title: describe(err, t("xenith.limits.failed")),
          status: "error",
          position: "top",
          duration: 6000,
          isClosable: true,
        }),
      )
      .finally(() => setBusy(false));
  };

  const nofile = data?.limits.find((limit: ResourceLimit) => limit.name === "nofile");

  return (
    <>
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.limits.title")}
          note={t("xenith.limits.note")}
          trailing={
            <button
              className="xn-btn xn-btn-primary"
              style={{ fontSize: 12.5 }}
              onClick={onRaise}
              disabled={busy || isLoading}
            >
              {busy ? t("xenith.limits.raising") : t("xenith.limits.raise")}
            </button>
          }
        />

        {nofile && !nofile.at_target && (
          <NoticeBox>{t("xenith.limits.belowTarget", { target: data?.target })}</NoticeBox>
        )}

        <div className="xn-scroll-x">
          <table className="xn-table" style={{ fontSize: 13 }}>
            <thead>
              <tr>
                <th>{t("xenith.limits.limit")}</th>
                <th>{t("xenith.limits.soft")}</th>
                <th>{t("xenith.limits.hard")}</th>
                <th>{t("xenith.limits.target")}</th>
              </tr>
            </thead>
            <tbody>
              {(data?.limits || []).map((limit) => (
                <tr key={limit.name}>
                  <td className="xn-mono" style={{ fontSize: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span>{limit.name}</span>
                      {limit.managed ? (
                        limit.at_target && (
                          <span className="xn-tag xn-tag-accent">{t("xenith.limits.atMaximum")}</span>
                        )
                      ) : (
                        <span className="xn-tag xn-tag-neutral">{t("xenith.limits.reportOnly")}</span>
                      )}
                    </div>
                  </td>
                  <td className="xn-mono" style={{ fontSize: 12 }}>
                    {formatLimit(limit.soft, t("xenith.limits.unlimited"))}
                  </td>
                  <td className="xn-mono" style={{ fontSize: 12, color: "var(--xn-neutral-600)" }}>
                    {formatLimit(limit.hard, t("xenith.limits.unlimited"))}
                  </td>
                  <td className="xn-mono" style={{ fontSize: 12, color: "var(--xn-neutral-600)" }}>
                    {limit.managed ? formatLimit(limit.target, t("xenith.limits.unlimited")) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--xn-neutral-600)" }}>
          {data?.kernel_ceiling
            ? t("xenith.limits.ceiling", { value: data.kernel_ceiling.toLocaleString("en-US") })
            : t("xenith.limits.ceilingUnknown")}
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="xn-label">{t("xenith.limits.hostTitle")}</span>
          <span style={{ fontSize: 11.5, lineHeight: 1.5, color: "var(--xn-neutral-600)" }}>
            {data?.enabled ? t("xenith.limits.hostBody") : data?.reason}
          </span>
          {(data?.snippets || []).map((snippet) => (
            <div
              key={snippet.path}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 0",
                borderTop: "1px solid var(--xn-neutral-200)",
              }}
            >
              <span className="xn-mono" style={{ fontSize: 12, marginRight: "auto" }}>
                {snippet.path}
              </span>
              <span style={{ fontSize: 11, color: "var(--xn-neutral-600)" }}>{snippet.restart}</span>
              <button
                className="xn-btn xn-btn-secondary"
                style={{ fontSize: 12 }}
                onClick={() => setShown(snippet)}
              >
                {t("xenith.limits.show")}
              </button>
            </div>
          ))}
        </div>
      </Blueprint>

      <ConfirmDialog
        open={!!shown}
        title={shown?.path || ""}
        body={
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 12 }}>{shown?.restart}</span>
            <pre
              className="xn-mono"
              style={{
                fontSize: 11.5,
                lineHeight: 1.5,
                margin: 0,
                padding: 10,
                overflowX: "auto",
                border: "1px solid var(--xn-neutral-200)",
                background: "var(--xn-neutral-100)",
              }}
            >
              {shown?.content}
            </pre>
          </div>
        }
        confirmLabel={t("close")}
        onConfirm={() => setShown(null)}
        onClose={() => setShown(null)}
      />
    </>
  );
};

/**
 * Kernel tunables and the profiles that group them.
 *
 * The form holds a draft of every managed value, not only the edited ones: the
 * panel owns one sysctl.d file and writes it whole, so a save has to describe
 * the complete desired state rather than a patch.
 */
export const NetworkSettings: FC = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, error } = useNetworkSettings();
  const { data: profiles } = useNetworkProfiles();

  const [draft, setDraft] = useState<Draft>({});
  const [open, setOpen] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [failures, setFailures] = useState<{ key: string; message: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileNote, setProfileNote] = useState("");
  const [applying, setApplying] = useState<NetworkProfile | null>(null);
  const [deleting, setDeleting] = useState<NetworkProfile | null>(null);
  const [resetting, setResetting] = useState(false);

  const writable = data?.writable ?? false;

  /** Live values, which the draft is layered on top of. */
  const current = useMemo(() => {
    const values: Draft = {};
    data?.sections.forEach((section) =>
      section.settings.forEach((setting) => {
        values[setting.key] = setting.value;
      }),
    );
    return values;
  }, [data]);

  const valueOf = (key: string) => (key in draft ? draft[key] : current[key] ?? "");
  const changed = Object.keys(draft).filter((key) => draft[key] !== current[key]);

  const refresh = () => {
    queryClient.invalidateQueries("xenith-network");
    queryClient.invalidateQueries("xenith-network-profiles");
  };

  const report = (result: NetworkApplyResult, title: string) => {
    setFailures(result.failed);
    setDraft({});
    refresh();
    toast({
      title: result.failed.length ? t("xenith.network.partial", { total: result.failed.length }) : title,
      status: result.failed.length ? "warning" : "success",
      position: "top",
      duration: 5000,
      isClosable: true,
    });
  };

  const fail = (err: any) =>
    toast({
      title: describe(err, t("xenith.network.failed")),
      status: "error",
      position: "top",
      duration: 6000,
      isClosable: true,
    });

  const run = (work: Promise<NetworkApplyResult>, title: string) => {
    setBusy(true);
    setFailures([]);
    work
      .then((result) => report(result, title))
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const onSave = () => run(saveNetworkSettings({ ...current, ...draft }), t("xenith.network.saved"));

  const onReset = () => {
    run(resetNetworkSettings(), t("xenith.network.wasReset"));
    setResetting(false);
  };

  const onApplyProfile = () => {
    if (!applying) return;
    run(applyNetworkProfile(applying.id), t("xenith.network.profileApplied", { name: applying.name }));
    setApplying(null);
  };

  // Reached both from the form's submit and from the dialog's confirm button,
  // which passes no event.
  const onSaveProfile = (event?: FormEvent) => {
    event?.preventDefault();
    setBusy(true);
    createNetworkProfile({
      name: profileName,
      description: profileNote || undefined,
      settings: { ...current, ...draft },
    })
      .then(() => {
        toast({
          title: t("xenith.network.profileSaved"),
          status: "success",
          position: "top",
          duration: 4000,
          isClosable: true,
        });
        setProfileName("");
        setProfileNote("");
        setSaving(false);
        refresh();
      })
      .catch(fail)
      .finally(() => setBusy(false));
  };

  const onDeleteProfile = () => {
    if (!deleting) return;
    setBusy(true);
    deleteNetworkProfile(deleting.id)
      .then(() => {
        toast({
          title: t("xenith.network.profileDeleted"),
          status: "success",
          position: "top",
          duration: 4000,
          isClosable: true,
        });
        refresh();
      })
      .catch(fail)
      .finally(() => {
        setBusy(false);
        setDeleting(null);
      });
  };

  const needle = filter.trim().toLowerCase();
  const sections = (data?.sections || [])
    .map((section) => ({
      ...section,
      settings: needle
        ? section.settings.filter(
            (setting) =>
              setting.key.toLowerCase().includes(needle) ||
              setting.description.toLowerCase().includes(needle),
          )
        : section.settings,
    }))
    .filter((section) => section.settings.length);

  // A filter narrows things down to what the reader is looking for, so the
  // matching sections open themselves rather than making them click again.
  const isOpen = (id: string) => (needle ? true : open.includes(id));
  const toggle = (id: string) =>
    setOpen((ids) => (ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]));

  return (
    <>
      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.network.title")}
          note={t("xenith.network.note")}
          trailing={
            data?.managed_file ? (
              <PanelNote>
                <span className="xn-mono">{data.managed_file}</span>
              </PanelNote>
            ) : undefined
          }
        />

        {!writable && !isLoading && (
          <NoticeBox>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="xn-heading" style={{ fontSize: 15 }}>
                {t("xenith.network.readOnlyTitle")}
              </span>
              <span>{isError ? describe(error, t("xenith.network.failed")) : data?.reason}</span>
              {!data?.enabled && (
                <code className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-accent-800)" }}>
                  SYSCTL_ENABLED = True
                </code>
              )}
            </div>
          </NoticeBox>
        )}

        {failures.length > 0 && (
          <NoticeBox>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span>{t("xenith.network.refused")}</span>
              {failures.map((failure) => (
                <span key={failure.key} className="xn-mono" style={{ fontSize: 11.5 }}>
                  {failure.key} — {failure.message}
                </span>
              ))}
            </div>
          </NoticeBox>
        )}

        {/* Interfaces, for context only: the panel never reconfigures them. */}
        {!!data?.interfaces?.length && (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th>{t("xenith.network.interface")}</th>
                  <th>{t("xenith.network.mac")}</th>
                  <th>{t("xenith.network.mtu")}</th>
                  <th>{t("xenith.network.addresses")}</th>
                </tr>
              </thead>
              <tbody>
                {data.interfaces.map((interfaceInfo) => (
                  <tr key={interfaceInfo.name}>
                    <td className="xn-mono" style={{ fontSize: 12 }}>
                      {interfaceInfo.name}
                    </td>
                    <td className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
                      {interfaceInfo.mac || "—"}
                    </td>
                    <td className="xn-mono" style={{ fontSize: 11.5 }}>
                      {interfaceInfo.mtu ?? "—"}
                    </td>
                    <td style={{ color: "var(--xn-neutral-700)" }}>
                      {interfaceInfo.addresses.join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Blueprint>

      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.network.profilesTitle")}
          note={t("xenith.network.profilesNote")}
          trailing={
            <button
              className="xn-btn xn-btn-secondary"
              style={{ fontSize: 12.5 }}
              onClick={() => setSaving(true)}
              disabled={isLoading}
            >
              {t("xenith.network.saveAsProfile")}
            </button>
          }
        />

        {!profiles?.length ? (
          <PanelEmpty loading={isLoading}>{t("xenith.network.noProfiles")}</PanelEmpty>
        ) : (
          <div className="xn-scroll-x">
            <table className="xn-table" style={{ fontSize: 13 }}>
              <thead>
                <tr>
                  <th>{t("xenith.network.profileName")}</th>
                  <th>{t("xenith.network.profileDescription")}</th>
                  <th>{t("xenith.network.profileSize")}</th>
                  <th style={{ textAlign: "right" }}>{t("xenith.users.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span>{profile.name}</span>
                        {profile.builtin && (
                          <span className="xn-tag xn-tag-outline">{t("xenith.network.builtin")}</span>
                        )}
                      </div>
                    </td>
                    <td style={{ color: "var(--xn-neutral-700)" }}>{profile.description || "—"}</td>
                    <td className="xn-mono" style={{ fontSize: 11.5 }}>
                      {Object.keys(profile.settings).length}
                    </td>
                    <td>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                        <button
                          className="xn-btn xn-btn-secondary"
                          style={{ fontSize: 12 }}
                          onClick={() => setApplying(profile)}
                          disabled={!writable || busy}
                        >
                          {t("apply")}
                        </button>
                        <button
                          className="xn-btn xn-btn-danger"
                          style={{ fontSize: 12 }}
                          onClick={() => setDeleting(profile)}
                          disabled={profile.builtin || busy}
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

      <ResourceLimitsCard />

      <Blueprint style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <PanelHead
          title={t("xenith.network.tunablesTitle")}
          note={
            changed.length
              ? t("xenith.network.unsaved", { total: changed.length })
              : t("xenith.network.tunablesNote")
          }
          trailing={
            <input
              className="xn-input"
              style={{ fontSize: 12.5, width: 200 }}
              placeholder={t("search")}
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
          }
        />

        {!sections.length ? (
          <PanelEmpty loading={isLoading}>{t("xenith.network.noMatches")}</PanelEmpty>
        ) : (
          sections.map((section) => (
            <div key={section.id} style={{ borderTop: "1px solid var(--xn-neutral-200)" }}>
              <button
                type="button"
                className="xn-btn xn-btn-ghost"
                style={{
                  width: "100%",
                  justifyContent: "flex-start",
                  gap: 8,
                  padding: "10px 0",
                  fontSize: 13.5,
                }}
                onClick={() => toggle(section.id)}
                aria-expanded={isOpen(section.id)}
              >
                {isOpen(section.id) ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <span style={{ marginRight: "auto" }}>{section.title}</span>
                <span className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-neutral-600)" }}>
                  {section.settings.length}
                </span>
              </button>

              {isOpen(section.id) &&
                section.settings.map((setting) => {
                  const value = valueOf(setting.key);
                  const dirty = value !== current[setting.key];
                  return (
                    <div
                      key={setting.key}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1fr) 220px",
                        gap: 12,
                        alignItems: "start",
                        padding: "10px 0 12px",
                        borderTop: "1px solid var(--xn-neutral-200)",
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span className="xn-mono" style={{ fontSize: 12.5 }}>
                            {setting.key}
                          </span>
                          {setting.customised && !dirty && (
                            <span className="xn-tag xn-tag-neutral">{t("xenith.network.customised")}</span>
                          )}
                          {dirty && <span className="xn-tag xn-tag-accent">{t("xenith.network.edited")}</span>}
                        </div>
                        <span style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--xn-neutral-600)" }}>
                          {setting.description}
                        </span>
                        {value !== setting.baseline && (
                          <button
                            type="button"
                            className="xn-link"
                            style={{ fontSize: 11, alignSelf: "flex-start" }}
                            onClick={() => setDraft((d) => ({ ...d, [setting.key]: setting.baseline }))}
                            disabled={!writable}
                          >
                            {t("xenith.network.useBaseline", { value: setting.baseline })}
                          </button>
                        )}
                      </div>
                      <input
                        className="xn-input xn-mono"
                        style={{ fontSize: 12.5 }}
                        value={value}
                        placeholder={placeholderFor(setting)}
                        spellCheck={false}
                        onChange={(event) =>
                          setDraft((d) => ({ ...d, [setting.key]: event.target.value }))
                        }
                        disabled={!writable || busy}
                      />
                    </div>
                  );
                })}
            </div>
          ))
        )}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", paddingTop: 4 }}>
          <button
            className="xn-btn xn-btn-primary"
            style={{ height: 40, fontSize: 14 }}
            onClick={onSave}
            disabled={!writable || busy || !changed.length}
          >
            {busy ? t("xenith.network.applying") : t("xenith.network.save")}
          </button>
          <button
            className="xn-btn xn-btn-secondary"
            style={{ height: 40, fontSize: 14 }}
            onClick={() => setDraft({})}
            disabled={busy || !changed.length}
          >
            {t("cancel")}
          </button>
          <button
            className="xn-btn xn-btn-secondary"
            style={{ height: 40, fontSize: 14, marginLeft: "auto" }}
            onClick={() => setResetting(true)}
            disabled={!writable || busy}
          >
            {t("xenith.network.reset")}
          </button>
        </div>
      </Blueprint>

      <ConfirmDialog
        open={saving}
        title={t("xenith.network.saveAsProfile")}
        body={
          <form
            id="xenith-network-profile"
            onSubmit={onSaveProfile}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <span style={{ fontSize: 12.5, color: "var(--xn-neutral-700)" }}>
              {t("xenith.network.saveProfileBody")}
            </span>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="xn-label">{t("xenith.network.profileName")}</span>
              <input
                className="xn-input"
                style={{ fontSize: 13 }}
                value={profileName}
                onChange={(event) => setProfileName(event.target.value)}
                autoFocus
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="xn-label">{t("xenith.network.profileDescription")}</span>
              <input
                className="xn-input"
                style={{ fontSize: 13 }}
                value={profileNote}
                onChange={(event) => setProfileNote(event.target.value)}
              />
            </label>
          </form>
        }
        confirmLabel={t("xenith.network.saveProfile")}
        busy={busy}
        confirmDisabled={!profileName.trim()}
        onConfirm={onSaveProfile}
        onClose={() => setSaving(false)}
      />

      <ConfirmDialog
        open={!!applying}
        title={t("xenith.network.applyProfile")}
        body={t("xenith.network.applyProfilePrompt", { name: applying?.name })}
        confirmLabel={t("apply")}
        busy={busy}
        onConfirm={onApplyProfile}
        onClose={() => setApplying(null)}
      />

      <ConfirmDialog
        open={!!deleting}
        title={t("xenith.network.deleteProfile")}
        body={t("xenith.network.deleteProfilePrompt", { name: deleting?.name })}
        confirmLabel={t("delete")}
        busy={busy}
        danger
        onConfirm={onDeleteProfile}
        onClose={() => setDeleting(null)}
      />

      <ConfirmDialog
        open={resetting}
        title={t("xenith.network.reset")}
        body={t("xenith.network.resetPrompt")}
        confirmLabel={t("xenith.network.reset")}
        busy={busy}
        danger
        onConfirm={onReset}
        onClose={() => setResetting(false)}
      />
    </>
  );
};
