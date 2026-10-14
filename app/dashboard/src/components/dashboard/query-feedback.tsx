import { useTranslation } from "react-i18next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function QueryFeedback({ loading, refreshing, failed, retry, message, offline = false }: {
  loading: boolean; refreshing: boolean; failed: boolean; updatedAt?: number;
  retry?: () => void; message?: string; offline?: boolean;
}) {
  const { t } = useTranslation();
  return <div className="space-y-2">
    {failed && <Alert variant="destructive"><AlertDescription className="flex flex-wrap items-center justify-between gap-2">
      <span>{message || t("dataStatus.failed", { defaultValue: "Could not refresh data. Your last loaded data is still available." })}</span>
      {retry && <Button type="button" variant="outline" size="sm" disabled={refreshing} onClick={retry}>{t("retry", { defaultValue: "Retry" })}</Button>}
    </AlertDescription></Alert>}
    {offline && <p role="status" className="text-xs text-muted-foreground">{t("dataStatus.offline", { defaultValue: "Waiting for a network connection." })}</p>}
    {!offline && loading && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner aria-hidden="true" />{t("loading", { defaultValue: "Loading…" })}</p>}
  </div>;
}
