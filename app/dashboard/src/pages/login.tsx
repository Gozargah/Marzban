import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, LogIn } from "lucide-react";
import { FetchError } from "ofetch";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router";
import { z } from "zod";

import Logo from "assets/logo.svg?react";
import { Footer } from "@/components/footer";
import { Language } from "@/components/language";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { fetch } from "service/http";
import { queryClient } from "utils/react-query";
import { removeAuthToken, setAuthToken } from "utils/authStorage";

const loginSchema = z.object({
  username: z.string().min(1, "login.fieldRequired"),
  password: z.string().min(1, "login.fieldRequired"),
});

type LoginValues = z.infer<typeof loginSchema>;
type TokenResponse = { access_token: string; token_type: string };

async function authenticate(values: LoginValues): Promise<TokenResponse> {
  const body = new FormData();
  body.append("username", values.username);
  body.append("password", values.password);
  body.append("grant_type", "password");

  return fetch<TokenResponse>("/admin/token", {
    method: "POST",
    body,
    retry: 0,
  });
}

export function Login() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t, i18n } = useTranslation();
  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });
  const loginMutation = useMutation({ mutationFn: authenticate, retry: false });
  const isPending = isSubmitting || loginMutation.isPending;

  useEffect(() => {
    removeAuthToken();
  }, []);

  useEffect(() => {
    if (pathname.replace(/\/$/, "") !== "/login") {
      navigate("/login", { replace: true });
    }
  }, [pathname, navigate]);

  async function login(values: LoginValues) {
    clearErrors("root.server");

    try {
      const { access_token } = await loginMutation.mutateAsync(values);
      queryClient.clear();
      setAuthToken(access_token);
      await navigate("/", { replace: true });
    } catch (error: unknown) {
      const detail: unknown = error instanceof FetchError ? error.data?.detail : undefined;
      setError("root.server", {
        type: "server",
        message: typeof detail === "string" && detail.trim()
          ? detail
          : t("login.error", { defaultValue: "Unable to sign in. Please try again." }),
      });
    }
  }

  return (
    <div
      className="flex min-h-dvh w-full flex-col justify-between gap-8 bg-background p-6 text-foreground"
      dir={i18n.dir()}
      lang={i18n.resolvedLanguage || i18n.language}
    >
      <div className="w-full">
        <div className="flex justify-end">
          <Language />
        </div>

        <section aria-labelledby="login-title" className="mx-auto mt-6 w-full max-w-[340px]">
          <div className="flex flex-col items-center gap-2 text-center">
            <Logo aria-hidden="true" className="size-12 stroke-[10px]" />
            <h1 id="login-title" className="text-2xl! font-semibold!">
              {t("login.loginYourAccount")}
            </h1>
            <p className="text-muted-foreground">{t("login.welcomeBack")}</p>
          </div>

          <form
            onSubmit={handleSubmit(login)}
            aria-busy={isPending}
            className="mx-auto mt-8 w-full max-w-[300px]"
          >
            <FieldGroup>
              <Field data-invalid={!!errors.username}>
                <Input
                  {...register("username")}
                  id="login-username"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  readOnly={isPending}
                  placeholder={t("username")}
                  aria-invalid={!!errors.username}
                  aria-describedby={errors.username ? "login-username-error" : undefined}

                />
                {errors.username?.message && (
                  <FieldError id="login-username-error">{t(errors.username.message)}</FieldError>
                )}
              </Field>

              <Field data-invalid={!!errors.password}>
                <Input
                  {...register("password")}
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  required
                  readOnly={isPending}
                  placeholder={t("password")}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? "login-password-error" : undefined}
                />
                {errors.password?.message && (
                  <FieldError id="login-password-error">{t(errors.password.message)}</FieldError>
                )}
              </Field>

              {errors.root?.server?.message && (
                <Alert variant="destructive" className="border! border-destructive/30!">
                  <AlertCircle aria-hidden="true" />
                  <AlertDescription>{errors.root.server.message}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isPending}
                className="h-10 w-full bg-primary! text-sm! text-primary-foreground! hover:bg-primary/80!"
              >
                {isPending ? <Spinner aria-hidden="true" /> : <LogIn aria-hidden="true" />}
                {t("login")}
              </Button>
            </FieldGroup>
          </form>
        </section>
      </div>

      <Footer />
    </div>
  );
}

export default Login;
