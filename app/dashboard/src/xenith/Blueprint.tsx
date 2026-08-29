import { CSSProperties, FC, ReactNode } from "react";

type BlueprintProps = {
  children: ReactNode;
  /** Extra classes appended after `xn-blueprint`. */
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "aside";
};

/**
 * A panel drawn as a wireframe object: hairline frame, no fill, no radius, and
 * the four registration marks the design system requires on every panel.
 */
export const Blueprint: FC<BlueprintProps> = ({ children, className = "", style, as = "div" }) => {
  const Tag = as;
  return (
    <Tag className={`xn-blueprint ${className}`} style={style}>
      <i className="xn-corner tl" />
      <i className="xn-corner tr" />
      <i className="xn-corner bl" />
      <i className="xn-corner br" />
      {children}
    </Tag>
  );
};
