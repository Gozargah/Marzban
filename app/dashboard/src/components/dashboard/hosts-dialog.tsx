import { useEffect, useId, useRef, useState } from "react";
import { Copy, ArrowDown, ArrowUp, Info, Link2, Trash2 } from "lucide-react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, FormProvider, useFieldArray, useForm, useFormContext } from "react-hook-form";
import { Trans, useTranslation } from "react-i18next";
import { toast } from "sonner";
import { proxyALPN, proxyFingerprint, proxyHostSecurity } from "constants/Proxies";
import { useHosts } from "contexts/HostsContext";
import { useDashboard } from "contexts/DashboardContext";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
      remark: z.string().min(1, "Remark is required"),
      address: z.string().min(1, "Address is required"),
      port: z
        .string()
        .or(z.number())
        .nullable()
        .transform((value) => {
          if (typeof value === "number") return value;
          if (value !== null && !isNaN(parseInt(value))) return Number(parseInt(value));
          return null;
        }),
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
}: {
  hostKey: string;
  index: number;
  count: number;
  onRemove: () => void;
  onDuplicate: () => void;
  onMove: (direction: number) => void;
  disabled: boolean;
}) {
  const form = useFormContext<HostFormValues>();
  const { t } = useTranslation();
  const id = useId();
  const prefix = `${hostKey}.${index}`;
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
    <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
      {field("remark", t("hostsDialog.remark", { defaultValue: "Remark" }), "Remark")}
      {field("address", t("hostsDialog.address", { defaultValue: "Address" }), "example.com")}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Controller
          name={`${prefix}.is_disabled`}
          control={form.control}
          render={({ field }) => (
            <Switch
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              checked={!field.value}
              onCheckedChange={(checked) => field.onChange(!checked)}
              disabled={disabled}
              aria-label={t("active")}
            />
          )}
        />
        <Button
          type="button"
          size="icon-sm"
          variant="destructive"
          disabled={disabled}
          aria-label={t("delete")}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled}
          aria-label={t("hostsDialog.duplicate", { defaultValue: "Duplicate" })}
          onClick={onDuplicate}
        >
          <Copy />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled || index === count - 1}
          aria-label={t("hostsDialog.moveDown", { defaultValue: "Move down" })}
          onClick={() => onMove(1)}
        >
          <ArrowDown />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          disabled={disabled || index === 0}
          aria-label={t("hostsDialog.moveUp", { defaultValue: "Move up" })}
          onClick={() => onMove(-1)}
        >
          <ArrowUp />
        </Button>
      </div>
      <Accordion>
        <AccordionItem value="advanced" className="border-0">
          <AccordionTrigger className="px-0">{t("hostsDialog.advancedOptions")}</AccordionTrigger>
          <AccordionContent className="space-y-3 px-0">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {field("port", t("hostsDialog.port"), "443", "number")}
              {field("sni", t("hostsDialog.sni"), "example.com")}
              {field("host", t("hostsDialog.host"), "example.com")}
              {field("path", t("hostsDialog.path"), "/vless")}
              {select("security", proxyHostSecurity)}
              {select("alpn", proxyALPN)}
              {select("fingerprint", proxyFingerprint)}
              {field("fragment_setting", t("hostsDialog.fragment"), "100-200,10-20,tlshello")}
              {field("noise_setting", t("hostsDialog.noise"), "rand:10-20,10-20")}
            </div>
            {checkbox("use_sni_as_host", "useSniAsHost")}
            {checkbox("allowinsecure", "allowinsecure")}
            {checkbox("mux_enable", "muxEnable")}
            {checkbox("random_user_agent", "randomUserAgent")}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
function InboundHosts({ hostKey, disabled }: { hostKey: string; disabled: boolean }) {
  const form = useFormContext<HostFormValues>();
  const { fields, append, remove, insert, move } = useFieldArray({ control: form.control, name: hostKey });
  const { t } = useTranslation();
  return (
    <AccordionItem value={hostKey}>
      <AccordionTrigger>
        <span className="break-all">{hostKey}</span>
      </AccordionTrigger>
      <AccordionContent className="space-y-3">
        {fields.map((host, index) => (
          <HostCard
            key={host.id}
            hostKey={hostKey}
            index={index}
            count={fields.length}
            disabled={disabled}
            onRemove={() => remove(index)}
            onDuplicate={() => insert(index + 1, { ...form.getValues(hostKey)[index] })}
            onMove={(direction) => move(index, index + direction)}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={disabled}
          onClick={() => append(newHost())}
        >
          {t("hostsDialog.addHost")}
        </Button>
      </AccordionContent>
    </AccordionItem>
  );
}
export function HostsDialog() {
  const { isEditingHosts, onEditingHosts, refetchUsers } = useDashboard();
  const { hosts, fetchHosts, setHosts, isLoading, isPostLoading } = useHosts();
  const { t, i18n } = useTranslation();
  const [expanded, setExpanded] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const form = useForm<HostFormValues, unknown, HostValues>({ resolver: zodResolver(hostsSchema), defaultValues: {} });
  useEffect(() => {
    if (isEditingHosts) fetchHosts();
  }, [isEditingHosts, fetchHosts]);
  useEffect(() => {
    if (isEditingHosts) form.reset(hosts);
  }, [hosts, isEditingHosts, form]);
  const close = () => {
    if (isPostLoading || lock.current) return;
    setExpanded([]);
    setError(null);
    onEditingHosts(false);
  };
  const save = async (values: HostValues) => {
    if (lock.current) return;
    lock.current = true;
    setError(null);
    try {
      await setHosts(values);
      toast.success(t("hostsDialog.savedSuccess"));
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
    <Dialog
      open={isEditingHosts}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
        dir={i18n.dir()}
        showCloseButton={!isPostLoading}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Link2 className="size-5 text-primary" />
            {t("header.hostSettings")}
          </DialogTitle>
          <DialogDescription>{t("hostsDialog.title")}</DialogDescription>
        </DialogHeader>
        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(save, (errors) =>
              setExpanded((previous) => [...new Set([...previous, ...Object.keys(errors)])]),
            )}
            className="space-y-4"
            aria-busy={isPostLoading}
          >
            {isLoading ? (
              <Spinner />
            ) : Object.keys(hosts).length ? (
              <Accordion multiple value={expanded} onValueChange={setExpanded} className="space-y-3">
                {Object.keys(hosts).map((key) => (
                  <InboundHosts key={key} hostKey={key} disabled={isPostLoading} />
                ))}
              </Accordion>
            ) : (
              <p className="text-muted-foreground">
                {t("hostsDialog.noInbounds", { defaultValue: "No inbound found. Please check your Xray config file." })}
              </p>
            )}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading || isPostLoading}>
                {isPostLoading && <Spinner />}
                {t("hostsDialog.apply")}
              </Button>
            </div>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
