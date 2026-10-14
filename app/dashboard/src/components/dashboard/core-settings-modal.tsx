import { CoreConfigError } from "@/features/core/config";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
AlertDialog,
AlertDialogContent,
AlertDialogDescription,
AlertDialogFooter,
AlertDialogHeader,
AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useCoreSettings } from "@/contexts/core-settings-context";
import { useDashboard } from "@/contexts/dashboard-context";
import { clearDraft } from "@/features/shared/drafts";
import { useRecoverableDraft } from "@/features/shared/use-recoverable-draft";
import { useLocale } from "@/hooks/use-locale";
import { useMutation } from "@tanstack/react-query";
import { Maximize2, Minimize2, RefreshCw, Settings } from "lucide-react";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { NodeLogs } from "./node-logs";
import { QueryFeedback } from "./query-feedback";
const JsonEditor = lazy(() => import("../JsonEditor").then((module) => ({ default: module.JsonEditor })));
export const ReloadIcon = RefreshCw;

export function CoreSettingsModal() {
  const isEditingCore = useDashboard((state) => state.isEditingCore);
  const { config, version, isLoading, isPostLoading, fetchCoreSettings, updateConfig, restartCore, isError, isRefreshing, updatedAt, offline } = useCoreSettings(isEditingCore);
  const { t } = useTranslation();
  const { direction } = useLocale();
  const form = useForm({ defaultValues: { config: "" } });
  const formRef = useRef<HTMLFormElement>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const cancelDiscardRef = useRef<HTMLButtonElement>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [fullHeight, setFullHeight] = useState(false);
  useEffect(() => {
    if (isEditingCore) {
      dirty.current = false;
      setFullHeight(false);
    }
  }, [isEditingCore]);
  useEffect(() => {
    if (isEditingCore && !dirty.current) form.reset({ config });
  }, [config, isEditingCore, form]);
  useRecoverableDraft("core", form, isEditingCore);
  useEffect(() => { dirty.current = form.formState.isDirty; }, [form.formState.isDirty]);
  const close = () => {
    if (saving.current || isPostLoading) return;
    if (dirty.current) {
      setDiscardOpen(true);
      return;
    }
    useDashboard.setState({ isEditingCore: false });
  };
  const { mutate: restart, isPending: restarting } = useMutation({
    mutationFn: () => restartCore(),
    onSuccess: () => toast.success(t("core.restartSuccess", { defaultValue: "Core restarted." })),
    onError: () => toast.error(t("core.generalErrorMessage")),
  });
  const save = async ({ config: value }: { config: string }) => {
    if (saving.current) return;
    saving.current = true;
    setSaveError(null);
    try {
      await updateConfig(value);
      dirty.current = false;
      form.reset({ config: value });
      clearDraft("core");
      toast.success(t("core.successMessage"));
    } catch (error: any) {
      const detail = error?.response?._data?.detail;
      const message =
        error instanceof SyntaxError ? t("core.invalidJSON") : error instanceof CoreConfigError ? t(error.message) : typeof detail === "string"
          ? detail
          : detail && typeof detail === "object"
            ? String(Object.values(detail)[0])
            : t("core.generalErrorMessage");
      setSaveError(message);
      toast.error(message);
    } finally {
      saving.current = false;
    }
  };
  return (
    <>
      <Sheet
        open={isEditingCore}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <SheetContent
          side={direction === "rtl" ? "left" : "right"}
          className="w-full! sm:max-w-3xl!"
          showCloseButton={!isPostLoading}
          dir={direction}
          aria-describedby={undefined}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Settings className="size-5 text-primary-text" />
              {t("core.title")}
            </SheetTitle>
          </SheetHeader>
          <QueryFeedback loading={false} refreshing={isRefreshing && !isLoading} failed={false} updatedAt={updatedAt} offline={offline} />
          {saveError && <Alert variant="destructive"><AlertDescription>{saveError}</AlertDescription></Alert>}
          <form
            ref={formRef}
            onSubmit={form.handleSubmit(save)}
            className="flex min-h-0 flex-1 flex-col"
            aria-busy={isPostLoading}
          >
            {isError && <Alert variant="destructive"><AlertDescription className="flex items-center justify-between gap-3">
              <span>{t("core.generalErrorMessage")}</span><Button type="button" variant="outline" disabled={isRefreshing} onClick={() => void fetchCoreSettings().catch(() => undefined)}>{t("retry")}</Button>
            </AlertDescription></Alert>}
            <div className="flex min-h-0 flex-1 flex-col gap-3 px-4">
              <div className={fullHeight ? "flex min-h-0 flex-1 flex-col gap-2" : "flex h-2/3 min-h-0 flex-col gap-2"}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {t("core.configuration")}
                    {isLoading && <Spinner />}
                  </span>
                  {version && <Badge variant="secondary">Xray v{version}</Badge>}
                </div>
                <div className="relative min-h-0 flex-1 overflow-hidden rounded-md border border-border [&>div]:h-full">
                  {isEditingCore && !isLoading && config && (
                    <Controller
                      control={form.control}
                      name="config"
                      render={({ field }) => (
                        <Suspense
                          fallback={
                            <div className="flex h-full items-center justify-center">
                              <Spinner />
                            </div>
                          }
                        >
                          <JsonEditor

                            json={field.value}
                            ariaLabel={t("core.configuration")}
                            onSave={() => {
                              if (!isPostLoading && !isLoading) formRef.current?.requestSubmit();
                            }}
                            onChange={(value: string) => {
                              field.onChange(value);
                              setSaveError(null);
                              try {
                                dirty.current =
                                  JSON.stringify(JSON.parse(value)) !==
                                  JSON.stringify(typeof config === "string" ? JSON.parse(config) : config);
                              } catch {
                                dirty.current = true;
                              }
                            }}
                          />
                        </Suspense>
                      )}
                    />
                  )}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    className="absolute end-3 top-2"
                    aria-label={t("core.fullscreen", { defaultValue: "Toggle full screen" })}
                    aria-pressed={fullHeight}
                    onClick={() => setFullHeight((value) => !value)}
                  >
                    {fullHeight ? <Minimize2 /> : <Maximize2 />}
                  </Button>
                </div>
              </div>
              {!fullHeight && isEditingCore && (
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                  <NodeLogs />
                </div>
              )}
            </div>
            <SheetFooter className="flex-row items-center justify-between">
              <Button type="button" variant="outline" disabled={restarting || isPostLoading} onClick={() => restart()}>
                {restarting ? <Spinner /> : <RefreshCw />}
                {t(restarting ? "core.restarting" : "core.restartCore")}
              </Button>
              <Button type="submit" disabled={isLoading || isPostLoading || isError}>
                {isPostLoading && <Spinner />}
                {t("core.save")}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent initialFocus={cancelDiscardRef} dir={direction}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("core.unsavedTitle", { defaultValue: "Unsaved changes" })}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("core.unsavedPrompt", { defaultValue: "Discard your unsaved configuration changes?" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button ref={cancelDiscardRef} type="button" variant="outline" onClick={() => setDiscardOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                clearDraft("core");
                form.reset({ config });
                dirty.current = false;
                setDiscardOpen(false);
                useDashboard.setState({ isEditingCore: false });
              }}
            >
              {t("core.discard", { defaultValue: "Discard changes" })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
