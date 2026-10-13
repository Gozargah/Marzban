import { AlertCircle, ChartPie, Pencil, RefreshCw, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetStrategy } from "constants/UserSettings";
import { FilterUsageType, useDashboard } from "contexts/DashboardContext";
import dayjs from "dayjs";
import { FC, useEffect, useId, useState } from "react";
import ReactApexChart from "react-apexcharts";
import ReactDatePicker from "react-datepicker";
import { Controller, FormProvider, Resolver, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ProxyKeys, ProxyType, User, UserCreate, UserInbounds } from "types/User";
import { relativeExpiryDate } from "utils/dateFormatter";
import { z } from "zod";
import { RadioGroup } from "../RadioGroup";
import { UsageFilter, createUsageConfig } from "../UsageFilter";

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
  const {
    editingUser,
    isCreatingNewUser,
    onCreateUser,
    editUser,
    fetchUserUsage,
    onEditingUser,
    createUser,
    onDeletingUser,
  } = useDashboard();
  const isEditing = !!editingUser;
  const isOpen = isCreatingNewUser || isEditing;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>("");
  const id = useId();
  const fieldId = (name: string) => `${id}-${name}`;
  const { t, i18n } = useTranslation();

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
          form.reset(getDefaultValues());
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
  const fetchUsageWithFilter = (query: FilterUsageType) => {
    fetchUserUsage(editingUser!, query).then((data: any) => {
      const labels = [];
      const series = [];
      for (const key in data.usages) {
        series.push(data.usages[key].used_traffic);
        labels.push(data.usages[key].node_name);
      }
      setUsage(createUsageConfig(colorMode, usageTitle, series, labels));
    });
  };

  useEffect(() => {
    if (editingUser) {
      form.reset(formatUser(editingUser));

      fetchUsageWithFilter({
        start: dayjs().utc().subtract(30, "day").format("YYYY-MM-DDTHH:00:00"),
      });
    }
  }, [editingUser]);

  const submit = (values: FormType) => {
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
        setLoading(false);
      });
  };

  const onClose = () => {
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
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !loading) onClose();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!loading}
        aria-describedby={undefined}
        dir={i18n.dir()}
      >
        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(submit)} className="space-y-6" aria-busy={loading}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  {isEditing ? <Pencil className="size-5" /> : <UserPlus className="size-5" />}
                </span>
                {isEditing ? t("userDialog.editUserTitle") : t("createNewUser")}
              </DialogTitle>
            </DialogHeader>
            <fieldset disabled={disabled} className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-4">
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
                            <SimpleTooltip label={t(`status.${field.value}`)}>
                              <Switch
                                name={field.name}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                disabled={disabled}
                                aria-label={t(`status.${field.value}`)}
                                checked={field.value === "active"}
                                onCheckedChange={(checked) => field.onChange(checked ? "active" : "disabled")}
                              />
                            </SimpleTooltip>
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
                          aria-describedby={fieldState.invalid ? fieldId("data-limit-error") : undefined}
                        />
                        <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          GB
                        </span>
                      </div>
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
                                locale={i18n.language.toLocaleLowerCase()}
                                dateFormat={t("dateFormat")}
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
                    aria-invalid={!!form.formState.errors.note}
                    aria-describedby={form.formState.errors.note ? fieldId("note-error") : undefined}
                    {...form.register("note")}
                  />
                  <FieldError id={fieldId("note-error")} errors={[form.formState.errors.note]} />
                </Field>
              </div>
              <FieldSet
                className="min-w-0 gap-3"
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
                <div className="flex min-w-0 flex-col items-center gap-4 pt-2 md:col-span-2">
                  <UsageFilter
                    defaultValue={usageFilter}
                    onChange={(filter, query) => {
                      setUsageFilter(filter);
                      fetchUsageWithFilter(query);
                    }}
                  />
                  <div className="w-full md:w-7/10">
                    <ReactApexChart options={usage.options} series={usage.series} type="donut" />
                  </div>
                </div>
              )}
            </fieldset>
            {error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter className="flex-col gap-3 sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {isEditing && (
                  <>
                    <SimpleTooltip label={t("delete")}>
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
                    </SimpleTooltip>
                    <SimpleTooltip label={t("userDialog.usage")}>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        disabled={disabled}
                        aria-label={t("userDialog.usage")}
                        aria-expanded={usageVisible}
                        onClick={handleUsageToggle}
                      >
                        <ChartPie />
                      </Button>
                    </SimpleTooltip>
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
              <Button type="submit" size="sm" className="self-end px-8" disabled={disabled}>
                {loading && <Spinner />}
                {isEditing ? t("userDialog.editUser") : t("createUser")}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
};
