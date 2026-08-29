import { FC, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ReadyState } from "react-use-websocket";
import { Blueprint } from "xenith/Blueprint";
import { PanelEmpty, PanelHead, PanelNote } from "xenith/panels";
import { LEVEL_COLORS, useCoreLogs } from "xenith/useCoreLogs";

const MAX_LINES = 500;

/** The live core log stream, in the same row format as the overview panel. */
export const Logs: FC = () => {
  const { t } = useTranslation();
  const { logs, readyState } = useCoreLogs(MAX_LINES);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [logs.length]);

  const status =
    readyState === ReadyState.OPEN
      ? t("xenith.logs.connected")
      : readyState === ReadyState.CONNECTING
        ? t("xenith.logs.connecting")
        : t("xenith.logs.closed");

  return (
    <Blueprint style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
      <PanelHead title={t("xenith.events.title")} note={t("xenith.events.note")} trailing={<PanelNote>{status}</PanelNote>} />
      {logs.length === 0 ? (
        <PanelEmpty>{t("xenith.events.waiting")}</PanelEmpty>
      ) : (
        <div style={{ maxHeight: "62vh", overflowY: "auto" }}>
          {logs.map((line) => (
            <div
              key={line.id}
              className="xn-mono"
              style={{
                display: "grid",
                gridTemplateColumns: "74px 92px 1fr",
                gap: 16,
                padding: "7px 0",
                borderTop: "1px solid var(--xn-neutral-200)",
                fontSize: 12,
              }}
            >
              <span style={{ color: "var(--xn-neutral-500)" }}>{line.time}</span>
              <span style={{ letterSpacing: "0.06em", color: LEVEL_COLORS[line.level] || "var(--xn-accent-700)" }}>
                {line.level}
              </span>
              <span style={{ color: "var(--xn-neutral-800)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {line.text}
              </span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </Blueprint>
  );
};

export default Logs;
