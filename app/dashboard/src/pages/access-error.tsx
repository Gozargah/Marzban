import { useTranslation } from "react-i18next";
import { useRevalidator, useRouteError } from "react-router";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/hooks/use-locale";
import { Login } from "./login";

/** Only authentication failures enter Login; transient failures retain the session and editor drafts. */
export function AccessError() {
  const error = useRouteError() as { status?: number; response?: { status?: number } } | undefined;
  const revalidator = useRevalidator();
  const { t } = useTranslation();
  const { direction } = useLocale();
  const status = error?.response?.status ?? error?.status;
  if (status === 401 || status === 403) return <Login />;
  return <main dir={direction} className="flex min-h-dvh items-center justify-center bg-background p-6 text-foreground">
    <Alert variant="destructive" className="max-w-md"><AlertDescription className="space-y-4">
      <p>{t("dashboardLoadError", { defaultValue: "Could not open the dashboard. Your session and saved drafts have been kept. Please try again." })}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={revalidator.state === "loading"} onClick={() => void revalidator.revalidate()}>{t("retry", { defaultValue: "Retry" })}</Button>
      </div>
    </AlertDescription></Alert>
  </main>;
}
