import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { canReloadWithoutLosingDrafts, draftFlushEvent } from "@/features/shared/drafts";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function DeploymentRecovery({
  reload = () => window.location.reload(),
}: {
  reload?: () => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState(false);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const fail = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    window.addEventListener("vite:preloadError", fail);
    return () => window.removeEventListener("vite:preloadError", fail);
  }, []);
  if (!failed) return null;
  return (
    <Alert
      variant="destructive"
      className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl shadow-lg"
    >
      <AlertDescription className="space-y-3">
        <p>
          {t("deploymentRecovery.message", {
            defaultValue:
              "An updated application could not be loaded. Reload to try again. Saved editor drafts will be restored when you reopen the editor.",
          })}
        </p>
        {blocked && (
          <p>
            {t("deploymentRecovery.blocked", {
              defaultValue:
                "Your browser could not save a draft. Save or discard your edits before reloading.",
            })}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              window.dispatchEvent(new Event(draftFlushEvent));
              if (canReloadWithoutLosingDrafts()) reload();
              else setBlocked(true);
            }}
          >
            {t("deploymentRecovery.reload", { defaultValue: "Reload application" })}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setFailed(false)}>
            {t("deploymentRecovery.keepEditing", { defaultValue: "Keep editing" })}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
