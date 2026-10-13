import { useEffect, useId, useRef, useState } from "react";
import { Copy, ArrowDown, ArrowUp, Info, Link2, Trash2, Plus, Search, ChevronDown, Server, Undo2, Check } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { proxyALPN, proxyFingerprint, proxyHostSecurity } from "constants/Proxies";
import { useHosts } from "@/contexts/hosts-context";
import { useDashboard } from "@/contexts/dashboard-context";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
export const DuplicateIcon = Copy;
export const UpIcon = ArrowUp;
export const DownIcon = ArrowDown;
const hostsSchema = z.record(
  z.string().min(1),
  z.array(
    z.object({
      remark: z.string().trim().min(1, "Remark is required").max(256),
      address: z.string().trim().min(1, "Address is required").max(256),
      port: z.union([z.string(), z.number(), z.null()])
        .transform((value) => value === null || value === "" ? null : Number(value))
        .refine((value) => value === null || (Number.isInteger(value) && value >= 1 && value <= 65535),
          "Port must be a whole number between 1 and 65535"),
      path: z.string().nullable(),
      sni: z.string().nullable(),
      host: z.string().nullable(),
      mux_enable: z.boolean().default(false),
      allowinsecure: z.boolean().nullable().default(false),
      is_disabled: z.boolean().default(true),
      fragment_setting: z.string().nullable(),
      noise_setting: z.string().nullable(),
      random_user_agent: z.boolean().default(false),
      security: z.string(),
      alpn: z.string(),
      fingerprint: z.string(),
      use_sni_as_host: z.boolean().default(false),
    }),
  ),
);

