import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ShieldCheck, TriangleAlert } from "lucide-react";
import { FC, useEffect, useState } from "react";
import { FieldValues, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { fetch } from "service/http";
import { clearLegacyToken } from "utils/authStorage";
import { Blueprint } from "xenith/Blueprint";
import { LogoLockup } from "xenith/Logo";

const schema = z.object({
  username: z.string().min(1, "login.fieldRequired"),
  password: z.string().min(1, "login.fieldRequired"),
});

/** The blueprint grid drawn over the dark field of the brand column. */
const FieldGrid: FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundImage:
        "repeating-linear-gradient(to right, rgba(242,242,243,0.07) 0 1px, transparent 1px 48px), " +
        "repeating-linear-gradient(to bottom, rgba(242,242,243,0.07) 0 1px, transparent 1px 48px)",
      pointerEvents: "none",
    }}
  />
);

export const Login: FC = () => {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [pwVisible, setPwVisible] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const {
    register,
    formState: { errors },
    handleSubmit,
  } = useForm({ resolver: zodResolver(schema) });

  useEffect(() => {
    // Landing here means the session is over, so drop the cookie server-side
    // as well. Failures are ignored: the cookie may already be gone.
    clearLegacyToken();
    fetch("/admin/logout", { method: "post" }).catch(() => undefined);
    if (location.pathname !== "/login") {
      navigate("/login", { replace: true });
    }
  }, []);

  const login = (values: FieldValues) => {
    setError("");
    const formData = new FormData();
    formData.append("username", values.username);
    formData.append("password", values.password);
    formData.append("grant_type", "password");
    setLoading(true);
    fetch("/admin/token", { method: "post", body: formData })
      .then(() => {
        // The token arrives as an httpOnly cookie, so there is nothing to store.
        navigate("/");
      })
      .catch((err) => {
        setError(err?.response?._data?.detail || t("login.failed"));
      })
      .finally(() => setLoading(false));
  };

  const fieldError = (name: "username" | "password") => {
    const message = errors?.[name]?.message as string | undefined;
    return message ? t(message) : undefined;
  };

  return (
    <div className="xn-root xn-login">
      <aside className="xn-login-brand">
        <FieldGrid />
        <LogoLockup variant="hero" />

        <div style={{ position: "relative", marginTop: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          <h1 style={{ fontSize: 54, lineHeight: 0.98, letterSpacing: "-0.01em", maxWidth: "15ch" }}>
            {t("login.headline")}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--xn-accent-200)",
              maxWidth: "42ch",
              textWrap: "pretty",
            }}
          >
            {t("login.tagline")}
          </p>
        </div>
      </aside>

      <main className="xn-login-main">
        <div style={{ width: 428, maxWidth: "100%", display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <span style={{ fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--xn-accent-700)" }}>
              {t("login.step")}
            </span>
            <div style={{ flex: 1, height: 1, background: "var(--xn-divider)" }} />
            <span className="xn-mono" style={{ fontSize: 10.5, color: "var(--xn-neutral-500)" }}>
              01 / 01
            </span>
          </div>

          <Blueprint style={{ padding: "32px 30px", display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h2 style={{ fontSize: 32, lineHeight: 1 }}>{t("login.title")}</h2>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--xn-neutral-700)" }}>
                {t("login.subtitle")}
              </p>
            </div>

            {error && (
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
                <span style={{ fontSize: 12.5, lineHeight: 1.45, color: "var(--xn-accent-900)" }}>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit(login)} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="xn-label">{t("username")}</span>
                <input
                  className="xn-input xn-mono"
                  style={{ fontSize: 13.5 }}
                  placeholder="admin"
                  autoComplete="username"
                  {...register("username")}
                />
                {fieldError("username") && (
                  <span style={{ fontSize: 11.5, color: "var(--xn-neutral-900)" }}>{fieldError("username")}</span>
                )}
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span
                  className="xn-label"
                  style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}
                >
                  {t("password")}
                  <button
                    type="button"
                    onClick={() => setPwVisible((v) => !v)}
                    style={{
                      background: "none",
                      border: 0,
                      padding: 0,
                      cursor: "pointer",
                      fontFamily: "var(--xn-font-body)",
                      fontSize: 10.5,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--xn-accent-700)",
                    }}
                  >
                    {pwVisible ? t("login.hide") : t("login.show")}
                  </button>
                </span>
                <input
                  className="xn-input xn-mono"
                  type={pwVisible ? "text" : "password"}
                  style={{ fontSize: 13.5, letterSpacing: "0.08em" }}
                  autoComplete="current-password"
                  {...register("password")}
                />
                {fieldError("password") && (
                  <span style={{ fontSize: 11.5, color: "var(--xn-neutral-900)" }}>{fieldError("password")}</span>
                )}
              </label>

              <button
                type="submit"
                className="xn-btn xn-btn-primary"
                disabled={loading}
                style={{ width: "100%", height: 44, fontSize: 15, letterSpacing: "0.04em", marginTop: 4 }}
              >
                {loading ? t("login.signingIn") : t("login.submit")}
                {!loading && <ArrowRight size={16} strokeWidth={1.5} />}
              </button>
            </form>
          </Blueprint>

          <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 2 }}>
            <ShieldCheck size={14} strokeWidth={1.5} color="var(--xn-accent)" style={{ flex: "none" }} />
            <span style={{ fontSize: 11.5, lineHeight: 1.4, color: "var(--xn-neutral-600)" }}>{t("login.audit")}</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
