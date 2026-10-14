import { useInbounds } from "@/features/users/use-inbounds";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FilterUsageType, useDashboard } from "@/contexts/dashboard-context";
import { clearDraft } from "@/features/shared/drafts";
import { createUsageData } from "@/features/shared/traffic";
import { useRecoverableDraft } from "@/features/shared/use-recoverable-draft";
import { UserAccountFields } from "@/features/users/account-fields";
import { getDefaultValues as createDefaultValues, formatUser, toUserCreate, userFormSchema, type FormType } from "@/features/users/form";
import { useLocale } from "@/hooks/use-locale";
import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { AlertCircle, ChartPie, Pencil, Trash2, UserPlus } from "lucide-react";
import { FC, lazy, Suspense, useEffect, useId, useRef, useState } from "react";
import { Controller, FormProvider, Resolver, useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { formatBytes } from "utils/formatByte";
import { createLatestRequest } from "utils/latest-request";
import { RadioGroup } from "../RadioGroup";
import { UsageFilter } from "./usage-filter";

const TrafficChart = lazy(() => import("@/features/shared/traffic-chart").then((module) => ({ default: module.TrafficChart })));

export type { FormType } from "@/features/users/form";

export type UserDialogProps = {};

export const UserDialog: FC<UserDialogProps> = () => {
  const { inbounds } = useInbounds();
  const getDefaultValues = () => createDefaultValues(inbounds);
  const editingUser = useDashboard((state) => state.editingUser);
  const isCreatingNewUser = useDashboard((state) => state.isCreatingNewUser);
  const onCreateUser = useDashboard((state) => state.onCreateUser);
  const editUser = useDashboard((state) => state.editUser);
  const fetchUserUsage = useDashboard((state) => state.fetchUserUsage);
  const onEditingUser = useDashboard((state) => state.onEditingUser);
  const createUser = useDashboard((state) => state.createUser);
  const onDeletingUser = useDashboard((state) => state.onDeletingUser);
  const isEditing = !!editingUser;
  const isOpen = isCreatingNewUser || isEditing;
  const [loading, setLoading] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const cancelDiscardRef = useRef<HTMLButtonElement>(null);
  const saving = useRef(false);
  const [error, setError] = useState<string | null>("");
  const id = useId();
  const fieldId = (name: string) => `${id}-${name}`;
  const { t } = useTranslation();
  const { direction, language } = useLocale();


  const [usageVisible, setUsageVisible] = useState(false);
  const handleUsageToggle = () => {
    setUsageVisible((current) => !current);
  };

  const form = useForm<FormType>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(userFormSchema) as Resolver<FormType>,
  });

  useEffect(() => {
    if (!editingUser && !form.formState.isDirty) form.reset(createDefaultValues(inbounds));
  }, [inbounds, editingUser, form]);

  const usageTitle = t("userDialog.total");
  const [usage, setUsage] = useState(createUsageData());
  const [usageFilter, setUsageFilter] = useState("1m");
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageError, setUsageError] = useState(false);
  const usageSection = useRef<HTMLDivElement>(null);
  const usageRequest = useRef(createLatestRequest());
  const fetchUsageWithFilter = (query: FilterUsageType) => {
    if (!editingUser) return;
    const pending = usageRequest.current.start();
    setUsageLoading(true);
    setUsageError(false);
    fetchUserUsage(editingUser, query, pending.signal).then((data: any) => {
      if (!pending.isCurrent()) return;
      const labels = [];
      const series = [];
      for (const key in data.usages) {
        series.push(data.usages[key].used_traffic);
        labels.push(data.usages[key].node_name);
      }
      setUsage(createUsageData(series, labels));
    }).catch(() => {
      if (pending.isCurrent()) setUsageError(true);
    }).finally(() => {
      if (pending.isCurrent()) setUsageLoading(false);
      pending.finish();
    });
  };

  useEffect(() => {
    if (editingUser) form.reset(formatUser(editingUser));
    else if (isCreatingNewUser) form.reset(getDefaultValues());
    if (isOpen) setError(null);
  }, [editingUser, isCreatingNewUser, isOpen, form]);

  useEffect(() => {
    if (editingUser && usageVisible) {
      setUsageFilter("1m");
      fetchUsageWithFilter({
        start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
      });
    }
    return () => usageRequest.current.cancel();
  }, [editingUser, usageVisible]);

  useEffect(() => {
    if (usageVisible && !usageLoading) {
      usageSection.current?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [usageVisible, usageLoading]);

  const submit = (values: FormType) => {
    if (saving.current) return;
    saving.current = true;
    setLoading(true);
    const methods = { edited: editUser, created: createUser };
    const method = isEditing ? "edited" : "created";
    setError(null);

    const body = toUserCreate(values);

    methods[method](body)
      .then(() => {
        toast.success(
          t(isEditing ? "userDialog.userEdited" : "userDialog.userCreated", { username: values.username }),
          {
            duration: 3000,
            closeButton: true,
          },
        );
        onClose();
      })
      .catch((err) => {
        setError(t("userDialog.saveError", { defaultValue: "Could not save the user. Please try again." }));
        if (err?.response?.status === 409 || err?.response?.status === 400) setError(err?.response?._data?.detail);
        if (err?.response?.status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            setError(err?.response._data.detail[key] as string);
            form.setError(key as "proxies" | "username" | "data_limit" | "expire", {
              type: "custom",
              message: err.response._data.detail[key],
            });
          });
        }
      })
      .finally(() => {
        saving.current = false;
        setLoading(false);
      });
  };

  const requestClose = () => {
    if (saving.current) return;
    if (form.formState.isDirty) setDiscardOpen(true);
    else onClose();
  };

  const onClose = () => {
    clearDraft(editingUser ? `user:${editingUser.username}` : "user:new");
    setDiscardOpen(false);
    form.reset(getDefaultValues());
    onCreateUser(false);
    onEditingUser(null);
    setError(null);
    setUsageVisible(false);
    setUsageFilter("1m");
  };

  const handleResetUsage = () => {
    useDashboard.setState({ resetUsageUser: editingUser });
  };

  const handleRevokeSubscription = () => {
    useDashboard.setState({ revokeSubscriptionUser: editingUser });
  };

  useRecoverableDraft(editingUser ? `user:${editingUser.username}` : "user:new", form, isOpen);

  const disabled = loading;
  return (
    <>
      <Sheet
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !loading) requestClose();
        }}
      >
        <SheetContent
          side={direction === "rtl" ? "left" : "right"}
          className="w-full! sm:max-w-md! gap-0 overflow-hidden"
          initialFocus={() => document.getElementById(fieldId(isEditing ? "data_limit" : "username"))}
          showCloseButton={!loading}
          aria-describedby={fieldId("description")}
          dir={direction}
        >
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(submit)} className="flex min-h-0 flex-1 flex-col" aria-busy={loading}>
              <SheetHeader className="shrink-0 border-b px-6 py-5 pe-14">
                <SheetTitle className="flex items-center gap-2 text-lg">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    {isEditing ? <Pencil className="size-5" /> : <UserPlus className="size-5" />}
                  </span>
                  {isEditing ? t("userDialog.editUserTitle") : t("createNewUser")}
                </SheetTitle>
                <SheetDescription id={fieldId("description")}>
                  {isEditing
                    ? t("userDialog.editDescription", { defaultValue: "Manage this user’s access, limits, and connection settings." })
                    : t("userDialog.createDescription", { defaultValue: "Set up access and choose the connection protocols for your new user." })}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-6">
                <fieldset disabled={disabled} className="grid min-w-0 grid-cols-1 gap-6">
                  <UserAccountFields fieldId={fieldId} disabled={disabled} isEditing={isEditing} language={language} />
                  <FieldSet
                    className="min-w-0 gap-3 border-t pt-6"
                    aria-describedby={form.formState.errors.selected_proxies ? fieldId("protocol-error") : undefined}
                  >
                    <FieldLegend variant="label">{t("userDialog.protocols")}</FieldLegend>
                    <Controller
                      control={form.control}
                      name="selected_proxies"
                      render={({ field }) => (
                        <RadioGroup
                          list={["vmess", "vless", "trojan", "shadowsocks"].map((title) => ({
                            title,
                            description: t(`userDialog.${title}Desc`),
                          }))}
                          disabled={disabled}
                          {...field}
                        />
                      )}
                    />
                    {form.formState.errors.selected_proxies?.message && (
                      <FieldError id={fieldId("protocol-error")}>
                        {t(form.formState.errors.selected_proxies.message)}
                      </FieldError>
                    )}
                  </FieldSet>
                  {isEditing && usageVisible && (
                    <section ref={usageSection} id={fieldId("usage")} aria-labelledby={fieldId("usage-title")}
                      className="min-w-0 max-w-full space-y-4 border border-border p-4 scroll-mt-6">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 id={fieldId("usage-title")} className="text-sm font-medium">{t("userDialog.usage")}</h3>
                        {!usageLoading && !usageError && (
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {usageTitle} {formatBytes(usage.series.reduce((sum, value) => sum + value, 0))}
                          </span>
                        )}
                      </div>
                      <UsageFilter
                        defaultValue={usageFilter}
                        onChange={(filter, query) => {
                          setUsageFilter(filter);
                          fetchUsageWithFilter(query);
                        }}
                      />
                      <div aria-busy={usageLoading} className="min-w-0 max-w-full">
                        {usageLoading ? (
                          <div role="status" className="flex min-h-64 items-center justify-center gap-2 text-xs text-muted-foreground">
                            <Spinner /> {t("loading", { defaultValue: "Loading" })}
                          </div>
                        ) : usageError ? (
                          <Alert variant="destructive"><AlertCircle /><AlertDescription>
                            {t("userDialog.usageLoadError", { defaultValue: "Could not load usage." })}
                          </AlertDescription></Alert>
                        ) : usage.series.some((value) => value > 0) ? (
                          <>
                            <Suspense fallback={<Spinner aria-label={t("loading")} />}><TrafficChart usage={usage} hideLegend /></Suspense>
                            <ul className="space-y-2 text-xs">
                              {usage.series.map((value, index) => (
                                <li key={index} className="flex min-w-0 items-start gap-2">
                                  <span aria-hidden="true" className="mt-1 size-2 shrink-0" style={{ backgroundColor: typeof usage.colors?.[index] === "string" ? usage.colors[index] as string : "var(--primary)" }} />
                                  <span className="min-w-0 flex-1 break-all">{usage.labels?.[index]}</span>
                                  <span className="shrink-0 tabular-nums text-muted-foreground">{formatBytes(value)}</span>
                                </li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <p role="status" className="py-12 text-center text-xs text-muted-foreground">
                            {t("userDialog.noUsage", { defaultValue: "No usage recorded for this period." })}
                          </p>
                        )}
                      </div>
                    </section>
                  )}
                </fieldset>
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </div>
              <SheetFooter className="shrink-0 gap-4 border-t bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="flex flex-wrap items-center gap-2">
                  {isEditing && (
                    <>
                      <Tooltip>
                        <TooltipTrigger render={
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon-sm"
                            disabled={disabled}
                            aria-label={t("delete")}
                            onClick={() => {
                              onDeletingUser(editingUser);
                              onClose();
                            }}
                          >
                            <Trash2 />
                          </Button>
                        } />
                        <TooltipContent>{t("delete")}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger render={
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            disabled={disabled}
                            aria-label={t("userDialog.usage")}
                            aria-expanded={usageVisible}
                            aria-controls={usageVisible ? fieldId("usage") : undefined}
                            onClick={handleUsageToggle}
                          >
                            <ChartPie />
                          </Button>
                        } />
                        <TooltipContent>{t("userDialog.usage")}</TooltipContent>
                      </Tooltip>
                      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={handleResetUsage}>
                        {t("userDialog.resetUsage")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={handleRevokeSubscription}
                      >
                        {t("userDialog.revokeSubscription")}
                      </Button>
                    </>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button type="button" variant="outline" disabled={disabled} onClick={requestClose}>
                    {t("cancel", { defaultValue: "Cancel" })}
                  </Button>
                  <Button type="submit" className="min-w-32" disabled={disabled}>
                    {loading && <Spinner />}
                    {isEditing ? t("userDialog.editUser") : t("createUser")}
                  </Button>
                </div>
              </SheetFooter>
            </form>
          </FormProvider>
        </SheetContent>
      </Sheet>
      <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
        <AlertDialogContent initialFocus={cancelDiscardRef} dir={direction}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("userDialog.unsavedTitle", { defaultValue: "Discard unsaved changes?" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("userDialog.unsavedDescription", { defaultValue: "Your changes have not been saved. Keep editing or discard them to close this panel." })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button ref={cancelDiscardRef} variant="outline" onClick={() => setDiscardOpen(false)}>{t("userDialog.keepEditing", { defaultValue: "Keep editing" })}</Button>
            <Button variant="destructive" onClick={onClose}>{t("userDialog.discardChanges", { defaultValue: "Discard changes" })}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
