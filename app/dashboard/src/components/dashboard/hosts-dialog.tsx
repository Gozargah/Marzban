import { useEffect, useId, useRef, useState } from "react";
import { Copy, ArrowDown, ArrowUp, Info, Link2, Trash2, Plus, Search, ChevronDown, Server, Undo2, Check, Layers, Settings2, X } from "lucide-react";
import { z } from "zod";
import { DirectionProvider } from "@base-ui/react/direction-provider";
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
      mux_enable: z.boolean().nullable().transform((value) => value ?? false).default(false),
      allowinsecure: z.boolean().nullable().default(false),
      is_disabled: z.boolean().nullable().transform((value) => value ?? false).default(false),
      fragment_setting: z.string().nullable(),
      noise_setting: z.string().nullable(),
      random_user_agent: z.boolean().nullable().transform((value) => value ?? false).default(false),
      security: z.string(),
      alpn: z.string(),
      fingerprint: z.string(),
      use_sni_as_host: z.boolean().nullable().transform((value) => value ?? false).default(false),
    }),
  ),
);

type HostFormValues = z.input<typeof hostsSchema>;
type HostValues = z.output<typeof hostsSchema>;
// Inbound tags may contain dots or brackets, which RHF treats as path separators.
const toFormKey = (tag: string) => `inbound_${encodeURIComponent(tag).replace(/[.!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)}`;
const toInboundTag = (key: string) => decodeURIComponent(key.slice("inbound_".length));
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
function firstErrorPath(error: unknown, prefix = ""): string | null {
  if (!error || typeof error !== "object") return null;
  if ("message" in error && typeof error.message === "string") return prefix || null;
  for (const [key, value] of Object.entries(error)) {
    if (key === "ref") continue;
    const path = firstErrorPath(value, prefix ? `${prefix}.${key}` : key);
    if (path) return path;
  }
  return null;
}
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
function FieldHelp({ name, title }: { name: string; title: string }) {
  const { t, i18n } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger aria-label={t("hostsDialog.fieldHelp", { defaultValue: "Help for {{field}}", field: title })} className="inline-flex shrink-0 text-muted-foreground">
        <Info className="size-4" />
      </PopoverTrigger>
      <PopoverContent dir={i18n.dir()} className="max-h-[min(32rem,70dvh)] w-80 max-w-[calc(100vw-2rem)] space-y-2 overflow-y-auto overscroll-contain">
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
  showActions = true,
  focusOnOpen = true,
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
  showActions?: boolean;
  focusOnOpen?: boolean;
}) {
  const form = useFormContext<HostFormValues>();
  const { t } = useTranslation();
  const id = useId();
  const prefix = `${hostKey}.${index}`;
  // RHF's record-path types cannot infer an indexed host from a dynamic key.
  const values = useWatch({ control: form.control, name: prefix }) as unknown as HostFormValues[string][number] | undefined;
  const invalid = form.getFieldState(prefix, form.formState).invalid;
  const expanded = open || invalid;
  const [advancedSections, setAdvancedSections] = useState<string[]>([]);
  const errorSections = [
    { key: "transport", fields: ["host", "path", "mux_enable", "random_user_agent"] },
    { key: "security", fields: ["security", "sni", "alpn", "fingerprint", "use_sni_as_host", "allowinsecure"] },
    { key: "advanced", fields: ["fragment_setting", "noise_setting"] },
  ].filter((section) => section.fields.some((name) => form.getFieldState(`${prefix}.${name}`, form.formState).invalid))
    .map((section) => section.key);
  const errorSectionKey = errorSections.join("|");
  useEffect(() => {
    if (errorSectionKey) setAdvancedSections((current) => [...new Set([...current, ...errorSectionKey.split("|")])]);
  }, [errorSectionKey]);
  const setFocus = form.setFocus;
  useEffect(() => {
    if (open && focusOnOpen) setFocus(`${prefix}.remark`);
  }, [open, prefix, setFocus, focusOnOpen]);
  const field = (name: string, title: string, placeholder?: string, type = "text") => (
    <Controller
      key={name}
      control={form.control}
      name={`${prefix}.${name}`}
      render={({ field, fieldState }) => (
        <Field className="gap-1.5" data-invalid={fieldState.invalid}>
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={`${id}-${name}`}>{title}</FieldLabel>
            <FieldHelp title={title} name={name === "fragment_setting" ? "fragment" : name === "noise_setting" ? "noise" : name} />
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
  const summary = (
    <>
      <span className="flex items-center gap-2 font-medium">
        <span className="truncate">{String(values?.remark || t("hostsDialog.newHost"))}</span>
        {invalid && <Badge variant="destructive">{t("hostsDialog.needsAttention")}</Badge>}
      </span>
      <span className="mt-1 block truncate text-xs text-muted-foreground" dir="ltr">
        {String(values?.address || t("hostsDialog.noAddress"))}{values?.port ? ` : ${values.port}` : ""}
      </span>
    </>
  );
  return (
    <section className={`overflow-hidden rounded-none border bg-background transition-colors ${invalid ? "border-destructive" : expanded ? "border-primary/30" : "border-border"}`}>
      <div className="flex items-center gap-3 p-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-none bg-muted text-xs font-medium text-muted-foreground">{index + 1}</span>
        {showActions ? <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={`${id}-editor`} disabled={disabled}
          className="min-w-0 flex-1 rounded-none text-start outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {summary}
        </button> : <div className="min-w-0 flex-1 text-start">{summary}</div>}
        <Controller name={`${prefix}.is_disabled`} control={form.control} render={({ field }) => (
          <div className="flex shrink-0 items-center gap-2">
            <span className={`hidden text-xs sm:inline ${field.value ? "text-muted-foreground" : "text-foreground"}`}>
              {t(field.value ? "hostsDialog.disabledStatus" : "hostsDialog.enabledStatus")}
            </span>
            <Switch name={field.name} ref={field.ref} onBlur={field.onBlur} checked={!field.value}
              onCheckedChange={(checked) => field.onChange(!checked)} disabled={disabled}
              aria-label={t("hostsDialog.enableHost", { name: values?.remark || index + 1 })} />
          </div>
        )} />
        {showActions && <Button type="button" size="icon-sm" variant="ghost" onClick={onToggle} disabled={disabled}
          aria-label={t("hostsDialog.editHost")} aria-expanded={expanded} aria-controls={`${id}-editor`}>
          <ChevronDown className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </Button>}
      </div>
      <div id={`${id}-editor`} hidden={!expanded} className="space-y-4 border-t p-4">
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_120px]">
          <div className="sm:col-span-2">{field("remark", t("hostsDialog.remark"), t("hostsDialog.remarkPlaceholder"))}</div>
          {field("address", t("hostsDialog.address"), "example.com")}
          {field("port", t("hostsDialog.port"), t("hostsDialog.inherit"), "number")}
        </div>
        <p className="text-xs text-muted-foreground">{t("hostsDialog.basicsHint")}</p>
        <Accordion multiple value={[...new Set([...advancedSections, ...errorSections])]} onValueChange={setAdvancedSections} className="rounded-none border bg-muted/20 px-3">
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
        {showActions && <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex flex-wrap gap-1">
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={onDuplicate}>
              <Copy />{t("hostsDialog.duplicate")}
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" disabled={disabled || index === 0}
              title={t("hostsDialog.moveUp")} aria-label={t("hostsDialog.moveUp")} onClick={() => onMove(-1)}><ArrowUp /></Button>
            <Button type="button" size="icon-sm" variant="ghost" disabled={disabled || index === count - 1}
              title={t("hostsDialog.moveDown")} aria-label={t("hostsDialog.moveDown")} onClick={() => onMove(1)}><ArrowDown /></Button>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={disabled} onClick={onRemove}>
              <Trash2 />{t("delete")}
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={async () => {
              if (await form.trigger(prefix)) onToggle();
              else {
                const path = firstErrorPath(form.getFieldState(prefix, form.formState).error, prefix);
                if (path) requestAnimationFrame(() => setFocus(path));
              }
            }}>{t("hostsDialog.doneEditing", { defaultValue: "Done editing" })}</Button>
          </div>
        </div>}
      </div>
    </section>
  );
}
function InboundHosts({ hostKey, disabled, globalQuery, onClearSearch, creationVersion, draftVersion }: {
  hostKey: string; disabled: boolean; globalQuery?: string; onClearSearch?: () => void; creationVersion?: number; draftVersion: number;
}) {
  const form = useFormContext<HostFormValues>();
  const { fields, append, remove, insert, move } = useFieldArray({ control: form.control, name: hostKey });
  const values = useWatch({ control: form.control, name: hostKey }) || [];
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  useEffect(() => { setQuery(""); }, [creationVersion]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<number | null>(null);
  const [deleted, setDeleted] = useState<{ index: number; host: HostFormValues[string][number] } | null>(null);
  const undoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { setDeleted(null); }, [draftVersion]);
  useEffect(() => { if (deleted) undoRef.current?.focus(); }, [deleted]);
  useEffect(() => {
    if (pendingOpen !== null && fields[pendingOpen]) {
      setOpenId(fields[pendingOpen].id);
      setPendingOpen(null);
    }
  }, [fields, pendingOpen]);
  const effectiveQuery = globalQuery ?? query;
  // Keep invalid hosts visible even when a search would otherwise hide them.
  const visible = fields.map((host, index) => ({ host, index })).filter(({ index }) =>
    form.getFieldState(`${hostKey}.${index}`, form.formState).invalid ||
    `${values[index]?.remark || ""} ${values[index]?.address || ""}`.toLowerCase().includes(effectiveQuery.toLowerCase().trim()));
  const add = () => {
    onClearSearch?.();
    setQuery("");
    setPendingOpen(fields.length);
    append(newHost(), { shouldFocus: true, focusName: `${hostKey}.${fields.length}.remark` });
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-all text-sm font-semibold">{toInboundTag(hostKey)}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={add}><Plus />{t("hostsDialog.addHost")}</Button>
        </div>
      </div>
      {globalQuery === undefined && <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-3 size-4 text-muted-foreground" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} className="ps-9"
          placeholder={t("hostsDialog.searchHosts")} aria-label={t("hostsDialog.searchHosts")} />
      </div>}
      {deleted && <div role="status" className="flex items-center justify-between gap-2 rounded-none border bg-muted/40 px-3 py-2 text-sm">
        <span>{t("hostsDialog.hostRemoved")}</span>
        <Button ref={undoRef} type="button" size="sm" variant="ghost" disabled={disabled} onClick={() => {
          const index = Math.min(deleted.index, fields.length);
          insert(index, deleted.host);
          onClearSearch?.();
          setQuery(""); setPendingOpen(index); setDeleted(null);
        }}><Undo2 />{t("hostsDialog.undo")}</Button>
      </div>}
      {visible.map(({ host, index }) => (
        <HostCard key={host.id} hostKey={hostKey} index={index} count={fields.length} disabled={disabled}
          open={openId === host.id} onToggle={() => setOpenId(openId === host.id ? null : host.id)}
          onRemove={() => {
            onClearSearch?.(); setQuery("");
            setDeleted({ index, host: { ...form.getValues(hostKey)[index] } }); remove(index);
          }}
          onDuplicate={() => {
            onClearSearch?.();
            setQuery(""); setPendingOpen(index + 1);
            insert(index + 1, { ...form.getValues(hostKey)[index], remark: `${form.getValues(hostKey)[index].remark} (${t("hostsDialog.copyLabel")})` });
          }} onMove={(direction) => move(index, index + direction)} />
      ))}
      {!visible.length && !globalQuery && <div className="flex flex-col items-center gap-3 rounded-none border border-dashed px-4 py-10 text-center">
        <Server className="size-8 text-muted-foreground" />
        <p className="font-medium">{t(fields.length ? "hostsDialog.noMatches" : "hostsDialog.emptyTitle")}</p>
        <p className="max-w-sm text-sm text-muted-foreground">{t(fields.length ? "hostsDialog.searchHint" : "hostsDialog.emptyHint")}</p>
        <Button type="button" variant="outline" disabled={disabled} onClick={fields.length ? () => setQuery("") : add}>
          {fields.length ? t("hostsDialog.clearSearch") : t("hostsDialog.addHost")}
        </Button>
      </div>}
    </div>
  );
}

function InboundNavigation({ keys, activeInbound, onSelect }: {
  keys: string[]; activeInbound: string; onSelect: (key: string) => void;
}) {
  const form = useFormContext<HostFormValues>();
  const { t } = useTranslation();
  const selectedRef = useRef<HTMLButtonElement>(null);
  const counts = useWatch({ control: form.control, compute: (values: HostFormValues) =>
    Object.fromEntries(Object.entries(values).map(([key, hosts]) => [key, hosts.length])) });
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  const items = [{ key: "", label: t("hostsDialog.allFilter", { defaultValue: "All" }), total },
    ...keys.map((key) => ({ key, label: toInboundTag(key), total: counts[key] ?? 0 }))];
  useEffect(() => { selectedRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [activeInbound]);
  return (
    <nav aria-label={t("hostsDialog.inboundFilter", { defaultValue: "Inbound filter" })} className="min-w-0 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">{t("hostsDialog.inboundFilter", { defaultValue: "Inbound filter" })}</p>
      <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto overscroll-contain p-px">
        {items.map((item) => {
          const selected = activeInbound === item.key;
          const invalid = item.key ? !!form.formState.errors[item.key] : !!Object.keys(form.formState.errors).length;
          return <Button key={item.key} ref={selected ? selectedRef : undefined} type="button" size="sm"
            variant={selected ? "default" : "outline"} aria-pressed={selected} title={item.label}
            onClick={() => onSelect(item.key)} className="min-w-0 max-w-full gap-2">
            <span className="truncate">{item.label}</span>
            <span className={selected ? "shrink-0 tabular-nums text-primary-foreground/70" : "shrink-0 tabular-nums text-muted-foreground"}>{item.total}</span>
            {invalid && <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-label={t("hostsDialog.needsAttention")} />}
          </Button>;
        })}
      </div>
    </nav>
  );
}

function HostWorkspace({ keys, activeInbound, onSelect, disabled, onCreate, creationVersion, draftVersion }: {
  keys: string[]; activeInbound: string; onSelect: (key: string) => void; disabled: boolean; onCreate: () => void; creationVersion: number; draftVersion: number;
}) {
  const form = useFormContext<HostFormValues>();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  useEffect(() => { setQuery(""); }, [creationVersion]);
  const searchIndex = useWatch({ control: form.control, compute: (values: HostFormValues) =>
    Object.fromEntries(Object.entries(values).map(([key, hosts]) =>
      [key, [toInboundTag(key).toLowerCase(), ...hosts.map((host) => `${host.remark} ${host.address}`.toLowerCase())]])) });
  const normalizedQuery = query.trim().toLowerCase();
  const visibleKeys = keys.filter((key) => (!activeInbound || activeInbound === key) &&
    (!!form.formState.errors[key] || !normalizedQuery || searchIndex[key]?.some((value) => value.includes(normalizedQuery))));
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="shrink-0 space-y-3 border-b bg-background px-4 py-4 sm:px-6">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-2 size-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="ps-9 pe-9"
            placeholder={t("hostsDialog.searchAll", { defaultValue: "Search inbounds, host names, or addresses…" })}
            aria-label={t("hostsDialog.searchAll", { defaultValue: "Search inbounds, host names, or addresses…" })} />
          {query && <Button type="button" size="icon-xs" variant="ghost" className="absolute end-1 top-1" aria-label={t("hostsDialog.clearSearch")} onClick={() => setQuery("")}><X /></Button>}
        </div>
        <InboundNavigation keys={keys} activeInbound={activeInbound} onSelect={onSelect} />
      </div>
      <div className="min-h-0 min-w-0 flex-1 space-y-5 overflow-y-auto overscroll-contain p-4 sm:p-6">
        {!activeInbound && <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium">{t("hostsDialog.allInbounds", { defaultValue: "All inbounds" })}</h2>
          <Button type="button" size="sm" disabled={disabled} onClick={onCreate}><Plus aria-hidden="true" />{t("hostsDialog.addHost")}</Button>
        </div>}
        <div className="space-y-6">
          {keys.map((key) => <div key={key} hidden={!visibleKeys.includes(key)}>
            <InboundHosts hostKey={key} disabled={disabled} creationVersion={creationVersion} draftVersion={draftVersion} onClearSearch={() => setQuery("")}
              globalQuery={toInboundTag(key).toLowerCase().includes(normalizedQuery) ? "" : query} />
          </div>)}
          {!visibleKeys.length && <div className="border border-dashed px-4 py-10 text-center">
            <p className="text-sm font-medium">{t("hostsDialog.noMatches")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("hostsDialog.searchHint")}</p>
            <Button type="button" size="sm" className="mt-3" variant="outline" onClick={() => setQuery("")}>{t("hostsDialog.clearSearch")}</Button>
          </div>}
        </div>
        {!!visibleKeys.length && <p className="text-xs text-muted-foreground">{t("hostsDialog.orderHint")}</p>}
      </div>
    </div>
  );
}

function CreateHostSheet({ open, keys, initialInbound, onClose, onCreate }: {
  open: boolean; keys: string[]; initialInbound: string; onClose: () => void;
  onCreate: (host: HostFormValues[string][number], targets: string[]) => void;
}) {
  const { t, i18n } = useTranslation();
  const [targets, setTargets] = useState<string[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const addLock = useRef(false);
  const id = useId();
  const form = useForm<HostFormValues, unknown, HostValues>({ resolver: zodResolver(hostsSchema), defaultValues: { template: [newHost()] } });
  useEffect(() => {
    if (open) {
      addLock.current = false;
      form.reset({ template: [newHost()] });
      setTargets([initialInbound || keys[0]].filter(Boolean));
    }
  }, [open, initialInbound, keys.join("|"), form]);
  const close = () => { if (form.formState.isDirty) setDiscardOpen(true); else onClose(); };
  const allSelected = keys.length > 0 && targets.length === keys.length;
  return <>
    <Sheet open={open} onOpenChange={(next) => { if (!next) close(); }}>
      <SheetContent dir={i18n.dir()} side={i18n.dir() === "rtl" ? "left" : "right"} className="w-full! sm:max-w-xl! gap-0 overflow-hidden">
        <SheetHeader className="shrink-0 border-b px-6 py-5 pe-14">
          <SheetTitle className="text-lg">{t("hostsDialog.addHost")}</SheetTitle>
          <SheetDescription>{t("hostsDialog.createDescription", { defaultValue: "Choose the inbounds, then configure your host. Hosts are added to your draft until you save." })}</SheetDescription>
        </SheetHeader>
        <FormProvider {...form}>
          <form noValidate className="flex min-h-0 flex-1 flex-col" onSubmit={form.handleSubmit((values) => {
            if (!targets.length || addLock.current) return;
            addLock.current = true;
            onCreate(values.template[0], targets);
            onClose();
          })}>
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-6">
              <fieldset className="space-y-3">
                <legend className="mb-3 font-medium">{t("hostsDialog.destinationInbounds", { defaultValue: "Add to inbounds" })}</legend>
                <div className="flex items-center gap-3 rounded-none border bg-muted/30 p-3">
                  <Checkbox id={`${id}-all`} checked={allSelected} indeterminate={!allSelected && targets.length > 0}
                    onCheckedChange={(checked) => setTargets(checked ? [...keys] : [])} />
                  <FieldLabel htmlFor={`${id}-all`}>{t("hostsDialog.selectAllInbounds", { defaultValue: "Select all inbounds" })}</FieldLabel>
                </div>
                <div className="max-h-40 space-y-2 overflow-y-auto rounded-none border p-3">
                  {keys.map((key, index) => <div key={key} className="flex items-center gap-3">
                    <Checkbox id={`${id}-${index}`} checked={targets.includes(key)} onCheckedChange={(checked) => setTargets((current) => checked ? [...current, key] : current.filter((target) => target !== key))} />
                    <FieldLabel htmlFor={`${id}-${index}`} className="min-w-0 break-all">{toInboundTag(key)}</FieldLabel>
                  </div>)}
                </div>
                {!targets.length && <p role="status" className="text-xs text-muted-foreground">{t("hostsDialog.selectInboundHint", { defaultValue: "Choose at least one inbound to continue." })}</p>}
              </fieldset>
              <HostCard hostKey="template" index={0} count={1} disabled={false} open onToggle={() => {}}
                showActions={false} focusOnOpen={false} onRemove={() => {}} onDuplicate={() => {}} onMove={() => {}} />
            </div>
            <SheetFooter className="shrink-0 border-t bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">{t("hostsDialog.selectedInbounds", { defaultValue: "{{count}} inbounds selected", count: targets.length })}</p>
                <div className="flex gap-2"><Button type="button" variant="outline" onClick={close}>{t("cancel")}</Button>
                  <Button type="submit" disabled={!targets.length || form.formState.isSubmitting}><Plus />{t("hostsDialog.addToDraft", { defaultValue: "Add to draft" })}</Button></div>
              </div>
            </SheetFooter>
          </form>
        </FormProvider>
      </SheetContent>
    </Sheet>
    <AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
      <AlertDialogContent dir={i18n.dir()} initialFocus={cancelRef}>
        <AlertDialogHeader><AlertDialogTitle>{t("hostsDialog.discardTitle")}</AlertDialogTitle><AlertDialogDescription>{t("hostsDialog.discardDescription")}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><Button ref={cancelRef} variant="outline" onClick={() => setDiscardOpen(false)}>{t("hostsDialog.keepEditing")}</Button>
          <Button variant="destructive" onClick={() => { setDiscardOpen(false); onClose(); }}>{t("hostsDialog.discard")}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [creationVersion, setCreationVersion] = useState(0);
  const [draftVersion, setDraftVersion] = useState(0);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const cancelDiscardRef = useRef<HTMLButtonElement>(null);
  const [selectedInbound, setSelectedInbound] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const lock = useRef(false);
  const form = useForm<HostFormValues, unknown, HostValues>({ resolver: zodResolver(hostsSchema), defaultValues: {} });
  const keys = Object.keys(hosts).map(toFormKey);
  const activeInbound = keys.includes(selectedInbound) ? selectedInbound : "";
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
    if (isEditingHosts) {
      form.reset(Object.fromEntries(Object.entries(hosts).map(([tag, rows]) => [toFormKey(tag), rows])));
      setDraftVersion((version) => version + 1);
    }
  }, [hosts, isEditingHosts, form]);
  const discard = () => {
    setConfirmClose(false);
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
      refetchUsers();
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
    <DirectionProvider direction={i18n.dir() === "rtl" ? "rtl" : "ltr"}>
      <Sheet open={isEditingHosts} onOpenChange={(open) => { if (!open) close(); }}
        onOpenChangeComplete={(open) => { if (!open) { setSelectedInbound(""); setError(null); } }}>
        <SheetContent dir={i18n.dir()} className="w-full! sm:max-w-2xl! gap-0 overflow-hidden" side={i18n.dir() === "rtl" ? "left" : "right"}
          showCloseButton={!isPostLoading} initialFocus={titleRef}>
          <SheetHeader className="shrink-0 border-b px-5 py-5 pe-14 sm:px-6">
            <SheetTitle ref={titleRef} tabIndex={-1} className="flex items-center gap-2 text-lg outline-none"><span className="flex size-9 items-center justify-center rounded-none bg-primary text-primary-foreground"><Link2 className="size-5" /></span>{t("header.hostSettings")}</SheetTitle>
            <SheetDescription>{t("hostsDialog.editorDescription")}</SheetDescription>
          </SheetHeader>
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
                {error && <Alert variant="destructive"><AlertDescription>
                  <p>{error}</p>
                  {loadFailed && <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={async () => {
                    setLoadFailed(false); setError(null);
                    try { await fetchHosts(); } catch { setLoadFailed(true); setError(t("hostsDialog.loadError")); }
                  }}>{t("hostsDialog.retry", { defaultValue: "Retry" })}</Button>}
                </AlertDescription></Alert>}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isLoading ? <Spinner /> : loadFailed ? <Info className="size-4" /> : form.formState.isDirty ? <span className="size-2 rounded-full bg-warning" /> : <Check className="size-4" />}
                    {t(isLoading ? "hostsDialog.loading" : loadFailed ? "hostsDialog.notLoaded" : form.formState.isDirty ? "hostsDialog.unsavedChanges" : "hostsDialog.savedState")}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={isPostLoading} onClick={close}>{t("cancel")}</Button>
                    <Button type="submit" disabled={isLoading || isPostLoading || loadFailed || !form.formState.isDirty || !keys.length}>
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
        <AlertDialogContent dir={i18n.dir()} initialFocus={cancelDiscardRef}>
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
