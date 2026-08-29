import { useToast } from "@chakra-ui/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Copy, Info, Plus, Trash2 } from "lucide-react";
import { FC, Fragment, useEffect, useState } from "react";
import { FormProvider, useFieldArray, useForm, useFormContext, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { proxyALPN, proxyFingerprint, proxyHostSecurity } from "constants/Proxies";
import { useHosts } from "contexts/HostsContext";
import { Checkbox, Field, IconButton, Select } from "xenith/fields";
import { useDashboard } from "../contexts/DashboardContext";

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

type HostsForm = z.infer<typeof hostsSchema>;

const EMPTY_HOST = {
  host: "",
  sni: "",
  port: null,
  path: null,
  address: "",
  remark: "",
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
};

/** The variables that can be used in a remark, shown on demand. */
const VariableHelp: FC = () => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const variables: [string, string][] = [
    ["SERVER_IP", t("hostsDialog.currentServer")],
    ["SERVER_IPV6", t("hostsDialog.currentServerv6")],
    ["USERNAME", t("hostsDialog.username")],
    ["DATA_USAGE", t("hostsDialog.dataUsage")],
    ["DATA_LEFT", t("hostsDialog.remainingData")],
    ["DATA_LIMIT", t("hostsDialog.dataLimit")],
    ["DAYS_LEFT", t("hostsDialog.remainingDays")],
    ["EXPIRE_DATE", t("hostsDialog.expireDate")],
    ["JALALI_EXPIRE_DATE", t("hostsDialog.jalaliExpireDate")],
    ["TIME_LEFT", t("hostsDialog.remainingTime")],
    ["STATUS_EMOJI", t("hostsDialog.statusEmoji")],
    ["STATUS_TEXT", t("hostsDialog.statusText")],
    ["PROTOCOL", t("hostsDialog.proxyProtocol")],
    ["TRANSPORT", t("hostsDialog.proxyMethod")],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="xn-link"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
          fontSize: 11.5,
        }}
      >
        <Info size={13} strokeWidth={1.5} />
        {t("hostsDialog.desc")}
      </button>
      {open && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 190px) 1fr",
            gap: "4px 12px",
            padding: "10px 12px",
            border: "1px solid var(--xn-divider)",
            fontSize: 11.5,
            color: "var(--xn-neutral-700)",
          }}
        >
          {variables.map(([name, description]) => (
            <Fragment key={name}>
              <code className="xn-mono" style={{ fontSize: 11, color: "var(--xn-accent-800)" }}>
                {`{${name}}`}
              </code>
              <span>{description}</span>
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

type HostRowProps = {
  hostKey: string;
  index: number;
  total: number;
  onDuplicate: () => void;
  onRemove: () => void;
  onMove: (direction: "up" | "down") => void;
};

const HostRow: FC<HostRowProps> = ({ hostKey, index, total, onDuplicate, onRemove, onMove }) => {
  const { t } = useTranslation();
  const [advanced, setAdvanced] = useState(false);
  const form = useFormContext<HostsForm>();
  const errors = (form.formState.errors as any)[hostKey]?.[index];
  const field = (name: string) => `${hostKey}.${index}.${name}` as const;
  const disabled = useWatch({ control: form.control, name: field("is_disabled") as never });

  const errorOf = (name: string) => errors?.[name]?.message as string | undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 14,
        border: "1px solid var(--xn-divider)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <Field label={t("hostsDialog.remark")} error={errorOf("remark")} grow>
          <input className="xn-input" placeholder="🚀 Marz ({USERNAME})" {...form.register(field("remark"))} />
        </Field>
        <div style={{ display: "flex", gap: 6, paddingTop: 22 }}>
          <IconButton title={t("hostsDialog.moveUp")} onClick={() => onMove("up")} disabled={index === 0}>
            <ChevronUp size={15} strokeWidth={1.5} />
          </IconButton>
          <IconButton title={t("hostsDialog.moveDown")} onClick={() => onMove("down")} disabled={index === total - 1}>
            <ChevronDown size={15} strokeWidth={1.5} />
          </IconButton>
          <IconButton title={t("hostsDialog.duplicate")} onClick={onDuplicate}>
            <Copy size={15} strokeWidth={1.5} />
          </IconButton>
          <IconButton title={t("delete")} onClick={onRemove} danger>
            <Trash2 size={15} strokeWidth={1.5} />
          </IconButton>
        </div>
      </div>

      <Field label={t("hostsDialog.address")} error={errorOf("address")}>
        <input className="xn-input xn-mono" style={{ fontSize: 13 }} placeholder="{SERVER_IP}" {...form.register(field("address"))} />
      </Field>

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => setAdvanced((value) => !value)}
          className="xn-link"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: 0,
            padding: 0,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          {advanced ? <ChevronUp size={14} strokeWidth={1.5} /> : <ChevronDown size={14} strokeWidth={1.5} />}
          {t("hostsDialog.advancedOptions")}
        </button>
        <div style={{ marginLeft: "auto" }}>
          <Checkbox
            label={t("hostsDialog.enabled")}
            checked={!disabled}
            onChange={(event) => form.setValue(field("is_disabled") as never, !event.target.checked as never)}
          />
        </div>
      </div>

      {advanced && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 2 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label={t("hostsDialog.port")} error={errorOf("port")} grow>
              <input className="xn-input xn-mono" style={{ fontSize: 13 }} placeholder="8443" {...form.register(field("port"))} />
            </Field>
            <Field label={t("hostsDialog.sni")} error={errorOf("sni")} grow>
              <input className="xn-input xn-mono" style={{ fontSize: 13 }} {...form.register(field("sni"))} />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label={t("hostsDialog.host")} error={errorOf("host")} grow>
              <input className="xn-input xn-mono" style={{ fontSize: 13 }} {...form.register(field("host"))} />
            </Field>
            <Field label={t("hostsDialog.path")} error={errorOf("path")} grow>
              <input className="xn-input xn-mono" style={{ fontSize: 13 }} {...form.register(field("path"))} />
            </Field>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Field label={t("hostsDialog.security")} grow>
              <Select options={proxyHostSecurity} registration={form.register(field("security"))} />
            </Field>
            <Field label={t("hostsDialog.alpn")} grow>
              <Select options={proxyALPN} registration={form.register(field("alpn"))} />
            </Field>
            <Field label={t("hostsDialog.fingerprint")} grow>
              <Select options={proxyFingerprint} registration={form.register(field("fingerprint"))} />
            </Field>
          </div>

          <Field label={t("hostsDialog.fragment")} hint={t("hostsDialog.fragment.info")} error={errorOf("fragment_setting")}>
            <input
              className="xn-input xn-mono"
              style={{ fontSize: 13 }}
              placeholder="100-200,10-20,tlshello"
              {...form.register(field("fragment_setting"))}
            />
          </Field>

          <Field label={t("hostsDialog.noise")} hint={t("hostsDialog.noise.info")} error={errorOf("noise_setting")}>
            <input
              className="xn-input xn-mono"
              style={{ fontSize: 13 }}
              placeholder="rand:10-20,10-20"
              {...form.register(field("noise_setting"))}
            />
          </Field>

          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 2 }}>
            {[
              { name: "use_sni_as_host", label: t("hostsDialog.useSniAsHost") },
              { name: "allowinsecure", label: t("hostsDialog.allowinsecure") },
              { name: "mux_enable", label: t("hostsDialog.muxEnable") },
              { name: "random_user_agent", label: t("hostsDialog.randomUserAgent") },
            ].map((option) => {
              const registration = form.register(field(option.name));
              return (
                <Checkbox
                  key={option.name}
                  label={option.label}
                  name={registration.name}
                  inputRef={registration.ref}
                  checked={!!form.watch(field(option.name) as never)}
                  onChange={registration.onChange as never}
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/** One inbound and the hosts configured for it. */
const InboundSection: FC<{ hostKey: string; open: boolean; onToggle: () => void }> = ({ hostKey, open, onToggle }) => {
  const { t } = useTranslation();
  const form = useFormContext<HostsForm>();
  const {
    fields: hosts,
    append,
    remove,
    insert,
    move,
  } = useFieldArray({ control: form.control, name: hostKey as never });
  const sectionErrors = (form.formState.errors as any)[hostKey];

  // A section with an invalid host has to be visible for the message to land.
  useEffect(() => {
    if (sectionErrors && !open) onToggle();
  }, [sectionErrors]);

  return (
    <div style={{ border: "1px solid var(--xn-divider)" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "11px 14px",
          background: open ? "var(--xn-accent-100)" : "transparent",
          color: open ? "var(--xn-accent-800)" : "var(--xn-text)",
          border: 0,
          borderBottom: open ? "1px solid var(--xn-divider)" : 0,
          cursor: "pointer",
          font: "inherit",
        }}
      >
        <span className="xn-mono" style={{ fontSize: 12.5, marginRight: "auto" }}>
          {hostKey}
        </span>
        <span className="xn-tag xn-tag-neutral">{hosts.length}</span>
        {open ? <ChevronUp size={15} strokeWidth={1.5} /> : <ChevronDown size={15} strokeWidth={1.5} />}
      </button>

      {open && (
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          {hosts.map((host, index) => (
            <HostRow
              key={host.id}
              hostKey={hostKey}
              index={index}
              total={hosts.length}
              onDuplicate={() => insert(index + 1, form.getValues(`${hostKey}.${index}` as never))}
              onRemove={() => remove(index)}
              onMove={(direction) => {
                if (direction === "up" && index > 0) move(index, index - 1);
                if (direction === "down" && index < hosts.length - 1) move(index, index + 1);
              }}
            />
          ))}
          <button
            type="button"
            className="xn-btn xn-btn-secondary"
            style={{ width: "100%", fontSize: 12.5 }}
            onClick={() => append(EMPTY_HOST as never)}
          >
            <Plus size={15} strokeWidth={1.5} />
            {t("hostsDialog.addHost")}
          </button>
        </div>
      )}
    </div>
  );
};

export const HostsDialog: FC = () => {
  const { isEditingHosts, onEditingHosts, refetchUsers } = useDashboard();
  const { isLoading, hosts, fetchHosts, isPostLoading, setHosts } = useHosts();
  const toast = useToast();
  const { t } = useTranslation();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const form = useForm({ resolver: zodResolver(hostsSchema) });

  useEffect(() => {
    if (isEditingHosts) fetchHosts();
  }, [isEditingHosts]);

  useEffect(() => {
    if (hosts && isEditingHosts) form.reset(hosts);
  }, [hosts]);

  if (!isEditingHosts) return null;

  const onClose = () => {
    setOpenSections({});
    onEditingHosts(false);
  };

  const onSubmit = (values: HostsForm) => {
    setHosts(values)
      .then(() => {
        toast({
          title: t("hostsDialog.savedSuccess"),
          status: "success",
          isClosable: true,
          position: "top",
          duration: 3000,
        });
        refetchUsers();
      })
      .catch((err) => {
        const status = err?.response?.status;
        if (status === 409 || status === 400) {
          toast({
            title: err.response?._data?.detail,
            status: "error",
            isClosable: true,
            position: "top",
            duration: 3000,
          });
        }
        if (status === 422) {
          Object.keys(err.response._data.detail).forEach((key) => {
            toast({
              title: `${err.response._data.detail[key]} (${key})`,
              status: "error",
              isClosable: true,
              position: "top",
              duration: 3000,
            });
          });
        }
      });
  };

  const inboundTags = Object.keys(hosts || {});

  return (
    <div className="xn-dialog-backdrop" onClick={onClose}>
      <div
        className="xn-dialog"
        role="dialog"
        aria-modal="true"
        style={{ width: "min(760px, 100%)", gap: 16, overflow: "hidden" }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginRight: "auto" }}>
            <h3 className="xn-heading" style={{ fontSize: 22, lineHeight: 1.1 }}>
              {t("header.hostSettings")}
            </h3>
            <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--xn-neutral-700)" }}>
              {t("hostsDialog.title")}
            </span>
          </div>
          <button className="xn-btn xn-btn-ghost" onClick={onClose} aria-label={t("close")} style={{ fontSize: 16 }}>
            ✕
          </button>
        </div>

        <VariableHelp />

        <FormProvider {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0, flex: 1 }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                overflowY: "auto",
                minHeight: 0,
                flex: 1,
                paddingRight: 4,
              }}
            >
              {isLoading && (
                <span style={{ fontSize: 12.5, color: "var(--xn-neutral-600)" }}>{t("hostsDialog.loading")}</span>
              )}
              {!isLoading && inboundTags.length === 0 && (
                <span style={{ fontSize: 12.5, color: "var(--xn-neutral-600)" }}>{t("hostsDialog.noInbounds")}</span>
              )}
              {!isLoading &&
                inboundTags.map((hostKey) => (
                  <InboundSection
                    key={hostKey}
                    hostKey={hostKey}
                    open={!!openSections[hostKey]}
                    onToggle={() => setOpenSections((current) => ({ ...current, [hostKey]: !current[hostKey] }))}
                  />
                ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="xn-btn xn-btn-secondary" onClick={onClose}>
                {t("cancel")}
              </button>
              <button type="submit" className="xn-btn xn-btn-primary" disabled={isPostLoading}>
                {isPostLoading ? t("xenith.working") : t("hostsDialog.apply")}
              </button>
            </div>
          </form>
        </FormProvider>
      </div>
    </div>
  );
};
