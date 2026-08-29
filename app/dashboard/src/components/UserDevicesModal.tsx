import { useToast } from "@chakra-ui/react";
import { useDashboard } from "contexts/DashboardContext";
import { FC, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UserDevices } from "types/User";
import dayjs from "dayjs";

/** Devices that have fetched one user's subscription.
 *
 * Rows come from the server on every change rather than being patched here:
 * each of the three calls answers with the whole list, and a device that
 * re-registered itself between two clicks should show up rather than be
 * papered over by an optimistic update.
 */
export const UserDevicesModal: FC = () => {
  const { devicesUser: user, fetchUserDevices, removeUserDevice, resetUserDevices } = useDashboard();
  const { t } = useTranslation();
  const toast = useToast();

  const [data, setData] = useState<UserDevices | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClose = () => useDashboard.setState({ devicesUser: null });

  const failed = useCallback(
    (err: any) => {
      const detail = err?.response?._data?.detail;
      setError(typeof detail === "string" ? detail : t("xenith.devices.error"));
    },
    [t],
  );

  const load = useCallback(() => {
    if (!user) return;
    setError(null);
    fetchUserDevices(user).then(setData).catch(failed);
  }, [user, fetchUserDevices, failed]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const act = (work: Promise<UserDevices>, message: string) => {
    setBusy(true);
    setError(null);
    work
      .then((result) => {
        setData(result);
        toast({ title: message, status: "success", isClosable: true, position: "top", duration: 3000 });
      })
      .catch(failed)
      .finally(() => setBusy(false));
  };

  if (!user) return null;

  const devices = data?.devices ?? [];

  return (
    <div className="xn-dialog-backdrop" onClick={onClose}>
      <div
        className="xn-dialog"
        role="dialog"
        aria-modal="true"
        style={{ maxWidth: 760, width: "100%" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="xn-heading" style={{ fontSize: 20, lineHeight: 1.1 }}>
          {t("xenith.devices.title", { username: user.username })}
        </h3>

        <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--xn-neutral-700)", margin: 0 }}>
          {data?.enforced
            ? t("xenith.devices.limited", { total: data.total, limit: data.limit })
            : t("xenith.devices.unlimited")}
        </p>

        {/* Said plainly, because it is the thing most easily misread about
            this feature: removing a device frees a slot, it does not cut the
            device off. */}
        <p style={{ fontSize: 12, lineHeight: 1.5, color: "var(--xn-neutral-600)", margin: 0 }}>
          {t("xenith.devices.caveat")}
        </p>

        {error && (
          <p style={{ fontSize: 13, color: "var(--xn-danger, #c0392b)", margin: 0 }} role="alert">
            {error}
          </p>
        )}

        <div className="xn-scroll-x" style={{ maxHeight: 340, overflowY: "auto" }}>
          <table className="xn-table">
            <thead>
              <tr>
                <th>{t("xenith.devices.device")}</th>
                <th>{t("xenith.devices.hwid")}</th>
                <th>{t("xenith.devices.lastSeen")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {devices.map((device) => (
                <tr key={device.id}>
                  <td>
                    {[device.model, device.os, device.os_version].filter(Boolean).join(" · ") || "—"}
                    {device.user_agent && (
                      <div style={{ fontSize: 11, color: "var(--xn-neutral-600)" }}>{device.user_agent}</div>
                    )}
                  </td>
                  <td className="xn-mono" style={{ fontSize: 11, wordBreak: "break-all" }}>
                    {device.hwid}
                  </td>
                  <td style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                    {device.last_seen_at ? dayjs.utc(device.last_seen_at).local().format("DD MMM, HH:mm") : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button
                      className="xn-btn xn-btn-ghost"
                      style={{ fontSize: 12 }}
                      disabled={busy}
                      onClick={() =>
                        act(removeUserDevice(user, device.id), t("xenith.devices.removed"))
                      }
                    >
                      {t("xenith.devices.forget")}
                    </button>
                  </td>
                </tr>
              ))}
              {data && devices.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ fontSize: 13, color: "var(--xn-neutral-600)" }}>
                    {t("xenith.devices.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
          <button
            className="xn-btn xn-btn-danger"
            style={{ marginRight: "auto" }}
            disabled={busy || devices.length === 0}
            onClick={() => act(resetUserDevices(user), t("xenith.devices.resetDone"))}
          >
            {t("xenith.devices.forgetAll")}
          </button>
          <button className="xn-btn xn-btn-secondary" onClick={onClose} disabled={busy}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
};
