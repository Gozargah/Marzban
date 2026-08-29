import { FC, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Blueprint } from "./Blueprint";

/** Header row shared by the side panels: title, note, optional trailing slot. */
export const PanelHead: FC<{ title: string; note?: ReactNode; trailing?: ReactNode }> = ({
  title,
  note,
  trailing,
}) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
    <h2 className="xn-panel-title" style={{ marginRight: note ? 0 : "auto" }}>
      {title}
    </h2>
    {note && (
      <span style={{ fontSize: 11.5, color: "var(--xn-neutral-600)", marginRight: "auto" }}>{note}</span>
    )}
    {trailing}
  </div>
);

export const PanelNote: FC<{ children: ReactNode }> = ({ children }) => (
  <span
    style={{
      fontSize: 11,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "var(--xn-neutral-600)",
    }}
  >
    {children}
  </span>
);

/**
 * A two-line meter row: label plus trailing value, then a track with a caption.
 * Used by the node list and the top-consumption list.
 */
export const MeterRow: FC<{
  lead: ReactNode;
  label: ReactNode;
  value: ReactNode;
  percent: number;
  caption: ReactNode;
  captionWidth?: number;
  fill?: string;
}> = ({ lead, label, value, percent, caption, captionWidth = 80, fill = "var(--xn-accent)" }) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 6,
      padding: "10px 0",
      borderTop: "1px solid var(--xn-neutral-200)",
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
      {lead}
      <span style={{ fontSize: 13, marginRight: "auto", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span className="xn-mono" style={{ fontSize: 11.5, color: "var(--xn-accent-800)" }}>
        {value}
      </span>
    </div>
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "var(--xn-neutral-200)", position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, background: fill, width: `${percent}%` }} />
      </div>
      <span
        className="xn-mono"
        style={{
          fontSize: 10.5,
          color: "var(--xn-neutral-600)",
          width: captionWidth,
          textAlign: "right",
          whiteSpace: "nowrap",
        }}
      >
        {caption}
      </span>
    </div>
  </div>
);

/** Placeholder used when a panel has nothing to show yet. */
export const PanelEmpty: FC<{ loading?: boolean; children?: ReactNode }> = ({ loading, children }) => {
  const { t } = useTranslation();
  return (
    <div style={{ padding: "18px 0", fontSize: 12.5, color: "var(--xn-neutral-600)" }}>
      {loading ? t("xenith.loading") : children || t("xenith.empty")}
    </div>
  );
};

/** A panel that only wraps children in the blueprint frame with standard padding. */
export const Panel: FC<{ children: ReactNode; padding?: string; gap?: number; className?: string }> = ({
  children,
  padding = "18px",
  gap = 14,
  className,
}) => (
  <Blueprint className={className} style={{ padding, display: "flex", flexDirection: "column", gap }}>
    {children}
  </Blueprint>
);
