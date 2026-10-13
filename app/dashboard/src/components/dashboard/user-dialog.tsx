import { useLocale } from "@/hooks/use-locale";
import { createLatestRequest } from "utils/latest-request";
import { AlertCircle, ChartPie, Pencil, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetStrategy } from "constants/UserSettings";
import { FilterUsageType, useDashboard } from "@/contexts/dashboard-context";
import dayjs from "dayjs";
import { FC, useEffect, useId, useRef, useState } from "react";
import ReactApexChart from "react-apexcharts";
import ReactDatePicker from "react-datepicker";
import { Controller, FormProvider, Resolver, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ProxyKeys, ProxyType, User, UserCreate, UserInbounds } from "types/User";
import { formatBytes } from "utils/formatByte";
import { relativeExpiryDate } from "utils/dateFormatter";
import { z } from "zod";
import { RadioGroup } from "../RadioGroup";
import { UsageFilter, createUsageConfig } from "./usage-filter";

export type UserDialogProps = {};

export type FormType = Pick<UserCreate, keyof UserCreate> & {
  selected_proxies: ProxyKeys;
};

const formatUser = (user: User): FormType => {
  return {
    ...user,
    data_limit: user.data_limit ? Number((user.data_limit / 1073741824).toFixed(5)) : user.data_limit,
    on_hold_expire_duration: user.on_hold_expire_duration
      ? Number(user.on_hold_expire_duration / (24 * 60 * 60))
      : user.on_hold_expire_duration,
    selected_proxies: Object.keys(user.proxies) as ProxyKeys,
  };
};
const getDefaultValues = (): FormType => {
  const defaultInbounds = Object.fromEntries(useDashboard.getState().inbounds);
  const inbounds: UserInbounds = {};
  for (const key in defaultInbounds) {
    inbounds[key] = defaultInbounds[key].map((i) => i.tag);
  }
  return {
    selected_proxies: Object.keys(defaultInbounds) as ProxyKeys,
    data_limit: null,
    expire: null,
    username: "",
    data_limit_reset_strategy: "no_reset",
    status: "active",
    on_hold_expire_duration: null,
    note: "",
    inbounds,
    proxies: {
      vless: { id: "", flow: "" },
      vmess: { id: "" },
      trojan: { password: "" },
      shadowsocks: { password: "", method: "chacha20-ietf-poly1305" },
    },
  };
};

const mergeProxies = (proxyKeys: ProxyKeys, proxyType: ProxyType | undefined): ProxyType => {
  const proxies: ProxyType = proxyKeys.reduce((ac, a) => ({ ...ac, [a]: {} }), {});
  if (!proxyType) return proxies;
  proxyKeys.forEach((proxy) => {
    if (proxyType[proxy]) {
      proxies[proxy] = proxyType[proxy];
    }
  });
  return proxies;
};

const baseSchema = {
  username: z.string().min(1, { message: "Required" }),
  selected_proxies: z.array(z.string()).refine((value) => value.length > 0, {
    message: "userDialog.selectOneProtocol",
  }),
  note: z.string().nullable(),
  proxies: z.record(z.string(), z.record(z.string(), z.any())).transform((ins) => {
    const deleteIfEmpty = (obj: any, key: string) => {
      if (obj && obj[key] === "") {
        delete obj[key];
      }
    };
    deleteIfEmpty(ins.vmess, "id");
    deleteIfEmpty(ins.vless, "id");
    deleteIfEmpty(ins.trojan, "password");
    deleteIfEmpty(ins.shadowsocks, "password");
    deleteIfEmpty(ins.shadowsocks, "method");
    return ins;
  }),
  data_limit: z
    .string()
    .min(0)
    .or(z.number())
    .nullable()
    .transform((str) => {
      if (str) return Number((parseFloat(String(str)) * 1073741824).toFixed(5));
      return 0;
    }),
  expire: z.number().nullable(),
  data_limit_reset_strategy: z.string(),
  inbounds: z.record(z.string(), z.array(z.string())).transform((ins) => {
    Object.keys(ins).forEach((protocol) => {
      if (Array.isArray(ins[protocol]) && !ins[protocol]?.length) delete ins[protocol];
    });
    return ins;
  }),
};

const schema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("active"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("disabled"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("limited"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("expired"),
    ...baseSchema,
  }),
  z.object({
    status: z.literal("on_hold"),
    on_hold_expire_duration: z.coerce
      .number()
      .min(0.1, "Required")
      .transform((d) => {
        return d * (24 * 60 * 60);
      }),
    ...baseSchema,
  }),
]);

