import { CSSProperties, FC } from "react";

type PlateProps = {
  /** Side of the square plate in px; the glyph is 0.66 of it. */
  size?: number;
  /** On dark ground the plate is drawn as an outline instead of a fill. */
  inverted?: boolean;
  style?: CSSProperties;
};

/** The chosen mark (1c "element Xe"): a square plate with the Xe glyph. */
export const LogoPlate: FC<PlateProps> = ({ size = 30, inverted = false, style }) => (
  <div
    style={{
      width: size,
      height: size,
      flex: "none",
      display: "grid",
      placeItems: "center",
      background: inverted ? "transparent" : "var(--xn-accent-900)",
      color: inverted ? "inherit" : "var(--xn-bg)",
      border: inverted ? "1px solid var(--xn-accent-400)" : undefined,
      ...style,
    }}
  >
    <span
      style={{
        fontFamily: "var(--xn-font-heading)",
        fontWeight: 600,
        fontSize: Math.round(size * 0.66),
        lineHeight: 0.8,
        letterSpacing: "-0.02em",
      }}
    >
      Xe
    </span>
  </div>
);

type LockupProps = {
  /** `sidebar` is the compact panel lockup, `hero` the one on the login field. */
  variant?: "sidebar" | "hero";
};

/** Plate + XENITH + the descriptor line. */
export const LogoLockup: FC<LockupProps> = ({ variant = "sidebar" }) => {
  const hero = variant === "hero";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: hero ? 13 : 11, position: "relative" }}>
      <LogoPlate size={hero ? 40 : 30} inverted={hero} />
      <div style={{ display: "flex", flexDirection: "column", gap: hero ? 2 : 1 }}>
        <span
          style={{
            fontFamily: "var(--xn-font-heading)",
            fontWeight: 600,
            fontSize: hero ? 24 : 19,
            lineHeight: 1,
            letterSpacing: hero ? "0.09em" : "0.08em",
          }}
        >
          XENITH
        </span>
        <span
          style={{
            fontSize: hero ? 9.5 : 9,
            letterSpacing: hero ? "0.2em" : "0.18em",
            textTransform: "uppercase",
            color: hero ? "var(--xn-accent-300)" : "var(--xn-neutral-600)",
          }}
        >
          {hero ? "Xray control panel" : "Xray panel"}
        </span>
      </div>
    </div>
  );
};
