import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { useDashboard } from "@/contexts/dashboard-context";
import { useHostsSettings } from "@/contexts/hosts-context";
import { firstErrorPath, hostsSchema, toFormKey, toHostFormValues, toInboundTag, type HostFormValues, type HostValues } from "@/features/hosts/form";
import { CreateHostSheet, HostWorkspace } from "@/features/hosts/host-editor";
import { clearDraft } from "@/features/shared/drafts";
import { useRecoverableDraft } from "@/features/shared/use-recoverable-draft";
import { useLocale } from "@/hooks/use-locale";
import { DirectionProvider } from "@base-ui/react/direction-provider";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Check, Copy, Info, Link2, Server, Settings2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { QueryFeedback } from "./query-feedback";
export const DuplicateIcon = Copy;
export const UpIcon = ArrowUp;
export const DownIcon = ArrowDown;
export function HostsDialog() {
  const isEditingHosts = useDashboard((state) => state.isEditingHosts);
  const onEditingHosts = useDashboard((state) => state.onEditingHosts);
  const { hosts, fetchHosts, setHosts, isLoading, isPostLoading, isError, isRefreshing, updatedAt, offline } = useHostsSettings(isEditingHosts);
  const { t } = useTranslation();
  const { direction } = useLocale();
  const [createOpen, setCreateOpen] = useState(false);
  const [creationVersion, setCreationVersion] = useState(0);
  const [draftVersion, setDraftVersion] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cancelDiscardRef = useRef<HTMLButtonElement>(null);
  const [selectedInbound, setSelectedInbound] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadFailed = isError;
  const lock = useRef(false);
  const form = useForm<HostFormValues, unknown, HostValues>({ resolver: zodResolver(hostsSchema), defaultValues: {} });
  const draft = useWatch({ control: form.control });
  const keys = Object.keys(draft);
  const activeInbound = keys.includes(selectedInbound) ? selectedInbound : "";
  useEffect(() => {
    if (isEditingHosts && !form.formState.isDirty) {
      form.reset(toHostFormValues(hosts));
      setDraftVersion((version) => version + 1);
    }
  }, [hosts, isEditingHosts, form]);
  useRecoverableDraft("hosts", form, isEditingHosts);
  const discard = () => {
    clearDraft("hosts");
    setConfirmClose(false);
    form.reset();
    onEditingHosts(false);
  };
  const close = () => {
    if (isPostLoading || lock.current) return;
    if (form.formState.isDirty) setConfirmClose(true);
    else discard();
  };
  const save = async (values: HostValues) => {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await setHosts(Object.fromEntries(Object.entries(values).map(([key, rows]) => [toInboundTag(key), rows])));
      toast.success(t("hostsDialog.savedSuccess"));
      form.reset(values);
      clearDraft("hosts");
    } catch (error: any) {
      const detail = error?.response?._data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : t("hostsDialog.saveError", { defaultValue: "Could not save hosts. Please try again." }),
      );
      if (Array.isArray(detail)) {
        let firstPath: string | null = null;
        for (const entry of detail) {
          const location = entry?.loc;
          const tag = Array.isArray(location) && location[0] === "body" ? location[1] : null;
          if (typeof tag !== "string" || !Object.hasOwn(hosts, tag)) continue;
          const suffix = location.slice(2).filter((part: unknown) => typeof part === "string" || typeof part === "number").join(".");
          const path = `${toFormKey(tag)}${suffix ? `.${suffix}` : ""}`;
          form.setError(path, { type: "server", message: String(entry.msg || t("hostsDialog.validationError")) });
          firstPath ??= path;
          if (firstPath === path) setSelectedInbound(toFormKey(tag));
        }
        if (firstPath) {
          setError(t("hostsDialog.validationError"));
          const path = firstPath;
          requestAnimationFrame(() => form.setFocus(path));
        }
      } else if (detail && typeof detail === "object")
        Object.entries(detail).forEach(([key, message]) => {
          const tag = Object.keys(hosts).sort((a, b) => b.length - a.length).find((tag) => key === tag || key.startsWith(`${tag}.`));
          form.setError(tag ? `${toFormKey(tag)}${key.slice(tag.length)}` : key, { message: String(message) });
        });
    } finally {
      lock.current = false;
    }
  };
  return (
    <DirectionProvider direction={direction === "rtl" ? "rtl" : "ltr"}>
      <Sheet open={isEditingHosts} onOpenChange={(open) => { if (!open) close(); }}
        onOpenChangeComplete={(open) => { if (!open) { setSelectedInbound(""); setError(null); } }}>
        <SheetContent dir={direction} className="w-full! sm:max-w-2xl! gap-0 overflow-hidden" side={direction === "rtl" ? "left" : "right"}
          showCloseButton={!isPostLoading} initialFocus={titleRef}>
          <SheetHeader className="shrink-0 border-b px-5 py-5 pe-14 sm:px-6">
            <SheetTitle ref={titleRef} tabIndex={-1} className="flex items-center gap-2 text-lg outline-none"><span className="flex size-9 items-center justify-center rounded-none bg-primary text-primary-foreground"><Link2 className="size-5" /></span>{t("header.hostSettings")}</SheetTitle>
            <SheetDescription>{t("hostsDialog.editorDescription")}</SheetDescription>
          </SheetHeader>
          <QueryFeedback loading={false} refreshing={isRefreshing && !isLoading} failed={false} updatedAt={updatedAt} offline={offline} />
          <FormProvider {...form}>
            <form noValidate onSubmit={form.handleSubmit(save, (errors) => {
              setSelectedInbound(Object.keys(errors)[0]);
              setError(t("hostsDialog.validationError"));
              const path = firstErrorPath(errors);
              if (path) requestAnimationFrame(() => form.setFocus(path));
            })} className="flex min-h-0 flex-1 flex-col" aria-busy={isPostLoading}>
              {isLoading ? <div className="flex flex-1 items-center justify-center gap-2"><Spinner />{t("hostsDialog.loading")}</div> : keys.length ? (
                <HostWorkspace keys={keys} activeInbound={activeInbound} onSelect={(key) => { setSelectedInbound(key); setError(null); }}
                  disabled={isPostLoading || loadFailed} creationVersion={creationVersion} draftVersion={draftVersion} onCreate={() => setCreateOpen(true)} />
              ) : <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <Server aria-hidden="true" className="size-8 text-muted-foreground" />
                <p className="max-w-sm text-muted-foreground">{t("hostsDialog.noInbounds")}</p>
                {!loadFailed && <Button type="button" variant="outline" onClick={() => {
                  onEditingHosts(false); useDashboard.setState({ isEditingCore: true });
                }}><Settings2 />{t("hostsDialog.configureInbounds", { defaultValue: "Configure inbounds" })}</Button>}
              </div>}
              <SheetFooter className="shrink-0 space-y-3 border-t bg-background px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
                {(error || loadFailed) && <Alert variant="destructive"><AlertDescription>
                  <p>{error || t("hostsDialog.loadError")}</p>
                  {loadFailed && <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={async () => {
                    setError(null);
                    try { await fetchHosts(); } catch { setError(t("hostsDialog.loadError")); }
                  }}>{t("hostsDialog.retry", { defaultValue: "Retry" })}</Button>}
                </AlertDescription></Alert>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isLoading ? <Spinner /> : loadFailed ? <Info className="size-4" /> : form.formState.isDirty ? <span className="size-2 rounded-full bg-warning" /> : <Check className="size-4" />}
                    {t(isLoading ? "hostsDialog.loading" : loadFailed ? (updatedAt ? "dataStatus.stale" : "hostsDialog.notLoaded") : form.formState.isDirty ? "hostsDialog.unsavedChanges" : "hostsDialog.savedState")}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={isPostLoading} onClick={close}>{t("cancel")}</Button>
                    <Button type="submit" disabled={isLoading || isRefreshing || isPostLoading || loadFailed || !form.formState.isDirty || !keys.length}>
                      {isPostLoading && <Spinner />}{t(isPostLoading ? "hostsDialog.saving" : "hostsDialog.saveAllChanges")}
                    </Button>
                  </div>
                </div>
              </SheetFooter>
            </form>
          </FormProvider>
        </SheetContent>
      </Sheet>
      <CreateHostSheet open={createOpen} keys={keys} initialInbound={activeInbound} onClose={() => setCreateOpen(false)}
        onCreate={(host, targets) => {
          setCreationVersion((version) => version + 1);
          targets.forEach((key) => form.setValue(key, [...form.getValues(key), { ...host }], { shouldDirty: true }));
          setSelectedInbound(targets.length === 1 ? targets[0] : "");
          toast.success(t("hostsDialog.addedToDraft", { defaultValue: "Host added to {{count}} inbounds. Save all changes to publish it.", count: targets.length }));
        }} />
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent dir={direction} initialFocus={cancelDiscardRef}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("hostsDialog.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("hostsDialog.discardDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" ref={cancelDiscardRef} variant="outline" onClick={() => setConfirmClose(false)}>{t("hostsDialog.keepEditing")}</Button>
            <Button type="button" variant="destructive" onClick={discard}>{t("hostsDialog.discard")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DirectionProvider>
  );
}
