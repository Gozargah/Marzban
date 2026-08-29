import { ChangeEvent, FC, ReactNode } from "react";

/** Label + control + error, laid out the way the design system does forms. */
export const Field: FC<{
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  grow?: boolean;
}> = ({ label, hint, error, children, grow }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: grow ? 1 : undefined, minWidth: 0 }}>
    <span className="xn-label">{label}</span>
    {children}
    {hint && !error && <span style={{ fontSize: 11, color: "var(--xn-neutral-600)", lineHeight: 1.4 }}>{hint}</span>}
    {error && <span style={{ fontSize: 11, color: "var(--xn-neutral-900)", lineHeight: 1.4 }}>{error}</span>}
  </label>
);

/** Square checkbox with the accent fill, as on the login screen. */
export const Checkbox: FC<{
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  label: ReactNode;
  name?: string;
  inputRef?: (instance: HTMLInputElement | null) => void;
}> = ({ checked, onChange, label, name, inputRef }) => (
  <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", fontSize: 13 }}>
    <input
      type="checkbox"
      name={name}
      ref={inputRef}
      checked={checked}
      onChange={onChange}
      style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
    />
    <span
      aria-hidden
      style={{
        width: 15,
        height: 15,
        flex: "none",
        border: "1px solid var(--xn-neutral-500)",
        display: "grid",
        placeItems: "center",
        background: checked ? "var(--xn-accent)" : "transparent",
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--xn-bg)" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round" style={{ opacity: checked ? 1 : 0 }}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
    {label}
  </label>
);

/** A native select wearing the .xn-input skin. */
export const Select: FC<{
  options: { title: string; value: string }[];
  registration: object;
}> = ({ options, registration }) => (
  <select className="xn-input" style={{ appearance: "none", paddingRight: 24 }} {...registration}>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.title}
      </option>
    ))}
  </select>
);

/** Small square icon button used in dense rows. */
export const IconButton: FC<{
  title: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}> = ({ title, onClick, children, disabled, danger }) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    onClick={onClick}
    disabled={disabled}
    className={`xn-btn ${danger ? "xn-btn-danger" : "xn-btn-secondary"}`}
    style={{ width: 30, height: 30, padding: 0, flex: "none" }}
  >
    {children}
  </button>
);