export const UserDialog: FC<UserDialogProps> = () => {
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

  const { resolvedTheme: colorMode } = useTheme();

  const [usageVisible, setUsageVisible] = useState(false);
  const handleUsageToggle = () => {
    setUsageVisible((current) => !current);
  };

  const form = useForm<FormType>({
    defaultValues: getDefaultValues(),
    resolver: zodResolver(schema) as Resolver<FormType>,
  });

  useEffect(
    () =>
      useDashboard.subscribe(
        (state) => state.inbounds,
        () => {
          if (!useDashboard.getState().editingUser && !form.formState.isDirty) form.reset(getDefaultValues());
        },
      ),
    [],
  );

  const [dataLimit, userStatus] = useWatch({
    control: form.control,
    name: ["data_limit", "status"],
  });

  const usageTitle = t("userDialog.total");
  const [usage, setUsage] = useState(createUsageConfig(colorMode, usageTitle));
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
      setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
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

    const { selected_proxies, ...rest } = values;

    let body: UserCreate = {
      ...rest,
      data_limit: values.data_limit,
      proxies: mergeProxies(selected_proxies, values.proxies),
      data_limit_reset_strategy:
        values.data_limit && values.data_limit > 0 ? values.data_limit_reset_strategy : "no_reset",
      status:
        values.status === "active" || values.status === "disabled" || values.status === "on_hold"
          ? values.status
          : "active",
    };

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

  const disabled = loading;
  const isOnHold = userStatus === "on_hold";

  const createRandomUsername = () => {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const username = Array.from(
      crypto.getRandomValues(new Uint8Array(6)),
      (value) => characters[value % characters.length],
    ).join("");
    form.setValue("username", username, { shouldDirty: true, shouldValidate: true });
  };

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
                  <FieldSet className="min-w-0 gap-5">
                    <FieldLegend>{t("userDialog.accountDetails", { defaultValue: "Account details" })}</FieldLegend>
                    <div className="flex items-start gap-3">
                      <Field className="min-w-0 flex-1" data-invalid={!!form.formState.errors.username}>
                        <div className="flex items-center gap-2">
                          <FieldLabel htmlFor={fieldId("username")}>{t("username")}</FieldLabel>
                          {!isEditing && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-xs"
                              disabled={disabled}
                              aria-label={t("userDialog.generateRandomUsername", {
                                defaultValue: "Generate random username",
                              })}
                              onClick={createRandomUsername}
                            >
                              <RefreshCw />
                            </Button>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <Input
                            id={fieldId("username")}
                            autoComplete="off"
                            disabled={disabled || isEditing}
                            aria-invalid={!!form.formState.errors.username}
                            aria-describedby={form.formState.errors.username ? fieldId("username-error") : undefined}
                            {...form.register("username")}
                          />
                          {isEditing && (
                            <Controller
                              name="status"
                              control={form.control}
                              render={({ field }) => (
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Switch
                                        name={field.name}
                                        ref={field.ref}
                                        onBlur={field.onBlur}
                                        disabled={disabled}
                                        aria-label={t(`status.${field.value}`)}
                                        checked={field.value === "active"}
                                        onCheckedChange={(checked) => field.onChange(checked ? "active" : "disabled")}
                                      />
                                    }
                                  />
                                  <TooltipContent>{t(`status.${field.value}`)}</TooltipContent>
                                </Tooltip>
                              )}
                            />
                          )}
                        </div>
                        <FieldError id={fieldId("username-error")} errors={[form.formState.errors.username]} />
                      </Field>
                      {!isEditing && (
                        <Field className="w-auto shrink-0">
                          <FieldLabel htmlFor={fieldId("on-hold")}>{t("userDialog.onHold")}</FieldLabel>
                          <Controller
                            name="status"
                            control={form.control}
                            render={({ field }) => (
                              <Switch
                                id={fieldId("on-hold")}
                                name={field.name}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                disabled={disabled}
                                checked={field.value === "on_hold"}
                                onCheckedChange={(checked) => field.onChange(checked ? "on_hold" : "active")}
                              />
                            )}
                          />
                        </Field>
                      )}
                    </div>
                    <Controller
                      control={form.control}
                      name="data_limit"
                      render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                          <FieldLabel htmlFor={fieldId(field.name)}>{t("userDialog.dataLimit")}</FieldLabel>
                          <div className="relative">
                            <Input
                              {...field}
                              id={fieldId(field.name)}
                              type="number"
                              min={0}
                              step="any"
                              className="pe-12"
                              value={field.value ?? ""}
                              aria-invalid={fieldState.invalid}
                              aria-describedby={`${fieldId("data-limit-description")}${fieldState.invalid ? ` ${fieldId("data-limit-error")}` : ""}`}
                            />
                            <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              GB
                            </span>
                          </div>
                          <FieldDescription id={fieldId("data-limit-description")}>{t("userDialog.unlimitedHint", { defaultValue: "Leave empty for unlimited traffic." })}</FieldDescription>
                          <FieldError id={fieldId("data-limit-error")} errors={[fieldState.error]} />
                        </Field>
                      )}
                    />
                    {!!(dataLimit && dataLimit > 0) && (
                      <Field>
                        <FieldLabel htmlFor={fieldId("reset-strategy")}>{t("userDialog.periodicUsageReset")}</FieldLabel>
                        <select
                          id={fieldId("reset-strategy")}
                          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                          {...form.register("data_limit_reset_strategy")}
                        >
                          {resetStrategy.map((strategy) => (
                            <option key={strategy.value} value={strategy.value}>
                              {t("userDialog.resetStrategy" + strategy.title)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <Field
                      data-invalid={
                        !!(isOnHold ? form.formState.errors.on_hold_expire_duration : form.formState.errors.expire)
                      }
                    >
                      <FieldLabel htmlFor={fieldId(isOnHold ? "on_hold_expire_duration" : "expire")}>
                        {isOnHold ? t("userDialog.onHoldExpireDuration") : t("userDialog.expiryDate")}
                      </FieldLabel>
                      {isOnHold ? (
                        <Controller
                          control={form.control}
                          name="on_hold_expire_duration"
                          render={({ field, fieldState }) => (
                            <>
                              <div className="relative">
                                <Input
                                  {...field}
                                  id={fieldId(field.name)}
                                  type="number"
                                  min={0.1}
                                  step="any"
                                  className="pe-14"
                                  value={field.value ?? ""}
                                  aria-invalid={fieldState.invalid}
                                  aria-describedby={fieldState.invalid ? fieldId("duration-error") : undefined}
                                  onChange={(event) => {
                                    form.setValue("expire", null);
                                    field.onChange(event);
                                  }}
                                />
                                <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                  {t("userDialog.days")}
                                </span>
                              </div>
                              <FieldError id={fieldId("duration-error")} errors={[fieldState.error]} />
                            </>
                          )}
                        />
                      ) : (
                        <Controller
                          name="expire"
                          control={form.control}
                          render={({ field, fieldState }) => {
                            const { status, time } = relativeExpiryDate(field.value);
                            return (
                              <>
                                <div className="[&_.react-datepicker-wrapper]:w-full">
                                  <ReactDatePicker
                                    id={fieldId(field.name)}
                                    name={field.name}
                                    onBlur={field.onBlur}
                                    locale={(language.startsWith("zh") ? "zh-cn" : language.split("-")[0])}
                                    dateFormat={t("dateFormat")}
                                    placeholderText={t("neverExpires", { defaultValue: "Never expires" })}
                                    minDate={new Date()}
                                    disabled={disabled}
                                    isClearable={!disabled}
                                    selected={field.value ? dayjs(field.value * 1000).toDate() : null}
                                    onChange={(date: Date | null) => {
                                      form.setValue("on_hold_expire_duration", null);
                                      field.onChange(date ? dayjs(date).endOf("day").unix() : null);
                                    }}
                                    customInput={
                                      <Input
                                        ref={field.ref}
                                        aria-invalid={fieldState.invalid}
                                        aria-describedby={
                                          fieldState.invalid
                                            ? fieldId("expire-error")
                                            : field.value
                                              ? fieldId("expiry-description")
                                              : undefined
                                        }
                                      />
                                    }
                                  />
                                </div>
                                {!!field.value && (
                                  <FieldDescription id={fieldId("expiry-description")}>
                                    {t(status, { time })}
                                  </FieldDescription>
                                )}
                                <FieldError id={fieldId("expire-error")} errors={[fieldState.error]} />
                              </>
                            );
                          }}
                        />
                      )}
                    </Field>
                    <Field data-invalid={!!form.formState.errors.note}>
                      <FieldLabel htmlFor={fieldId("note")}>{t("userDialog.note")}</FieldLabel>
                      <Textarea
                        id={fieldId("note")}
                        rows={3}
                        placeholder={t("userDialog.notePlaceholder", { defaultValue: "Optional notes about this user" })}
                        aria-invalid={!!form.formState.errors.note}
                        aria-describedby={form.formState.errors.note ? fieldId("note-error") : undefined}
                        {...form.register("note")}
                      />
                      <FieldError id={fieldId("note-error")} errors={[form.formState.errors.note]} />
                    </Field>
                  </FieldSet>
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
                            <div aria-hidden="true" className="min-w-0 overflow-hidden">
                              <ReactApexChart width="100%" height={260}
                                options={{ ...usage.options, title: { text: "" }, legend: { show: false }, dataLabels: { enabled: false } }}
                                series={usage.series} type="donut" />
                            </div>
                            <ul className="space-y-2 text-xs">
                              {usage.series.map((value, index) => (
                                <li key={index} className="flex min-w-0 items-start gap-2">
                                  <span aria-hidden="true" className="mt-1 size-2 shrink-0" style={{ backgroundColor: typeof usage.options.colors?.[index] === "string" ? usage.options.colors[index] as string : "var(--primary)" }} />
                                  <span className="min-w-0 flex-1 break-all">{usage.options.labels?.[index]}</span>
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