type HostFormValues = z.input<typeof hostsSchema>;
type HostValues = z.output<typeof hostsSchema>;
const newHost = (): HostFormValues[string][number] => ({
  remark: "",
  address: "",
  port: null,
  path: "",
  sni: "",
  host: "",
  mux_enable: false,
  allowinsecure: false,
  is_disabled: false,
  fragment_setting: "",
  noise_setting: "",
  random_user_agent: false,
  security: "inbound_default",
  alpn: "",
  fingerprint: "",
  use_sni_as_host: false,
});
const variableHints = [
  ["SERVER_IP", "currentServer"],
  ["SERVER_IPV6", "currentServerv6"],
  ["USERNAME", "username"],
  ["DATA_USAGE", "dataUsage"],
  ["DATA_LEFT", "remainingData"],
  ["DATA_LIMIT", "dataLimit"],
  ["DAYS_LEFT", "remainingDays"],
  ["EXPIRE_DATE", "expireDate"],
  ["JALALI_EXPIRE_DATE", "jalaliExpireDate"],
  ["TIME_LEFT", "remainingTime"],
  ["STATUS_TEXT", "statusText"],
  ["STATUS_EMOJI", "statusEmoji"],
  ["PROTOCOL", "proxyProtocol"],
  ["TRANSPORT", "proxyMethod"],
];
function FieldHelp({ name }: { name: string }) {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger aria-label={t("hostsDialog.desc")} className="inline-flex shrink-0 text-muted-foreground">
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent className="space-y-2">
        {name === "remark" || name === "address" ? (
          <>
            <p>{t("hostsDialog.desc")}</p>
            {variableHints.map(([variable, key]) => (
              <p key={variable}>
                <Badge variant="secondary">{`{${variable}}`}</Badge> {t(`hostsDialog.${key}`)}
              </p>
            ))}
          </>
        ) : (
          <>
            <p>{t(`hostsDialog.${name}.info`)}</p>
            {["sni", "host"].includes(name) && (
              <>
                <p>
                  <Trans i18nKey="hostsDialog.host.wildcard" components={{ badge: <Badge variant="secondary" /> }} />
                </p>
                <p>
                  <Trans i18nKey="hostsDialog.host.multiHost" components={{ badge: <Badge variant="secondary" /> }} />
                </p>
              </>
            )}
            {["fragment", "noise"].includes(name) && (
              <>
                <p>{t(`hostsDialog.${name}.info.examples`)}</p>
                <code className="block break-all" dir="ltr">
                  {name === "fragment" ? "100-200,10-20,tlshello" : "rand:10-20,10-20"}
                </code>
                <p>{t(`hostsDialog.${name}.info.attention`)}</p>
              </>
            )}
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
function HostCard({
  hostKey,
  index,
  count,
  onRemove,
  onDuplicate,
  onMove,
  disabled,
  open,
  onToggle,
}: {
  hostKey: string;
  index: number;
  count: number;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: number) => void;
  disabled: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const form = useFormContext<HostFormValues>();
  const { t } = useTranslation();
  const id = useId();
  const prefix = `${hostKey}.${index}`;
  // RHF's record-path types cannot infer an indexed host from a dynamic inbound tag.
  const values = useWatch({ control: form.control, name: prefix }) as unknown as HostFormValues[string][number] | undefined;
  const invalid = form.getFieldState(prefix, form.formState).invalid;
  const expanded = open || invalid;
  useEffect(() => {
    if (open) form.setFocus(`${prefix}.remark`);
  }, [open, prefix, form]);
  const field = (name: string, title: string, placeholder?: string, type = "text") => (
    <Controller
      key={name}
      control={form.control}
      name={`${prefix}.${name}`}
      render={({ field, fieldState }) => (
        <Field className="gap-1.5" data-invalid={fieldState.invalid}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={`${id}-${name}`}>{title}</FieldLabel>
            <FieldHelp name={name === "fragment_setting" ? "fragment" : name === "noise_setting" ? "noise" : name} />
          </div>
          <Input
            {...field}
            value={field.value == null ? "" : String(field.value)}
            id={`${id}-${name}`}
            placeholder={placeholder}
            type={type}
            dir={name === "remark" ? undefined : "ltr"}
            min={type === "number" ? 1 : undefined}
            max={type === "number" ? 65535 : undefined}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
            aria-describedby={fieldState.invalid ? `${id}-${name}-error` : undefined}
          />
          <FieldError id={`${id}-${name}-error`} errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
  const select = (name: string, options: { title: string; value: string }[]) => (
    <Controller
      key={name}
      control={form.control}
      name={`${prefix}.${name}`}
      render={({ field, fieldState }) => (
        <Field className="gap-1.5" data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={`${id}-${name}`}>{t(`hostsDialog.${name}`)}</FieldLabel>
          <NativeSelect
            {...field}
            value={String(field.value ?? "")}
            id={`${id}-${name}`}
            disabled={disabled}
            aria-invalid={fieldState.invalid}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.title}
              </option>
            ))}
          </NativeSelect>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
  const checkbox = (name: string, key: string) => (
    <Controller
      key={name}
      control={form.control}
      name={`${prefix}.${name}`}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <div className="flex items-center gap-2">
            <Checkbox
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              id={`${id}-${name}`}
              checked={!!field.value}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-invalid={fieldState.invalid}
            />
            <FieldLabel htmlFor={`${id}-${name}`}>{t(`hostsDialog.${key}`)}</FieldLabel>
          </div>
          <FieldError errors={[fieldState.error]} />
        </Field>
      )}
    />
  );
  return (
    <section className={`overflow-hidden rounded-xl border bg-background transition-colors ${invalid ? "border-destructive" : expanded ? "border-primary/30" : "border-border"}`}>
      <div className="flex items-center gap-3 p-3 sm:p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-medium text-muted-foreground">{index + 1}</span>
        <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`${id}-editor`}
          className="min-w-0 flex-1 rounded-md text-start outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex items-center gap-2 font-medium">
            <span className="truncate">{String(values?.remark || t("hostsDialog.newHost"))}</span>
            {invalid && <Badge variant="destructive">{t("hostsDialog.needsAttention")}</Badge>}
          </span>
          <span className="mt-1 block truncate text-xs text-muted-foreground" dir="ltr">
            {String(values?.address || t("hostsDialog.noAddress"))}{values?.port ? ` : ${values.port}` : ""}
          </span>
        </button>
        <Controller name={`${prefix}.is_disabled`} control={form.control} render={({ field }) => (
          <div className="flex shrink-0 items-center gap-2">
            <span className={`hidden text-xs sm:inline ${field.value ? "text-muted-foreground" : "text-primary"}`}>
              {t(field.value ? "hostsDialog.disabledStatus" : "hostsDialog.enabledStatus")}
            </span>
            <Switch name={field.name} ref={field.ref} onBlur={field.onBlur} checked={!field.value}
              onCheckedChange={(checked) => field.onChange(!checked)} disabled={disabled}
              aria-label={t("hostsDialog.enableHost", { name: values?.remark || index + 1 })} />
          </div>
        )} />
        <Button type="button" size="icon-sm" variant="ghost" onClick={onToggle}
          aria-label={t("hostsDialog.editHost")} aria-expanded={expanded} aria-controls={`${id}-editor`}>
          <ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>
      </div>
      <div id={`${id}-editor`} hidden={!expanded} className="space-y-5 border-t p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div className="sm:col-span-2">{field("remark", t("hostsDialog.remark"), t("hostsDialog.remarkPlaceholder"))}</div>
          {field("address", t("hostsDialog.address"), "example.com")}
          {field("port", t("hostsDialog.port"), t("hostsDialog.inherit"), "number")}
        </div>
        <p className="text-xs text-muted-foreground">{t("hostsDialog.basicsHint")}</p>
        <Accordion multiple className="rounded-lg border bg-muted/20 px-3">
          <AccordionItem value="transport" className="rounded-none border-0 border-b">
            <AccordionTrigger className="px-0">{t("hostsDialog.transportSettings")}</AccordionTrigger>
            <AccordionContent className="grid gap-4 px-0 sm:grid-cols-2">
              {field("host", t("hostsDialog.host"), "example.com")}
              {field("path", t("hostsDialog.path"), "/vless")}
              {checkbox("mux_enable", "muxEnable")}
              {checkbox("random_user_agent", "randomUserAgent")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="security" className="rounded-none border-0 border-b">
            <AccordionTrigger className="px-0">{t("hostsDialog.tlsSettings")}</AccordionTrigger>
            <AccordionContent className="space-y-4 px-0">
              <div className="grid gap-4 sm:grid-cols-2">
                {select("security", proxyHostSecurity)}
                {field("sni", t("hostsDialog.sni"), "example.com")}
                {select("alpn", proxyALPN)}
                {select("fingerprint", proxyFingerprint)}
              </div>
              {checkbox("use_sni_as_host", "useSniAsHost")}
              {checkbox("allowinsecure", "allowinsecure")}
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="advanced" className="border-0">
            <AccordionTrigger className="px-0">{t("hostsDialog.advancedOptions")}</AccordionTrigger>
            <AccordionContent className="grid gap-4 px-0 sm:grid-cols-2">
              {field("fragment_setting", t("hostsDialog.fragment"), "100-200,10-20,tlshello")}
              {field("noise_setting", t("hostsDialog.noise"), "rand:10-20,10-20")}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onDuplicate}>
              <Copy />{t("hostsDialog.duplicate")}
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" disabled={disabled || index === 0}
              title={t("hostsDialog.moveUp")} aria-label={t("hostsDialog.moveUp")} onClick={() => onMove(-1)}><ArrowUp /></Button>
            <Button type="button" size="icon-sm" variant="ghost" disabled={disabled || index === count - 1}
              title={t("hostsDialog.moveDown")} aria-label={t("hostsDialog.moveDown")} onClick={() => onMove(1)}><ArrowDown /></Button>
          </div>
          <Button type="button" size="sm" variant="destructive" disabled={disabled} onClick={onRemove}>
            <Trash2 />{t("delete")}
          </Button>
        </div>
      </div>
    </section>
  );
}
function InboundHosts({ hostKey, disabled }: { hostKey: string; disabled: boolean }) {
  const form = useFormContext<HostFormValues>();
  const { fields, append, remove, insert, move } = useFieldArray({ control: form.control, name: hostKey });
  const values = useWatch({ control: form.control, name: hostKey }) || [];
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<number | null>(null);
  const [deleted, setDeleted] = useState<{ index: number; host: HostFormValues[string][number] } | null>(null);
  useEffect(() => {
    if (!form.formState.isDirty) setDeleted(null);
  }, [form.formState.isDirty]);
  useEffect(() => {
    if (pendingOpen !== null && fields[pendingOpen]) {
      setOpenId(fields[pendingOpen].id);
      setPendingOpen(null);
    }
  }, [fields, pendingOpen]);
  // Keep invalid hosts visible even when a search would otherwise hide them.
  const visible = fields.map((host, index) => ({ host, index })).filter(({ index }) =>
    form.getFieldState(`${hostKey}.${index}`, form.formState).invalid ||
    `${values[index]?.remark || ""} ${values[index]?.address || ""}`.toLowerCase().includes(query.toLowerCase().trim()));
  const add = () => {
    setQuery("");
    setPendingOpen(fields.length);
    append(newHost(), { shouldFocus: true, focusName: `${hostKey}.${fields.length}.remark` });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-all text-base font-semibold">{hostKey}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{t("hostsDialog.inboundHint")}</p>
        </div>
        <Button type="button" disabled={disabled} onClick={add}><Plus />{t("hostsDialog.addHost")}</Button>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="ps-9"
          placeholder={t("hostsDialog.searchHosts")} aria-label={t("hostsDialog.searchHosts")} />
      </div>
      {deleted && <div role="status" className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm">
        <span>{t("hostsDialog.hostRemoved")}</span>
        <Button type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => {
          const index = Math.min(deleted.index, fields.length);
          insert(index, deleted.host);
          setQuery(""); setPendingOpen(index); setDeleted(null);
        }}><Undo2 />{t("hostsDialog.undo")}</Button>
      </div>}
      {visible.map(({ host, index }) => (
        <HostCard key={host.id} hostKey={hostKey} index={index} count={fields.length} disabled={disabled}
          open={openId === host.id} onToggle={() => setOpenId(openId === host.id ? null : host.id)}
          onRemove={() => { setDeleted({ index, host: { ...form.getValues(hostKey)[index] } }); remove(index); }}
          onDuplicate={() => {
            setQuery(""); setPendingOpen(index + 1);
            insert(index + 1, { ...form.getValues(hostKey)[index], remark: `${form.getValues(hostKey)[index].remark} (${t("hostsDialog.copyLabel")})` });
          }} onMove={(direction) => move(index, index + direction)} />
      ))}
      {!visible.length && <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
        <Server className="size-8 text-muted-foreground" />
        <p className="font-medium">{t(fields.length ? "hostsDialog.noMatches" : "hostsDialog.emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t(fields.length ? "hostsDialog.searchHint" : "hostsDialog.emptyHint")}</p>
        <Button type="button" variant="outline" disabled={disabled} onClick={fields.length ? () => setQuery("") : add}>
          {fields.length ? t("hostsDialog.clearSearch") : t("hostsDialog.addHost")}
        </Button>
      </div>}
      {!!visible.length && <p className="text-xs text-muted-foreground">{t("hostsDialog.orderHint")}</p>}
    </div>
  );
}

function InboundNavigation({ keys, activeInbound, onSelect }: {
  keys: string[]; activeInbound: string; onSelect: (key: string) => void;
}) {
  const form = useFormContext<HostFormValues>();
  const { t } = useTranslation();
  const counts = useWatch({
    control: form.control,
    compute: (values: HostFormValues) => Object.fromEntries(Object.entries(values).map(([key, hosts]) =>
      [key, { total: hosts.length, enabled: hosts.filter((host) => !host.is_disabled).length }])),
  });
  return (
    <nav aria-label={t("hostsDialog.inbounds")} className="shrink-0 overflow-y-auto border-b bg-muted/20 p-3 md:w-56 md:border-b-0 md:border-e">
      <p className="mb-2 hidden px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground md:block">{t("hostsDialog.inbounds")}</p>
      <div className="flex gap-2 overflow-x-auto md:flex-col md:overflow-x-visible">
        {keys.map((key) => {
          const { total, enabled } = counts[key] || { total: 0, enabled: 0 };
          const invalid = !!form.formState.errors[key];
          return <button key={key} type="button" onClick={() => onSelect(key)}
            aria-current={activeInbound === key ? "true" : undefined}
            className={`flex min-w-40 items-center gap-3 rounded-lg border p-3 text-start text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring md:min-w-0 ${activeInbound === key ? "border-primary/20 bg-background text-primary shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted"}`}>
            <Server className="size-4 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block truncate font-medium" title={key}>{key}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t("hostsDialog.hostCount", { count: total })} · {t("hostsDialog.enabledCount", { count: enabled })}</span>
            </span>
            {invalid && <span className="size-2 shrink-0 rounded-full bg-destructive" aria-label={t("hostsDialog.needsAttention")} />}
          </button>;
        })}
      </div>
    </nav>
  );
}

export function HostsDialog() {
  const isEditingHosts = useDashboard((state) => state.isEditingHosts);
  const onEditingHosts = useDashboard((state) => state.onEditingHosts);
  const refetchUsers = useDashboard((state) => state.refetchUsers);
  const hosts = useHosts((state) => state.hosts);
  const fetchHosts = useHosts((state) => state.fetchHosts);
  const cancelFetch = useHosts((state) => state.cancelFetch);
  const setHosts = useHosts((state) => state.setHosts);
  const isLoading = useHosts((state) => state.isLoading);
  const isPostLoading = useHosts((state) => state.isPostLoading);
  const { t, i18n } = useTranslation();
  const [selectedInbound, setSelectedInbound] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const lock = useRef(false);
  const form = useForm<HostFormValues, unknown, HostValues>({ resolver: zodResolver(hostsSchema), defaultValues: {} });
  const keys = Object.keys(hosts);
  const activeInbound = keys.includes(selectedInbound) ? selectedInbound : keys[0];
  useEffect(() => {
    if (isEditingHosts) {
      setLoadFailed(false);
      setError(null);
      fetchHosts().catch(() => {
        setLoadFailed(true);
        setError(t("hostsDialog.loadError"));
      });
    }
    return cancelFetch;
  }, [isEditingHosts, fetchHosts, cancelFetch]);
  useEffect(() => {
    if (isEditingHosts) form.reset(hosts);
  }, [hosts, isEditingHosts, form]);
  const discard = () => {
    setConfirmClose(false);
    setSelectedInbound("");
    setError(null);
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
      await setHosts(values);
      toast.success(t("hostsDialog.savedSuccess"));
      form.reset(values);
      refetchUsers();
    } catch (error: any) {
      const detail = error?.response?._data?.detail;
      setError(
        typeof detail === "string"
          ? detail
          : t("hostsDialog.saveError", { defaultValue: "Could not save hosts. Please try again." }),
      );
      if (detail && typeof detail === "object" && !Array.isArray(detail))
        Object.entries(detail).forEach(([key, message]) => form.setError(key, { message: String(message) }));
    } finally {
      lock.current = false;
    }
  };
  return (
    <>
      <Dialog open={isEditingHosts} onOpenChange={(open) => { if (!open) close(); }}>
        <DialogContent className="flex h-[min(850px,calc(100dvh-2rem))] max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl"
          dir={i18n.dir()} showCloseButton={!isPostLoading}>
          <DialogHeader className="shrink-0 border-b px-5 py-5 pe-14 sm:px-6">
            <DialogTitle className="flex items-center gap-2 text-lg"><Link2 className="size-5 text-primary" />{t("header.hostSettings")}</DialogTitle>
            <DialogDescription>{t("hostsDialog.editorDescription")}</DialogDescription>
          </DialogHeader>
          <FormProvider {...form}>
            <form onSubmit={form.handleSubmit(save, (errors) => {
              setSelectedInbound(Object.keys(errors)[0]);
              setError(t("hostsDialog.validationError"));
            })} className="flex min-h-0 flex-1 flex-col" aria-busy={isPostLoading}>
              {isLoading ? <div className="flex flex-1 items-center justify-center gap-2"><Spinner />{t("hostsDialog.loading")}</div> : keys.length ? (
                <div className="flex min-h-0 flex-1 flex-col md:flex-row">
                  <InboundNavigation keys={keys} activeInbound={activeInbound} onSelect={(key) => {
                    setSelectedInbound(key); setError(null);
                  }} />
                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
                    {keys.map((key) => <div key={key} hidden={activeInbound !== key}>
                      <InboundHosts hostKey={key} disabled={isPostLoading || loadFailed} />
                    </div>)}
                  </div>
                </div>
              ) : <p className="flex-1 p-6 text-muted-foreground">{t("hostsDialog.noInbounds")}</p>}
              <div className="shrink-0 space-y-3 border-t bg-background px-4 py-3 sm:px-6">
                {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                    {form.formState.isDirty ? <span className="size-2 rounded-full bg-amber-500" /> : <Check className="size-4" />}
                    {t(form.formState.isDirty ? "hostsDialog.unsavedChanges" : "hostsDialog.savedState")}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={isPostLoading} onClick={close}>{t("cancel")}</Button>
                    <Button type="submit" disabled={isLoading || isPostLoading || loadFailed || !form.formState.isDirty || !keys.length}>
                      {isPostLoading && <Spinner />}{t(isPostLoading ? "hostsDialog.saving" : "hostsDialog.saveChanges")}
                    </Button>
                  </div>
                </div>
              </div>
            </form>
          </FormProvider>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}>
        <AlertDialogContent dir={i18n.dir()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("hostsDialog.discardTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("hostsDialog.discardDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmClose(false)}>{t("hostsDialog.keepEditing")}</Button>
            <Button type="button" variant="destructive" onClick={discard}>{t("hostsDialog.discard")}</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
